// 공휴일 프록시: 브라우저는 /api/holidays?country=KR 만 부르고,
// KOTRA API 키는 Netlify 환경 변수 KOTRA_API_KEY 에만 둬요 (응답·로그에 키를 싣지 않아요).
const KOTRA_URL = 'https://apis.data.go.kr/B410001/holiday/getHoliday';
const fail = (error, status) => Response.json({ error, status }, { status });

export default async (req) => {
  const country = (new URL(req.url).searchParams.get('country') || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) return fail('나라 코드가 올바르지 않아요', 400);
  const key = process.env.KOTRA_API_KEY;
  if (!key) return fail('서버에 API 키가 설정되지 않았어요', 500);

  const url = KOTRA_URL + '?serviceKey=' + encodeURIComponent(key) + '&type=json&numOfRows=100&pageNo=1&search1=' + encodeURIComponent(country);
  try {
    // 공공데이터포털이 가끔 일시적으로 5xx를 주므로 한 번만 다시 시도한다
    let res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!res || res.status >= 500) res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return fail('공휴일 API가 응답하지 않았어요', 502);
    const json = await res.json();
    const header = json && json.response && json.response.header;
    if (!header || header.resultCode !== '00') return fail('공휴일 API 오류', 502);
    const raw = json.response.body && json.response.body.itemList && json.response.body.itemList.item;
    // 외부 필드명이 화면까지 가지 않게 { date: 'YYYYMMDD', name } 로 바꿔서 내려줘요
    const items = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((it) => ({ date: String(it.hldyDeFrom || ''), name: String(it.hldyName || '') }));
    return Response.json({ items }, { headers: { 'Cache-Control': 'public, max-age=21600' } });
  } catch (e) {
    return fail('공휴일 API에 연결하지 못했어요', 504);
  }
};

export const config = { path: '/api/holidays' };
