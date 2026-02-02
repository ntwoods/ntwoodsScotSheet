import { useMemo, useState } from 'react'
import { ModalShell } from './ModalShell.jsx'

function inList_(dealers, name) {
  const n = String(name || '').trim().toLowerCase()
  return (dealers || []).some((d) => String(d || '').trim().toLowerCase() === n)
}

export function ScheduleCallDialog({ order, dealers, onClose, onSubmit }) {
  const [dealerName, setDealerName] = useState(() =>
    inList_(dealers, order?.dealerName) ? String(order?.dealerName || '') : '',
  )

  const dealerOptions = useMemo(
    () => (dealers || []).slice().sort((a, b) => String(a).localeCompare(String(b))),
    [dealers],
  )

  const actions = (
    <>
      <button className="btn btnLight" onClick={onClose}>
        Cancel
      </button>
      <button className="btn btnPrimary" onClick={() => onSubmit({ dealerName })} disabled={!dealerName}>
        Create Follow-up
      </button>
    </>
  )

  return (
    <ModalShell title="Schedule Call" onClose={onClose} actions={actions} width="min(680px, 96vw)">
      <div className="field">
        <label>Order Dealer</label>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{order?.dealerName || '(unknown)'}</div>
      </div>

      <div className="field">
        <label>Dealer Name (SCOT)</label>
        <select value={dealerName} onChange={(e) => setDealerName(e.target.value)}>
          <option value="">Select dealer…</option>
          {dealerOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <div className="hint">This dropdown is filtered for your SCOT login.</div>
        <div className="hint">A follow-up will be created automatically after 15 days.</div>
      </div>

    </ModalShell>
  )
}
