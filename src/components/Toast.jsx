import { useEffect, useState } from 'react'

export function Toast({ msg }) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setOpen(false), 2200)
    return () => clearTimeout(t)
  }, [msg])

  if (!open) return null
  return <div className="toast">{msg}</div>
}
