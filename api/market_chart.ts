// pages/api/market_chart.ts
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, days, benchmark } = req.query;

  if (!id || !days || !benchmark) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const tokenId = id.toString();
  const benchmarkId = benchmark.toString();

  try {
    // Get today’s price (Pₜ)
    const simplePriceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId},${benchmarkId}&vs_currencies=usd`;
    const simplePriceRes = await fetch(simplePriceUrl);
    const simplePriceData = await simplePriceRes.json();

    const todayTokenPrice = simplePriceData[tokenId]?.usd;
    const todayBenchmarkPrice = simplePriceData[benchmarkId]?.usd;

    if (!todayTokenPrice || !todayBenchmarkPrice) {
      return res.status(404).json({ error: 'Price data not found for one or both IDs' });
    }

    // Get past price (Pₜ₋ₙ)
    const date = new Date();
    date.setDate(date.getDate() - parseInt(days.toString()));

    const formatDate = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    };

    const formattedDate = formatDate(date);

    const tokenHistoryUrl = `https://api.coingecko.com/api/v3/coins/${tokenId}/history?date=${formattedDate}`;
    const benchmarkHistoryUrl = `https://api.coingecko.com/api/v3/coins/${benchmarkId}/history?date=${formattedDate}`;

    const [tokenHistoryRes, benchmarkHistoryRes] = await Promise.all([
      fetch(tokenHistoryUrl),
      fetch(benchmarkHistoryUrl),
    ]);

    const tokenHistoryData = await tokenHistoryRes.json();
    const benchmarkHistoryData = await benchmarkHistoryRes.json();

    const pastTokenPrice = tokenHistoryData?.market_data?.current_price?.usd;
    const pastBenchmarkPrice = benchmarkHistoryData?.market_data?.current_price?.usd;

    if (!pastTokenPrice || !pastBenchmarkPrice) {
      return res.status(404).json({ error: 'Historical price data not found' });
    }

    const perfToken = (todayTokenPrice - pastTokenPrice) / pastTokenPrice;
    const perfBenchmark = (todayBenchmarkPrice - pastBenchmarkPrice) / pastBenchmarkPrice;
    const relativeStrength = perfToken / perfBenchmark;

    return res.status(200).json({ relativeStrength, perfToken, perfBenchmark });
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
