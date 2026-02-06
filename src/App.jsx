import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleSignIn } from './components/GoogleSignIn.jsx'
import { DueCard } from './components/DueCard.jsx'
import { FollowupModal } from './components/FollowupModal.jsx'
import { OrdersPanel } from './components/OrdersPanel.jsx'
import { QuickOrderModal } from './components/QuickOrderModal.jsx'
import { ScheduleCallDialog } from './components/ScheduleCallDialog.jsx'
import { LoaderOverlay } from './components/LoaderOverlay.jsx'
import { Toast } from './components/Toast.jsx'
import {
  getDue,
  getMe,
  getOrderCycleSummary,
  getRowByDealer,
  getScotDealers,
  getSfRemarks,
  postMarkNoCors,
} from './lib/scotApi.js'
import { computeOverdueCount, formatDateLabel } from './lib/date.js'

const CFG = {
  clientId: import.meta.env.VITE_CLIENT_ID,
  gasBase: import.meta.env.VITE_SCOT_GAS_BASE,
  orderPunchUrl: import.meta.env.VITE_ORDER_PUNCH_URL || 'https://ntwoods.github.io/ordertodispatch/orderPunch.html',
}

const DEBUG = (() => {
  try {
    return new URLSearchParams(window.location.search).has('debug')
  } catch {
    return false
  }
})()

function pickArray_(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k]
    if (Array.isArray(v)) return v
  }
  return []
}

function pad2_(n) {
  return String(n).padStart(2, '0')
}

