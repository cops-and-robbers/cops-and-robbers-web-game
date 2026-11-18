// 좀비 모드 화면(docs/zombie.md). 규칙은 shared/logic.js, 여기는 그리기와 알림만.
// game.js 와 같은 전역에서 돈다(빌드가 game.js 뒤에 붙인다). game.js 는 G.mode === "zombie" 일 때만 여기를 부른다
const ZB = (() => {
  const isZ = () => G?.mode === "zombie";
  // 생김새는 편으로 정해진다(docs/zombie.md "편과 생김새"): 좀비는 늘 좀비 냥파(zcat), 생존자는 늘 생존자 도둥이(zsurv).
  // 그림은 캐릭터 엔진이 만든다(playground.html addZombieArt). 처음 쓸 때 한 번 만들어 둔다
  const art = () => window.CharRig.addZombieArt(SVGS);
  art(); // 그림 묶음(SVGS)은 이 파일보다 먼저 실린다. game.js 가 SVGS["zcat-side"] 처럼 바로 꺼내 쓰니 처음에 만들어 둔다
  const cache = new Map();
  function svg(name) { art(); return SVGS[name]; }
  const url = name => { if (!cache.has(name)) cache.set(name, "data:image/svg+xml," + encodeURIComponent(svg(name))); return cache.get(name); };
  const zombie = a => isZ() && a.team === "police";
  // 그림 묶음 이름(game.js VIEWS). 좀비 모드면 편이 곧 생김새다
  const kindOf = a => isZ() ? (a.team === "police" ? "zcat" : "zsurv") : a.team;
  const lookOf = kindOf;

  // ───── 편 바뀜 ─────
  // 서버 판은 갱신과 사건으로 편이 바뀐 걸 알고, 혼자 하기는 규칙이 직접 옮긴다. 어느 쪽이든 그림은 frame 이 맞춘다
  function switchTeam(a, team) {
    if (a.team === team) return;
    const from = a.team === "police" ? G.police : G.robbers, to = team === "police" ? G.police : G.robbers;
    const i = from.indexOf(a); if (i >= 0) from.splice(i, 1);
    if (!to.includes(a)) to.push(a);
    a.team = team;
  }
  // 편이 그림과 다르면 다시 만든다. 좀비가 되는 순간 민트빛 가루가 피어오른다
  function syncChars() {
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i], a = c.a;
      if (c.kind === kindOf(a)) continue;
      const was = c.zombie;
      c.el.remove(); chars[i] = makeChar(a);
      if (!was && chars[i].zombie) { chars[i].popAt = performance.now(); chars[i].face = c.face; if (c.el.style.display !== "none") sparks(a); }
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

  // ───── 도둥이가 냥파로 (docs/zombie.md "물기") ─────
  // 물린 생존자 도둥이: 비틀거리며 민트빛으로 물들고, 쓰고 있던 냄비가 튕겨 나가 굴러떨어지고, 들고 있던 나뭇가지를 놓친다.
  // 마지막엔 납작하게 눌렸다가(편이 바뀌면 syncChars 가 좀비 냥파로 바꿔 끼운다) 냥파가 튀어 오르며 볼트에서 불꽃이 튄다.
  // 돌려주는 sx, sy 는 캐릭터 전체 배율(발 기준). game.js drawChar 가 모션을 돌린 다음에 불러 냄비와 가지 움직임을 덮어쓴다
  const ease = x => x * x * (3 - 2 * x), cl = (v, a, b) => Math.max(a, Math.min(b, v));
  function turning(c) {
    // turnDur: 대기실 좀비 뽑기처럼 짧게 변할 때 쓴다(ms). 없으면 판의 비틀거림 시간
    const now = performance.now(), k = Math.min(1, (now - (c.turnAt ||= now)) / (c.turnDur || (CFG.ZOMBIE.TURN || 2) * 1000));
    c.lungeX = Math.sin(now / 70) * 6 * (1 - k * 0.5);
    const tint = `sepia(${k * 0.7}) hue-rotate(${k * 95}deg) saturate(${1 + k * 0.8}) brightness(${1 - k * 0.05})`;
    for (const r of Object.values(c.views)) r.svg.style.filter = tint; // 이름표는 물들이지 않는다
    c.tinted = true;
    const rig = c.views[c.view], d = rig.def, dir = c.face < 0 ? -1 : 1;
    // 냄비: 머리에서 튀어 올라 돌며 옆으로 떨어진다
    const pot = cl((k - 0.12) / 0.5, 0, 1);
    if (pot > 0) for (const g of rig.parts.beanie || []) {
      g.setAttribute("transform", piv(d.cx, 40, dir * 210 * ease(pot), 1, 1, dir * 80 * pot, -60 * Math.sin(Math.PI * Math.min(1, pot * 1.25)) + 70 * pot * pot));
      g.style.opacity = String(1 - cl((pot - 0.7) / 0.3, 0, 1));
    }
    // 나뭇가지: 손에서 미끄러져 떨어진다(앞모습 handL 의 세 번째 조각이 가지다)
    const drop = cl((k - 0.28) / 0.32, 0, 1), stick = rig.parts.handL?.[2];
    if (stick && drop > 0) { stick.setAttribute("transform", piv(33, 98, -70 * ease(drop), 1, 1, -6 * drop, 40 * drop * drop)); stick.style.opacity = String(1 - cl((drop - 0.6) / 0.4, 0, 1)); }
    // 마지막 0.45초: 바닥으로 눌린다
    const sq = ease(cl((k - 0.78) / 0.22, 0, 1));
    return { sx: 1 + 0.3 * sq, sy: 1 - 0.45 * sq };
  }
  // 방금 좀비 냥파가 된 캐릭터: 눌린 모습에서 튀어 올랐다가 자리를 잡는다(0.6초)
  function popIn(c) {
    const t = (performance.now() - c.popAt) / 600;
    if (t >= 1) { c.popAt = 0; return { sx: 1, sy: 1 }; }
    const sy = 1 - 0.45 * Math.cos(t * Math.PI * 2.5) * (1 - t) ** 2;
    return { sx: 1 + (1 - sy) * 0.6, sy };
  }
  function sparks(a) {
    for (const s of [-1, 1]) burst(a.x + s * 38, a.y - 46, "#FFE58A", 5);
    burst(a.x, a.y - 30, "#6EB69B", 16); burst(a.x, a.y - 10, "#C9F0DF", 8);
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
  // 사람 수 점: 노랑은 생존자, 민트는 좀비, 테두리만 있는 노랑은 탄 사람
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
      if (e.r === p) { play("caught"); haptic(500); shake = 12; hitStop = 0.08; Scenes.bitten(); }
      else if (e.by === p) { play("catch"); haptic(80); toast(Z.iInfected(nm(e.r)), "good"); }
      else { toast(Z.xInfected(nm(e.r)), p.team === "police" ? "good" : "bad"); }
      if (e.r && (e.r === p || e.by === p || seen(e.r))) burst(e.r.x, e.r.y - 40, "#6EB69B", 14);
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
  return { isZ, zombie, kindOf, turning, popIn, sparks, vanImage, lookOf, svg, url, switchTeam, syncChars, drawVan, drawMini, vanCard, heart, pips, statusLine, onEvent, endText };
})();
