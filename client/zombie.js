// 좀비 모드 화면(docs/zombie.md). 규칙은 shared/logic.js, 여기는 그리기와 알림만.
// game.js 와 같은 전역에서 돈다(빌드가 game.js 뒤에 붙인다). game.js 는 G.mode === "zombie" 일 때만 여기를 부른다
const ZB = (() => {
  const isZ = () => G?.mode === "zombie";
  // 좀비 모습: 피부색만 바꾸고 붕대와 꿰맨 자국을 한 겹 덧댄다. 모자, 털모자, 코는 그대로라 누구였는지 알아본다
  const SKIN = { "#57BFFF": "#86AE8F", "#9FD6FF": "#AECBB2", "#B3DCFF": "#C3DAC3", "#0B4692": "#433C5E", "#0B4690": "#433C5E", "#FFB600": "#A99A68", "#FFE500": "#C6B984", "#FDB403": "#A99A68", "#DD7C00": "#7E7150",
    "#007ECA": "#5F8A6B", "#6CBFFF": "#93B79A", "#85CFFF": "#A2C3A7", "#A5AAB7": "#A6BDA6", "#7D828E": "#7F9A84", "#1D232B": "#2B2536", "#9196A3": "#93AE96", "#A3A8B5": "#A3BBA4", "#7D808C": "#7E9882", "#000A12": "#241F2E" };
  const MARKS = {
    "police-front": '<g transform="rotate(28 140 62)"><rect x="118" y="55" width="46" height="13" rx="4" fill="#F4EFE4" stroke="#CFC6B4" stroke-width="1.2"/><path d="M126 58v7M134 58v7M142 58v7M150 58v7M158 58v7" stroke="#CFC6B4" stroke-width="1.2"/></g><g stroke="#5D4A86" stroke-width="2.2" stroke-linecap="round"><path d="M78 158l24 6"/><path d="M83 154l-2 9M91 156l-2 9M99 158l-2 9"/></g>',
    "robber-front": '<g transform="rotate(-30 28 40)"><rect x="12" y="34" width="34" height="11" rx="4" fill="#F4EFE4" stroke="#CFC6B4" stroke-width="1.1"/><path d="M19 37v5M26 37v5M33 37v5M40 37v5" stroke="#CFC6B4" stroke-width="1.1"/></g><g stroke="#5D4A86" stroke-width="2" stroke-linecap="round"><path d="M106 92l14 8"/><path d="M109 89l-3 7M115 92l-3 7"/></g>',
  };
  const recolor = s => { for (const [a, b] of Object.entries(SKIN)) s = s.split(a).join(b); return s; };
  const cache = new Map();
  function svg(name) {
    if (!cache.has(name)) cache.set(name, recolor(SVGS[name]).replace(/<\/svg>\s*$/, (MARKS[name] || "") + "</svg>"));
    return cache.get(name);
  }
  const url = name => "data:image/svg+xml," + encodeURIComponent(svg(name));
  // 엔진은 팔다리 막대를 그림 정보(DEFS)의 색으로 그린다. 좀비로 붙일 때만 잠깐 바꿔 끼운다
  function mountZ(name) {
    const def = window.CharRig.DEFS[name], saved = def?.limbs?.map(l => l.color);
    if (saved) def.limbs.forEach(l => l.color = recolor(l.color));
    try { return mount(svg(name), name); } finally { if (saved) def.limbs.forEach((l, i) => l.color = saved[i]); }
  }
  const zombie = a => isZ() && a.team === "police";
  const lookOf = a => a.look || a.team;

  // ───── 편 바뀜 ─────
  // 서버 판은 갱신과 사건으로 편이 바뀐 걸 알고, 혼자 하기는 규칙이 직접 옮긴다. 어느 쪽이든 그림은 frame 이 맞춘다
  function switchTeam(a, team) {
    if (a.team === team) return;
    const from = a.team === "police" ? G.police : G.robbers, to = team === "police" ? G.police : G.robbers;
    const i = from.indexOf(a); if (i >= 0) from.splice(i, 1);
    if (!to.includes(a)) to.push(a);
    a.team = team;
  }
  // 생김새나 편이 그림과 다르면 다시 만든다. 좀비가 되는 순간 보라 가루가 피어오른다
  function syncChars() {
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i], a = c.a;
      if (c.kind === lookOf(a) && !!c.zombie === zombie(a)) continue;
      const was = c.zombie;
      c.el.remove(); chars[i] = makeChar(a);
      if (!was && chars[i].zombie && c.el.style.display !== "none") { burst(a.x, a.y - 40, "#9A78E0", 18); burst(a.x, a.y - 20, "#C9B6FF", 8); }
    }
    // 내가 물려 좀비가 되면 내 버튼과 칸을 좀비 것으로 바꾼다
    const p = G.player;
    if (p && p.team !== role) {
      role = p.team; document.body.dataset.role = role;
      $("btnCatch").style.display = role === "police" ? "" : "none";
      $("btnCatch").textContent = tt("zb").bite;
      const k = document.querySelector('#hint em[data-t="catch"]'); if (k) k.textContent = tt("zb").bite;
      lastPip = "";
    }
  }

  // ───── 구조차 ─────
  // 서버 판은 내가 아는 정류장만 받고(view.van), 혼자 하기는 규칙에서 내 편이 아는 것만 고른다
  // 구조차는 경찰차 그림의 파랑을 노랑으로 바꿔 쓴다
  const CAR = "/*B64:car.svg*/";
  let vanImg = null;
  function vanImage() {
    if (vanImg) return vanImg;
    vanImg = new Image(); vanImg.src = "data:image/svg+xml," + encodeURIComponent(atob(CAR).split("#0088FF").join("#FFB21A"));
    return vanImg;
  }
  function stops() {
    const p = G.player; if (!p) return [];
    if (online) return (G.zVan || []).map(s => ({ ...s, isOpen: G.t >= s.open && (s.close === undefined || G.t < s.close) }));
    return G.van.stops.filter(s => L.stopKnown(G, s, p.team === "robber" ? "robber" : "police")).map(s => ({ x: s.x, y: s.y, open: s.open, close: s.close ?? undefined, isOpen: L.stopOpen(G, s) }));
  }
  // 길 위의 노란 칸과 차. 칸은 길 폭에 맞춰 건물이나 수풀로 넘어가지 않는다
  function drawVan(fx2) {
    if (!isZ()) return;
    const R = CFG.ZOMBIE.STOP_R, img = vanImage();
    for (const s of stops()) {
      const road = L.ROADS.find(r => s.x >= r.x && s.x <= r.x + r.w && s.y >= r.y && s.y <= r.y + r.h);
      const hor = road ? road.w >= road.h : true, half = road ? Math.min(road.w, road.h) / 2 - 6 : 48;
      const w = hor ? R * 2 : half * 2, hgt = hor ? half * 2 : R * 2;
      const [x, y] = toScreen(s.x - w / 2, s.y - hgt / 2);
      fx2.save();
      fx2.globalAlpha = s.isOpen ? 1 : 0.55;
      fx2.fillStyle = "rgba(255,200,61,.2)"; fx2.strokeStyle = "#FFC83D"; fx2.lineWidth = Math.max(2, 4 * zoom);
      if (!s.isOpen) fx2.setLineDash([12 * zoom, 9 * zoom]);
      fx2.beginPath(); fx2.roundRect(x, y, w * zoom, hgt * zoom, 18 * zoom); fx2.fill(); fx2.stroke();
      if (s.isOpen && img.complete) { const vw = 120 * zoom, vh = vw * 141 / 192, [cx, cy] = toScreen(s.x, s.y); fx2.globalAlpha = 1; fx2.drawImage(img, cx - vw / 2, cy - vh * 0.72, vw, vh); }
      fx2.restore();
    }
    // 타는 중: 머리 위 원이 차오른다
    const p = G.player, b = online ? G.zBoard : p.boardT;
    if (p && b > 0 && p.state === "free") {
      const [x, y] = toScreen(p.x, p.y - 120), r = 18 * zoom + 6;
      fx2.save(); fx2.lineWidth = 6; fx2.lineCap = "round";
      fx2.strokeStyle = "rgba(255,255,255,.35)"; fx2.beginPath(); fx2.arc(x, y, r, 0, 7); fx2.stroke();
      fx2.strokeStyle = "#FFC83D"; fx2.beginPath(); fx2.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.min(1, b / G.zb.board) * Math.PI * 2); fx2.stroke();
      fx2.restore();
    }
  }
  function drawMini(x, s) {
    if (!isZ()) return;
    for (const st of stops()) { x.fillStyle = "#FFC83D"; x.strokeStyle = "#1D232B"; x.lineWidth = 1.5; x.beginPath(); x.roundRect(st.x * s - 5, st.y * s - 4, 10, 8, 2); x.fill(); x.stroke(); }
  }
  // 생존자 칸: 구조차를 알면 "오기까지 / 떠나기까지", 서 있으면 "섰어요"
  function vanCard() {
    const p = G.player; if (!p || p.team !== "robber") return null;
    const known = stops(); if (!known.length) return null;
    const soon = known.filter(s => !s.isOpen).sort((a, b) => a.open - b.open)[0], open = known.filter(s => s.isOpen), leaving = open.filter(s => s.close !== undefined).sort((a, b) => a.close - b.close)[0];
    const Z = tt("zb");
    if (leaving) return { label: Z.vanLeaving, n: Math.ceil(leaving.close - G.t), of: CFG.ZOMBIE.VAN_NEXT };
    if (soon && !open.length) return { label: Z.vanComing, n: Math.ceil(soon.open - G.t), of: G.zb.radio };
    return { label: Z.vanHere, n: open.length, of: 0, here: true };
  }

  // ───── 심장 소리 ─────
  // 안 보이는 좀비가 가까우면 가장자리가 붉게 뛰고 심장 소리. 서버는 세 단계(me.heart)만 보내고, 혼자 하기는 거리로 같은 단계를 센다
  let heartT = 0;
  function heart(dt) {
    const el = $("zHeart"), p = G.player;
    let lv = 0;
    if (isZ() && p && p.team === "robber" && p.state === "free" && G.phase === "play" && !ended) {
      if (online) lv = G.zHeart || 0;
      else { const d = Math.min(1e9, ...G.police.filter(z => z.state === "free").map(z => dist(p, z))), H = CFG.ZOMBIE.HEART; lv = d < H * 0.4 ? 3 : d < H * 0.7 ? 2 : d < H ? 1 : 0; }
    }
    el.className = lv ? "on l" + lv : "";
    if (!lv) { heartT = 0; return; }
    heartT -= dt;
    if (heartT <= 0) { heartT = [0, 0.95, 0.7, 0.48][lv]; play("heart", 0.9 + lv * 0.07); el.classList.remove("beat"); void el.offsetWidth; el.classList.add("beat"); }
  }

  // ───── 칸과 알림 ─────
  // 사람 수 점: 노랑은 생존자, 보라는 좀비, 테두리만 있는 노랑은 탄 사람
  function pips() {
    const free = online ? online.free : G.robbers.filter(r => r.state === "free").length;
    const esc = online ? G.stats.escaped || 0 : G.stats.escaped || 0, z = G.police.length;
    return { key: `${free}.${esc}.${z}`, html: [...Array(free)].map(() => `<i class="zs"></i>`).concat([...Array(esc)].map(() => `<i class="zs esc"></i>`), [...Array(z)].map(() => `<i class="zz"></i>`)).join("") };
  }
  function statusLine(p) {
    const Z = tt("zb");
    if (p.state === "turning") return Z.turning;
    if (p.state === "escaped") return Z.escaped;
    if (G.phase === "wait") return p.team === "police" ? Z.waitZ : Z.waitS;
    return null;
  }
  function onEvent(e) {
    const p = G.player, Z = tt("zb"), nm = a => nameOf(a?.name ?? "");
    if (e.type === "reveal") {
      if (p.team === "police") { play("reveal"); haptic(250); toast(Z.revealedZ, "good"); }
      else if (p.state === "free") { play("reveal"); haptic(250); toast(Z.revealedS, "bad"); }
      return true;
    }
    if (e.type === "bitten") {
      if (e.r) { e.r.state = "turning"; chars[e.r.id] && (chars[e.r.id].turnAt = performance.now()); }
      if (e.r === p) { play("caught"); haptic(500); shake = 12; hitStop = 0.08; Scenes.bitten(lookOf(p)); }
      else if (e.by === p) { play("catch"); haptic(80); toast(Z.iInfected(nm(e.r)), "good"); }
      else { toast(Z.xInfected(nm(e.r)), p.team === "police" ? "good" : "bad"); }
      if (e.r && (e.r === p || e.by === p || seen(e.r))) burst(e.r.x, e.r.y - 40, "#9A78E0", 14);
    }
    if (e.type === "turned" && e.r) {
      switchTeam(e.r, "police"); e.r.state = "free";
      if (e.r === p) toast(Z.youZombie, "bad");
    }
    if (e.type === "boarded" && e.r) {
      e.r.state = "escaped";
      if (e.r === p) { play("free"); haptic([0, 120, 80, 120]); toast(Z.iEscaped, "good"); }
      else toast(Z.xEscaped(nm(e.r)), p.team === "robber" ? "good" : "bad");
    }
    if (e.type === "vanRadio" && p.team === "robber") { play("zRadio"); haptic(200); const s = stops().filter(x => !x.isOpen).sort((a, b) => a.open - b.open)[0]; toast(Z.radio(s ? Math.max(1, Math.ceil(s.open - G.t)) : G.zb.radio), "good"); }
    if (e.type === "vanOpen") { play("zVan"); toast(p.team === "robber" ? Z.vanOpenS : Z.vanOpenZ, p.team === "robber" ? "good" : "bad"); }
    if (e.type === "vanLeave") toast(Z.vanLeave);
    return ["bitten", "turned", "boarded", "vanRadio", "vanOpen", "vanLeave"].includes(e.type);
  }
  // 결과 카드
  function endText() {
    const Z = tt("zb"), p = G.player, s = p.s, origin = p.origin || (online ? G.zOrigin : p.team);
    const out = s.escapeAt !== undefined ? Z.outEscaped : p.team === "police" && origin === "robber" ? Z.outInfected : origin === "robber" ? Z.outMissed : null;
    return {
      reason: Z.reasons[G.over.reason] || "",
      stats: p.team === "police"
        ? [[Z.stBites, tt("times", s.catches)], [Z.stTeamBites, tt("times", G.stats.catches)], [Z.stEscapedN, tt("people", G.stats.escaped || 0)]]
        : [[Z.stResult, out || Z.outMissed], [Z.stSurvived, tt("secs", Math.round(Math.max(0, (s.escapeAt ?? s.survT ?? G.over.at ?? G.t) - (G.wait ?? CFG.WAIT))))], [Z.stEscapedN, tt("people", G.stats.escaped || 0)]],
      hero: url(`${lookOf(p)}-front`),
    };
  }
  return { isZ, zombie, vanImage, lookOf, svg, url, mountZ, switchTeam, syncChars, drawVan, drawMini, vanCard, heart, pips, statusLine, onEvent, endText };
})();
