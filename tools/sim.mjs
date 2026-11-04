// 봇끼리 여러 판을 돌려 규칙의 균형을 잰다. node tools/sim.mjs [판 수]
import fs from "node:fs";
import vm from "node:vm";
const code = fs.readFileSync(new URL("../shared/logic.js", import.meta.url), "utf8");
const load = () => { const ctx = { window: {}, console }; vm.createContext(ctx); vm.runInContext(code, ctx); return ctx.window.GameLogic; };
const N = Number(process.argv[2] || 60);

function run(over, label) {
  const L = load();
  const r = { police: 0, robber: 0, catches: 0, rescues: 0, len: 0, firstCatch: 0, firstN: 0, seen: 0, chase: 0, escapes: 0, idle: 0 };
  for (let i = 0; i < N; i++) {
    const G = L.newGame({ seed: 1000 + i, botPlayer: true, ...over });
    let first = null, seenPrev = false;
    const dt = 1 / 20;
    while (!G.over && G.t < 400) {
      L.step(G, dt);
      for (const e of G.events.splice(0)) if (e.type === "caught" && first === null) first = G.t;
      // 경찰 한 명이라도 도둑을 보고 있는 시간, 그런 장면이 시작된 횟수
      const seenNow = G.phase === "play" && G.police.some(p => G.robbers.some(x => x.state === "free" && L.sees(p, x)));
      if (seenNow) r.seen += dt;
      if (seenNow && !seenPrev) r.chase++;
      seenPrev = seenNow;
    }
    r[G.over.winner]++; r.catches += G.stats.catches; r.rescues += G.stats.rescues; r.len += G.over.at;
    if (first !== null) { r.firstCatch += first; r.firstN++; }
    for (const x of G.robbers) r.escapes += x.s.escapes;
  }
  const f = (v, d = 1) => (v / N).toFixed(d);
  console.log(`${label.padEnd(18)} 경찰승 ${String(Math.round(r.police / N * 100)).padStart(3)}% | 길이 ${f(r.len, 0)}초 | 체포 ${f(r.catches)} | 구출 ${f(r.rescues)} | 들킨 장면 ${f(r.chase)}회 | 보이는 시간 ${f(r.seen, 0)}초 | 따돌림 ${f(r.escapes)} | 첫 체포 ${r.firstN ? (r.firstCatch / r.firstN).toFixed(0) : "-"}초`);
}

const cases = JSON.parse(process.argv[3] || "null") || [
  [{ theme: "town" }, "보통 동네"],
];
for (const [o, l] of cases) run(o, l);
