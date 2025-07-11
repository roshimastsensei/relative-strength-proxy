import axios from 'axios';
import { subDays, format } from 'date-fns';

export default async function handler(req, res) {
  const { id, days, benchmark } = req.query;

  if (!id || !days || !benchmark) {
    return res.status(400).json({ error: 'Missing required parameters (id, days, benchmark)' });
  }

  try {
    const today = new Date();
    const pastDate = subDays(today, parseInt(days));
    const formattedDate = format(pastDate, 'dd-MM-yyyy');

    // Step 1: get Pt
    const nowUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${id},${benchmark}&vs_currencies=usd`;
    const nowRes = await axios.get(nowUrl);
    const pt_token = nowRes.data?.[id]?.usd ?? 0;
    const pt_bench = nowRes.data?.[benchmark]?.usd ?? 0;

    // Step 2: get Pt-n
    const histTokenUrl = `https://api.coingecko.com/api/v3/coins/${id}/history?date=${formattedDate}`;
    const histBenchUrl = `https://api.coingecko.com/api/v3/coins/${benchmark}/history?date=${formattedDate}`;
    const [histTokenRes, histBenchRes] = await Promise.all([
      axios.get(histTokenUrl),
      axios.get(histBenchUrl),
    ]);

    const ptn_token = histTokenRes.data?.market_data?.current_price?.usd ?? 0;
    const ptn_bench = histBenchRes.data?.market_data?.current_price?.usd ?? 0;

    if (!pt_token || !ptn_token || !pt_bench || !ptn_bench) {
      return res.status(400).json({ error: 'Missing or zero price' });
    }

    const perf_token = (pt_token - ptn_token) / ptn_token;
    const perf_bench = (pt_bench - ptn_bench) / ptn_bench;
    const rs = perf_bench === 0 ? null : perf_token / perf_bench;

    return res.status(200).json({ rs });
  } catch (err) {
    console.error('❌ Internal error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
