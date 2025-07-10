// api/market_chart.ts

export const config = {
  runtime: 'edge',
};

function parseDateToYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function fetchPrice(id: string, date?: string): Promise<number | null> {
  try {
    const url = date
      ? `https://api.coingecko.com/api/v3/coins/${id}/history?date=${date}`
      : `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    return date ? data?.market_data?.current_price?.usd ?? null : data?.[id]?.usd ?? null;
  } catch {
    return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const days = parseInt(searchParams.get('days') || '7', 10);
    const benchmark = searchParams.get('benchmark');

    if (!id || !benchmark || isNaN(days)) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
    }

    const now = new Date();
    const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const pastDate = past.toLocaleDateString('en-GB').split('/').reverse().join('-'); // dd-mm-yyyy

    const tokenNow = await fetchPrice(id);
    const tokenPast = await fetchPrice(id, pastDate);

    const benchNow = await fetchPrice(benchmark);
    const benchPast = await fetchPrice(benchmark, pastDate);

    if ([tokenNow, tokenPast, benchNow, benchPast].some(p => p === null || p === 0)) {
      return new Response(JSON.stringify({ error: 'Missing or zero price' }), { status: 500 });
    }

    const tokenPerf = (tokenNow! - tokenPast!) / tokenPast!;
    const benchPerf = (benchNow! - benchPast!) / benchPast!;

    const relativeStrength = tokenPerf / benchPerf;

    return new Response(JSON.stringify({ relativeStrength }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Unexpected server error', details: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
