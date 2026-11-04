// 사람끼리 하는 화면. 규칙은 서버가 돌리고, 여기서는 받은 것만 그린다.
// 들어오는 법: play.html#room=ABCD&key=열쇠 (대기실 디자인과 초대 흐름은 다음 단계에서 만든다)
const NET = new URLSearchParams(location.hash.slice(1));
const NET_ROOM = (NET.get("room") || "").toUpperCase();
const NET_KEY = NET.get("key") || "";
const INPUT_GAP_MS = 100;
const INPUT_IDLE_MS = 1000;
const RETRY_MS = 2000;
const RETRY_MAX = 15;

const store = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* 저장이 안 되면 끊겼을 때 이어 하지 못할 뿐이다 */ } },
};

function createOnline() {
  const tokenKey = `room:${NET_ROOM}:token`;
  const net = { free: 0, rtt: 0, seed: null, snap: 0 };
  let ws = null, joined = false, wasPlaying = false, retries = 0, name = "";
  let lastSent = 0, lastInput = "", pingT = 0;
  const send = data => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
  const lobby = (show, message) => {
    $("lobby").className = show ? "sheet show" : "sheet";
    if (message !== undefined) $("lobbyMsg").textContent = message;
  };

  function connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/room/${NET_ROOM}?key=${encodeURIComponent(NET_KEY)}`);
    ws.onopen = () => {
      retries = 0;
      send({ t: "join", name, token: store.get(tokenKey) || undefined });
    };
    ws.onmessage = e => onMessage(JSON.parse(e.data));
    ws.onclose = () => {
      joined = false;
      if (ended || retries >= RETRY_MAX) {
        if (!ended) lobby(true, "연결이 끊겼어요. 받은 링크를 다시 열어 주세요");
        return;
      }
      retries++;
      if (wasPlaying) toast("연결이 끊겼어요. 다시 들어가는 중이에요", "bad");
      else lobby(true, "다시 연결하는 중이에요");
      setTimeout(connect, RETRY_MS);
    };
  }

  function onMessage(m) {
    switch (m.t) {
      case "joined":
        joined = true;
        store.set(tokenKey, m.token);
        return;
      case "lobby":
        if (wasPlaying && !ended) return;
        $("lobbyList").textContent = m.players.join(", ");
        $("lobbyStart").hidden = !m.host;
        if (!ended) lobby(true, m.host ? "다 모이면 시작을 눌러 주세요" : "방장이 시작하면 바로 시작해요");
        return;
      case "start":
        return onStart(m);
      case "s":
        return onSnap(m);
      case "e":
        return onEvents(m.list);
      case "over":
        return onOver(m);
      case "pong":
        net.rtt = Math.round(performance.now() - m.n);
        if (NET.get("debug")) $("status").dataset.rtt = net.rtt;
        return;
      case "error":
        if (m.code === "playing") lobby(true, "이미 시작한 방이에요. 끝나면 다시 들어와 주세요");
        if (m.code === "full") lobby(true, "방이 가득 찼어요");
    }
  }

  function onStart(m) {
    lobby(false);
    if (wasPlaying && net.seed === m.seed) return; // 끊겼다 돌아왔으면 하던 판을 이어 그린다
    wasPlaying = true;
    net.seed = m.seed;
    CFG.WAIT = m.wait;
    CFG.DURATION = m.duration;
    showGame(m.team, { seed: m.seed, theme: m.theme, diff: "normal" }, G2 => {
      G2.player = G2.agents[m.you];
      G2.player.isPlayer = true;
      // 못 본 상대의 이름은 받지 않으니 진영으로 부른다
      for (const a of G2.agents) if (a !== G2.player) a.name = a.team === "police" ? "경찰" : "도둑";
    });
    syncRotate();
  }

  function onSnap(s) {
    if (!G || !wasPlaying) return;
    const now = performance.now();
    net.snap++;
    G.t = s.time;
    G.phase = s.phase;
    G.rescueT = s.rescue;
    G.nextReveal = s.nextReveal;
    net.free = s.freeRobbers;
    G.pings = s.pings.map(k => ({ x: k.x, y: k.y, t: s.time - k.age, id: G.player.id }));
    G.intel = new Map((s.intel || []).map((k, i) => [i, { x: k.x, y: k.y, t: s.time }]));
    for (const o of [s.me, ...s.others]) applyAgent(o, now);
    const me = G.player;
    me.stam = s.me.stamina;
    me.tired = !!s.me.tired;
    me.lock = s.me.lock;
    me.breakT = s.me.breakT;
    me.catchCd = s.me.catchCd;
    for (const a of G.agents) {
      if (a.seenAt === net.snap) continue;
      a.vx = a.vy = a.ix = a.iy = 0;
      a.inBush = false;
    }
  }

  function applyAgent(o, now) {
    const a = G.agents[o.id];
    const fresh = a.seenAt !== net.snap - 1 || a.tx === undefined;
    a.seenAt = net.snap;
    a.tx = o.x;
    a.ty = o.y;
    a.snapAt = now;
    if (fresh) { a.x = o.x; a.y = o.y; }
    a.vx = o.vx;
    a.vy = o.vy;
    a.faceA = o.face;
    a.state = o.state;
    a.inBush = !!o.bush;
    if (o.catching) a.action ||= { name: "catch", dx: Math.cos(o.face) };
    else a.action = null;
    if (a !== G.player) {
      const m = Math.hypot(o.vx, o.vy);
      a.ix = m > 1 ? o.vx / m : 0;
      a.iy = m > 1 ? o.vy / m : 0;
      a.name = o.name;
      const tag = chars[o.id]?.tag;
      if (tag && tag.textContent !== o.name) tag.textContent = o.name;
    }
  }

  function onEvents(list) {
    if (!G) return;
    const who = id => (id === undefined ? undefined : G.agents[id]);
    // 판 끝은 over 메시지로 받는다
    for (const e of list) if (e.type !== "over") G.events.push({ ...e, a: who(e.a), r: who(e.r), by: who(e.by) });
  }

  function onOver(m) {
    if (!G || ended) return;
    wasPlaying = false;
    net.seed = null;
    handleEvents();
    G.over = { winner: m.winner, reason: m.reason };
    if (m.stats) G.stats = m.stats;
    if (m.mine) G.player.s = m.mine;
    showEnd();
    sfx(m.winner === G.player.team ? "win" : "lose");
  }

  // 그리기 한 번. 받은 자리를 부드럽게 따라가고, 내 캐릭터는 받은 뒤 지난 시간만큼 앞서 그린다
  net.step = dt => {
    const now = performance.now();
    for (const a of G.agents) {
      if (a.tx === undefined || a.seenAt !== net.snap) continue;
      const ahead = a === G.player ? Math.min(0.12, (now - a.snapAt) / 1000) : 0;
      const gx = a.tx + a.vx * ahead, gy = a.ty + a.vy * ahead;
      if (Math.hypot(gx - a.x, gy - a.y) > 220) { a.x = gx; a.y = gy; continue; }
      const k = 1 - Math.exp(-dt * (a === G.player ? 22 : 16));
      a.x += (gx - a.x) * k;
      a.y += (gy - a.y) * k;
    }
    pingT -= dt;
    if (pingT <= 0) { pingT = 2; send({ t: "ping", n: Math.round(now) }); }
  };

  // 바뀔 때만, 초당 10번까지 보낸다. 받는 메시지가 사용량에 잡힌다
  net.input = (v, sprint, catching) => {
    if (!joined) return;
    const now = performance.now();
    const x = Math.round(v.x * 100) / 100, y = Math.round(v.y * 100) / 100, s = sprint ? 1 : 0;
    const key = `${x},${y},${s}`;
    if (!catching && (now - lastSent < INPUT_GAP_MS || (key === lastInput && now - lastSent < INPUT_IDLE_MS))) return;
    lastSent = now;
    lastInput = key;
    send(catching ? { t: "input", x, y, s, c: 1 } : { t: "input", x, y, s });
  };

  net.sees = a => a.seenAt === net.snap;
  net.isOver = () => !wasPlaying;
  net.toLobby = () => {
    ended = false;
    G = null;
    chars.forEach(c => c.el.remove());
    chars = [];
    $("end").className = "sheet";
    $("hud").className = "";
    lobby(true);
  };

  $("start").className = "sheet";
  $("swap").hidden = true;
  $("lobbyName").value = store.get("name") || "";
  $("lobbyCode").textContent = NET_ROOM;
  lobby(true, "이름을 적고 들어와 주세요");
  $("lobbyJoin").onclick = () => {
    name = $("lobbyName").value.trim().slice(0, 12);
    store.set("name", name);
    $("lobbyForm").hidden = true;
    unlockAudio();
    tryLandscape();
    lobby(true, "연결하는 중이에요");
    connect();
  };
  $("lobbyStart").onclick = () => send({ t: "start" });
  return net;
}

if (NET_ROOM && NET_KEY) online = createOnline();
window.__game.online = () => online;
