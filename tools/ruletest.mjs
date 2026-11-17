// 팀 시험(11/7) 뒤 바꾼 규칙을 검사한다. node tools/ruletest.mjs
// 1) 구역 밖에 5초 넘게 있는 도둑은 1초마다 위치가 경찰에게만 보이고, 알림은 나갈 때 한 번
// 2) 경계에서 잠깐 들어왔다 나가도 초가 풀리지 않고, 1초 넘게 돌아와야 처음부터 센다
// 3) 감옥 문이 열려 밖으로 나간 도둑은 탈옥할 때까지(3초) 잡히지 않는다
// 4) 인원이 많은 판의 넓은 지도도 이어져 있고 수풀이 넓이만큼 늘어난다
// 5) 시작 멈춤 동안은 시계도 사람도 움직이지 않고, 끝나면 그대로 대기가 이어진다
// 6) 팀 MVP: 경찰은 많이 잡은 사람, 도둑은 덜 잡힌 사람. 사람이 둘 이상이면 봇은 후보가 아니다
// 7) 좀비 모드: 물리면 비틀거리다 좀비 편, 구조차는 생존자만 먼저 알고 버티면 탄다, 한 명이라도 타야 생존자 승리, 혼자 남으면 정류장이 일찍 열린다
// 8) 좀비 모드: 문 좀비는 멈춘 동안 다시 물지 못하고, 구역 축소 판의 정류장은 줄어든 구역 안에 선다
import "../shared/logic.js";
import { viewFor, canSee } from "../shared/view.js";

const DT = 1 / 20;
let bad = 0, checks = 0;
const ok = (cond, message, detail) => { checks++; if (!cond) { bad++; console.log("실패", message, detail ?? ""); } };

// 봇이 끼어들지 않게 모두 사람으로 두고, 경찰은 멀리 세운다
function setup() {
  const logic = globalThis.createGameLogic();
  logic.CFG.WAIT = 0.1;
  const G = logic.newGame({ seed: 4242, theme: "town", diff: "normal", police: 1, robbers: 2 });
  for (const a of G.agents) a.isPlayer = true;
  while (G.phase !== "play") logic.step(G, DT);
  G.events.length = 0;
  const outside = (() => {
    for (let x = 40; x < logic.CFG.W; x += 40) if (!logic.inZone(x, 60) && !logic.solidAt(x, 60)) return { x, y: 60 };
    throw new Error("구역 밖 자리를 못 찾았어요");
  })();
  const inside = { x: logic.CFG.JAIL.x + 600, y: logic.CFG.JAIL.y };
  const [cop] = G.police, [r1, r2] = G.robbers;
  cop.x = logic.CFG.W - 80; cop.y = logic.CFG.H - 80;
  r2.x = inside.x; r2.y = inside.y + 200;
  return { logic, G, cop, r1, r2, outside, inside };
}
// 손으로 옮긴 자리를 그대로 두고 시간만 흘린다
function hold(logic, G, a, at, sec) {
  for (let t = 0; t < sec - 1e-9; t += DT) { a.x = at.x; a.y = at.y; a.ix = a.iy = 0; logic.step(G, DT); }
}

{
  const { logic, G, cop, r1, r2, outside } = setup();
  hold(logic, G, r1, outside, 4.9);
  ok(!G.pings.some(p => p.out), "5초 전에 위치가 보였어요");
  ok(viewFor(logic, G, r1).me.out >= 4.8, "도둑 본인에게 밖에 있은 시간이 안 갔어요", viewFor(logic, G, r1).me.out);
  hold(logic, G, r1, outside, 0.2);
  ok(G.pings.some(p => p.out && p.id === r1.id), "5초가 넘었는데 위치가 안 보여요");
  ok(viewFor(logic, G, cop).pings.length >= 1, "경찰에게 위치가 안 갔어요");
  ok(viewFor(logic, G, r1).pings.length >= 1, "도둑 본인에게 공개 표시가 안 갔어요");
  ok(viewFor(logic, G, r2).pings.length === 0, "다른 도둑에게 공개 위치가 갔어요");
  hold(logic, G, r1, outside, 3);
  const outEvents = G.events.filter(e => e.type === "outReveal");
  ok(outEvents.length === 1, "알림은 나갈 때 한 번이어야 해요", outEvents.length);
  ok(G.stats.outReveals === 1, "판 결과의 구역 밖 공개 수가 틀려요", G.stats.outReveals);
  const shown = G.pings.filter(p => p.out).length;
  ok(shown >= 1 && shown <= 2, "1초마다 찍고 1.6초만 보여야 해요", shown);
}

