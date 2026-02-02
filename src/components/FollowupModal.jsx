import { useEffect, useMemo, useState } from 'react'
import { ModalShell } from './ModalShell.jsx'

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
  onClose,
  onSubmit,
  onAutoMarkOR,
  onRemarkChange,
}) {
  const [outcome, setOutcome] = useState('')
  const [remark, setRemark] = useState('')
  const [sfWhen, setSfWhen] = useState('')

  useEffect(() => {
    onRemarkChange?.('')
  }, [onRemarkChange])

  const iframeSrc = useMemo(() => {
    if (!context || outcome !== 'OR') return ''

    const params = new URLSearchParams({
      fromScot: '1',
      scEmail: scEmail || '',
      scName: scName || '',
      scIdToken: scIdToken || '',
      rowIndex: String(context.rowIndex || ''),
      callN: String(context.callN || ''),
      plannedDate: String(context.callDate || ''),
      clientName: String(context.clientName || ''),
    })
    return `${orderPunchUrl}?${params.toString()}`
  }, [context, outcome, orderPunchUrl, scEmail, scName, scIdToken])

  useEffect(() => {
    if (outcome !== 'OR' || !context) return

    const onMessage = (ev) => {
      if (ev.origin !== orderPunchOrigin) return
      const msg = ev.data || {}
      if (msg.type !== 'ORDER_PUNCHED') return

      const meta = msg.meta || {}
      const metaRow = Number(meta.rowIndex || 0)
      const metaCall = Number(meta.callN || 0)
      const metaPlanned = String(meta.plannedDate || '').trim()

      if (!metaRow || metaRow !== Number(context.rowIndex)) return
      if (!metaCall || metaCall !== Number(context.callN)) return
      if (metaPlanned && context.callDate && metaPlanned !== String(context.callDate)) return

      onAutoMarkOR?.()
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [outcome, context, orderPunchOrigin, onAutoMarkOR])

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
            <iframe title="Order Punch" src={iframeSrc} loading="lazy" referrerPolicy="no-referrer" />
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
