import { useEffect, useRef } from 'react'

let didInit = false

export function GoogleSignIn({ clientId, onCredential }) {
  const hostRef = useRef(null)

  useEffect(() => {
    if (!clientId) return
    if (didInit) return

    let alive = true
    const tryInit = () => {
      if (!alive) return false
      const g = window.google
      if (!g?.accounts?.id) return false

      didInit = true
      g.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => {
          const credential = resp?.credential
          if (credential) onCredential(credential)
        },
        auto_select: false,
        ux_mode: 'popup',
      })
      g.accounts.id.renderButton(hostRef.current, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill' })
      return true
    }

    if (tryInit()) return () => { alive = false }

    const t = setInterval(() => {
      if (tryInit()) clearInterval(t)
    }, 200)

    return () => {
      alive = false
      clearInterval(t)
    }
  }, [clientId, onCredential])

  return <div ref={hostRef} />
}
