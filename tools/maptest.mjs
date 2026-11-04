// 만든 지도가 놀 수 있는지 검사한다. node tools/maptest.mjs [개수]
import fs from "node:fs";
import vm from "node:vm";
const ctx = { window: {}, console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL("../shared/logic.js", import.meta.url), "utf8"), ctx);
const L = ctx.window.GameLogic;
const N = Number(process.argv[2] || 200);
const hitsRect = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const problems = [];
for (const theme of Object.keys(L.THEMES)) for (const [diffN, role] of [["easy", "police"], ["normal", "police"], ["hard", "police"], ["hard", "robber"]]) {
  let reach = 0, bld = 0, bush = 0, spots = 0, areaBld = 0, lowReach = 0, minSpots = 1e9;
  for (let i = 0; i < N; i++) {
    const G = L.newGame({ seed: 5000 + i * 31, theme, diff: diffN, role });
    const m = G.map, J = m.jail;
    reach += m.reach; bld += m.buildings.length; bush += m.bushes.length; spots += L.SPOTS.length; minSpots = Math.min(minSpots, L.SPOTS.length);
    if (m.reach < 0.97) lowReach++;
    for (const b of m.buildings) {
      areaBld += b.w * b.h;
      const nx = Math.max(b.x, Math.min(J.x, b.x + b.w)), ny = Math.max(b.y, Math.min(J.y, b.y + b.h));
      if (Math.hypot(nx - J.x, ny - J.y) < L.CFG.GATE_R) problems.push(`${theme} ${i}: 감옥에 건물`);
      if (!L.inZone(b.x, b.y) || !L.inZone(b.x + b.w, b.y + b.h)) problems.push(`${theme} ${i}: 구역 밖 건물`);
    }
    m.buildings.forEach((a, k) => m.buildings.slice(k + 1).forEach(b => { if (hitsRect(a, b)) problems.push(`${theme} ${i}: 건물 겹침`); }));
    for (const a of G.agents) if (L.solidAt(a.x, a.y)) problems.push(`${theme} ${i}: ${a.name} 건물 안에서 시작`);
    for (const r of G.robbers) if (L.dist(r, J) < 300) problems.push(`${theme} ${i}: ${r.name} 감옥 옆에서 시작`);
    if (!L.inZone(J.x, J.y)) problems.push(`${theme} ${i}: 감옥이 구역 밖`);
  }
  console.log(`${L.THEMES[theme].name.padEnd(5)} ${diffN.padEnd(6)} ${role.padEnd(6)} 닿는 칸 ${(reach / N * 100).toFixed(1)}% | 미달 ${lowReach} | 건물 ${(bld / N).toFixed(0)} | 덤불 ${(bush / N).toFixed(0)} | 숨을 곳 평균 ${(spots / N).toFixed(0)} 최소 ${minSpots}`);
}
console.log("문제", problems.length); [...new Set(problems)].slice(0, 12).forEach(p => console.log(" ", p));
