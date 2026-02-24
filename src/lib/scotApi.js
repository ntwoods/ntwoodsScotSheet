function assertCfg_(gasBase, idToken) {
  if (!gasBase) throw new Error('Missing VITE_SCOT_GAS_BASE')
  if (!idToken) throw new Error('Missing id_token')
}

const inflightGet_ = new Map()

function abortable_(signal, timeoutMs) {
  const controller = new AbortController()
  let t = null

  const onAbort = () => {
    try {
      controller.abort(signal?.reason)
    } catch {
      controller.abort()
    }
  }

  if (signal) {
    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  }

  const ms = Number(timeoutMs || 0)
  if (ms > 0) t = setTimeout(() => controller.abort(new Error('Timeout')), ms)

  return {
    signal: controller.signal,
    cleanup: () => {
      if (t) clearTimeout(t)
      if (signal) signal.removeEventListener?.('abort', onAbort)
    },
  }
}

async function jsonGet_(url, { signal, timeoutMs = 15_000, dedupe = true } = {}) {
  const key = String(url || '')
  const canDedupe = dedupe && !signal
  if (canDedupe && inflightGet_.has(key)) return inflightGet_.get(key)

  const p = (async () => {
    const { signal: sig, cleanup } = abortable_(signal, timeoutMs)
    try {
      const res = await fetch(url, { signal: sig })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json || !json.ok) throw new Error((json && json.error) || 'Request failed')
      return json
    } finally {
      cleanup()
    }
  })()

  if (canDedupe) {
    inflightGet_.set(
      key,
      p.finally(() => {
        inflightGet_.delete(key)
      }),
    )
    return inflightGet_.get(key)
  }

  return p
}

export async function getMe(gasBase, idToken, { signal, timeoutMs } = {}) {
  assertCfg_(gasBase, idToken)
  const url = `${gasBase}?path=me&id_token=${encodeURIComponent(idToken)}`
  return jsonGet_(url, { signal, timeoutMs })
}

export async function getDue(gasBase, idToken, { signal, timeoutMs, fresh, limit, cursor } = {}) {
  assertCfg_(gasBase, idToken)
  const params = new URLSearchParams({
    path: 'due',
    id_token: idToken,
  })
  if (fresh) params.set('fresh', '1')
  if (Number.isFinite(Number(limit)) && Number(limit) > 0) params.set('limit', String(Number(limit)))
  if (Number.isFinite(Number(cursor)) && Number(cursor) > 0) params.set('cursor', String(Number(cursor)))
  const url = `${gasBase}?${params.toString()}`
  return jsonGet_(url, { signal, timeoutMs })
}

export async function getSfRemarks(gasBase, idToken, clientName, { signal, timeoutMs } = {}) {
  assertCfg_(gasBase, idToken)
  const url = `${gasBase}?path=sfRemarks&client=${encodeURIComponent(clientName)}&id_token=${encodeURIComponent(idToken)}`
  const json = await jsonGet_(url, { signal, timeoutMs })
  return json.remarks || []
}

export async function getOrderCycleSummary(
  gasBase,
  idToken,
  { signal, timeoutMs, fresh, fast, windowRows } = {},
) {
  assertCfg_(gasBase, idToken)
  const params = new URLSearchParams({
    path: 'orderCycleSummary',
    id_token: idToken,
  })
  if (fresh) params.set('fresh', '1')
  if (fast) params.set('fast', '1')
  if (Number.isFinite(Number(windowRows)) && Number(windowRows) > 0) params.set('windowRows', String(Number(windowRows)))
  const url = `${gasBase}?${params.toString()}`
  return jsonGet_(url, { signal, timeoutMs })
}

export async function getScotDealers(gasBase, email) {
  if (!gasBase) throw new Error('Missing VITE_SCOT_GAS_BASE')
  const url = `${gasBase}?path=scotDealers&email=${encodeURIComponent(email)}`
  return jsonGet_(url)
}

export async function getRowByDealer(gasBase, idToken, email, dealer, { includeCalls } = {}) {
  if (!gasBase) throw new Error('Missing VITE_SCOT_GAS_BASE')
  const params = new URLSearchParams({
    path: 'rowByDealer',
    email,
    dealer,
    id_token: idToken || '',
  })
  if (includeCalls) params.set('includeCalls', '1')
  const url = `${gasBase}?${params.toString()}`
  return jsonGet_(url)
}

function sleep_(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function postJson_(url, payload, { signal, timeoutMs = 15_000, retries = 1 } = {}) {
  let lastErr = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { signal: sig, cleanup } = abortable_(signal, timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: payload,
        signal: sig,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json || !json.ok) throw new Error((json && json.error) || 'Request failed')
      return json
    } catch (err) {
      lastErr = err
      const isAbort = err?.name === 'AbortError' || String(err?.message || '').toLowerCase().includes('aborted')
      if (isAbort || attempt >= retries) break
      await sleep_(300 * (attempt + 1))
    } finally {
      cleanup()
    }
  }

  throw lastErr || new Error('Request failed')
}

export async function postMark(gasBase, body, { signal, timeoutMs = 15_000, retries = 1 } = {}) {
  if (!gasBase) throw new Error('Missing VITE_SCOT_GAS_BASE')
  const payload = JSON.stringify(body || {})
  return postJson_(gasBase, payload, { signal, timeoutMs, retries })
}

// Backward-compatible alias for existing callers.
export async function postMarkNoCors(gasBase, body, opts) {
  return postMark(gasBase, body, opts)
}

export async function postAddDealer(gasBase, { email, dealerName, color, idToken, signal, timeoutMs = 15_000 } = {}) {
  if (!gasBase) throw new Error('Missing VITE_SCOT_GAS_BASE')
  const payload = JSON.stringify({
    path: 'addDealer',
    email: String(email || '').trim(),
    dealerName: String(dealerName || '').trim(),
    color: String(color || '').trim(),
    id_token: String(idToken || '').trim(),
  })

  const { signal: sig, cleanup } = abortable_(signal, timeoutMs)
  try {
    const res = await fetch(gasBase, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: payload,
      signal: sig,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    if (!json || !json.ok) throw new Error((json && json.error) || 'Add dealer failed')
    return json
  } finally {
    cleanup()
  }
}