{
  const { logic, G, r1, outside, inside } = setup();
  hold(logic, G, r1, outside, 3);
  hold(logic, G, r1, inside, 0.5);
  hold(logic, G, r1, outside, 0.5);
  ok(r1.outT >= 3.4, "잠깐 들어왔다 나갔는데 초가 풀렸어요", r1.outT);
  hold(logic, G, r1, inside, 1.1);
  ok(r1.outT === 0, "1초 넘게 돌아왔는데 초가 남았어요", r1.outT);
}

{
  const { logic, G, r1 } = setup();
  const J = logic.CFG.JAIL;
  r1.state = "inJail"; r1.x = J.x; r1.y = J.y;
  const out = { x: J.x + J.r + 40, y: J.y };
  hold(logic, G, r1, out, DT);
  ok(r1.state === "breaking", "감옥 밖으로 나갔는데 탈옥 중이 아니에요", r1.state);
  let safe = true;
  for (let t = 0; t < logic.CFG.BREAK_SEC - 0.1; t += DT) { if (logic.catchable(r1)) safe = false; hold(logic, G, r1, out, DT); }
  ok(safe, "탈옥하는 동안 잡힐 수 있었어요");
  hold(logic, G, r1, out, 0.2);
  ok(r1.state === "free", "3초가 지났는데 탈옥이 안 됐어요", r1.state);
}

{
  const base = globalThis.createGameLogic().newGame({ seed: 77, theme: "town", diff: "normal", scale: 1 });
  const big = globalThis.createGameLogic().newGame({ seed: 77, theme: "town", diff: "normal", scale: 1.2 });
  ok(big.map.W === 4320 && big.map.H === 3240, "1.2배 지도 크기가 틀려요", [big.map.W, big.map.H]);
  ok(big.map.reach >= 0.97, "넓은 지도가 끊겼어요", big.map.reach);
  ok(big.map.bushes.length > base.map.bushes.length, "넓은 지도인데 수풀이 늘지 않았어요", [base.map.bushes.length, big.map.bushes.length]);
  ok(big.map.W * big.map.H <= 16_777_216, "아이폰 캔버스 한도를 넘어요", big.map.W * big.map.H);
}

{
  const logic = globalThis.createGameLogic();
  const G = logic.newGame({ seed: 9, theme: "town", diff: "normal", police: 1, robbers: 1, intro: 1 });
  const [cop, rob] = [G.police[0], G.robbers[0]];
  for (const a of G.agents) a.isPlayer = true;
  const at = { x: rob.x, y: rob.y };
  // 막히지 않은 쪽으로 걷게 한다
  const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => !logic.solidAt(rob.x + dx * 40, rob.y + dy * 40));
  rob.ix = dir[0]; rob.iy = dir[1];
  for (let t = 0; t < 0.9; t += DT) logic.step(G, DT);
  ok(G.t === 0, "시작 멈춤인데 시계가 갔어요", G.t);
  ok(rob.x === at.x && rob.y === at.y, "시작 멈춤인데 도둑이 움직였어요", [rob.x - at.x, rob.y - at.y]);
  ok(viewFor(logic, G, rob).intro > 0, "시작 멈춤이 화면에 안 갔어요");
  for (let t = 0; t < 0.5; t += DT) logic.step(G, DT);
  ok(G.intro === 0 && G.t > 0 && G.phase === "wait", "시작 멈춤 뒤 대기가 이어지지 않았어요", [G.intro, G.t, G.phase]);
  ok(rob.s.dist > 0, "움직인 거리가 쌓이지 않았어요", rob.s.dist);
  ok(viewFor(logic, G, rob).intro === undefined, "멈춤이 끝났는데 계속 보냈어요");
  ok(cop.state === "waiting", "경찰이 대기하지 않아요", cop.state);
}

