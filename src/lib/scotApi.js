function assertCfg_(gasBase, idToken) {
  if (!gasBase) throw new Error('Missing VITE_SCOT_GAS_BASE')
  if (!idToken) throw new Error('Missing id_token')
}

async function jsonGet_(url) {
  const res = await fetch(url)
  const json = await res.json()
  if (!json || !json.ok) throw new Error((json && json.error) || 'Request failed')
  return json
}

export async function getMe(gasBase, idToken) {
  assertCfg_(gasBase, idToken)
  const url = `${gasBase}?path=me&id_token=${encodeURIComponent(idToken)}`
  return jsonGet_(url)
}

export async function getDue(gasBase, idToken) {
  assertCfg_(gasBase, idToken)
  const url = `${gasBase}?path=due&id_token=${encodeURIComponent(idToken)}`
  return jsonGet_(url)
}

export async function getSfRemarks(gasBase, idToken, clientName) {
  assertCfg_(gasBase, idToken)
  const url = `${gasBase}?path=sfRemarks&client=${encodeURIComponent(clientName)}&id_token=${encodeURIComponent(idToken)}`
  const json = await jsonGet_(url)
  return json.remarks || []
}

export async function getOrderCycleSummary(gasBase, idToken) {
  assertCfg_(gasBase, idToken)
  const url = `${gasBase}?path=orderCycleSummary&id_token=${encodeURIComponent(idToken)}`
  return jsonGet_(url)
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
