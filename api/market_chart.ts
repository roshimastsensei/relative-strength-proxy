import { NextRequest } from 'next/server'

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'

function formatDateNDaysAgo(daysAgo: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - daysAgo)
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = date.getUTCFullYear()
  return `${dd}-${mm}-${yyyy}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenId = searchParams.get('id')
  const benchmarkId = searchParams.get('benchmark')
  const daysStr = searchParams.get('days')
  const days = daysStr ? parseInt(daysStr) : 7

  if (!tokenId || !benchmarkId) {
    return new Response('Missing id or benchmark parameter', { status: 400 })
  }

  const dateStr = formatDateNDaysAgo(days)

  const tokenNowUrl = \`\${COINGECKO_BASE}/simple/price?ids=\${tokenId}&vs_currencies=usd\`
  const tokenPastUrl = \`\${COINGECKO_BASE}/coins/\${tokenId}/history?date=\${dateStr}\`

  const benchNowUrl = \`\${COINGECKO_BASE}/simple/price?ids=\${benchmarkId}&vs_currencies=usd\`
  const benchPastUrl = \`\${COINGECKO_BASE}/coins/\${benchmarkId}/history?date=\${dateStr}\`

  try {
    const [tokenNowRes, tokenPastRes, benchNowRes, benchPastRes] = await Promise.all([
      fetch(tokenNowUrl),
      fetch(tokenPastUrl),
      fetch(benchNowUrl),
      fetch(benchPastUrl)
    ])

    if (!tokenNowRes.ok || !tokenPastRes.ok || !benchNowRes.ok || !benchPastRes.ok) {
      return new Response('One or more CoinGecko requests failed', { status: 500 })
    }

    const tokenNow = await tokenNowRes.json()
    const tokenPast = await tokenPastRes.json()
    const benchNow = await benchNowRes.json()
    const benchPast = await benchPastRes.json()

    const pt = tokenNow[tokenId]?.usd
    const pt_n = tokenPast?.market_data?.current_price?.usd
    const pb = benchNow[benchmarkId]?.usd
    const pb_n = benchPast?.market_data?.current_price?.usd

    if ([pt, pt_n, pb, pb_n].some(val => typeof val !== 'number')) {
      return new Response('Invalid data structure from CoinGecko', { status: 500 })
    }

    const perfToken = (pt - pt_n) / pt_n
    const perfBenchmark = (pb - pb_n) / pb_n
    const relativeStrength = perfToken / perfBenchmark

    return new Response(JSON.stringify({ relativeStrength, perfToken, perfBenchmark }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response('Unexpected error', { status: 500 })
  }
}