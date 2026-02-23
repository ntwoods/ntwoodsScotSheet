function startsWithHttp_(s) {
  return /^https?:\/\//i.test(String(s || '').trim())
}

export function parseOrderUrls(rawValue) {
  const raw = String(rawValue || '').trim()
  if (!raw) return []

  const normalized = raw.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return []

  const hasComma = normalized.includes(',')
  const tokens = hasComma
    ? normalized
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : normalized
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)

  if (!tokens.length) return []
  if (!hasComma) return tokens

  const out = []
  for (const token of tokens) {
    if (!out.length) {
      out.push(token)
      continue
    }

    if (startsWithHttp_(token)) {
      out.push(token)
      continue
    }

    if (startsWithHttp_(out[out.length - 1])) {
      out[out.length - 1] = `${out[out.length - 1]},${token}`
      continue
    }

    out.push(token)
  }

  return out.map((x) => x.trim()).filter(Boolean)
}
