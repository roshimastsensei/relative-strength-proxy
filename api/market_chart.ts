// api/market_chart.ts

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function formatDateToDDMMYYYY(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const benchmark = searchParams.get('benchmark');
  const days = parseInt(searchParams.get('days') || '7');

  if (!id || !benchmark || isNaN(days)) {
    return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
  }

  try {
    // 1. Fetch Pₜ for token and benchmark
    const priceNowRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id},${benchmark}&vs_currencies=usd`);
    if (!priceNowRes.ok) throw new Error(`Failed to fetch current prices: ${priceNowRes.status}`);
    const priceNow = await priceNowRes.json();

    const tokenNow = priceNow[id]?.usd;
    const benchmarkNow = priceNow[benchmark]?.usd;

    if (typeof tokenNow !== 'number' || typeof benchmarkNow !== 'number') {
      return NextResponse.json({ error: 'Invalid ID(s)' }, { status: 400 });
    }

    // 2. Compute target date (Pₜ₋ₙ)
    const pastDate = new Date();
    pastDate.setUTCDate(pastDate.getUTCDate() - days);
    const dateStr = formatDateToDDMMYYYY(pastDate);

    // 3. Fetch Pₜ₋ₙ for token and benchmark
    const [tokenHistRes, benchmarkHistRes] = await Promise.all([
      fetch(`https://api.coingecko.com/api/v3/coins/${id}/history?date=${dateStr}`),
      fetch(`https://api.coingecko.com/api/v3/coins/${benchmark}/history?date=${dateStr}`),
    ]);

    if (!tokenHistRes.ok || !benchmarkHistRes.ok) {
      return NextResponse.json({ error: 'History fetch failed' }, { status: 500 });
    }

    const tokenHist = await tokenHistRes.json();
    const benchmarkHist = await benchmarkHistRes.json();

    const tokenPast = tokenHist?.market_data?.current_price?.usd;
    const benchmarkPast = benchmarkHist?.market_data?.current_price?.usd;

    if (typeof tokenPast !== 'number' || typeof benchmarkPast !== 'number') {
      return NextResponse.json({ error: 'Missing historical data' }, { status: 500 });
    }

    // 4. Compute performances
    const perfToken = (tokenNow - tokenPast) / tokenPast;
    const perfBenchmark = (benchmarkNow - benchmarkPast) / benchmarkPast;

    // 5. Relative strength
    const relativeStrength = perfBenchmark === 0 ? null : perfToken / perfBenchmark;

    return NextResponse.json({
      relativeStrength,
      perfToken,
      perfBenchmark,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
