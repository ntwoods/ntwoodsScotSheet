import { parseOrderUrls } from '../lib/orderUrls.js'

function formatTs_(tsISO) {
  const s = String(tsISO || '').trim()
  if (!s) return ''
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toLocaleString('en-IN')
  return s
}

function openExternal_(url) {
  if (!url) return false
  const win = window.open(url, '_blank', 'noopener,noreferrer')
  if (win) win.opener = null
  return !!win
}

export function OrdersPanel({ title, items, onScheduleCall, onNotify }) {
  return (
    <>
      <div className="panelHeader">
        <h2>{title}</h2>
        <div className="muted">{items.length} orders</div>
      </div>
      <div className="list">
        {items.length ? (
          items.map((o, idx) => {
            const urls = parseOrderUrls(o.orderUrl)
            return (
              <div className="orderCard" key={`${o.orderId || ''}-${idx}`}>
                <div className="orderTop">
                  <div>
                    <div className="orderTitle">{o.dealerName || '(Dealer)'}</div>
                    <div className="orderMeta">{formatTs_(o.tsISO)}</div>
                    <div className="orderMeta">{o.location || ''}</div>
                  </div>
                  <div className="orderActions">
                    {urls.length ? (
                      urls.map((url, urlIdx) => (
                        <button
                          key={`${o.orderId || idx}-${urlIdx}`}
                          className="btn btnLight"
                          onClick={() => {
                            const ok = openExternal_(url)
                            if (!ok) onNotify?.('Popup blocked. Please allow popups for this site.')
                          }}
                        >
                          {urls.length > 1 ? `View ${urlIdx + 1}` : 'View'}
                        </button>
                      ))
                    ) : (
                      <button className="btn btnLight" disabled>
                        View
                      </button>
                    )}

                    {urls.length > 1 ? (
                      <button
                        className="btn btnLight"
                        onClick={() => {
                          let blocked = 0
                          urls.forEach((url, i) => {
                            window.setTimeout(() => {
                              const ok = openExternal_(url)
                              if (!ok) blocked += 1
                              if (i === urls.length - 1 && blocked > 0) {
                                onNotify?.('Some tabs were blocked. Allow popups, then retry Open All.')
                              }
                            }, i * 140)
                          })
                        }}
                      >
                        Open All
                      </button>
                    ) : null}

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