function dateIsoLocal_(d) {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${pad2_(dt.getMonth() + 1)}-${pad2_(dt.getDate())}`
}

function computeAutoFollowup_(todayISO, { days }) {
  const now = new Date()
  let base = now

  const s = String(todayISO || '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m) {
    base = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), now.getHours(), now.getMinutes(), 0, 0)
  }

  const scheduleAt = new Date(base)
  scheduleAt.setDate(scheduleAt.getDate() + Number(days || 0))

  return {
    plannedDateISO: dateIsoLocal_(scheduleAt),
    scheduleAtISO: scheduleAt.toISOString(),
  }
}

function parseJwtPayload_(token) {
  try {
    const parts = String(token || '').split('.')
    if (parts.length < 2) return null
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const json = atob(padded)
    return JSON.parse(json)
  } catch {
    return null
  }
}

function mergeUniqueByRowIndex_(base, extra) {
  const a = Array.isArray(base) ? base : []
  const b = Array.isArray(extra) ? extra : []
  if (!b.length) return a

  const seen = new Set(a.map((x) => x?.rowIndex))
  const out = a.slice()
  for (const it of b) {
    const k = it?.rowIndex
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(it)
  }
  return out
}

export default function App() {
  const [idToken, setIdToken] = useState('')
  const [user, setUser] = useState(null)
  const [blocking, setBlocking] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState(null)
  const [lastSyncError, setLastSyncError] = useState('')
  const [debugPayload, setDebugPayload] = useState(null)

  const [todayISO, setTodayISO] = useState('')
  const [dueItems, setDueItems] = useState([])
  const [ordersReceived, setOrdersReceived] = useState([])
  const [ordersInProcess, setOrdersInProcess] = useState([])
  const [scotDealers, setScotDealers] = useState([])

  const [followup, setFollowup] = useState({ open: false, context: null })
  const [quickOrderOpen, setQuickOrderOpen] = useState(false)
  const [schedule, setSchedule] = useState({ open: false, order: null })

  const followupRemarkRef = useRef('')
  const loadAbortRef = useRef(null)
  const loadInflightRef = useRef(null)
  const loadReqRef = useRef(0)
  const lastFullOrdersAtRef = useRef(0)

  const orderPunchOrigin = useMemo(() => {
    try {
      return new URL(CFG.orderPunchUrl).origin
    } catch {
      return 'https://ntwoods.github.io'
    }
  }, [])

  const overdueCount = useMemo(() => computeOverdueCount(dueItems, todayISO), [dueItems, todayISO])

  const showToast = useCallback((msg) => {
    setToast({ msg, id: Date.now() })
  }, [])

  const loadAll = useCallback(
    async ({ silent, fresh, initial, token } = {}) => {
      const tkn = token || idToken
      if (!tkn) return

      if (loadInflightRef.current && !fresh && !initial) return loadInflightRef.current

      try {
        loadAbortRef.current?.abort()
      } catch {
        // ignore
      }

      const controller = new AbortController()
      loadAbortRef.current = controller
      const reqId = Date.now()
      loadReqRef.current = reqId

      if (!silent) setSyncing(true)

      const p = (async () => {
        const t0 = performance.now()

        // 1) Fetch DUE first to unblock LCP ASAP, and to warm server-side token cache.
        let due
        try {
          due = await getDue(CFG.gasBase, tkn, {
            signal: controller.signal,
            fresh,
            limit: initial ? 12 : undefined,
            cursor: undefined,
          })
        } catch (e) {
          if (DEBUG) console.debug('[SCOT] due fetch failed', e)
          throw e
        }

        if (loadReqRef.current === reqId) {
          setLastSyncError('')
          setTodayISO(due?.today || due?.todayISO || '')
          setDueItems(pickArray_(due, ['items', 'dueItems', 'due_items']))
        }

        // If we only fetched the initial page, fill remaining due items in the background (non-blocking).
        if (initial && Number(due?.nextCursor || 0) > 0) {
          const startCursor = Number(due.nextCursor || 0)
          void (async () => {
            let cursor = startCursor
            const pageLimit = 60
            while (cursor) {
              const page = await getDue(CFG.gasBase, tkn, {
                signal: controller.signal,
                fresh,
                limit: pageLimit,
                cursor,
              })
              if (loadReqRef.current !== reqId) return
              const items = pickArray_(page, ['items', 'dueItems', 'due_items'])
              if (items.length) setDueItems((prev) => mergeUniqueByRowIndex_(prev, items))
              cursor = Number(page?.nextCursor || 0)
            }
          })().catch(() => {})
        }

        // 2) Fetch orders after due (not gating initial paint).
        try {
          const orderSummary = await getOrderCycleSummary(CFG.gasBase, tkn, {
            signal: controller.signal,
            // Prefer fast window to paint orders quickly; fetch full occasionally in background.
            fast: true,
            windowRows: 2500,
            // Avoid forcing nocache for fast calls (helps cold-ish loads too).
            fresh: false,
          })
          if (loadReqRef.current === reqId) {
            setOrdersReceived(pickArray_(orderSummary, ['received', 'ordersReceived', 'orders_received']))
            setOrdersInProcess(pickArray_(orderSummary, ['inProcess', 'in_process', 'ordersInProcess', 'orders_in_process']))
          }

          if (DEBUG && loadReqRef.current === reqId) {
            setDebugPayload({ at: new Date().toISOString(), due, orderSummary })
            console.debug('[SCOT] loadAll()', { due, orderSummary, ms: Math.round(performance.now() - t0) })
          }

          // Background full refresh (correctness): on initial load, or every ~5 min.
          const now = Date.now()
          const needFull = initial || now - (lastFullOrdersAtRef.current || 0) > 5 * 60 * 1000
          if (needFull) {
            void getOrderCycleSummary(CFG.gasBase, tkn, {
              signal: controller.signal,
              fresh,
            })
              .then((full) => {
                if (loadReqRef.current !== reqId) return
                setOrdersReceived(pickArray_(full, ['received', 'ordersReceived', 'orders_received']))
                setOrdersInProcess(pickArray_(full, ['inProcess', 'in_process', 'ordersInProcess', 'orders_in_process']))
                lastFullOrdersAtRef.current = now
              })
              .catch(() => {})
          }
        } catch (e) {
          if (DEBUG) console.debug('[SCOT] orderCycleSummary fetch failed', e)
        }
      })()

      loadInflightRef.current = p

      try {
        await p
      } catch (e) {
        const isAbort = e?.name === 'AbortError' || String(e?.message || '').toLowerCase().includes('aborted')
        if (isAbort) return
        const msg = e?.message || 'Sync failed'
        if (loadReqRef.current === reqId) setLastSyncError(msg)
        if (!silent) showToast(msg)
      } finally {
        if (loadInflightRef.current === p) loadInflightRef.current = null
        if (loadAbortRef.current === controller) loadAbortRef.current = null

        if (!silent && loadReqRef.current === reqId) setSyncing(false)
      }
    },
    [idToken, showToast],
  )

  useEffect(() => {
    if (!idToken || !user) return
    if (followup.open || quickOrderOpen || schedule.open) return
    const t = setInterval(() => {
      loadAll({ silent: true }).catch(() => {})
    }, 30_000)
    return () => clearInterval(t)
  }, [idToken, user, followup.open, quickOrderOpen, schedule.open, loadAll])

  const handleCredential = useCallback(
    async (credential) => {
      setIdToken(credential)
      setBlocking(false)
      try {
        const payload = parseJwtPayload_(credential) || {}
        const guessedUser = payload?.email
          ? { email: payload.email, name: payload.name || '', picture: payload.picture || '' }
          : null

        if (guessedUser) setUser(guessedUser)
        else {
          // Fallback to server whoami (rare: malformed token)
          const who = await getMe(CFG.gasBase, credential)
          setUser(who.user)
        }

        // Fast-first initial fetch: due first (LCP), then orders; dealers can load after.
        await loadAll({ fresh: true, initial: true, token: credential })

        const email = guessedUser?.email || payload?.email || ''
        if (email) {
          getScotDealers(CFG.gasBase, email)
            .then((dealers) => setScotDealers(dealers.dealers || []))
            .catch(() => {})
        }
      } catch (e) {
        setIdToken('')
        setUser(null)
        showToast(e?.message || 'Login failed')
      } finally {
        setBlocking(false)
      }
    },
    [loadAll, showToast],
  )

  const signOut = useCallback(() => {
    try {
      window.google?.accounts?.id?.disableAutoSelect()
    } catch (e) {
      // ignore
      void e
    }
    try {
      loadAbortRef.current?.abort()
    } catch {
      // ignore
    }
    loadAbortRef.current = null
    loadInflightRef.current = null
    loadReqRef.current = 0

    setIdToken('')
    setUser(null)
    setLastSyncError('')
    setDebugPayload(null)
    setDueItems([])
    setOrdersReceived([])
    setOrdersInProcess([])
    setScotDealers([])
    setFollowup({ open: false, context: null })
    setQuickOrderOpen(false)
    setSchedule({ open: false, order: null })
    setBlocking(false)
    setSyncing(false)
  }, [])

  const openFollowup = useCallback(
    (item, dueCall) => {
      const ctx = {
        rowIndex: item.rowIndex,
        callN: dueCall.callN,
        clientName: item.clientName,
        callDate: dueCall.callDate,
        dateISO: todayISO,
      }
      followupRemarkRef.current = ''
      setFollowup({ open: true, context: ctx })
    },
    [todayISO],
  )

  const closeFollowup = useCallback(() => setFollowup({ open: false, context: null }), [])

  const handleMark = useCallback(
    async ({ outcome, remark, scheduleAt }) => {
      const ctx = followup.context
      if (!ctx) return
      if (!outcome) return

      setBlocking(true)
      try {
        const payload = {
          rowIndex: ctx.rowIndex,
          date: ctx.dateISO,
          outcome,
          remark: remark || '',
          callN: ctx.callN,
          plannedDate: ctx.callDate || ctx.dateISO,
        }
        if (outcome === 'SF') payload.scheduleAt = scheduleAt

        await postMarkNoCors(CFG.gasBase, { path: 'mark', id_token: idToken, ...payload })
        showToast(`Saved: ${outcome}`)
        closeFollowup()
        await loadAll({ fresh: true })
      } catch (e) {
        showToast(e?.message || 'Could not save')
      } finally {
        setBlocking(false)
      }
    },
    [followup.context, idToken, closeFollowup, loadAll, showToast],
  )

  const handleAutoMarkOR = useCallback(async () => {
    const ctx = followup.context
    if (!ctx) return
    setBlocking(true)
    try {
      const remark = followupRemarkRef.current || ''
      const payload = {
        rowIndex: ctx.rowIndex,
        date: ctx.dateISO,
        outcome: 'OR',
        remark,
        callN: ctx.callN,
        plannedDate: ctx.callDate || ctx.dateISO,
      }
      await postMarkNoCors(CFG.gasBase, { path: 'mark', id_token: idToken, ...payload })
      showToast('Saved: OR')
      closeFollowup()
      await loadAll({ fresh: true })
    } catch (e) {
      showToast(e?.message || 'Could not record OR')
    } finally {
      setBlocking(false)
    }
  }, [followup.context, idToken, closeFollowup, loadAll, showToast])

  const handleQuickOrderPunched = useCallback(
    async ({ dealerName }) => {
      if (!user?.email || !dealerName) return
      setBlocking(true)
      try {
        const row = await getRowByDealer(CFG.gasBase, idToken, user.email, dealerName)
        const nowISO = todayISO || new Date().toISOString().slice(0, 10)
        await postMarkNoCors(CFG.gasBase, {
          path: 'mark',
          id_token: idToken,
          rowIndex: row.rowIndex,
          date: nowISO,
          outcome: 'OR',
          remark: 'Quick Order',
          callN: 0,
          plannedDate: nowISO,
        })
        showToast('Order saved. Follow-ups updated.')
        setQuickOrderOpen(false)
        await loadAll({ fresh: true })
      } catch (e) {
        showToast(e?.message || 'Could not auto-update')
      } finally {
        setBlocking(false)
      }
    },
    [idToken, user?.email, todayISO, loadAll, showToast],
  )

  const openSchedule = useCallback((order) => setSchedule({ open: true, order }), [])
  const closeSchedule = useCallback(() => setSchedule({ open: false, order: null }), [])

  const handleScheduleSubmit = useCallback(
    async ({ dealerName }) => {
      if (!user?.email) return
      setBlocking(true)
      try {
        const row = await getRowByDealer(CFG.gasBase, idToken, user.email, dealerName, { includeCalls: true })
        const callSlots = Array.isArray(row.callSlots) ? row.callSlots : []

        let callN = 4
        for (let i = 0; i < 4; i++) {
          const v = String(callSlots[i] || '').trim()
          if (!v) {
            callN = i + 1
            break
          }
        }

        const remark = `Scheduled from OrderCycle (orderId=${schedule.order?.orderId || ''})`
        const nowISO = todayISO || dateIsoLocal_(new Date())
        const { plannedDateISO, scheduleAtISO } = computeAutoFollowup_(todayISO, { days: 15 })

        await postMarkNoCors(CFG.gasBase, {
          path: 'mark',
          id_token: idToken,
          rowIndex: row.rowIndex,
          date: nowISO,
          outcome: 'SF',
          remark,
          callN,
          plannedDate: plannedDateISO,
          scheduleAt: scheduleAtISO,
        })

        showToast('Follow-up scheduled (+15 days)')
        closeSchedule()
        await loadAll({ fresh: true })
      } catch (e) {
        showToast(e?.message || 'Could not schedule call')
      } finally {
        setBlocking(false)
      }
    },
    [idToken, user?.email, schedule.order, todayISO, closeSchedule, loadAll, showToast],
  )

  const fetchSfRemarks = useCallback((clientName) => getSfRemarks(CFG.gasBase, idToken, clientName), [idToken])

  if (!user) {
    return (
      <div className="appShell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div className="panel" style={{ minHeight: 'auto', width: 'min(520px, 96vw)' }}>
          <div className="panelHeader">
            <div>
              <h2>Sales Coordinator Login</h2>
              <div className="muted">Sign in with your NT Woods Google account to continue.</div>
            </div>
          </div>
          <div style={{ padding: 14 }}>
            <GoogleSignIn clientId={CFG.clientId} onCredential={handleCredential} />
          </div>
        </div>
        {blocking ? <LoaderOverlay /> : null}
        {toast ? <Toast msg={toast.msg} /> : null}
      </div>
    )
  }

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="logo">NT</div>
          <div className="title">
            <h1>SCOT Portal</h1>
            <div className="muted">{todayISO ? formatDateLabel(todayISO) : ''}</div>
          </div>
        </div>

        <div className="topbarRight">
          <div className="badge">
            <span>{dueItems.length}</span> Due
          </div>
          <div className="badge">
            <span style={{ color: overdueCount ? 'var(--danger)' : 'inherit' }}>{overdueCount}</span> Overdue
          </div>
          {syncing ? <div className="muted" style={{ fontWeight: 800, fontSize: 12 }}>Syncing…</div> : null}
          <button className="btn btnLight" onClick={() => setQuickOrderOpen(true)}>
            New Order
          </button>
          <div className="profile">
            <img className="avatar" src={user.picture || ''} alt="" />
            <div className="email" title={user.email}>
              {user.email}
            </div>
            <button className="btn btnLight" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {lastSyncError ? (
        <div className="panel" style={{ margin: '12px 0', padding: 12, borderLeft: '4px solid var(--danger)' }}>
          <div style={{ fontWeight: 800 }}>Sync error</div>
          <div className="muted" style={{ marginTop: 4 }}>
            {lastSyncError}
          </div>
        </div>
      ) : null}

      <div className="layout">
        <section className="panel">
          <div className="panelHeader">
            <h2>Due Follow-ups</h2>
            <div className="muted">Auto-refresh every 30s</div>
          </div>
          <div className="dueGrid">
            {dueItems.length ? (
              dueItems.map((it) => (
                <DueCard
                  key={it.rowIndex}
                  item={it}
                  todayISO={todayISO}
                  onOpenCall={(dc) => openFollowup(it, dc)}
                  fetchSfRemarks={fetchSfRemarks}
                />
              ))
            ) : (
              <div className="muted" style={{ padding: 8 }}>
                No active follow-ups.
              </div>
            )}
          </div>
        </section>

        <div className="rightColumn">
          <div className="panel rightSection">
            <OrdersPanel title="Orders Received" items={ordersReceived} onScheduleCall={openSchedule} />
          </div>
          <div className="panel rightSection big">
            <OrdersPanel title="Orders in Process" items={ordersInProcess} onScheduleCall={openSchedule} />
          </div>
          {DEBUG ? (
            <details className="panel" style={{ marginTop: 12, padding: 12 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 800 }}>Debug</summary>
              <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(
                  {
                    user: { email: user?.email, name: user?.name },
                    cfg: { gasBase: CFG.gasBase, orderPunchUrl: CFG.orderPunchUrl },
                    counts: {
                      due: dueItems.length,
                      received: ordersReceived.length,
                      inProcess: ordersInProcess.length,
                      dealers: scotDealers.length,
                    },
                    lastSyncError: lastSyncError || null,
                    lastPayload: debugPayload,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          ) : null}
        </div>
      </div>

      {followup.open ? (
        <FollowupModal
          context={followup.context}
          scEmail={user.email}
          scName={user.name}
          scIdToken={idToken}
          orderPunchUrl={CFG.orderPunchUrl}
          orderPunchOrigin={orderPunchOrigin}
          onClose={closeFollowup}
          onSubmit={handleMark}
          onAutoMarkOR={handleAutoMarkOR}
          onRemarkChange={(v) => {
            followupRemarkRef.current = v
          }}
        />
      ) : null}

      {quickOrderOpen ? (
        <QuickOrderModal
          onClose={() => setQuickOrderOpen(false)}
          scEmail={user.email}
          scName={user.name}
          scIdToken={idToken}
          orderPunchUrl={CFG.orderPunchUrl}
          orderPunchOrigin={orderPunchOrigin}
          dealers={scotDealers}
          onOrderPunched={handleQuickOrderPunched}
        />
      ) : null}

      {schedule.open ? (
        <ScheduleCallDialog
          order={schedule.order}
          dealers={scotDealers}
          onClose={closeSchedule}
          onSubmit={handleScheduleSubmit}
        />
      ) : null}

      {blocking ? <LoaderOverlay /> : null}
      {toast ? <Toast key={toast.id} msg={toast.msg} /> : null}
    </div>
  )
}
