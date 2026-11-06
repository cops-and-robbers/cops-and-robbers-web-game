// 사람끼리 하는 화면. 규칙은 서버가 돌리고, 여기서는 받은 것만 그린다.
// 들어오는 법: play.html#room=ABCD&key=열쇠&from=부른사람
// 안드로이드 바깥 브라우저로 넘길 때는 # 뒤가 사라져 ? 뒤로 받는다. 받으면 다시 # 뒤로 옮겨 주소 기록에 남기지 않는다
const NET = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
if (!location.hash && NET.get("room")) history.replaceState(null, "", `${location.pathname}#${NET}`);
const NET_ROOM = (NET.get("room") || "").toUpperCase();
const NET_KEY = NET.get("key") || "";
const NET_FROM = NET.get("from") || "";
const NET_NEW = NET.get("new") === "1";
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
  const net = { free: 0, rtt: 0, seed: null, snap: 0, room: NET_ROOM };
  let ws = null, joined = false, wasPlaying = false, retries = 0, name = "", opened = false, stopped = false;
  let lastSent = 0, lastInput = "", pingT = 0, lastLobby = null, gameReady = false;
  const send = data => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); };
  net.send = send;
  const scene = createLobbyScene(net);
  const baseFrame = frame;
  frame = dt => { baseFrame(dt); scene.after(dt); };
  net.invite = done => {
    const url = `${location.origin}${location.pathname}#room=${NET_ROOM}&key=${encodeURIComponent(NET_KEY)}&from=${encodeURIComponent(name)}`;
    if (navigator.share) { navigator.share({ url }).catch(() => {}); return; }
    navigator.clipboard?.writeText(url).then(done, done);
  };
  // 뒤로 가기나 옆으로 쓸기로 실수로 나가지 않게 한 번은 잡는다
  let backAt = 0;
  const guardBack = () => {
    history.pushState({ stay: 1 }, "");
    addEventListener("popstate", () => {
      if (ended && !wasPlaying && !scene.active) return;
      if (Date.now() - backAt < 2500) { history.back(); return; }
      backAt = Date.now(); history.pushState({ stay: 1 }, ""); toast("한 번 더 누르면 나가요");
    });
  };
  net.quit = () => { stopped = true; ended = true; ws?.close(); goHome(); };
  net.kick = id => send({ t: "kick", id });
  // 들어갈 수 없을 때. 다시 붙지 않게 멈추고 할 수 있는 일 하나만 보여 준다
  const blocked = (title, body, act) => {
    stopped = true; try { ws?.close(); } catch { /* 이미 닫혔다 */ }
    if (scene.active) scene.leave();
    $("lobbyTitle").textContent = title; $("lobbyMsg").textContent = body;
    $("lobbyForm").hidden = true; $("lobbyHome").hidden = act !== "home"; $("lobbyRetry").hidden = act !== "retry";
    $("hud").className = ""; $("lobby").className = "sheet show";
  };
  $("lobbyHome").onclick = () => goHome();
  $("lobbyRetry").onclick = () => location.reload();
  const lobby = (show, message) => {
    $("lobby").className = show ? "sheet show" : "sheet";
    if (message !== undefined) $("lobbyMsg").textContent = message;
  };

  function connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/room/${NET_ROOM}?key=${encodeURIComponent(NET_KEY)}`);
    ws.onopen = () => {
      retries = 0;
      opened = true;
      send({ t: "join", name, token: store.get(tokenKey) || undefined, create: NET_NEW || undefined });
    };
    ws.onmessage = e => onMessage(JSON.parse(e.data));
    ws.onclose = () => {
      joined = false;
      if (stopped) return;
      // 한 번도 못 붙었으면 오래 기다리게 하지 않는다
      if (!opened && retries >= 2) { blocked("지금은 들어갈 수 없어요", "잠시 뒤에 다시 해 주세요", "retry"); return; }
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
        // 방을 만든 뒤에는 주소에서 표시를 지워 다시 열어도 만든 사람으로 치지 않는다
        if (NET_NEW) history.replaceState(history.state, "", location.href.replace(/&new=1/, ""));
        return;
      case "lobby":
        lastLobby = m;
        if (wasPlaying || ended) return;
        lobby(false);
        if (scene.active) scene.update(m); else scene.enter(m);
        return;
      case "count":
        return scene.count(m.ms);
      case "say":
        return scene.say(m.id, m.i);
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
        if (m.code === "sideFull") scene.refused(m.side);
        if (m.code === "cantStart") scene.cant();
        if (m.code === "playing") blocked("지금 한 판 하는 중이에요", "3분 안에 끝나요", "retry");
        if (m.code === "full") blocked("방이 꽉 찼어요", "", "home");
        if (m.code === "noRoom") blocked("이 코드로 열린 방이 없어요", "", "home");
        if (m.code === "kicked") blocked("방장이 내보냈어요", "", "home");
    }
  }

  function onStart(m) {
    lobby(false);
    if (wasPlaying && net.seed === m.seed) return; // 끊겼다 돌아왔으면 하던 판을 이어 그린다
    wasPlaying = true;
    gameReady = false;
    net.seed = m.seed;
    const go = () => {
      scene.leave();
      CFG.WAIT = m.wait;
      CFG.DURATION = m.duration;
      CFG.RESCUE_SEC = m.rescue;
      CFG.AUTO_ESCAPE = m.autoEscape;
      CFG.CATCH_R = m.catchRange;
      showGame(m.team, { seed: m.seed, theme: m.theme, diff: "normal", police: m.police, robbers: m.robbers }, G2 => {
        G2.player = G2.agents[m.you];
        G2.player.isPlayer = true;
        // 못 본 상대의 이름은 받지 않으니 진영으로 부른다
        for (const a of G2.agents) if (a !== G2.player) a.name = a.team === "police" ? "경찰" : "도둑";
      });
      gameReady = true;
      syncRotate();
    };
    // 대기실에서 왔으면 내 편을 잠깐 보여 주고 넘어간다
    if (scene.active) { scene.reveal(m.team); setTimeout(go, 900); } else go();
  }

  function onSnap(s) {
    if (!G || !wasPlaying || !gameReady) return;
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
    if (!G || !gameReady) return;
    const who = id => (id === undefined ? undefined : G.agents[id]);
    // 판 끝은 over 메시지로 받는다
    for (const e of list) if (e.type !== "over") G.events.push({ ...e, a: who(e.a), r: who(e.r), by: who(e.by) });
  }

  function onOver(m) {
    if (!G || ended || !gameReady) return;
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
    if (scene.active) return scene.step(dt);
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
    if (!joined || scene.active) return;
    const now = performance.now();
    const x = Math.round(v.x * 100) / 100, y = Math.round(v.y * 100) / 100, s = sprint ? 1 : 0;
    const key = `${x},${y},${s}`;
    if (!catching && (now - lastSent < INPUT_GAP_MS || (key === lastInput && now - lastSent < INPUT_IDLE_MS))) return;
    lastSent = now;
    lastInput = key;
    send(catching ? { t: "input", x, y, s, c: 1 } : { t: "input", x, y, s });
  };

  net.sees = a => scene.active || a.seenAt === net.snap;
  net.isOver = () => !wasPlaying;
  net.toLobby = () => {
    ended = false;
    G = null;
    chars.forEach(c => c.el.remove());
    chars = [];
    $("end").className = "sheet";
    $("hud").className = "";
    if (lastLobby) scene.enter(lastLobby);
  };

  $("start").className = "sheet";
  $("swap").hidden = true;
  $("lobbyName").value = store.get("name") || "";
  $("lobbyTitle").textContent = NET_FROM ? `${NET_FROM.slice(0, 6)} 님이 경도 하재요` : "경찰과 도둑";
  lobby(true, "");
  $("lobbyJoin").onclick = () => {
    name = Array.from($("lobbyName").value.trim()).slice(0, 6).join("");
    store.set("name", name);
    $("lobbyForm").hidden = true;
    unlockAudio();
    tryLandscape();
    keepAwake();
    guardBack();
    lobby(true, "연결하는 중이에요");
    connect();
  };
  return net;
}

// 첫 화면. 열쇠만 있고 방이 없으면 방을 만들거나 코드로 들어간다
const ROOM_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function goHome() { location.hash = `key=${encodeURIComponent(NET_KEY)}`; location.reload(); }
function goRoom(code, create) { location.hash = `room=${code}&key=${encodeURIComponent(NET_KEY)}${create ? "&new=1" : ""}`; location.reload(); }
function showHome() {
  $("start").className = "sheet"; $("home").className = "sheet show";
  $("homeCreate").onclick = () => goRoom(Array.from(crypto.getRandomValues(new Uint8Array(5)), b => ROOM_CHARS[b % ROOM_CHARS.length]).join(""), true);
  $("homeJoinOpen").onclick = () => { $("homeJoinOpen").hidden = true; $("homeJoin").hidden = false; $("homeCode").focus(); };
  const join = () => { const code = $("homeCode").value.trim().toUpperCase(); if (!/^[A-Z0-9]{4,8}$/.test(code)) { $("homeCodeMsg").textContent = "영어와 숫자로 4~8자예요"; return; } goRoom(code, false); };
  $("homeJoinGo").onclick = join;
  $("homeCode").onkeydown = e => { if (e.key === "Enter") join(); };
  $("homeSolo").onclick = () => { $("home").className = "sheet"; $("start").className = "sheet show"; };
}

// 카카오톡 같은 앱 안 브라우저는 전체 화면이 안 되고 화면도 좁아서 바깥 브라우저로 내보낸다
function leaveInApp() {
  const ua = navigator.userAgent, kakao = /KAKAOTALK/i.test(ua), android = /Android/i.test(ua);
  const inApp = kakao || /Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|everytimeApp|; wv\)/i.test(ua);
  if (!inApp || store.get("stayInApp")) return;
  const page = `${location.origin}${location.pathname}?${new URLSearchParams(location.hash.slice(1))}`;
  const open = () => {
    if (kakao) location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}`;
    else if (android) location.href = `intent://${location.host}${location.pathname}?${new URLSearchParams(location.hash.slice(1))}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(page)};end`;
  };
  const canOpen = kakao || android;
  $("inappBody").textContent = canOpen ? "" : "메뉴에서 Safari로 열어 주세요";
  $("inappOpen").hidden = !canOpen;
  $("inapp").className = "sheet show";
  $("inappOpen").onclick = open;
  $("inappCopy").onclick = () => { navigator.clipboard?.writeText(location.href).then(() => { $("inappCopy").textContent = "링크를 복사했어요"; $("inappBody").textContent = "브라우저 주소창에 붙여 넣어 주세요"; }, () => {}); };
  $("inappStay").onclick = () => { store.set("stayInApp", "1"); $("inapp").className = "sheet"; };
  if (canOpen && !store.get("triedOut")) { store.set("triedOut", "1"); open(); }
}

if (NET_ROOM && NET_KEY) { online = createOnline(); leaveInApp(); }
else if (NET_KEY) { showHome(); leaveInApp(); }
window.__game.online = () => online;
