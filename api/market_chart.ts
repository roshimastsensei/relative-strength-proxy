import type { VercelRequest, VercelResponse } from 'vercel';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id, days, benchmark } = req.query;

  if (!id || !days || !benchmark) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    // 1. Prix actuels (P_t)
    const urlPriceNow = `https://api.coingecko.com/api/v3/simple/price?ids=${id},${benchmark}&vs_currencies=usd`;
    const responseNow = await fetch(urlPriceNow);
    const pricesNow = await responseNow.json();

    const priceToday = pricesNow?.[id as string]?.usd;
    const benchmarkToday = pricesNow?.[benchmark as string]?.usd;

    // DEBUG
    console.log(`[RSM DEBUG] priceToday: ${priceToday}`);
    console.log(`[RSM DEBUG] benchmarkToday: ${benchmarkToday}`);

    // 2. Prix d'il y a n jours (P_t-n)
    const pastDate = new Date(Date.now() - Number(days) * 86400000);
    const [day, month, year] = pastDate.toLocaleDateString('en-GB').split('/');
    const finalDate = `${day}-${month}-${year}`; // Format dd-mm-yyyy

    const urlPriceThen = `https://api.coingecko.com/api/v3/coins/${id}/history?date=${finalDate}`;
    const urlBenchmarkThen = `https://api.coingecko.com/api/v3/coins/${benchmark}/history?date=${finalDate}`;

    const responseThen = await fetch(urlPriceThen);
    const responseBenchThen = await fetch(urlBenchmarkThen);

    const priceDataThen = await responseThen.json();
    const benchDataThen = await responseBenchThen.json();

    // DEBUG
    console.log('[RSM DEBUG] Raw Token history:', JSON.stringify(priceDataThen));
    console.log('[RSM DEBUG] Raw Benchmark history:', JSON.stringify(benchDataThen));

    const priceThen = priceDataThen?.market_data?.current_price?.usd;
    const benchmarkThen = benchDataThen?.market_data?.current_price?.usd;

    // DEBUG
    console.log(`[RSM DEBUG] priceThen: ${priceThen}`);
    console.log(`[RSM DEBUG] benchmarkThen: ${benchmarkThen}`);

    if (!priceToday || !benchmarkToday || !priceThen || !benchmarkThen) {
      return res.status(400).json({ error: 'Missing or zero price' });
    }

    // 3. Performances
    const perfToken = (priceToday - priceThen) / priceThen;
    const perfBenchmark = (benchmarkToday - benchmarkThen) / benchmarkThen;

    // 4. Relative Strength
    const rs = perfToken / perfBenchmark;

    return res.status(200).json({ rs });
  } catch (err) {
    console.error('[RSM ERROR]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
