function startOfDay_(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function monthLastDate_(d) {
  const dt = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  dt.setHours(23, 59, 59, 999)
  return dt
}

// Week windows => 1–7, 8–14, 15–21, 22–monthEnd
export function weekWindowEnd(dateObj) {
  const dd = dateObj.getDate()
  const endDay = dd <= 7 ? 7 : dd <= 14 ? 14 : dd <= 21 ? 21 : monthLastDate_(dateObj).getDate()
  return new Date(dateObj.getFullYear(), dateObj.getMonth(), endDay, 23, 59, 59, 999)
}

export function formatDHMS(ms) {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function normColor(val) {
  if (!val) return ''
  const v = String(val).trim().toLowerCase()
  if (v.startsWith('r')) return 'Red'
  if (v.startsWith('y')) return 'Yellow'
  if (v.startsWith('g')) return 'Green'
  return ''
}

export function formatDateLabel(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`)
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}

export function computeOverdueCount(items, todayISO) {
  if (!todayISO) return 0
  const today = new Date(`${todayISO}T00:00:00`)
  const today0 = startOfDay_(today)
  const now = new Date()

  return (items || []).reduce((acc, it) => {
    const sfTarget = it.sfFuture ? new Date(it.sfFuture) : null
    const sfOver = !!(sfTarget && sfTarget <= now)

    const anyPastDate = (it.dueCalls || []).some((dc) => {
      const call = new Date(`${dc.callDate}T00:00:00`)
      return call < today0
    })
    const anySFPassed = (it.dueCalls || []).some((dc) => dc.sfAt && new Date(dc.sfAt) < now)

    const anyOver = anyPastDate || anySFPassed || sfOver
    return acc + (anyOver ? 1 : 0)
  }, 0)
}
