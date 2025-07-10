import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, days, benchmark } = req.query

  if (typeof id !== 'string' || typeof days !== 'string' || typeof benchmark !== 'string') {
    return res.status(400).json({ error: 'Invalid parameters' })
  }

  const todayUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${id},${benchmark}&vs_currencies=usd`

  const pastDate = new Date()
  pastDate.setDate(pastDate.getDate() - parseInt(days))
  const dateStr = pastDate.toLocaleDateString('en-GB').split('/').reverse().join('-') // format: dd-mm-yyyy

  const pastUrlToken = `https://api.coingecko.com/api/v3/coins/${id}/history?date=${dateStr}`
  const pastUrlBenchmark = `https://api.coingecko.com/api/v3/coins/${benchmark}/history?date=${dateStr}`

  try {
    const [todayResp, pastTokenResp, pastBenchmarkResp] = await Promise.all([
      fetch(todayUrl),
      fetch(pastUrlToken),
      fetch(pastUrlBenchmark),
    ])

    const todayData = await todayResp.json()
    const pastTokenData = await pastTokenResp.json()
    const pastBenchmarkData = await pastBenchmarkResp.json()

    const priceToday = todayData[id]?.usd
    const priceTodayBenchmark = todayData[benchmark]?.usd
    const priceThen = pastTokenData?.market_data?.current_price?.usd
    const priceThenBenchmark = pastBenchmarkData?.market_data?.current_price?.usd

    // 🧪 Log minimal
    console.log('[RSM DEBUG] priceToday:', priceToday)
    console.log('[RSM DEBUG] priceThen:', priceThen)
    console.log('[RSM DEBUG] Raw Token history:', JSON.stringify(pastTokenData).slice(0, 200))

    if (
      typeof priceToday !== 'number' || typeof priceTodayBenchmark !== 'number' ||
      typeof priceThen !== 'number' || typeof priceThenBenchmark !== 'number' ||
      priceToday === 0 || priceTodayBenchmark === 0 || priceThen === 0 || priceThenBenchmark === 0
    ) {
      return res.status(400).json({ error: 'Missing or zero price' })
    }

    const perfToken = (priceToday - priceThen) / priceThen
    const perfBenchmark = (priceTodayBenchmark - priceThenBenchmark) / priceThenBenchmark
    const rs = perfToken / perfBenchmark

    res.status(200).json({ rs })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', detail: (error as Error).message })
  }
}
