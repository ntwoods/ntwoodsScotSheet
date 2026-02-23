const DEFAULT_ORDER_POST_URL =
  'https://script.google.com/macros/s/AKfycbwX0DUbZ6e09l2MrPXibpxd1q8p17CanQegtHCTjmEcpA_zJOyBbt5iXDQKXIIrPEbqIw/exec'

function fileToBase64_(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const raw = String(reader.result || '')
      const idx = raw.indexOf(',')
      resolve(idx >= 0 ? raw.slice(idx + 1) : raw)
    }
    reader.onerror = () => reject(new Error(`Could not read file: ${file?.name || 'unknown'}`))
    reader.readAsDataURL(file)
  })
}

export async function filesToOrderPayload_(files) {
  const list = Array.isArray(files) ? files : Array.from(files || [])
  const out = []
  for (const file of list) {
    const data = await fileToBase64_(file)
    out.push({
      name: String(file?.name || ''),
      type: String(file?.type || ''),
      data,
    })
  }
  return out
}

export async function submitSalesOrder({
  orderPostUrl = DEFAULT_ORDER_POST_URL,
  payload,
  origin,
  signal,
} = {}) {
  const endpoint = String(orderPostUrl || '').trim() || DEFAULT_ORDER_POST_URL
  const reqOrigin = String(origin || window.location.origin || '').trim()
  const sep = endpoint.includes('?') ? '&' : '?'
  const url = `${endpoint}${sep}origin=${encodeURIComponent(reqOrigin)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload || {}),
    signal,
  })

  let json = null
  try {
    json = await res.json()
  } catch {
    // ignore, handled below
  }

  if (!res.ok) throw new Error((json && json.error) || `HTTP ${res.status}`)
  if (!json || !json.ok) throw new Error((json && json.error) || 'Order submit failed')
  return json
}

export { DEFAULT_ORDER_POST_URL }
