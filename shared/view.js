// 사람마다 무엇을 보내는지 정한다. 시야가 게임의 핵심이라, 못 보는 상대의 위치는 아예 보내지 않는다.
// 화면에서 가리기만 하면 통신을 들여다보는 것만으로 숨은 상대가 보인다.

const round = v => Math.round(v);

export function canSee(logic, G, me, other) {
  if (G.over || other.team === me.team) return true;
  return me.state !== "waiting" && logic.inZone(me.x, me.y) && logic.sees(me, other);
}

function publicAgent(a) {
  return {
    id: a.id,
    team: a.team,
    name: a.name,
    x: round(a.x),
    y: round(a.y),
    vx: round(a.vx),
    vy: round(a.vy),
    face: Math.round(a.faceA * 100) / 100,
    state: a.state,
    bush: a.inBush ? 1 : 0,
    catching: a.action?.name === "catch" ? 1 : 0,
  };
}

export function viewFor(logic, G, me) {
  const others = [];
  for (const a of G.agents) {
    if (a !== me && canSee(logic, G, me, a)) others.push(publicAgent(a));
  }
  const pings = G.pings
    .filter(p => me.team === "police" || p.id === me.id)
    .map(p => ({ x: round(p.x), y: round(p.y), age: Math.round((G.t - p.t) * 10) / 10 }));
  const view = {
    t: "s",
    time: Math.round(G.t * 100) / 100,
    phase: G.phase,
    me: {
      ...publicAgent(me),
      stamina: Math.round(me.stam * 100) / 100,
      tired: me.tired ? 1 : 0,
      lock: me.lock ? Math.round(me.lock * 10) / 10 : 0,
      breakT: me.breakT ? Math.round(me.breakT * 10) / 10 : 0,
      catchCd: me.catchCd > 0 ? Math.round(me.catchCd * 10) / 10 : 0,
    },
    others,
    pings,
    rescue: Math.round(G.rescueT * 10) / 10,
    freeRobbers: G.robbers.filter(r => r.state === "free").length,
  };
  if (me.team === "police") {
    view.intel = [...G.intel.values()]
      .filter(k => G.t - k.t < 6)
      .map(k => ({ x: round(k.x), y: round(k.y) }));
  }
  return view;
}

// 사건에는 위치를 싣지 않는다. 잡으려다 놓친 장면처럼 눈에 보여야 아는 일은 본 사람에게만 보낸다.
export function eventsFor(logic, G, me, events) {
  const out = [];
  for (const e of events) {
    const actor = e.a;
    if (actor && actor !== me && !canSee(logic, G, me, actor)) continue;
    out.push({
      type: e.type,
      ...(e.r ? { r: e.r.id } : {}),
      ...(e.by ? { by: e.by.id } : {}),
      ...(actor ? { a: actor.id } : {}),
      ...(e.n !== undefined ? { n: e.n } : {}),
      ...(e.rescued ? { rescued: 1 } : {}),
    });
  }
  return out;
}
