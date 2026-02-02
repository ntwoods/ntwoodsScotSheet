import { useEffect, useMemo } from 'react'
import { ModalShell } from './ModalShell.jsx'

export function QuickOrderModal({
  onClose,
  scEmail,
  scName,
  scIdToken,
  orderPunchUrl,
  orderPunchOrigin,
  dealers,
  onOrderPunched,
}) {
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      variant: 'quick',
      fromScot: '1',
      scEmail: scEmail || '',
      scName: scName || '',
      scIdToken: scIdToken || '',
    })
    return `${orderPunchUrl}?${params.toString()}`
  }, [orderPunchUrl, scEmail, scName, scIdToken])

  useEffect(() => {
    const onMessage = (ev) => {
      if (ev.origin !== orderPunchOrigin) return
      const msg = ev.data || {}
      if (msg.type === 'ORDER_PUNCHED') onOrderPunched?.({ dealerName: msg.dealerName })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [orderPunchOrigin, onOrderPunched])

  return (
    <ModalShell title="Order Punch" onClose={onClose} actions={null}>
      <div className="hint">Submit the embedded Order Punch form. On success, OR is recorded automatically.</div>
      <div className="iframeHost" style={{ marginTop: 10 }}>
        <iframe
          title="Order Punch"
          src={iframeSrc}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={(e) => {
            try {
              e.target.contentWindow?.postMessage({ type: 'DEALERS_INIT', dealers, email: scEmail }, orderPunchOrigin)
              e.target.contentWindow?.postMessage({ type: 'USER_CONTEXT', email: scEmail, name: scName, id_token: scIdToken }, orderPunchOrigin)
            } catch (err) {
              // ignore
              void err
            }
          }}
        />
      </div>
    </ModalShell>
  )
}
