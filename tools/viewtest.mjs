// 못 보는 상대의 위치가 보내는 내용에 섞이지 않는지 검사한다. node tools/viewtest.mjs [판 수]
import "../shared/logic.js";
import { canSee, eventsFor, viewFor } from "../shared/view.js";

const N = Number(process.argv[2] || 4);
const DT = 1 / 20;
let views = 0, hiddenChecks = 0, seenEnemies = 0, bad = 0;

function fail(message, detail) {
  bad++;
  console.log("실패", message, detail ?? "");
}

for (let i = 0; i < N; i++) {
  const logic = globalThis.createGameLogic();
  const G = logic.newGame({ seed: 5000 + i, theme: "town", diff: "normal", botPlayer: true });

  while (!G.over && G.t < 400) {
    logic.step(G, DT);
    const events = G.events.splice(0);
    for (const me of G.agents) {
      const view = viewFor(logic, G, me);
      const text = JSON.stringify(view);
      views++;

      for (const other of G.agents) {
        if (other === me) continue;
        const listed = view.others.some(o => o.id === other.id);
        const visible = canSee(logic, G, me, other);
        if (listed !== visible) fail("시야 판정과 목록이 달라요", { t: G.t, me: me.id, other: other.id });
        if (other.team !== me.team && listed) seenEnemies++;
        if (other.team !== me.team && !listed) {
          hiddenChecks++;
          // 못 보는 상대는 이름도, 위치 쌍도 보내면 안 된다
          if (text.includes(`"name":"${other.name}"`)) fail("숨은 상대 이름이 들어갔어요", { me: me.id, other: other.id });
          if (text.includes(`"x":${Math.round(other.x)},"y":${Math.round(other.y)}`)) {
            const ping = view.pings.some(p => p.x === Math.round(other.x) && p.y === Math.round(other.y));
            const intel = view.intel?.some(k => k.x === Math.round(other.x) && k.y === Math.round(other.y));
            if (!ping && !intel) fail("숨은 상대 위치가 들어갔어요", { me: me.id, other: other.id });
          }
        }
      }
      if (me.team === "robber" && view.intel) fail("도둑에게 경찰 정보가 갔어요");
      if (me.team === "robber" && view.pings.length > 1) fail("도둑에게 다른 도둑의 공개 위치가 갔어요");
      for (const event of eventsFor(logic, G, me, events)) {
        if ("x" in event || "y" in event) fail("사건에 위치가 들어갔어요", event);
      }
    }
  }
}

console.log(`보낸 내용 ${views}건 | 숨은 상대 확인 ${hiddenChecks}번 | 본 상대 ${seenEnemies}번 | 문제 ${bad}`);
// 검사가 헛돌지 않았는지도 본다. 숨은 경우와 보인 경우가 모두 있어야 한다
if (hiddenChecks === 0 || seenEnemies === 0) {
  console.log("실패 검사가 양쪽 경우를 다 보지 못했어요");
  process.exit(1);
}
process.exit(bad === 0 ? 0 : 1);
