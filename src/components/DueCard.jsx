import { memo, useEffect, useMemo, useState } from 'react'
import { formatDHMS, normColor, weekWindowEnd } from '../lib/date.js'

function colorHex_(c) {
  if (c === 'Red') return '#ef4444'
  if (c === 'Yellow') return '#f59e0b'
  if (c === 'Green') return '#10b981'
  return '#94a3b8'
}

function formatSFDate_(iso) {
  const d = new Date(iso)
  return d
    .toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    .replace(',', '')
}

export const DueCard = memo(function DueCard({ item, todayISO, onOpenCall, fetchSfRemarks }) {
  const [remarksOpen, setRemarksOpen] = useState(false)
  const [sfRemarks, setSfRemarks] = useState(null)
  const [remarksLoading, setRemarksLoading] = useState(false)
  const [countdown, setCountdown] = useState('')
  const [countdownOverdue, setCountdownOverdue] = useState(false)

  const color = useMemo(() => normColor(item.clientColor), [item.clientColor])
  const dot = useMemo(() => colorHex_(color), [color])

  const overdue = useMemo(() => {
    if (!todayISO) return false
    const today0 = new Date(`${todayISO}T00:00:00`)
    const now = new Date()

    const anyPastDate = (item.dueCalls || []).some((dc) => new Date(`${dc.callDate}T00:00:00`) < today0)
    const anySFPassed = (item.dueCalls || []).some((dc) => dc.sfAt && new Date(dc.sfAt) < now)
    const sfTarget = item.sfFuture ? new Date(item.sfFuture) : null
    const sfOver = !!(sfTarget && sfTarget <= now)
    return anyPastDate || anySFPassed || sfOver
  }, [item.dueCalls, item.sfFuture, todayISO])

  useEffect(() => {
    if (!item.sfFuture) {
      setCountdown('')
      setCountdownOverdue(false)
      return
    }
    const target = new Date(item.sfFuture)
    const tick = () => {
      const diff = target - new Date()
      if (diff <= 0) {
        setCountdown('Overdue')
        setCountdownOverdue(true)
        return
      }
      setCountdown(formatDHMS(diff))
      setCountdownOverdue(false)
    }
    tick()
    // Avoid per-card 1s timers (can cause heavy main-thread work & bad perf metrics).
    const t = setInterval(tick, 5000)
    return () => clearInterval(t)
  }, [item.sfFuture])

  const toggleRemarks = async () => {
    const next = !remarksOpen
    setRemarksOpen(next)
    if (!next) return
    if (sfRemarks !== null) return

    setRemarksLoading(true)
    try {
      const r = await fetchSfRemarks(item.clientName)
      setSfRemarks(r || [])
    } catch {
      setSfRemarks([])
    } finally {
      setRemarksLoading(false)
    }
  }

  const now = new Date()

  const callButtons = (item.dueCalls || []).map((dc) => {
    const dateObj = new Date(`${dc.callDate}T00:00:00`)
    const isActive = now.getTime() <= weekWindowEnd(dateObj).getTime()
    const label = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    const title = `Call-${dc.callN} (${dc.callDate})${dc.sfAt ? ` | until ${new Date(dc.sfAt).toLocaleString('en-IN')}` : ''}${isActive ? '' : ' (expired)'}`

    return (
      <button
        key={`${item.rowIndex}-${dc.callN}`}
        className="btn btnLight callBtn"
        disabled={!isActive}
        title={title}
        onClick={() => onOpenCall(dc)}
      >
        {label}
      </button>
    )
  })

  const sheet1Remark = String(item.remarkText || '').trim()
  const hasHistory = Array.isArray(sfRemarks) && sfRemarks.length > 0
  const hasAnyRemarks = !!sheet1Remark || hasHistory

  return (
    <div className={`card ${overdue ? 'overdue' : ''}`}>
      <div className="clientRow">
        <div className="clientName">{item.clientName}</div>
        <span className="colorDot" title={color} style={{ background: dot }} />
      </div>

      <div className="callsRow">
        {callButtons}
        <button className="btn btnLight callBtn" onClick={toggleRemarks}>
          {remarksOpen ? 'Hide Remarks' : 'Show Remarks'}
        </button>
      </div>

      {countdown ? <div className={`countdown ${countdownOverdue ? 'overdue' : ''}`}>{countdown}</div> : null}

      {remarksOpen ? (
        <div className="remarkPanel">
          {remarksLoading ? <div className="hint">Loading…</div> : null}
          {!remarksLoading && !hasAnyRemarks ? <div className="hint">No remarks.</div> : null}

          {sheet1Remark ? (
            <>
              <div className="remarkTitle">
                Sheet1 Remark · <strong>{item.remarkDay ? `Day ${String(item.remarkDay).padStart(2, '0')}` : 'Previous'}</strong>
              </div>
              <div className="remarkBody">{sheet1Remark}</div>
            </>
          ) : null}

          {hasHistory ? (
            <div style={{ marginTop: sheet1Remark ? 10 : 0 }}>
              <div className="remarkTitle">SF Follow-up History</div>
              {sfRemarks.map((r, idx) => (
                <div key={idx} className="remarkBody" style={{ marginBottom: 10 }}>
                  <strong>{formatSFDate_(r.ts)}</strong>
                  <div>{String(r.remark || '(no remark)').trim()}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
})