{
  const logic = globalThis.createGameLogic();
  const G = logic.newGame({ seed: 10, theme: "town", diff: "normal", police: 3, robbers: 3 });
  const [c1, c2, c3] = G.police, [r1, r2, r3] = G.robbers;
  for (const a of [c1, c2, r1, r2]) a.isPlayer = true;
  // 봇(c3)이 가장 많이 잡았어도 사람이 둘 이상이면 후보가 아니다
  c1.s.catches = 2; c2.s.catches = 2; c3.s.catches = 5;
  c1.s.dist = 100; c2.s.dist = 300;
  r1.s.caught = 1; r2.s.caught = 1; r3.s.caught = 0;
  r1.state = "jailed"; r2.state = "free";
  let m = logic.pickMvp(G);
  ok(m.police === c2.id, "경찰 MVP 는 같은 체포면 더 뛴 사람이에요", m);
  ok(m.robber === r2.id, "도둑 MVP 는 같은 잡힘이면 끝에 감옥 밖인 사람이에요", m);
  // 혼자 하기처럼 사람이 하나면 봇도 후보다
  for (const a of G.agents) a.isPlayer = false;
  c1.isPlayer = true;
  m = logic.pickMvp(G);
  ok(m.police === c3.id && m.robber === r3.id, "사람이 하나면 봇도 MVP 후보예요", m);
  // 나간 사람은 후보가 아니다
  for (const a of G.agents) a.isPlayer = true;
  c3.isPlayer = false; r3.isPlayer = false;
  m = logic.pickMvp(G);
  ok(m.police !== c3.id && m.robber !== r3.id, "나간 사람이 MVP 가 됐어요", m);
}

