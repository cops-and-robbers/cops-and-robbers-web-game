// 팀 시험(11/7) 뒤 바꾼 규칙을 검사한다. node tools/ruletest.mjs
// 1) 구역 밖에 5초 넘게 있는 도둑은 1초마다 위치가 경찰에게만 보이고, 알림은 나갈 때 한 번
// 2) 경계에서 잠깐 들어왔다 나가도 초가 풀리지 않고, 1초 넘게 돌아와야 처음부터 센다
// 3) 감옥 문이 열려 밖으로 나간 도둑은 탈옥할 때까지(3초) 잡히지 않는다
// 4) 인원이 많은 판의 넓은 지도도 이어져 있고 수풀이 넓이만큼 늘어난다
// 5) 시작 멈춤 동안은 시계도 사람도 움직이지 않고, 끝나면 그대로 대기가 이어진다
// 6) 팀 MVP: 경찰은 많이 잡은 사람, 도둑은 덜 잡힌 사람. 사람이 둘 이상이면 봇은 후보가 아니다
import "../shared/logic.js";
import { viewFor } from "../shared/view.js";

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

console.log(`규칙 확인 ${checks}번 | 문제 ${bad}`);
process.exit(bad === 0 ? 0 : 1);
