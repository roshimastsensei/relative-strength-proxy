import axios from 'axios';
import { format, subDays } from 'date-fns';

export default async function handler(req, res) {
  const { id, days, benchmark } = req.query;

  if (!id || !days || !benchmark) {
    return res.status(400).json({ error: 'Missing required parameters (id, days, benchmark)' });
  }

  try {
    const today = new Date();
    const pastDate = subDays(today, parseInt(days));
    const formattedDate = format(pastDate, 'dd-MM-yyyy');

    // Fetch current prices (P_t)
    const priceNowUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${id},${benchmark}&vs_currencies=usd`;
    const priceNowResp = await axios.get(priceNowUrl);
    const priceNow = priceNowResp.data;

    const pt_token = priceNow[id]?.usd ?? 0;
    const pt_benchmark = priceNow[benchmark]?.usd ?? 0;

    // Fetch historical price (P_{t-n}) for token
    const histTokenUrl = `https://api.coingecko.com/api/v3/coins/${id}/history?date=${formattedDate}`;
    const histBenchmarkUrl = `https://api.coingecko.com/api/v3/coins/${benchmark}/history?date=${formattedDate}`;

    const [histTokenResp, histBenchmarkResp] = await Promise.all([
      axios.get(histTokenUrl),
      axios.get(histBenchmarkUrl)
    ]);

    const ptn_token = histTokenResp.data?.market_data?.current_price?.usd ?? 0;
    const ptn_benchmark = histBenchmarkResp.data?.market_data?.current_price?.usd ?? 0;

    if (!pt_token || !ptn_token || !pt_benchmark || !ptn_benchmark) {
      return res.status(400).json({ error: 'Missing or zero price' });
    }

    const perf_token = (pt_token - ptn_token) / ptn_token;
    const perf_benchmark = (pt_benchmark - ptn_benchmark) / ptn_benchmark;

    const rs = perf_benchmark === 0 ? null : perf_token / perf_benchmark;

    return res.status(200).json({ rs });

  } catch (error) {
    console.error('Server error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}


