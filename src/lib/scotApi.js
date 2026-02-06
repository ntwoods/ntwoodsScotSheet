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

export async function getOrderCycleSummary(gasBase, idToken, { signal, timeoutMs, fresh } = {}) {
  assertCfg_(gasBase, idToken)
  const params = new URLSearchParams({
    path: 'orderCycleSummary',
    id_token: idToken,
  })
  if (fresh) params.set('fresh', '1')
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

export async function postMarkNoCors(gasBase, body) {
  if (!gasBase) throw new Error('Missing VITE_SCOT_GAS_BASE')
  await fetch(gasBase, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
