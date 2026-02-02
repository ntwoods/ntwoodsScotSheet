function firstUrl_(s) {
  const raw = String(s || '').trim()
  if (!raw) return ''
  return raw.split(',')[0].trim()
}

function formatTs_(tsISO) {
  const s = String(tsISO || '').trim()
  if (!s) return ''
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toLocaleString('en-IN')
  return s
}

export function OrdersPanel({ title, items, onScheduleCall }) {
  return (
    <>
      <div className="panelHeader">
        <h2>{title}</h2>
        <div className="muted">{items.length} orders</div>
      </div>
      <div className="list">
        {items.length ? (
          items.map((o, idx) => {
            const url = firstUrl_(o.orderUrl)
            return (
              <div className="orderCard" key={`${o.orderId || ''}-${idx}`}>
                <div className="orderTop">
                  <div>
                    <div className="orderTitle">{o.dealerName || '(Dealer)'}</div>
                    <div className="orderMeta">{formatTs_(o.tsISO)}</div>
                    <div className="orderMeta">{o.location || ''}</div>
                  </div>
                  <div className="orderActions">
                    <a
                      className="btn btnLight"
                      href={url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        if (!url) e.preventDefault()
                      }}
                    >
                      View
                    </a>
                    <button className="btn btnPrimary" onClick={() => onScheduleCall(o)}>
                      Schedule Call
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="muted">No orders.</div>
        )}
      </div>
    </>
  )
}
