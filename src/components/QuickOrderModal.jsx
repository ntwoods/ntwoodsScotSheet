import { useCallback, useEffect, useMemo, useRef } from 'react'
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
  const iframeRef = useRef(null)

  const iframeSrc = useMemo(() => {
    const url = new URL(orderPunchUrl, window.location.href)
    const params = url.searchParams
    params.set('variant', 'quick')
    params.set('fromScot', '1')
    params.set('scEmail', scEmail || '')
    params.set('scName', scName || '')
    params.set('scIdToken', scIdToken || '')
    return url.toString()
  }, [orderPunchUrl, scEmail, scName, scIdToken])

  const sendIframeInit = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.postMessage({ type: 'DEALERS_INIT', dealers: dealers || [], email: scEmail }, orderPunchOrigin)
      iframeRef.current?.contentWindow?.postMessage({ type: 'USER_CONTEXT', email: scEmail, name: scName, id_token: scIdToken }, orderPunchOrigin)
    } catch (err) {
      // ignore
      void err
    }
  }, [dealers, orderPunchOrigin, scEmail, scIdToken, scName])

  useEffect(() => {
    const onMessage = (ev) => {
      if (ev.origin !== orderPunchOrigin) return
      const msg = ev.data || {}
      if (msg.type !== 'ORDER_PUNCHED' && msg.type !== 'SUCCESS') return

      const payload = msg.payload || msg
      const dealerName = String(payload.dealerName || '').trim()
      onClose?.()
      if (dealerName) onOrderPunched?.({ dealerName })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onClose, orderPunchOrigin, onOrderPunched])

  useEffect(() => {
    // If dealers arrive after the iframe loads, re-send init.
    sendIframeInit()
  }, [sendIframeInit])

  return (
    <ModalShell title="Order Punch" onClose={onClose} actions={null}>
      <div className="hint">Submit the embedded Order Punch form. On success, OR is recorded automatically.</div>
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
    </ModalShell>
  )
}
