import type { VercelRequest, VercelResponse } from 'vercel';
import axios from 'axios';
import dayjs from 'dayjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { id, days, benchmark } = req.query;

    if (typeof id !== 'string' || typeof days !== 'string' || typeof benchmark !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid parameters' });
    }

    const daysInt = parseInt(days);
    if (isNaN(daysInt)) {
      return res.status(400).json({ error: 'Days must be an integer' });
    }

    const now = dayjs();
    const pastDate = now.subtract(daysInt, 'day');
    const pastDateFormatted = pastDate.format('DD-MM-YYYY');

    // 🟩 LOG: paramètres reçus
    console.log(`🟢 Fetching RS for ID=${id}, Benchmark=${benchmark}, Days=${daysInt}`);
    console.log(`🕒 Date utilisée pour l’historique : ${pastDateFormatted}`);

    // Obtenir prix actuel
    const currentPriceUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${id},${benchmark}&vs_currencies=usd`;
    const currentResp = await axios.get(currentPriceUrl);
    const currentData = currentResp.data;

    const ptToken = currentData[id]?.usd;
    const ptBenchmark = currentData[benchmark]?.usd;

    // LOG prix actuels
    console.log(`📈 Prix actuels : ${id} = ${ptToken}, ${benchmark} = ${ptBenchmark}`);

    // Obtenir prix historiques
    const historyUrlToken = `https://api.coingecko.com/api/v3/coins/${id}/history?date=${pastDateFormatted}`;
    const historyUrlBenchmark = `https://api.coingecko.com/api/v3/coins/${benchmark}/history?date=${pastDateFormatted}`;

    const [historyTokenResp, historyBenchmarkResp] = await Promise.all([
      axios.get(historyUrlToken),
      axios.get(historyUrlBenchmark)
    ]);

    const ptMinusN_Token = historyTokenResp.data.market_data?.current_price?.usd;
    const ptMinusN_Benchmark = historyBenchmarkResp.data.market_data?.current_price?.usd;

    // LOG prix historiques
    console.log(`📉 Prix historiques au ${pastDateFormatted} :`);
    console.log(`   ${id} = ${ptMinusN_Token}`);
    console.log(`   ${benchmark} = ${ptMinusN_Benchmark}`);

    // Vérifications
    if (!ptToken || !ptBenchmark || !ptMinusN_Token || !ptMinusN_Benchmark) {
      console.log('❌ Prix manquants ou nuls. Abandon de traitement.');
      return res.status(400).json({
        error: 'Missing or zero price',
        id,
        benchmark,
        ptToken,
        ptBenchmark,
        ptMinusN_Token,
        ptMinusN_Benchmark
      });
    }

    // Calcul performance
    const perfToken = (ptToken - ptMinusN_Token) / ptMinusN_Token;
    const perfBenchmark = (ptBenchmark - ptMinusN_Benchmark) / ptMinusN_Benchmark;

    if (perfBenchmark === 0) {
      return res.status(400).json({ error: 'Benchmark performance is zero' });
    }

    const rs = perfToken / perfBenchmark;
    console.log(`✅ RS calculée pour ${id} vs ${benchmark} = ${rs}`);

    return res.status(200).json({ rs });

  } catch (error: any) {
    console.error('🔥 Erreur inattendue :', error.message || error);
    return res.status(500).json({ error: 'Internal server error', message: error.message || error });
  }
}

