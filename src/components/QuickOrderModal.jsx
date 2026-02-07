import { useCallback, useEffect, useMemo, useRef } from 'react'
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
  const iframeOrigins = useMemo(() => allowedIframeOrigins_(orderPunchOrigin), [orderPunchOrigin])

  const iframeSrc = useMemo(() => {
    const url = new URL(orderPunchUrl, window.location.href)
    const params = url.searchParams
    params.set('variant', 'quick')
    params.set('fromScot', '1')
    params.set('scEmail', scEmail || '')
    params.set('scName', scName || '')
    params.set('scIdToken', scIdToken || '')
    params.set('parentOrigin', window.location.origin)
    return url.toString()
  }, [orderPunchUrl, scEmail, scName, scIdToken])

  const sendIframeInit = useCallback(() => {
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
  }, [dealers, iframeOrigins, scEmail, scIdToken, scName])

  useEffect(() => {
    const onMessage = (ev) => {
      if (!iframeOrigins.includes(ev.origin)) return
      const msg = ev.data || {}
      if (msg.type !== 'ORDER_PUNCHED' && msg.type !== 'SUCCESS') return

      const payload = msg.payload || msg
      const dealerName = String(payload.dealerName || '').trim()
      onClose?.()
      if (dealerName) onOrderPunched?.({ dealerName })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [iframeOrigins, onClose, onOrderPunched])

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
