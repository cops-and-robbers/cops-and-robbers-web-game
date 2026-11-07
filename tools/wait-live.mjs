// 자동 배포 전에 도는 판이 끝날 때까지 기다린다. 방 서버를 새로 올리면 메모리에 있던 판이 사라지기 때문이다.
//   SITE=https://cops-and-robbers-game.pages.dev node tools/wait-live.mjs
// 판이 없으면 바로 끝(0). 10분을 기다려도 판이 계속 돌면 멈춘다(1). 운영 상태를 못 읽으면 판이 없다고 보지 않고 멈춘다(2).
// 급할 때는 Actions 의 Deploy 를 손으로 돌리면서 force 를 켜면 이 단계를 건너뛴다(docs/deploy.md)
const SITE = process.env.SITE;
const WAIT_MS = Number(process.env.WAIT_LIVE_MS || 10 * 60_000);
const EVERY_MS = Number(process.env.WAIT_LIVE_EVERY_MS || 20_000);
if (!SITE) { console.log("SITE 가 없어요"); process.exit(2); }

const read = async () => {
  const res = await fetch(`${SITE}/live`, { headers: { "cache-control": "no-store" } });
  // 이 기능을 처음 올릴 때는 입구에 /live 가 아직 없다. 그 한 번만 판 수를 모르는 채로 올린다
  if (res.status === 404) return { playing: 0, first: true };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (typeof body.playing !== "number") throw new Error("playing 이 없어요");
  return body;
};

const started = Date.now();
for (;;) {
  let now;
  try { now = await read(); } catch (e) { console.log(`도는 판을 읽지 못했어요 (${e.message}). 판이 끊길 수 있어서 올리지 않아요`); process.exit(2); }
  if (now.first) { console.log("입구에 /live 가 아직 없어요(처음 한 번). 판 수를 모르는 채로 올려요"); process.exit(0); }
  if (now.playing === 0) { console.log("도는 판이 없어요. 올려요"); process.exit(0); }
  const waited = Math.round((Date.now() - started) / 1000);
  if (Date.now() - started >= WAIT_MS) { console.log(`판 ${now.playing}개가 ${waited}초째 돌고 있어 올리지 않았어요. 다시 돌리거나 force 로 올려요`); process.exit(1); }
  console.log(`판 ${now.playing}개가 돌고 있어요. 늦어도 ${now.until} 에 끝나요. ${waited}초 기다렸어요`);
  await new Promise(r => setTimeout(r, EVERY_MS));
}