// 구역 축소(방 옵션, docs/shrink.md)
// 6) 3분 판이면 출동 뒤 33초 간격으로 네 번, 크기는 1 에서 0.7 까지 같은 폭으로, 경계는 8초 동안 이어서 줄어든다
// 7) 감옥 문 둘레는 마지막 구역 안에 남는다
// 8) 줄어든 경계 밖 도둑은 처음 구역 안이어도 5초 뒤 위치가 드러나고, 밖에서는 상대가 안 보인다. 끈 판은 그대로다
// 9) 서버와 화면이 같은 값으로 newGame 을 부르면 같은 계획을 얻는다(판 중에 구역을 보내지 않는다)
{
  const logic = globalThis.createGameLogic(), C = logic.CFG;
  const G = logic.newGame({ seed: 4242, theme: "town", diff: "normal", police: 1, robbers: 2, shrink: true });
  const P = G.shrink, gap = (C.DURATION - C.WAIT) / 5;
  ok(P && P.at.length === 4, "축소가 네 번이 아니에요", P?.at);
  ok(P.at.every((t, i) => Math.abs(t - (C.WAIT + gap * (i + 1))) < 0.11), "축소 시각이 앱 공식과 달라요", P.at);
  ok(Math.abs(P.k[4] - C.SHRINK.FINAL) < 1e-9 && P.k.every((k, i) => !i || Math.abs(P.k[i - 1] - k - (1 - C.SHRINK.FINAL) / 4) < 1e-9), "크기가 같은 폭으로 줄지 않아요", P.k);
  ok(logic.zoneK(G, P.at[0] - 0.01) === 1 && Math.abs(logic.zoneK(G, P.at[0] + P.move / 2) - (1 + P.k[1]) / 2) < 1e-9 && Math.abs(logic.zoneK(G, P.at[0] + P.move) - P.k[1]) < 1e-9, "경계가 이어서 줄지 않아요");
  let prev = 1, mono = true;
  for (let t = 0; t <= C.DURATION; t += 0.5) { const k = logic.zoneK(G, t); if (k > prev + 1e-12) mono = false; prev = k; }
  ok(mono && Math.abs(prev - C.SHRINK.FINAL) < 1e-9, "구역이 다시 커지거나 끝 크기가 틀려요", prev);
  const J = C.JAIL;
  let gateIn = true;
  for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; if (!logic.inZoneK(P, P.k[4], J.x + Math.cos(a) * C.GATE_R, J.y + Math.sin(a) * C.GATE_R)) gateIn = false; }
  ok(gateIn, "감옥 문 둘레가 마지막 구역 밖이에요");
  const s = logic.shrinkState(G, P.at[1] - 4);
  ok(s.done === 1 && !s.moving && Math.abs(s.left - 4) < 1e-9 && s.next === P.k[2], "남은 시간과 다음 크기가 틀려요", s);
  ok(logic.shrinkState(G, P.at[3] + P.move).final, "마지막 뒤에도 더 줄어든대요");

  const same = globalThis.createGameLogic().newGame({ seed: 4242, theme: "town", diff: "normal", police: 1, robbers: 2, shrink: true, intro: C.INTRO });
  ok(JSON.stringify(same.shrink) === JSON.stringify(P), "같은 값인데 다른 계획이 나왔어요");
  ok(!globalThis.createGameLogic().newGame({ seed: 4242, theme: "town", diff: "normal" }).shrink, "끈 판에 축소 계획이 있어요");

  // 처음 구역 안, 마지막 구역 밖인 자리
  const spot = (() => {
    for (let i = 0; i < logic.ZONE.length; i += 3) { const v = logic.ZONE[i], x = P.cx + (v.x - P.cx) * 0.86, y = P.cy + (v.y - P.cy) * 0.86; if (logic.inZone(x, y) && !logic.solidAt(x, y)) return { x, y }; }
    throw new Error("시험할 자리를 못 찾았어요");
  })();
  for (const a of G.agents) a.isPlayer = true;
  G.phase = "play"; G.t = P.at[3] + P.move + 1; G.shrinkN = 4; G.nextReveal = 1e9;
  const [cop] = G.police, [r1, r2] = G.robbers;
  cop.state = "free"; cop.x = J.x; cop.y = J.y + 80; r2.x = J.x + 260; r2.y = J.y;
  ok(!logic.inZoneNow(G, spot.x, spot.y) && logic.inZone(spot.x, spot.y), "시험 자리가 줄어든 경계 밖이 아니에요");
  hold(logic, G, r1, spot, 4.8);
  ok(!G.pings.some(p => p.out), "줄어든 경계 밖인데 5초 전에 위치가 보였어요");
  hold(logic, G, r1, spot, 0.4);
  ok(G.pings.some(p => p.out && p.id === r1.id), "줄어든 경계 밖에 5초 넘게 있었는데 위치가 안 보여요");
  r1.faceA = Math.atan2(cop.y - r1.y, cop.x - r1.x);
  ok(!canSee(logic, G, r1, cop), "구역 밖에서 상대가 보여요");

  const off = globalThis.createGameLogic();
  const G2 = off.newGame({ seed: 4242, theme: "town", diff: "normal", police: 1, robbers: 2 });
  for (const a of G2.agents) a.isPlayer = true;
  G2.phase = "play"; G2.t = 160; G2.nextReveal = 1e9;
  G2.police[0].state = "free"; G2.police[0].x = J.x; G2.police[0].y = J.y + 80;
  hold(off, G2, G2.robbers[0], spot, 6);
  ok(!G2.pings.some(p => p.out), "축소를 끈 판에서 처음 구역 안인데 위치가 보였어요");
}
{
  // 끝까지 한 판: 축소 알림이 네 번, 차례대로. 아무도 움직이지 않게 모두 사람으로 둔다
  const logic = globalThis.createGameLogic();
  const G = logic.newGame({ seed: 99, theme: "park", diff: "normal", shrink: true });
  for (const a of G.agents) a.isPlayer = true;
  const ns = [];
  while (!G.over) { logic.step(G, DT); for (const e of G.events.splice(0)) if (e.type === "shrink") ns.push(e.n); }
  ok(ns.join() === "1,2,3,4" && G.over.reason === "timeUp", "축소 알림이 네 번 차례대로 오지 않았어요", [ns, G.over]);
}

