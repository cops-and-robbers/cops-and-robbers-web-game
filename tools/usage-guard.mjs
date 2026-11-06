// 올리기 전에 오늘(UTC) 사용량을 보고, 무료 한도에 가까우면 멈춘다. docs/cost-guard.md
// 토큰과 계정 번호는 환경 변수로만 받고 출력하지 않는다
//   CLOUDFLARE_API_TOKEN  Account Analytics 읽기 권한이 있는 토큰
//   CLOUDFLARE_ACCOUNT_ID 계정 번호
// 끝 코드: 0 올려도 됨, 1 한도에 가까움, 2 조회 실패(올리지 않는다)
const LIMIT = { requests: 100_000, gbs: 13_000 };
const STOP_AT = Number(process.env.USAGE_STOP_AT || 0.7);
const token = process.env.CLOUDFLARE_API_TOKEN, account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !account) { console.log("토큰이나 계정 번호가 없어서 사용량을 확인하지 못했어요"); process.exit(2); }

const now = new Date();
const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const query = `query($a:String!,$s:Time!,$e:Time!,$d:Date!){viewer{accounts(filter:{accountTag:$a}){
  workers:workersInvocationsAdaptive(limit:50,filter:{datetime_geq:$s,datetime_leq:$e}){sum{requests}}
  doReq:durableObjectsInvocationsAdaptiveGroups(limit:50,filter:{date:$d}){sum{requests}}
  doTime:durableObjectsPeriodicGroups(limit:50,filter:{date:$d}){sum{activeTime}}
}}}`;

let body;
try {
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { a: account, s: dayStart.toISOString(), e: now.toISOString(), d: dayStart.toISOString().slice(0, 10) } }),
  });
  body = await res.json();
} catch (e) {
  console.log("사용량 조회에 실패했어요:", e.message); process.exit(2);
}
const acc = body?.data?.viewer?.accounts?.[0];
if (!acc) { console.log("사용량 조회 결과가 없어요:", (body?.errors || []).map(e => e.message).join(" / ").slice(0, 200)); process.exit(2); }

const sum = (rows, k) => (rows || []).reduce((n, r) => n + (r.sum?.[k] || 0), 0);
// Worker 요청과 Durable Object 요청은 같은 하루 10만 건 한도를 함께 쓴다. 실행량은 128MB 기준으로 GB-s 로 바꾼다
const requests = sum(acc.workers, "requests") + sum(acc.doReq, "requests");
const gbs = (sum(acc.doTime, "activeTime") / 1e6) * 0.128;
const pct = v => `${(v * 100).toFixed(1)}%`;
console.log(`오늘 요청 ${requests.toLocaleString()}건 (${pct(requests / LIMIT.requests)}), 실행량 ${gbs.toFixed(1)} GB-s (${pct(gbs / LIMIT.gbs)}), 멈추는 선 ${pct(STOP_AT)}`);
if (requests / LIMIT.requests >= STOP_AT || gbs / LIMIT.gbs >= STOP_AT) { console.log("무료 한도에 가까워서 올리지 않았어요"); process.exit(1); }
