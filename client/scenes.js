// 앱 4.0.1 게임 시작·끝 장면을 온라인 게임에 맞게 옮겼다.
//   ① 역할 배너 - 판 시작 멈춤(CFG.INTRO) 동안 두 진영 모두. 흰(경찰)/검정(도둑) 사선 띠, 미션 제목, 튀어 오르는 캐릭터, 속도선
//   ② 경찰 대기 장면 - 경찰은 대기 15초 동안 못 움직여 화면 전체로. 도둑은 숨어야 하니 덮지 않는다
//   ③ 출동 카운팅 - 경찰은 화면 전체(사이렌, 5~1, "출동!", 원형으로 열림). 도둑은 숨는 손을 막지 않게 위쪽 작은 판과 가장자리 빛
//   ④ MVP 공개 - "게임 종료!" → "MVP는 누굴까?!" → 진 팀 MVP → 이긴 팀 MVP → 결과 카드
// 움직임은 웹사이트(dongsim-web lib/demo/start-motion.tsx)와 같은 계산이고, 색과 글꼴은 게임 것(--police, --robber, Pretendard)을 쓴다.
// 화면을 가로(폰 844x390)로 놓고 짰다. 움직임 줄이기 설정이면 움직임 없이 나타났다 사라진다.
const Scenes = (() => {
  const ART = {
    role: { police: "data:image/svg+xml;base64,/*B64:start-role-cop.svg*/", robber: "data:image/svg+xml;base64,/*B64:start-role-rob.svg*/" },
    mvp: { police: "data:image/svg+xml;base64,/*B64:mvp-cop.svg*/", robber: "data:image/svg+xml;base64,/*B64:mvp-rob.svg*/" },
    glow: { police: "data:image/svg+xml;base64,/*B64:mvp-glow-cop.svg*/", robber: "data:image/svg+xml;base64,/*B64:mvp-glow-rob.svg*/" },
    siren: "data:image/svg+xml;base64,/*B64:siren-count.svg*/",
    car: "data:image/svg+xml;base64,/*B64:car.svg*/",
    flag: "data:image/svg+xml;base64,/*B64:flag.svg*/",
    bulb: "data:image/svg+xml;base64,/*B64:bulb.svg*/",
    day: "data:image/webp;base64,/*B64:wait-day.webp*/",
    confetti: [1, 2, 3, 4, 5, 6].map(n => `data:image/svg+xml;base64,/*B64:confetti-${n}.svg*/`),
  };
  const COLOR = { police: "#2A9BEF", robber: "#35C26B", ink: "#1D232B", night: "#12171F" };
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const S = () => TX.sc || I18N.ko.sc;

  // ───────── 곡선과 자세 (start_banners.dart, stripe_banner.dart) ─────────
  function cubic(x1, y1, x2, y2) {
    const bx = t => 3 * x1 * t * (1 - t) ** 2 + 3 * x2 * t * t * (1 - t) + t ** 3;
    const by = t => 3 * y1 * t * (1 - t) ** 2 + 3 * y2 * t * t * (1 - t) + t ** 3;
    return x => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let lo = 0, hi = 1;
      for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (bx(m) < x) lo = m; else hi = m; }
      return by((lo + hi) / 2);
    };
  }
  const easeOut = cubic(0, 0, 0.58, 1), easeInOut = cubic(0.42, 0, 0.58, 1), easeOutCubic = cubic(0.215, 0.61, 0.355, 1);
  const outCurve = cubic(0.5, 0, 0.8, 0.3);
  const iv = (t, a, b, c = x => x) => c(Math.min(1, Math.max(0, (t - a) / (b - a))));
  const lerp = (a, b, t) => Object.fromEntries(Object.keys(a).map(k => [k, a[k] + (b[k] - a[k]) * t]));
  function stripeIn(t) {
    const p0 = { x: -2.05, sx: 1.9, sy: 0.12 }, p1 = { x: 0.03, sx: 0.94, sy: 1.12 }, p2 = { x: -0.01, sx: 1.02, sy: 0.97 }, p3 = { x: 0, sx: 1, sy: 1 };
    if (t < 0.7) return lerp(p0, p1, cubic(0.12, 0.9, 0.3, 1)(t / 0.7));
    if (t < 0.86) return lerp(p1, p2, easeOut((t - 0.7) / 0.16));
    return lerp(p2, p3, (t - 0.86) / 0.14);
  }
  function stripeOut(t) {
    const p0 = { x: 0, sx: 1, sy: 1 }, p1 = { x: -0.03, sx: 1.03, sy: 1.05 }, p2 = { x: 2.4, sx: 2.2, sy: 0.06 };
    return t < 0.15 ? lerp(p0, p1, outCurve(t / 0.15)) : lerp(p1, p2, outCurve((t - 0.15) / 0.85));
  }
  function popIn(t) {
    const a = { y: 1.12, sx: 0.92, sy: 1.1 }, b = { y: -0.05, sx: 0.97, sy: 1.04 }, c = { y: 0.012, sx: 1.05, sy: 0.94 }, d = { y: -0.006, sx: 0.985, sy: 1.015 }, e = { y: 0, sx: 1, sy: 1 };
    if (t < 0.42) return lerp(a, b, easeOutCubic(t / 0.42));
    if (t < 0.68) return lerp(b, c, easeInOut((t - 0.42) / 0.26));
    if (t < 0.85) return lerp(c, d, easeInOut((t - 0.68) / 0.17));
    return lerp(d, e, easeOut(Math.min(1, (t - 0.85) / 0.15)));
  }
  function dropOut(t) {
    const a = { y: 0, sx: 1, sy: 1 }, b = { y: -0.06, sx: 1.03, sy: 0.97 }, c = { y: 1.2, sx: 0.94, sy: 1.1 };
    return t < 0.35 ? lerp(a, b, easeOut(t / 0.35)) : lerp(b, c, cubic(0.64, 0, 0.78, 0)(Math.min(1, (t - 0.35) / 0.65)));
  }
  // 앱 시안 좌표(393x852)의 속도선. 시간은 배너 시작 기준(ms)
  const SPEED = [
    { x: 84, y: 208, len: 224, left: true, a: 300, b: 560, out: 1320 },
    { x: 231.5, y: 181.8, len: 42, left: true, a: 520, b: 660, out: 1260 },
    { x: 256.6, y: 534.6, len: 238, left: false, a: 380, b: 640, out: 1400 },
    { x: 102.8, y: 560, len: 42, left: false, a: 600, b: 740, out: 1340 },
  ];

  // ───────── 공통 ─────────
  let root = null, bandH = 0; // bandH: 마지막 역할 띠 높이. 대기 장면이 그 띠 자리에서 열린다
  function layer() {
    if (!root) { root = document.createElement("div"); root.id = "scenes"; document.getElementById("stage")?.appendChild(root) ?? document.body.appendChild(root); }
    return root;
  }
  const h = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const accent = (text, part, color) => {
    const at = text.indexOf(part);
    return at < 0 ? esc(text) : esc(text.slice(0, at)) + `<b style="color:${color}">${esc(part)}</b>` + esc(text.slice(at + part.length));
  };
  // 짧게 도는 장면마다 자기 프레임을 가진다. 끝나면 스스로 멈춘다
  function run(frame) {
    const t0 = performance.now(); let id = 0, stop = false;
    const tick = () => { if (stop) return; if (frame(performance.now() - t0) === false) return; id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => { stop = true; cancelAnimationFrame(id); };
  }

  // ───────── ① 역할 배너 ─────────
  // 앱은 0.9초 들어오고 2.35초 머물고 0.7초 나간다. 온라인은 시작 멈춤(2.6초) 안에 끝나게 줄였다
  const ROLE = { in: 700, hold: 1250, out: 600 };
  function roleBanner(team, theme, introMs, z) {
    // 서버 판은 시작 신호를 받은 뒤 조금 늦게 화면이 열려 멈춤이 덜 남아 있다. 남은 멈춤 안에 끝나게 머무는 시간을 줄인다
    const hold = Math.max(300, Math.min(ROLE.hold, (introMs || 2600) - ROLE.in - ROLE.out));
    const s = S(), police = team === "police", Z = z && tt("zb");
    // 좀비 판: 좀비는 좀비 냥파 빛의 어두운 초록 띠, 생존자는 흰 띠. 아래 줄 없이 두 줄로 끝낸다
    const band = Z ? (police ? "#1F2D28" : "#FFFFFF") : police ? "#FFFFFF" : COLOR.night, edge = Z ? (police ? "#2E4239" : "#EFE8D6") : police ? "#DCE6F2" : "#2B3440";
    const tint = Z ? (police ? "#8FD0B8" : "#C98A00") : COLOR[team], onBand = Z ? (police ? "#FFFFFF" : COLOR.ink) : police ? COLOR.ink : "#FFFFFF";
    const title = Z ? (police ? Z.titleZ : Z.titleS) : police ? s.titleCop : s.titleRob, acc = Z ? (police ? Z.accZ : Z.accS) : police ? s.accentCop : s.accentRob;
    const role = police ? tt("cop") : tt("rob");
    const box = h("div", "scRole"); box.setAttribute("aria-hidden", "true");
    const dim = h("div", "scDim");
    const bandBox = h("div", "scBand");
    const rows = [edge, band].map(c => { const g = h("div", "scStripes"); for (let i = 0; i < 7; i++) { const st = h("i"); st.style.background = c; g.appendChild(st); } bandBox.appendChild(g); return g; });
    rows[0].style.transform = "translateY(7px)";
    const lines = SPEED.map(() => { const w = h("div", "scSpeed"); const bar = h("i"); bar.style.background = band; w.appendChild(bar); box.appendChild(w); return { w, bar }; });
    const ch = h("img", "scRoleArt"); ch.src = Z ? ZB.url(police ? "zcat-front" : "zsurv-front") : ART.role[team]; ch.alt = "";
    const small = Z ? (police ? Z.smallZ : Z.smallS) : theme ? `${theme} · ${s.roleLabel}` : s.roleLabel;
    const tx = h("div", "scRoleTx", `<small>${esc(small)}</small><p>${accent(title[0], acc, tint)}<br>${accent(title[1], acc, tint)}</p>${Z ? "" : `<em>${accent(s.sentence(role), role, tint)}</em>`}`);
    tx.style.color = onBand; tx.querySelector("small").style.color = Z ? (police ? "#A9DCC8" : "#76899E") : police ? "#5F6E80" : "#A9B4C2";
    box.append(dim, bandBox, ch, tx);
    layer().appendChild(box);
    const total = ROLE.in + hold + ROLE.out, quiet = reduce();
    let fitW = 0, fitH = 0, fitMax = Infinity;
    ch.onload = () => { fitW = 0; };
    return run(ms => {
      const W = box.clientWidth, H = box.clientHeight;
      const enter = Math.min(1, ms / ROLE.in), exitAt = ROLE.in + hold, exit = Math.min(1, Math.max(0, (ms - exitAt) / ROLE.out)), leaving = ms >= exitAt;
      if (quiet) { box.style.opacity = String(Math.min(enter * 3, 1) * (1 - exit)); }
      dim.style.opacity = String(quiet ? 0.85 : 0.85 * iv(enter, 0, 0.55) * (1 - iv(exit, 0.3, 0.9)));
      // 띠가 7도 기울어 왼쪽이 내려가 있다. 글 덩어리를 그 자리의 띠 가운데에 두고, 글이 띠 밖(어두운 바탕)으로 나가지 않게 띠 높이를 글에 맞춰 키운다
      const tan = Math.tan((7 * Math.PI) / 180), tw = tx.offsetWidth, th = tx.offsetHeight;
      const bh = Math.max(Math.min(Math.max(H * 0.56, 190), 420), Math.min(H * 0.94, th + tw * tan + 40));
      const bw = W * 1.4; bandH = bh;
      bandBox.style.width = bw + "px"; bandBox.style.height = bh + "px";
      tx.style.top = H / 2 + (W / 2 - (tx.offsetLeft + tw / 2)) * tan + "px";
      for (const g of rows) [...g.children].forEach((st, i) => {
        const p = quiet ? { x: 0, sx: 1, sy: 1 } : leaving ? stripeOut(iv(exit, (120 + i * 40) / 700, (460 + i * 40) / 700)) : stripeIn(iv(enter, (i * 50) / 900, (380 + i * 50) / 900));
        st.style.transform = `translateX(${p.x * bw}px) scale(${p.sx},${p.sy * 1.04})`;
      });
      const unit = Math.min(W, 1100) / 300;
      lines.forEach(({ w, bar }, i) => {
        const L = SPEED[i], len = L.len * unit * 0.75;
        if (quiet) { w.style.display = "none"; return; }
        const drawn = iv(ms, L.a, L.b, cubic(0.3, 0, 0.2, 1)), drift = iv(ms, L.b, L.out);
        const out = Math.max(iv(ms, L.out, L.out + 320, outCurve), iv(exit, 0, 0.4, outCurve));
        const travel = (drift - 0.5) * 18 * unit + out * (W + len);
        w.style.cssText = `left:${(L.x / 393) * W - len / 2}px;top:${H / 2 + ((L.y - 426) / 426) * bh * 0.95}px;width:${len}px;height:${7 * unit}px;justify-content:${L.left ? "flex-start" : "flex-end"}`;
        bar.style.width = len * drawn + "px"; bar.style.transform = `translateX(${L.left ? travel : -travel}px)`;
      });
      // 캐릭터가 글을 덮지 않게, 가로 화면은 글 오른쪽 남는 폭, 세로 화면은 글 아래 남는 높이 안에서 크기를 정한다
      if (fitW !== W || fitH !== H) {
        fitW = W; fitH = H; const rg = document.createRange(); rg.selectNodeContents(tx);
        const tRight = tx.offsetLeft + rg.getBoundingClientRect().width, tBottom = parseFloat(tx.style.top) + th / 2, ratio = (ch.naturalWidth || 1) / (ch.naturalHeight || 1);
        fitMax = W > H ? (W * 0.97 - tRight - 12) / ratio : H - tBottom - 12;
      }
      const chH = Math.max(0, Math.min(H * 0.98, W * (W > H ? 0.5 : 0.8), 560, fitMax)), pose = quiet ? { y: 0, sx: 1, sy: 1 } : exit > 0 ? dropOut(iv(exit, 0, 0.5)) : popIn(iv(enter, 0.3, 1));
      ch.style.height = chH + "px";
      ch.style.transform = `translateY(${pose.y * chH * 0.75}px) scale(${pose.sx},${pose.sy})`;
      const cin = iv(enter, 0.6, 1, cubic(0.22, 1, 0.36, 1)), cout = iv(exit, 0, 0.3, cubic(0.64, 0, 0.78, 0));
      tx.style.opacity = String(quiet ? 1 : cin * (1 - cout));
      tx.style.transform = `translate(${(-16 * (1 - cin) + 16 * cout) * unit}px,-50%)`;
      if (ms >= total) { box.remove(); return false; }
    });
  }

  // ───────── ② 경찰 대기 장면 ─────────
  let wait = null;
  function waitScene(revealEvery, z) {
    const s = S(), Z = z && tt("zb");
    const box = h("div", Z ? "scWait zomb" : "scWait");
    // 좀비 판: 낮 하늘 대신 달밤과 지붕 그림자, 경찰차 대신 휘청이며 지나가는 좀비
    box.innerHTML = Z
      ? `<div class="scWaitBg scNight"><i class="scMoon"></i><i class="scRoofs"></i><i class="scMist"></i></div>
      <div class="scCar scWalker"></div>
      <div class="scWaitL"><div class="scTeam"><img src="${ZB.url("zcat-front")}" alt="">${esc(Z.teamZ)}</div><small>${esc(Z.timerWait)}</small><b class="scCount">00:12</b><p>${esc(Z.waitLine)}</p></div>
      <div class="scWaitR"><div class="scCard"><img src="${ART.flag}" alt=""><div><small>${esc(Z.missionLabel)}</small><p>${esc(Z.mission)}</p></div></div><div class="scCard scGuide"><img src="${ART.bulb}" alt=""><div><small></small><p></p></div></div></div>`
      : `<div class="scWaitBg" style="background-image:url(${ART.day})"></div>
      <div class="scCar"><img src="${ART.car}" alt=""></div>
      <div class="scWaitL"><div class="scTeam"><img src="${svgUrl("police-front")}" alt="">${esc(s.teamCop)}</div><small>${esc(s.waitLabel)}</small><b class="scCount">00:15</b><p>${esc(s.waitCop)}</p></div>
      <div class="scWaitR"><div class="scCard"><img src="${ART.flag}" alt=""><div><small>${esc(s.missionLabel)}</small><p>${esc(s.mission)}</p></div></div><div class="scCard scGuide"><img src="${ART.bulb}" alt=""><div><small></small><p></p></div></div></div>`;
    layer().appendChild(box);
    // 쫓고 쫓기는 둘: 앞에서 생존자 도둥이가 냄비를 쓰고 달아나고(runSide), 바로 뒤에서 좀비 냥파가 팔을 뻗고 발을 끌며 쫓아간다(shambleSide).
    // 판의 캐릭터 엔진을 그대로 쓴다. 두 쌍이 반 바퀴 간격으로 지나간다
    if (Z) {
      const cast = [["zsurv-side", "runSide", 1.25, 1.12], ["zcat-side", "shambleSide", 0, 0.95], ["zsurv-side", "runSide", 6.75, 1.12], ["zcat-side", "shambleSide", 5.5, 0.95]];
      const walkers = cast.map(([name, motion, ahead, size]) => {
        const rig = CharRig.mount(ZB.svg(name), name), d = rig.def, w = document.createElement("div");
        rig.svg.setAttribute("viewBox", `0 0 ${d.w} ${d.h}`); rig.svg.style.overflow = "visible";
        if (rig.parts.shadow) rig.parts.shadow.forEach(g => g.style.display = "none");
        // 두 캐릭터 몸집이 비슷해 보이게(game.js makeChar 와 같은 배율). 발끝을 같은 바닥에 맞춘다
        const unit = (120 / 202) * (size / 0.95); // 원래 좀비 옆모습(높이 202)이 칸의 120% 였다. 그 한 칸 = unit %
        w.className = "scWalk"; w.style.aspectRatio = `${d.w} / ${d.h}`; w.style.height = `${unit * d.h}%`; w.style.bottom = `${unit * (202 - 188) / (size / 0.95) - unit * (d.h - d.ground)}%`;
        w.style.animationDelay = `-${ahead}s`; w.append(rig.svg);
        box.querySelector(".scWalker").append(w);
        return { rig, mot: CharRig.MOTIONS[motion](rig), run: motion === "runSide" };
      });
      if (!reduce()) { let last = performance.now(); const step = now => { if (!box.isConnected) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; for (const k of walkers) { k.mot.update(dt, { speed: k.run ? 0.9 : 0.6 }); k.rig.updateLimbs(); } requestAnimationFrame(step); }; requestAnimationFrame(step); }
      else for (const k of walkers) { k.mot.update(0.3, { speed: 0.6 }); k.rig.updateLimbs(); }
    }
    const guide = Z ? Z.guideZ(revealEvery) : s.guideCop(revealEvery), gs = box.querySelector(".scGuide small"), gp = box.querySelector(".scGuide p"), count = box.querySelector(".scCount");
    let shown = -1;
    const t0 = performance.now();
    // 역할 띠 자리에서 화면 전체로 펼친다 (band_transition.dart)
    const open = quietOpen => {
      if (quietOpen) { box.style.clipPath = ""; return; }
      run(ms => {
        const W = box.clientWidth, H = box.clientHeight, o = iv(ms, 0, 620, cubic(0.7, 0, 0.25, 1));
        const a = (-7 * Math.PI) / 180, bh = (bandH || Math.min(Math.max(H * 0.56, 190), 420)) / 2, cx = W / 2, cy = H / 2;
        const band = (x, y) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)];
        const from = [band(-W * 0.7, -bh), band(W * 0.7, -bh), band(W * 0.7, bh), band(-W * 0.7, bh)], to = [[0, 0], [W, 0], [W, H], [0, H]];
        box.style.clipPath = o >= 1 ? "" : `polygon(${from.map(([fx, fy], i) => `${fx + (to[i][0] - fx) * o}px ${fy + (to[i][1] - fy) * o}px`).join(",")})`;
        if (o >= 1) return false;
      });
    };
    open(reduce());
    return {
      update(left) {
        const sec = Math.max(0, Math.ceil(left));
        count.textContent = `00:${String(sec).padStart(2, "0")}`;
        count.classList.toggle("final", sec <= 10);
        const i = Math.floor((performance.now() - t0) / 4000) % guide.length;
        if (i !== shown) { shown = i; gs.textContent = s.guide(i + 1, guide.length); gp.textContent = guide[i]; gp.parentElement.parentElement.classList.remove("fresh"); void gp.offsetWidth; gp.parentElement.parentElement.classList.add("fresh"); }
      },
      remove() { box.remove(); },
    };
  }

  // ───────── ③ 출동 카운팅 (dispatch_countdown.dart) ─────────
  // 출동 6초 전에 덮고 5~1, "출동!" 1.2초 뒤 1초 동안 사이렌 자리에서 열린다
  let dispatch = null;
  const MOON = "data:image/svg+xml;base64,/*B64:moon-count.svg*/";
  function dispatchCountdown(team, releaseAt, z) {
    const s = S(), full = team === "police", quiet = reduce(), icon = z ? MOON : ART.siren;
    const box = h("div", (full ? "scDispatch" : "scDispatch mini") + (z ? " zomb" : ""));
    box.setAttribute("aria-live", "assertive");
    box.innerHTML = full
      ? `<div class="scBeam"></div><div class="scSirenWrap"><span class="scGlow" style="-webkit-mask-image:url('${icon}');mask-image:url('${icon}')"></span><img class="scSiren" src="${icon}" alt=""><b class="scNum"></b></div>`
      : `<div class="scEdge"></div><div class="scPill"><img src="${icon}" alt=""><b class="scNum"></b></div>${z ? `<div class="scWakeHint">${esc(tt("zb").wakeSoon)}</div>` : ""}`;
    layer().appendChild(box);
    const num = box.querySelector(".scNum"), beam = box.querySelector(".scBeam"), glow = box.querySelector(".scGlow"), edge = box.querySelector(".scEdge"), wrap = box.querySelector(".scSirenWrap");
    let last = null, angle = 0, prev = performance.now();
    const stop = run(() => {
      const now = performance.now(), dt = (now - prev) / 1000; prev = now;
      const remaining = releaseAt - now, go = remaining <= 0;
      const seconds = go ? null : Math.ceil(remaining / 1000);
      const cover = Math.min(1, Math.max(0, (6000 - remaining) / 1000));
      const intensity = go ? 1 : Math.min(1, Math.max(0, (4000 - remaining) / 4000)) ** 1.6;
      const since = go ? -remaining / 1000 : (Math.ceil(remaining / 1000) * 1000 - remaining) / 1000;
      const iris = go ? Math.min(1, Math.max(0, (-remaining - 1200) / 1000)) : 0;
      const label = go ? (z ? tt("zb").woke : s.go) : cover < 1 && full ? "" : String(seconds);
      if (label !== last) {
        last = label; num.textContent = label;
        if (label && !go) play("tick", seconds <= 2 ? 1.12 : 1);
      }
      const pop = quiet ? 1 : 1 + 0.2 * Math.max(0, 1 - since / 0.25);
      num.style.transform = `scale(${pop})`;
      angle += dt * (80 + 760 * intensity);
      if (full) {
        const W = box.clientWidth, H = box.clientHeight, r = wrap.getBoundingClientRect(), b = box.getBoundingClientRect();
        const px = r.left - b.left + r.width / 2, py = r.top - b.top + r.height * 0.42;
        if (!quiet && intensity > 0) {
          const red = z ? `rgba(110,182,155,${0.18 + 0.82 * intensity})` : `rgba(226,87,76,${0.18 + 0.82 * intensity})`, blue = z ? `rgba(143,224,122,${0.14 + 0.6 * intensity})` : `rgba(42,155,239,${0.18 + 0.82 * intensity})`;
          beam.style.background = `conic-gradient(from ${angle}deg at ${px}px ${py}px, transparent 0deg, ${red} 13deg, transparent 26deg, transparent 180deg, ${blue} 193deg, transparent 206deg, transparent 360deg)`;
          beam.style.webkitMaskImage = beam.style.maskImage = `radial-gradient(circle at ${px}px ${py}px, #000 6%, rgba(0,0,0,.85) 30%, transparent 70%)`;
        }
        const flare = Math.max(0, 1 - since / (go ? 0.3 : 0.45));
        glow.style.filter = `blur(${intensity > 0 ? ((4 + 50 * intensity) * (0.6 + 0.4 * flare)) / 2 : 0}px)`;
        glow.style.opacity = intensity > 0 && !quiet ? "1" : "0";
        if (seconds === 1 && !quiet) { const k = 3 * (1 - Math.min(1, since) * 0.5); wrap.style.transform = `translate(${Math.sin(now * 0.9) * k}px,${Math.cos(now * 1.3) * k}px)`; } else wrap.style.transform = "";
        const far = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - px, y - py)));
        let radius = null;
        if (!quiet && cover < 1) radius = (1 - easeInOut(cover)) * far;
        else if (!quiet && iris > 0) radius = easeInOut(iris) * far;
        box.style.webkitMaskImage = box.style.maskImage = radius === null ? "" : `radial-gradient(circle at ${px}px ${py}px, transparent ${radius}px, #000 ${radius + 0.5}px)`;
        box.style.pointerEvents = iris > 0 ? "none" : "";
        if (quiet) box.style.opacity = String(go ? 1 - Math.min(1, (-remaining - 1200) / 600) : 1);
      } else {
        // 도둑 - 위쪽 작은 판과 화면 가장자리 빨강·파랑 빛. 숨는 손을 막지 않는다
        const fade = go ? 1 - Math.min(1, Math.max(0, (-remaining - 900) / 500)) : Math.min(1, (6000 - remaining) / 400);
        box.style.opacity = String(Math.max(0, fade));
        const red = 0.15 + 0.5 * intensity * (0.5 + 0.5 * Math.sin((angle * Math.PI) / 180));
        const blue = 0.15 + 0.5 * intensity * (0.5 - 0.5 * Math.sin((angle * Math.PI) / 180));
        edge.style.boxShadow = quiet ? "" : z ? `inset 0 0 70px -20px rgba(110,182,155,${Math.min(0.9, red + blue)})` : `inset 34px 0 60px -30px rgba(226,87,76,${red}), inset -34px 0 60px -30px rgba(42,155,239,${blue})`;
        box.classList.toggle("go", go);
      }
      if (remaining < -2200) { box.remove(); dispatch = null; return false; }
    });
    return { box, stop: () => { stop(); box.remove(); } };
  }

  // ───────── 판 진행에 맞춰 띄우기 ─────────
  let state = { game: null, banner: false, releaseAt: 0, stopBanner: null };
  function reset() {
    state.stopBanner?.();
    wait?.remove(); wait = null;
    dispatch?.stop(); dispatch = null;
    endStop?.();
    if (root) root.innerHTML = "";
    state = { game: null, banner: false, releaseAt: 0, stopBanner: null };
  }
  // 매 프레임 게임 화면(drawHud)이 부른다. 서버 판은 시각이 초당 20번 오니, 출동 시각은 내 시계로 옮겨 부드럽게 센다
  function sync(G, team, themeName) {
    if (!G || G.over) return;
    if (state.game !== G) { reset(); state.game = G; }
    const z = G.mode === "zombie" ? {} : null;
    if (!state.banner && G.intro > 0) { state.banner = true; state.stopBanner = roleBanner(team, themeName, G.intro * 1000, z); }
    if (G.intro > 0) return;
    const left = (G.wait ?? CFG.WAIT) - G.t, now = performance.now(), release = now + left * 1000;
    if (G.phase === "wait") {
      if (!state.releaseAt || Math.abs(state.releaseAt - release) > 250) state.releaseAt = release;
      if (team === "police") {
        if (!wait && left > 6.2) wait = waitScene(Math.round(G.revealEvery), z);
        wait?.update(left);
        if (wait && left <= 5) { wait.remove(); wait = null; }
      }
      if (!dispatch && left <= 6) dispatch = dispatchCountdown(team, state.releaseAt, z);
    } else if (wait) { wait.remove(); wait = null; }
  }

  // ───────── ④ MVP 공개 (game_over_intro_modal.dart) ─────────
  let endStop = null;
  // over: { winner, reason, mvp }. mvp 는 혼자 하기면 { police: 번호 }, 서버 판이면 { police: { id, name } }
  function mvpReveal(G, over, me, done) {
    const s = S();
    const pick = team => {
      const v = over.mvp?.[team]; if (v === null || v === undefined) return null;
      const id = typeof v === "object" ? v.id : v, a = G.agents[id];
      return { team, id, name: id === me.id ? me.name : nameOf(typeof v === "object" ? v.name : a?.name ?? "") };
    };
    const loser = over.winner === "police" ? "robber" : "police";
    const reveals = [pick(loser), pick(over.winner)].filter(Boolean);
    if (!reveals.length) { done(); return; }
    const quiet = reduce();
    const box = h("div", "scEnd");
    const bar = h("div", "scTap", esc(s.tap)), skip = h("button", "scSkip", esc(s.skip));
    skip.type = "button";
    box.append(bar, skip);
    layer().appendChild(box);
    let step = 0, stageStop = null, ready = false, timers = [];
    const later = (ms, f) => timers.push(setTimeout(f, ms));
    const finish = () => { timers.forEach(clearTimeout); stageStop?.(); box.remove(); endStop = null; done(); };
    endStop = () => { timers.forEach(clearTimeout); stageStop?.(); box.remove(); endStop = null; };
    skip.onclick = e => { e.stopPropagation(); finish(); };
    // 「게임 종료!」 카드가 흔들리다 「MVP는 누굴까?!」로 바뀐다
    const reason = G.mode === "zombie" ? tt("zb").reasons[over.reason] || "" : tt(over.reason === "allArrested" ? "allArrested" : "timeUp");
    const card = h("div", "scOverCard", `<b>${esc(s.over)}</b><p>${esc(reason)}</p>`);
    box.appendChild(card);
    later(1300, () => { card.classList.add("shake"); later(250, () => { card.innerHTML = `<b class="tease">${esc(s.tease)}</b>`; }); });
    later(2600, () => { card.remove(); next(); });
    function next() {
      stageStop?.(); box.querySelector(".scStage")?.remove();
      if (step >= reveals.length) { finish(); return; }
      const r = reveals[step++]; ready = false; bar.classList.remove("show");
      stageStop = stage(box, r, quiet, s, G);
      later(quiet ? 200 : 3100, () => { ready = true; bar.classList.toggle("light", r.team === "police"); bar.classList.add("show"); });
    }
    box.onclick = () => { if (ready) next(); };
  }
  // 무대 하나: 어두운 무대를 조명이 훑다 가운데 멈추면 빛 원과 글이 켜지고 캐릭터가 튀어나오며 색종이가 터진다
  function stage(box, r, quiet, s, G) {
    const police = r.team === "police", Z = G?.mode === "zombie" && tt("zb");
    // 좀비 판: 좀비 MVP 는 어두운 초록 무대에 좀비 냥파, 생존자 MVP 는 노란 무대에 생존자 도둥이
    // 원형 빛은 무대 밝기를 따른다: 좀비(어두운 무대)는 어두운 초록 빛, 생존자(밝은 무대)는 노란 빛
    const icon = Z ? ZB.url(police ? "zcat-front" : "zsurv-front") : svgUrl(police ? "police-front" : "robber-front");
    const artSrc = Z ? ZB.url(police ? "zcat-front" : "zsurv-front") : ART.mvp[r.team];
    const n = h("div", "scStage " + (Z ? (police ? "dark zomb" : "light surv") : police ? "light" : "dark"));
    n.innerHTML = `<div class="scLit"><img class="scGlowRing" src="${ART.glow[Z ? (police ? "robber" : "police") : r.team]}" alt=""><div class="scMvpTx"><small>${esc(s.result)}</small><span class="scPillTeam">${esc(Z ? (police ? Z.mvpZ : Z.mvpS) : police ? s.mvpCop : s.mvpRob)}</span><b><img src="${icon}" alt="">${esc(r.name)}</b><p>${esc(Z ? (police ? Z.subZ : Z.subS) : police ? s.subCop : s.subRob)}</p></div></div><img class="scMvpArt" src="${artSrc}" alt=""><div class="scConfetti"></div><div class="scSpot"></div>`;
    box.insertBefore(n, box.firstChild);
    const lit = n.querySelector(".scLit"), art = n.querySelector(".scMvpArt"), spot = n.querySelector(".scSpot"), conf = n.querySelector(".scConfetti");
    const POP = 2050;
    let burst = false;
    // 바닥 위를 지나는 조명 자리: 왼쪽 → 오른쪽 → 왼쪽 조금 → 가운데를 살짝 지나쳤다 돌아온다
    const path = [[0, 0.08], [0.35, 0.89], [0.68, 0.28], [0.88, 0.54], [1, 0.5]];
    const at = p => { for (let i = 1; i < path.length; i++) { const [p0, x0] = path[i - 1], [p1, x1] = path[i]; if (p <= p1) { const t = Math.min(1, Math.max(0, (p - p0) / (p1 - p0))); return x0 + (x1 - x0) * t * t * (3 - 2 * t); } } return 0.5; };
    return run(ms => {
      const t = quiet ? 99999 : ms;
      const sinceLit = t - POP, litT = Math.min(1, Math.max(0, sinceLit / 250));
      lit.style.opacity = String(litT);
      // 조명 - 바깥은 어둡고 바닥 웅덩이만 밝다
      const sw = iv(t, 300, 2000), x = at(sw) * 100, dark = 1 - litT;
      spot.style.opacity = String(dark);
      spot.style.background = `radial-gradient(ellipse 22% 14% at ${x}% 76%, rgba(255,255,240,${police ? 0.35 : 0.5}) 0%, rgba(255,255,240,0) 100%), linear-gradient(${x > 50 ? 200 : 160}deg, rgba(255,255,230,0) 30%, rgba(255,255,230,${police ? 0.06 : 0.12}) 50%, rgba(255,255,230,0) 70%), rgba(8,10,12,.95)`;
      // 캐릭터 - 납작하게 눌렸다 쭉 늘어나며 튀어나온다(발끝 기준)
      const p = sinceLit / 750;
      if (p <= 0) art.style.transform = "scale(0)";
      else {
        const grow = 1 - (1 - Math.min(1, p / 0.22)) ** 3, wob = -0.38 * Math.exp(-4.2 * p) * Math.cos(15 * p), hop = Math.min(1, p / 0.45);
        art.style.transform = `translateY(${-38 * Math.sin(Math.PI * hop) * (1 - hop)}px) scale(${grow * (1 - wob * 0.75)},${grow * (1 + wob)})`;
      }
      if (sinceLit >= 0 && !burst && !quiet) { burst = true; confetti(conf, Z && police); play("win"); }
      if (ms > POP + 4200) return false;
    });
  }
  // 좀비 무대는 색종이 대신 반딧불이 떠오른다
  function confetti(box, fireflies) {
    const W = box.clientWidth, H = box.clientHeight;
    if (fireflies) {
      for (let i = 0; i < 22; i++) {
        const f = h("i", "scFly"); f.style.cssText = `left:${10 + Math.random() * 80}%;top:${45 + Math.random() * 45}%`;
        box.appendChild(f);
        const a = f.animate([{ transform: "translate(0,0)", opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: `translate(${(Math.random() - 0.5) * 120}px,${-80 - Math.random() * 160}px)`, opacity: 0 }], { duration: 2600 + Math.random() * 1600, delay: Math.random() * 600, easing: "ease-out", fill: "both" });
        a.onfinish = () => f.remove();
      }
      return;
    }
    for (let i = 0; i < 28; i++) {
      const left = i % 2 === 0, img = h("img"); img.src = ART.confetti[i % 6]; img.alt = "";
      const x0 = left ? -10 : W + 10, vx = (left ? 1 : -1) * (180 + Math.random() * 320), vy = -(260 + Math.random() * 360), spin = (Math.random() - 0.5) * 720, delay = Math.random() * 180;
      img.style.cssText = `left:${x0}px;top:${H * (0.55 + Math.random() * 0.25)}px;width:${10 + Math.random() * 8}px`;
      box.appendChild(img);
      const a = img.animate([
        { transform: "translate(0,0) rotate(0)", opacity: 1 },
        { transform: `translate(${vx * 0.9}px,${vy * 0.8}px) rotate(${spin * 0.5}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${vx * 1.4}px,${vy * 0.2 + H * 0.5}px) rotate(${spin}deg)`, opacity: 0 },
      ], { duration: 3200, delay, easing: "cubic-bezier(.2,.6,.4,1)", fill: "both" });
      a.onfinish = () => img.remove();
    }
  }

  // ───────── 좀비 판: 물린 순간 ─────────
  // 물린 사람만 2초 동안: 초록빛으로 어두워지고, 원이 차오르는 동안 원 안의 생존자 도둥이가 떨다가
  // 한 바퀴 뒤집히며 좀비 냥파가 된다(판 위의 캐릭터와 같은 순서, client/zombie.js turning)
  function bitten() {
    const Z = tt("zb"), box = h("div", "scBitten", `<div class="scBiteRing"><img src="${ZB.url("zsurv-front")}" alt=""></div><div class="scBiteTx"><b>${esc(Z.bitten)}</b><span>${esc(Z.bittenSub)}</span></div>`);
    box.setAttribute("aria-live", "assertive");
    layer().appendChild(box);
    const ring = box.querySelector(".scBiteRing"), img = ring.querySelector("img"), quiet = reduce();
    let turned = false;
    run(ms => {
      ring.style.setProperty("--k", String(Math.min(1, ms / 2000)));
      box.style.opacity = String(quiet ? 1 : Math.min(1, ms / 180) * (ms > 2000 ? Math.max(0, 1 - (ms - 2000) / 300) : 1));
      // 1.15초까지 떨고, 1.15~1.35초에 납작하게 접혔다가 냥파로 펴진다
      const flip = (ms - 1150) / 200;
      if (!turned && flip >= 0.5) { turned = true; img.src = ZB.url("zcat-front"); }
      if (quiet) img.style.transform = "";
      else if (flip < 0) img.style.transform = `translateX(${Math.sin(ms / 45) * 3 * Math.min(1, ms / 600)}px)`;
      else if (flip < 1) img.style.transform = `scale(${Math.abs(1 - 2 * flip) * 1.1 + 0.02}, ${1 - 0.25 * Math.sin(Math.PI * flip)})`;
      else { const t = Math.min(1, (ms - 1350) / 450); img.style.transform = `scale(${1 + 0.12 * Math.sin(Math.PI * t) * (1 - t)})`; }
      if (ms > 2300) { box.remove(); return false; }
    });
  }

  return { sync, reset, mvpReveal, bitten };
})();
