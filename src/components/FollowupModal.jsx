import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ModalShell } from './ModalShell.jsx'

function allowedIframeOrigins_(origin) {
  const base = String(origin || '').trim()
  const out = new Set()
  if (base) out.add(base)
  // Apps Script web apps often render from googleusercontent even when embedded via script.google.com URL.
  if (base === 'https://script.google.com') out.add('https://script.googleusercontent.com')
  if (base === 'https://script.googleusercontent.com') out.add('https://script.google.com')
  return Array.from(out)
}

const OUTCOMES = [
  { value: 'OR', label: 'OR (Order Received)' },
  { value: 'SF', label: 'SF (Schedule Follow-up)' },
  { value: 'AP', label: 'AP (Already in Process)' },
  { value: 'NR', label: 'NR (No Requirement)' },
  { value: 'AI', label: 'AI (Accounts Intel)' },
  { value: 'MD', label: 'MD (Owner Restricted for Call)' },
]

export function FollowupModal({
  context,
  scEmail,
  scName,
  scIdToken,
  orderPunchUrl,
  orderPunchOrigin,
  dealers,
  onClose,
  onSubmit,
  onAutoMarkOR,
  onRemarkChange,
}) {
  const [outcome, setOutcome] = useState('')
  const [remark, setRemark] = useState('')
  const [sfWhen, setSfWhen] = useState('')
  const iframeRef = useRef(null)
  const iframeOrigins = useMemo(() => allowedIframeOrigins_(orderPunchOrigin), [orderPunchOrigin])

  useEffect(() => {
    onRemarkChange?.('')
  }, [onRemarkChange])

  const iframeSrc = useMemo(() => {
    if (!context || outcome !== 'OR') return ''

    const url = new URL(orderPunchUrl, window.location.href)
    const params = url.searchParams

    // Always force quick mode for consistent dealer UX inside SCOT.
    params.set('variant', 'quick')

    params.set('fromScot', '1')
    params.set('scEmail', scEmail || '')
    params.set('scName', scName || '')
    params.set('scIdToken', scIdToken || '')
    params.set('parentOrigin', window.location.origin)

    // Attach context so the iframe can echo it back in ORDER_PUNCHED.meta.
    params.set('rowIndex', String(context.rowIndex || ''))
    params.set('callN', String(context.callN || ''))
    params.set('plannedDate', String(context.callDate || ''))
    params.set('clientName', String(context.clientName || ''))

    return url.toString()
  }, [context, outcome, orderPunchUrl, scEmail, scName, scIdToken])

  const sendIframeInit = useCallback(() => {
    if (outcome !== 'OR' || !context) return
    try {
      for (const targetOrigin of iframeOrigins) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'DEALERS_INIT', dealers: dealers || [], email: scEmail },
          targetOrigin,
        )
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'USER_CONTEXT', email: scEmail, name: scName, id_token: scIdToken },
          targetOrigin,
        )
      }
    } catch (err) {
      // ignore
      void err
    }
  }, [context, dealers, iframeOrigins, outcome, scEmail, scIdToken, scName])

  useEffect(() => {
    if (outcome !== 'OR' || !context) return

    const onMessage = (ev) => {
      if (!iframeOrigins.includes(ev.origin)) return
      const msg = ev.data || {}
      if (msg.type !== 'ORDER_PUNCHED' && msg.type !== 'SUCCESS') return

      const payload = msg.payload || msg
      const meta = payload.meta || {}
      const metaRow = Number(meta.rowIndex || 0)
      const metaCall = Number(meta.callN || 0)
      const metaPlanned = String(meta.plannedDate || '').trim()

      // Backwards/forwards compatible: if meta is missing, still accept the success signal
      // (we only render this iframe for a single client context at a time).
      if (metaRow && metaRow !== Number(context.rowIndex)) return
      if (metaCall && metaCall !== Number(context.callN)) return
      if (metaPlanned && context.callDate && metaPlanned !== String(context.callDate)) return

      onAutoMarkOR?.()
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [outcome, context, iframeOrigins, onAutoMarkOR])

  useEffect(() => {
    // If dealers arrive after the iframe loads, re-send init.
    if (outcome !== 'OR' || !context) return
    sendIframeInit()
  }, [outcome, context, sendIframeInit])

  if (!context) return null

  const info = `Call-${context.callN} | Scheduled: ${context.callDate}`

  const actions = (
    <>
      <button className="btn btnLight" onClick={onClose}>
        Cancel
      </button>
      <button
        className="btn btnPrimary"
        onClick={() => onSubmit({ outcome, remark, scheduleAt: sfWhen })}
        disabled={!outcome || outcome === 'OR' || (outcome === 'SF' && !sfWhen)}
        title={outcome === 'OR' ? 'Submit inside the embedded Order Punch form' : undefined}
      >
        Submit
      </button>
    </>
  )

  return (
    <ModalShell title={`Follow-up for ${context.clientName}`} onClose={onClose} actions={actions}>
      <div className="field">
        <label>Outcome</label>
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="" disabled>
            Select an option
          </option>
          {OUTCOMES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {outcome === 'OR' ? (
          <div className="field">
            <label>Order Punch</label>
            <div className="hint">Submit the embedded form below. On success, OR is recorded automatically.</div>
            <div className="iframeHost" style={{ marginTop: 10 }}>
              <iframe
                ref={iframeRef}
                title="Order Punch"
                src={iframeSrc}
                loading="lazy"
                referrerPolicy="no-referrer"
                onLoad={sendIframeInit}
              />
            </div>
          </div>
      ) : null}

      {outcome === 'SF' ? (
        <div className="field">
          <label>Next Follow-up (Date & Time)</label>
          <input type="datetime-local" value={sfWhen} onChange={(e) => setSfWhen(e.target.value)} />
        </div>
      ) : null}

      <div className="field">
        <label>Remark (optional)</label>
        <textarea
          rows={4}
          value={remark}
          onChange={(e) => {
            setRemark(e.target.value)
            onRemarkChange?.(e.target.value)
          }}
          placeholder="Short remark…"
        />
      </div>

      <div className="hint">{info}</div>
    </ModalShell>
  )
}
