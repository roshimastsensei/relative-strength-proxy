// pages/api/market_chart.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id, days, benchmark } = req.query

    if (!id || !days || !benchmark || typeof id !== 'string' || typeof days !== 'string' || typeof benchmark !== 'string') {
      return res.status(400).json({ error: 'Invalid parameters' })
    }

    const now = new Date()
    const dateObj = new Date(now.getTime() - parseInt(days) * 86400000)
    const dateThen = `${dateObj.getDate().toString().padStart(2, '0')}-${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getFullYear()}`

    // Price today (token + benchmark)
    const priceTodayResponse = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: `${id},${benchmark}`,
        vs_currencies: 'usd'
      }
    })

    const priceToday = priceTodayResponse.data?.[id]?.usd
    const benchmarkToday = priceTodayResponse.data?.[benchmark]?.usd

    console.log('[RSM DEBUG] priceToday:', priceToday)
    console.log('[RSM DEBUG] benchmarkToday:', benchmarkToday)

    if (!priceToday || !benchmarkToday) {
      return res.status(400).json({ error: 'Missing or zero price' })
    }

    // Price then (token + benchmark)
    const [tokenThenRes, benchThenRes] = await Promise.all([
      axios.get(`https://api.coingecko.com/api/v3/coins/${id}/history?date=${dateThen}`),
      axios.get(`https://api.coingecko.com/api/v3/coins/${benchmark}/history?date=${dateThen}`)
    ])

    const priceThen = tokenThenRes.data?.market_data?.current_price?.usd
    const benchmarkThen = benchThenRes.data?.market_data?.current_price?.usd

    console.log('[RSM DEBUG] priceThen:', priceThen)
    console.log('[RSM DEBUG] benchmarkThen:', benchmarkThen)

    if (!priceThen || !benchmarkThen) {
      return res.status(400).json({ error: 'Missing or zero historical price' })
    }

    // Compute RS
    const perfToken = (priceToday - priceThen) / priceThen
    const perfBenchmark = (benchmarkToday - benchmarkThen) / benchmarkThen
    const rs = perfToken / perfBenchmark

    return res.status(200).json({ rs })
  } catch (error) {
    console.error('[RSM ERROR]', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
