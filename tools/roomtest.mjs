// 한 서버에서 방 여러 개를 함께 돌려도 서로 섞이지 않는지 검사한다. node tools/roomtest.mjs [판 수]
// 혼자 돌린 결과와 번갈아 돌린 결과가 한 글자도 같아야 한다.
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";

const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL("../shared/logic.js", import.meta.url), "utf8"), ctx);
const create = ctx.window.createGameLogic;
const N = Number(process.argv[2] || 6);
const DT = 1 / 20;

const snapshot = G => G.agents.map(a => [a.x.toFixed(3), a.y.toFixed(3), a.state]).join(";");

function open(logic, opts) {
  const G = logic.newGame({ botPlayer: true, ...opts });
  return { logic, G, hash: crypto.createHash("sha1") };
}
function tick(room) {
  if (room.G.over || room.G.t >= 400) return false;
  room.logic.step(room.G, DT);
  room.hash.update(snapshot(room.G));
  return true;
}
function finish(room) {
  return `${room.hash.digest("hex")}:${room.G.over?.winner}:${room.G.t.toFixed(2)}`;
}
function alone(opts) {
  const room = open(create(), opts);
  while (tick(room));
  return finish(room);
}
// 서로 다른 지도의 방을 한 걸음씩 번갈아 돌린다
function together(optsList, makeLogic) {
  const rooms = optsList.map(opts => open(makeLogic(), opts));
  let alive = true;
  while (alive) {
    alive = false;
    for (const room of rooms) alive = tick(room) || alive;
  }
  return rooms.map(finish);
}

const cases = [];
for (let i = 0; i < N; i++) {
  cases.push([
    { seed: 2000 + i, theme: "town", diff: "easy" },
    { seed: 3000 + i, theme: "snow", diff: "hard" },
    { seed: 4000 + i, theme: "city", diff: "normal" },
  ]);
}

let bad = 0;
for (const optsList of cases) {
  const expected = optsList.map(alone);
  const actual = together(optsList, create);
  actual.forEach((value, i) => {
    if (value !== expected[i]) {
      bad++;
      console.log("섞임", optsList[i], expected[i], value);
    }
  });
}

// 검사가 정말 섞임을 잡는지 본다. 규칙 하나를 함께 쓰면 달라져야 한다
const shared = create();
const leaked = cases.filter(optsList => {
  const expected = optsList.map(alone);
  const actual = together(optsList, () => shared);
  return actual.some((value, i) => value !== expected[i]);
}).length;

console.log(`방 ${N * 3}개 | 따로 만든 규칙에서 섞임 ${bad} | 하나를 함께 쓰면 달라진 묶음 ${leaked}/${N}`);
process.exit(bad === 0 && leaked > 0 ? 0 : 1);