// ───── 좀비 모드 ─────
// 모두 사람으로 두고(봇이 끼어들지 않게) 손으로 옮겨 규칙만 본다
function zsetup(over = {}) {
  const logic = globalThis.createGameLogic();
  const G = logic.newGame({ seed: 5150, theme: "town", diff: "normal", mode: "zombie", balance: "even", police: 1, robbers: 3, ...over });
  for (const a of G.agents) a.isPlayer = true;
  while (G.phase !== "play") logic.step(G, DT);
  G.events.length = 0;
  return { logic, G };
}
{
  const { logic, G } = zsetup();
  ok(G.wait === logic.CFG.ZOMBIE.BAL.even.wake, "좀비가 깨어나는 시간이 판 균형을 따르지 않아요", G.wait);
  ok(G.agents.every(a => a.look === "police" || a.look === "robber"), "생김새가 없어요");
  const [z] = G.police, [s1, s2] = G.robbers, look1 = s1.look;
  // 물기: 닿으면 비틀거리다 좀비 편으로
  s1.x = z.x + 40; s1.y = z.y; z.faceA = 0; s2.x = z.x + 1200; s2.y = z.y;
  logic.startCatch(G, z);
  for (let t = 0; t < 0.5; t += DT) logic.step(G, DT);
  ok(s1.state === "turning", "물렸는데 비틀거리지 않아요", s1.state);
  ok(!logic.catchable(s1), "비틀거리는 사람을 또 물 수 있어요");
  for (let t = 0; t < logic.CFG.ZOMBIE.TURN + 0.2; t += DT) logic.step(G, DT);
  ok(s1.team === "police" && G.police.includes(s1) && !G.robbers.includes(s1), "2초 뒤 좀비 편으로 옮기지 않았어요", s1.team);
  ok(z.s.catches === 1, "감염 수가 안 늘었어요", z.s.catches);
  ok(s1.look === look1 && s1.origin === "robber", "물린 사람의 생김새나 원래 편이 바뀌었어요");
  // 좀비도 생존자와 같이 달린다
  ok(z.sprintSpd === logic.CFG.SPRINT.robber && z.stamSec === logic.CFG.STAMINA.robber, "좀비 달리기가 생존자와 달라요", [z.sprintSpd, z.stamSec]);
}
{
  // 구조차: 생존자는 무전 때부터, 좀비는 차가 선 뒤부터 안다. 차 옆에 버티면 탄다
  const { logic, G } = zsetup();
  const [z] = G.police, [s1] = G.robbers;
  const st = G.van.stops[0];
  G.t = st.radio + 0.01; logic.step(G, DT);
  ok(st.x !== null, "무전 때 정류장 자리가 안 정해졌어요");
  ok(logic.dist(st, z) > 700 || logic.dist(st, z) >= Math.max(...G.van.spots.map(p => logic.dist(p, z))) - 400, "정류장이 좀비 가까이에 섰어요", logic.dist(st, z));
  ok(viewFor(logic, G, s1).van.length >= 1, "생존자에게 무전이 안 갔어요");
  ok(viewFor(logic, G, z).van.length === 0, "좀비가 무전을 미리 알아요");
  G.t = st.open + 0.01; logic.step(G, DT);
  ok(viewFor(logic, G, z).van.length >= 1, "차가 섰는데 좀비가 몰라요");
  s1.x = st.x; s1.y = st.y;
  for (let t = 0; t < logic.CFG.ZOMBIE.BAL.even.board + 0.2; t += DT) { s1.x = st.x; s1.y = st.y; s1.ix = s1.iy = 0; logic.step(G, DT); }
  ok(s1.state === "escaped" && G.stats.escaped === 1, "차 옆에 버텼는데 못 탔어요", s1.state);
  ok(!canSee(logic, G, z, s1), "탄 사람이 지도에 보여요");
  while (!G.over) logic.step(G, DT);
  ok(G.over.winner === "robber" && G.over.reason === "escaped", "한 명이 탔는데 생존자가 지지 않았어요", G.over);
  ok(G.over.mvp.robber === s1.id, "먼저 탄 사람이 생존자 MVP 가 아니에요", G.over.mvp);
}
{
  // 아무도 못 타면 좀비 승리
  const { logic, G } = zsetup();
  while (!G.over) logic.step(G, DT);
  ok(G.over.winner === "police" && G.over.reason === "noEscape", "아무도 안 탔는데 좀비가 이기지 않았어요", G.over);
}
{
  // 생존자가 한 명 남으면 정류장이 일찍 열린다
  const { logic, G } = zsetup();
  const [z] = G.police, [s1, s2, s3] = G.robbers;
  for (const s of [s2, s3]) { s.x = z.x + 40; s.y = z.y; z.faceA = 0; z.catchCd = 0; z.holdT = 0; logic.startCatch(G, z); for (let t = 0; t < 0.7; t += DT) { s.x = z.x + 40; s.y = z.y; logic.step(G, DT); } z.action = null; }
  for (let t = 0; t < 3; t += DT) logic.step(G, DT);
  const last = G.van.stops.find(s => s.last);
  ok(last && Math.abs(last.open - last.radio - logic.CFG.ZOMBIE.BAL.even.last) < 1e-6, "혼자 남았는데 정류장이 일찍 안 열려요", last);
}
{
  // 문 좀비는 멈춘 2초 동안 다시 물지 못한다(물기 대기가 멈춤보다 먼저 끝나 덮치던 것, #58)
  const { logic, G } = zsetup();
  const [z] = G.police, [s1, s2] = G.robbers;
  s1.x = z.x + 40; s1.y = z.y; z.faceA = 0;
  logic.startCatch(G, z);
  for (let t = 0; t < 0.4; t += DT) logic.step(G, DT);
  ok(s1.state === "turning", "물기가 안 됐어요", s1.state);
  ok(z.catchCd >= logic.CFG.ZOMBIE.BITE_HOLD - 0.5, "물기 대기가 멈춤보다 짧아요", z.catchCd);
  let again = false;
  for (let t = 0; t < logic.CFG.ZOMBIE.BITE_HOLD - 0.4; t += DT) { s2.x = z.x + 40; s2.y = z.y; if (z.holdT > 0 && logic.startCatch(G, z)) again = true; z.action = null; logic.step(G, DT); }
  ok(!again && s2.state === "free", "멈춘 동안 다시 물었어요", s2.state);
}
{
  // 구역 축소 판: 정류장은 차가 떠날 때(안 떠나면 판 끝)의 구역 안에 선다(#58)
  let outside = 0, n = 0;
  for (const seed of [11, 22, 33, 44, 55, 66]) {
    const logic = globalThis.createGameLogic();
    const G = logic.newGame({ seed, theme: "town", diff: "normal", mode: "zombie", balance: "even", police: 1, robbers: 5, shrink: true });
    for (const a of G.agents) a.isPlayer = true;
    for (const st of G.van.stops) { G.t = st.radio + 0.01; G.phase = "play"; logic.step(G, DT); }
    for (const st of G.van.stops) { n++; if (!logic.inZoneK(G.shrink, logic.zoneK(G, st.close ?? logic.CFG.DURATION), st.x, st.y)) outside++; }
  }
  ok(n > 0 && outside === 0, "정류장이 줄어든 구역 밖에 섰어요", { outside, n });
}
{
  // 첫 좀비 수: 판 균형 반반은 늘 한 명. 사람이 둘이면 최소 한 명은 생존자
  const L = globalThis.createGameLogic();
  ok([2, 4, 6, 8].every(n => L.zombieFirst(n, "even") === 1), "반반의 첫 좀비가 한 명이 아니에요");
  ok(L.zombieFirst(2, "zomb") === 1, "두 명 판에 첫 좀비가 둘이에요");
}

console.log(`규칙 확인 ${checks}번 | 문제 ${bad}`);
process.exit(bad === 0 ? 0 : 1);
