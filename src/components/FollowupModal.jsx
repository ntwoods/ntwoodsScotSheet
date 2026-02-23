import { useEffect, useState } from 'react'
import { ModalShell } from './ModalShell.jsx'
import { SalesOrderForm } from './SalesOrderForm.jsx'

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
  dealers,
  gasBase,
  orderPostUrl,
  onClose,
  onSubmit,
  onRemarkChange,
  onOrderSubmitted,
  onToast,
}) {
  const [outcome, setOutcome] = useState('')
  const [remark, setRemark] = useState('')
  const [sfWhen, setSfWhen] = useState('')

  useEffect(() => {
    onRemarkChange?.('')
  }, [onRemarkChange])

  if (!context) return null

  const info = `Call-${context.callN} | Scheduled: ${context.callDate}`
  const actions =
    outcome && outcome !== 'OR' ? (
      <>
        <button className="btn btnLight" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btnPrimary"
          onClick={() => onSubmit({ outcome, remark, scheduleAt: sfWhen })}
          disabled={!outcome || (outcome === 'SF' && !sfWhen)}
        >
          Submit
        </button>
      </>
    ) : null

  return (
    <ModalShell title={`Follow-up for ${context.clientName}`} onClose={onClose} actions={actions}>
      <div className="field">
        <label>Outcome</label>
        <select
          value={outcome}
          onChange={(e) => {
            setOutcome(e.target.value)
          }}
        >
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
        <>
          <div className="field">
            <label>Remark (optional)</label>
            <textarea
              rows={3}
              value={remark}
              onChange={(e) => {
                setRemark(e.target.value)
                onRemarkChange?.(e.target.value)
              }}
              placeholder="Short remark..."
            />
          </div>
          <SalesOrderForm
            mode="OR"
            dealerFixedName={context.clientName}
            signedInEmail={scEmail}
            signedInName={scName}
            signedInIdToken={scIdToken}
            dealerOptions={dealers}
            scotApiBase={gasBase}
            orderPostUrl={orderPostUrl}
            onCancel={onClose}
            onToast={onToast}
            onSuccess={(result) => onOrderSubmitted?.({ ...result, remark })}
          />
        </>
      ) : null}

      {outcome === 'SF' ? (
        <div className="field">
          <label>Next Follow-up (Date & Time)</label>
          <input type="datetime-local" value={sfWhen} onChange={(e) => setSfWhen(e.target.value)} />
        </div>
      ) : null}

      {outcome && outcome !== 'OR' ? (
        <div className="field">
          <label>Remark (optional)</label>
          <textarea
            rows={4}
            value={remark}
            onChange={(e) => {
              setRemark(e.target.value)
              onRemarkChange?.(e.target.value)
            }}
            placeholder="Short remark..."
          />
        </div>
      ) : null}

      <div className="hint">{info}</div>
    </ModalShell>
  )
}
