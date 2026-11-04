// 그리기와 조작. 규칙은 logic.js, 캐릭터 관절은 playground 의 엔진을 그대로 쓴다.
const L = window.GameLogic;
const { CFG, THEMES, newGame, step, sees, startCatch, dist, inZone } = L;
const { mount, MOTIONS, piv, Spring, clamp } = window.CharRig;

// 주기는 사람이 해 보면서 고른다: game.html?reveal=20
const QS = new URLSearchParams(location.search);
if (QS.get("reveal")) CFG.REVEAL_EVERY = Number(QS.get("reveal"));

const $ = id => document.getElementById(id);
const stage = $("stage"), world = $("world"), fog = $("fog"), fctx = fog.getContext("2d"), mini = $("mini"), mctx = mini.getContext("2d");
const CS = 0.5; // 캐릭터 크기
let G = null, chars = [], role = null, zoom = 1, camX = 0, camY = 0, W = 0, H = 0, ended = false, lastSeenBy = false;
const fitStage = () => {
  W = stage.clientWidth; H = stage.clientHeight; fog.width = W; fog.height = H;
  zoom = clamp(Math.min(W / 1180, H / 720), 0.52, 1.25);
};
fitStage(); addEventListener("resize", fitStage);

// ───────── 맵 ─────────
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function bakeMap() {
  const c = $("map"); c.width = CFG.W; c.height = CFG.H; const x = c.getContext("2d"), T = G.th, seed = G.map.seed % 1000;
  world.style.width = CFG.W + "px"; world.style.height = CFG.H + "px"; stage.style.background = T.out;
  x.fillStyle = T.out; x.fillRect(0, 0, CFG.W, CFG.H);
  const zonePath = () => { x.beginPath(); L.ZONE.forEach((p, i) => i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)); x.closePath(); };
  x.save(); zonePath(); x.fillStyle = T.ground; x.fill(); x.clip();
  // 마당은 색만 살짝 다르게
  for (const p of L.PARKS) { x.fillStyle = T.park; rr(x, p.x - p.rx, p.y - p.ry, p.rx * 2, p.ry * 2, 34); x.fill(); }
  // 큰길: 인도 턱, 차로, 중앙선
  for (const r of L.ROADS) { x.fillStyle = T.curb; x.fillRect(r.x - 10, r.y - 10, r.w + 20, r.h + 20); }
  x.fillStyle = T.road; for (const r of L.ROADS) x.fillRect(r.x, r.y, r.w, r.h);
  x.strokeStyle = T.line; x.lineWidth = 5; x.setLineDash([34, 30]);
  for (const r of L.ROADS) { x.beginPath(); if (r.w > r.h) { x.moveTo(r.x, r.y + r.h / 2); x.lineTo(r.x + r.w, r.y + r.h / 2); } else { x.moveTo(r.x + r.w / 2, r.y); x.lineTo(r.x + r.w / 2, r.y + r.h); } x.stroke(); }
  x.setLineDash([]);
  // 교차로: 가운데를 지우고 횡단보도를 그린다
  const hs = L.ROADS.filter(r => r.w > r.h), vs = L.ROADS.filter(r => r.w <= r.h); let crossN = 0;
  for (const h of hs) for (const v of vs) {
    if (v.x + v.w < h.x || v.x > h.x + h.w || h.y + h.h < v.y || h.y > v.y + v.h) continue;
    x.fillStyle = T.road; x.fillRect(v.x, h.y, v.w, h.h);
    crossN++;
    if (crossN % 3) continue;
    x.fillStyle = T.cross;
    for (let k = 0; k < v.w - 12; k += 26) x.fillRect(v.x + 6 + k, h.y - 34, 13, 28);
    for (let k = 0; k < h.h - 12; k += 26) x.fillRect(v.x + v.w + 6, h.y + 6 + k, 28, 13);
  }
  // 감옥 마당: 울타리를 세우면 통과할 때 어색해서 바닥에 그린다
  const J = CFG.JAIL;
  x.fillStyle = T.plaza; x.beginPath(); x.arc(J.x, J.y, CFG.GATE_R, 0, 7); x.fill();
  x.strokeStyle = T.curb; x.lineWidth = 8; x.beginPath(); x.arc(J.x, J.y, CFG.GATE_R, 0, 7); x.stroke();
  x.fillStyle = T.jail; x.beginPath(); x.arc(J.x, J.y, J.r, 0, 7); x.fill();
  x.strokeStyle = G.theme === "night" ? "#C9CFDC" : "#FFFFFF"; x.lineWidth = 9; x.beginPath(); x.arc(J.x, J.y, J.r - 5, 0, 7); x.stroke();
  x.restore();
  // 구역 경계: 바깥쪽을 어둡게 눌러 구역이 떠 보이게
  x.save(); x.beginPath(); x.rect(0, 0, CFG.W, CFG.H); L.ZONE.forEach((p, i) => i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)); x.closePath(); x.clip("evenodd");
  zonePath(); x.lineWidth = 60; x.strokeStyle = "rgba(29,35,43,.12)"; x.stroke(); x.restore();
  zonePath(); x.strokeStyle = "#E2574C"; x.lineWidth = 8; x.setLineDash([40, 26]); x.stroke(); x.setLineDash([]);
  // 건물: 그림자, 벽, 지붕, 문, 창. 벽이 충돌 칸 안에 그대로 들어간다
  // 밤에는 가로등 빛이 길에 고인다. 그림이라 부딪히지 않는다
  if (G.theme === "night") {
    x.save(); x.globalCompositeOperation = "lighter";
    for (const r of L.ROADS) { const len = Math.max(r.w, r.h), hor = r.w > r.h; for (let k = 120; k < len; k += 420) { const lx = hor ? r.x + k : r.x + r.w / 2, ly = hor ? r.y + r.h / 2 : r.y + k, g = x.createRadialGradient(lx, ly, 8, lx, ly, 170); g.addColorStop(0, "rgba(255,214,130,.22)"); g.addColorStop(1, "rgba(255,214,130,0)"); x.fillStyle = g; x.beginPath(); x.arc(lx, ly, 170, 0, 7); x.fill(); } }
    x.restore();
  }
  // 감옥 글자
  x.font = "800 30px Pretendard, 'Noto Sans KR', sans-serif"; x.textAlign = "center";
  const w = x.measureText("감옥").width + 34; x.fillStyle = "#1D232B"; rr(x, J.x - w / 2, J.y - J.r - 58, w, 44, 14); x.fill(); x.fillStyle = "#fff"; x.fillText("감옥", J.x, J.y - J.r - 25);
}
function drawBuilding(x, b, T, i, seed) {
    const [roof, wall] = T.roofs[(i * 7 + seed) % T.roofs.length], wh = Math.min(66, Math.max(40, b.h * 0.34)), h = hash(i + seed);
    x.fillStyle = "rgba(29,35,43,.14)"; rr(x, b.x + 8, b.y + 14, b.w + 6, b.h + 4, 14); x.fill();
    x.fillStyle = wall; rr(x, b.x, b.y, b.w, b.h, 12); x.fill();
    x.fillStyle = "rgba(0,0,0,.14)"; x.fillRect(b.x + 3, b.y + b.h - 8, b.w - 6, 8);
    x.fillStyle = roof; rr(x, b.x, b.y, b.w, b.h - wh, 12); x.fill();
    x.fillStyle = "rgba(0,0,0,.10)"; x.fillRect(b.x, b.y + b.h - wh - 7, b.w, 7);
    const rh = b.h - wh;
    if (h < 0.4) { x.strokeStyle = "rgba(0,0,0,.07)"; x.lineWidth = 3; for (let k = b.y + 24; k < b.y + rh - 10; k += 20) { x.beginPath(); x.moveTo(b.x + 6, k); x.lineTo(b.x + b.w - 6, k); x.stroke(); } }
    if (T.roofEdge) { x.fillStyle = T.roofEdge; x.fillRect(b.x + 4, b.y + rh - 8, b.w - 8, 5); }
    const n = Math.max(1, Math.floor((b.w - 30) / 58)), door = n > 1 ? Math.floor(hash(i * 9 + seed) * n) : -1;
    for (let k = 0; k < n; k++) {
      const wx = b.x + (b.w - n * 58 + 22) / 2 + k * 58, wy = b.y + b.h - wh + 11, ww = wh - 26;
      if (k === door) { x.fillStyle = "rgba(29,35,43,.5)"; x.fillRect(wx + 4, wy, 28, wh - 15); continue; }
      x.fillStyle = hash(i * 13 + k) < T.winOn ? T.win : T.winOff; x.fillRect(wx, wy, 36, ww);
    }
}
function rr(x, a, b, w, h, r) { x.beginPath(); x.roundRect(a, b, w, h, r); }
// 윤곽은 낮은 주파수로만 흔들어 납작한 실루엣으로 둔다. 잎을 하나하나 찍지 않는다(앱 그림체가 면 위주다)
function lobed(x, cx, cy, rx, ry, seed, amp = 0.06) {
  const n = 44, P = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, k = 1 + amp * (Math.sin(3 * a + seed) + 0.6 * Math.sin(5 * a + seed * 1.7) + 0.35 * Math.sin(8 * a + seed * 2.3)); P.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  x.beginPath(); x.moveTo((P[n - 1][0] + P[0][0]) / 2, (P[n - 1][1] + P[0][1]) / 2);
  for (let i = 0; i < n; i++) { const q = P[(i + 1) % n]; x.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + q[0]) / 2, (P[i][1] + q[1]) / 2); }
  x.closePath();
}
// 잎덩이: 아래는 그늘, 왼쪽 위는 빛. 세 톤이 전부다
function crown(x, cx, cy, rx, ry, pal, seed, snow) {
  x.fillStyle = pal[0]; lobed(x, cx, cy + ry * 0.1, rx, ry * 0.95, seed); x.fill();
  x.save(); lobed(x, cx, cy - ry * 0.04, rx * 0.97, ry * 0.88, seed); x.fillStyle = pal[1]; x.fill(); x.clip();
  x.fillStyle = snow ? "#FFFFFF" : pal[2]; lobed(x, cx - rx * 0.22, cy - ry * 0.4, rx * 0.68, ry * 0.5, seed + 2, 0.1); x.fill();
  x.restore();
}
// 그림자는 건물과 같은 방향(오른쪽 아래)으로 떨어진다
const groundShadow = (x, cx, cy, rx, ry) => { x.fillStyle = "rgba(29,35,43,.15)"; x.beginPath(); x.ellipse(cx + rx * 0.1, cy + ry * 0.25, rx, ry, 0, 0, 7); x.fill(); };
function drawBush(x, b, w, h, foot, pal, seed, snow) {
  const cx = w / 2;
  if (b.hedge) {
    // 생울타리: 건물처럼 윗면과 앞면이 있다. 가장자리만 잎처럼 울퉁불퉁하다
    const fh = Math.min(b.r * 0.42, 26), topH = b.ry * 1.5, y0 = foot - fh - topH, hw = b.rx;
    groundShadow(x, cx, foot - 2, hw * 1.02, b.r * 0.15);
    const leafy = (px, py, pw, ph, col, sd) => {
      x.fillStyle = col; rr(x, px, py, pw, ph, 6); x.fill();
      const dot = 11, step = 15; let k = sd * 7;
      const bump = (bx, by) => { k = (k * 16807 + 11) % 2147483647; x.beginPath(); x.arc(bx, by, dot * (0.72 + (k % 100) / 260), 0, 7); x.fill(); };
      for (let q = px + 4; q <= px + pw - 4; q += step) { bump(q, py + 3); bump(q + 5, py + ph - 3); }
      for (let q = py + 8; q <= py + ph - 8; q += step) { bump(px + 3, q); bump(px + pw - 3, q + 4); }
    };
    leafy(cx - hw, y0 + topH * 0.45, hw * 2, topH * 0.55 + fh, pal[0], seed + 1);
    leafy(cx - hw, y0, hw * 2, topH, snow ? "#FFFFFF" : pal[1], seed + 2);
    if (!snow) { x.save(); rr(x, cx - hw, y0, hw * 2, topH, 6); x.clip(); x.fillStyle = pal[2]; lobed(x, cx - hw * 0.3, y0 + topH * 0.24, hw * 0.62, topH * 0.3, seed, 0.1); x.fill(); x.restore(); }
  } else {
    // 둥근 관목: 낮은 무더기
    groundShadow(x, cx, foot - 3, b.rx * 1.02, b.r * 0.2);
    crown(x, cx, foot - b.ry * 0.86, b.rx, b.ry * 0.9, pal, seed, snow);
  }
}
function drawTree(x, b, w, h, foot, pal, seed, T) {
  const r = b.crown, cx = w / 2;
  if (b.pit) { x.fillStyle = "#8D94A0"; rr(x, cx - 34, foot - 14, 68, 26, 3); x.fill(); x.fillStyle = "#6F7682"; x.fillRect(cx - 22, foot - 7, 44, 11); }
  if (b.species === "pine") {
    // 전나무: 사철 푸른 나무라 겨울에도 잎이 있다. 층마다 눈이 쌓인다
    groundShadow(x, cx, foot - 2, r * 0.6, r * 0.15);
    x.fillStyle = T.trunk; x.fillRect(cx - 7, foot - r * 0.42, 14, r * 0.42);
    for (let k = 0; k < 3; k++) {
      const hw = r * (0.78 - k * 0.2), base = foot - r * (0.28 + k * 0.5), top = base - r * 0.74;
      x.fillStyle = pal[0]; x.beginPath(); x.moveTo(cx - hw, base); x.quadraticCurveTo(cx, base + r * 0.12, cx + hw, base); x.lineTo(cx, top); x.closePath(); x.fill();
      x.fillStyle = "#FFFFFF"; x.beginPath(); x.moveTo(cx - hw * 0.54, top + r * 0.4); x.quadraticCurveTo(cx - hw * 0.1, top + r * 0.5, cx, top + r * 0.36); x.quadraticCurveTo(cx + hw * 0.16, top + r * 0.5, cx + hw * 0.54, top + r * 0.4); x.lineTo(cx, top); x.closePath(); x.fill();
    }
    return;
  }
  const oval = b.species === "oval", rx = oval ? r * 0.7 : r, ry = oval ? r * 1 : r * 0.76, trunkH = r * (oval ? 0.5 : 0.46);
  // 그림자는 줄기 밑이 아니라 잎이 드리운 만큼 넓다
  groundShadow(x, cx, foot - 3, rx * 0.86, r * 0.26);
  // 짧은 줄기가 낮은 곳에서 갈라진다. 위는 잎이 덮는다
  x.fillStyle = T.trunk; x.beginPath(); x.moveTo(cx - 11, foot); x.quadraticCurveTo(cx - 7, foot - trunkH * 0.5, cx - 8, foot - trunkH); x.lineTo(cx + 8, foot - trunkH); x.quadraticCurveTo(cx + 7, foot - trunkH * 0.5, cx + 11, foot); x.closePath(); x.fill();
  x.strokeStyle = T.trunk; x.lineCap = "round"; x.lineWidth = 7; x.beginPath(); x.moveTo(cx - 2, foot - trunkH * 0.72); x.lineTo(cx - rx * 0.32, foot - trunkH * 1.5); x.moveTo(cx + 2, foot - trunkH * 0.78); x.lineTo(cx + rx * 0.3, foot - trunkH * 1.55); x.stroke();
  crown(x, cx, foot - trunkH - ry * 0.68, rx, ry, pal, seed);
}
// 건물과 쓰레기통은 부딪히는 칸보다 위로 높게 그린다. 그 뒤로 가면 몸 아래쪽이 가려지고 머리는 보인다
const RISE = 70, BIN_RISE = 30;
function bakeSolids() {
  const T = G.th, seed = G.map.seed % 1000;
  L.BUILDINGS.forEach((b, i) => {
    if (b.kind === "tree") return;
    const rise = b.kind === "bin" ? BIN_RISE : RISE, pad = 22;
    const vb = { x: b.x, y: b.y - rise, w: b.w, h: b.h + rise };
    const c = document.createElement("canvas"); c.className = "bush"; c.width = b.w + pad * 2; c.height = vb.h + pad * 2;
    c.style.left = (b.x - pad) + "px"; c.style.top = (vb.y - pad) + "px"; c.style.zIndex = b.y + b.h;
    const x = c.getContext("2d"); x.translate(pad - vb.x, pad - vb.y);
    if (b.kind === "bin") drawBins(x, vb, T, i); else drawBuilding(x, vb, T, i, seed);
    world.append(c);
  });
}
function bakeBushes() {
  document.querySelectorAll(".bush").forEach(n => n.remove());
  bakeSolids();
  const pal = G.th.bushes, snow = G.theme === "snow";
  L.BUSHES.forEach((b, i) => {
    const c = document.createElement("canvas"); c.className = "bush"; const w = Math.round(b.rx * 2 + 40), h = Math.round(b.ry * 2 + b.r * 0.9 + 30), foot = h - 12, by = b.y + b.ry * 0.82;
    c.width = w; c.height = h; c.style.left = (b.x - w / 2) + "px"; c.style.top = (by - foot) + "px"; c.style.zIndex = Math.round(by);
    drawBush(c.getContext("2d"), b, w, h, foot, pal, i * 1.7 + 3, snow);
    c.style.transformOrigin = "50% 90%"; b.el = c;
    world.append(c);
  });
  // 나무: 줄기는 부딪히고, 잎은 뒤에 선 캐릭터를 가린다
  L.BUILDINGS.forEach((b, i) => {
    if (b.kind !== "tree") return;
    const c = document.createElement("canvas"); c.className = "bush"; const r = b.crown, w = Math.round(r * 2.3 + 60), h = Math.round(r * 2.6 + 50), foot = h - 20, tx = b.x + b.w / 2, gy = b.y + b.h;
    c.width = w; c.height = h; c.style.left = (tx - w / 2) + "px"; c.style.top = (gy - foot) + "px"; c.style.zIndex = Math.round(gy);
    drawTree(c.getContext("2d"), b, w, h, foot, pal, i * 2.3 + 1, G.th);
    world.append(c);
  });
}
// 쓰레기통 두 개를 나란히. 벽 옆에 두는 흔한 바퀴 달린 통이다
function drawBins(x, b, T, i) {
  const n = 2, w = b.w / n, col = T.bin[i % T.bin.length];
  x.fillStyle = "rgba(29,35,43,.16)"; x.fillRect(b.x + 3, b.y + b.h - 3, b.w + 2, 8);
  for (let k = 0; k < n; k++) {
    const bx = b.x + k * w + 1, bw = w - 3;
    x.fillStyle = col[0]; rr(x, bx + 1, b.y + 12, bw - 2, b.h - 12, 3); x.fill();
    x.fillStyle = "rgba(0,0,0,.14)"; for (let v = 1; v < 3; v++) x.fillRect(bx + bw * v / 3 - 1, b.y + 20, 2, b.h - 28);
    x.fillStyle = col[1]; rr(x, bx - 1, b.y, bw + 2, 15, 3); x.fill();
    x.fillStyle = "rgba(0,0,0,.4)"; x.fillRect(bx + bw * 0.34, b.y + b.h - 3, bw * 0.32, 3);
    if (G.theme === "snow") { x.fillStyle = "#FFFFFF"; rr(x, bx, b.y - 4, bw, 11, 5); x.fill(); }
  }
}

// ───────── 캐릭터 (playground 와 같은 방식) ─────────
// 뒷모습은 얼굴을 숨긴 그림이라 몸만 남는다. 꼬리를 달아 등을 보고 있다는 걸 바로 알게 한다
function addTail(rig) {
  const name = rig.def.name; if (!name.endsWith("-back")) return;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const police = name.startsWith("police");
  path.setAttribute("d", police ? "M92 172 C118 178 138 168 136 146 C135 136 124 134 122 142" : "M82 118 C104 128 122 122 124 104 C125 96 116 94 113 100");
  path.setAttribute("fill", "none"); path.setAttribute("stroke", police ? "#7FC4F5" : "#6F7480"); path.setAttribute("stroke-width", police ? "13" : "6"); path.setAttribute("stroke-linecap", "round");
  rig.all.append(path);
}
function makeChar(a) {
  const kind = a.team;
  const el = document.createElement("div"); el.className = "char"; world.append(el);
  const sh = document.createElement("div"); sh.className = "shadow"; el.append(sh);
  const base = kind === "police" ? 0.95 : 1.12; // 두 캐릭터 몸집이 비슷해 보이게
  const views = {};
  const names = kind === "police" ? ["police-front", "police-side", "police-back"] : ["robber-front", "robber-side", "robber-back", "robber-jailed"];
  for (const n of names) {
    const rig = mount(SVGS[n], n); const d = rig.def; addTail(rig);
    const scale = base * (n === "robber-jailed" ? 1.45 : 1);
    rig.svg.setAttribute("viewBox", `0 0 ${d.w} ${d.h}`);
    rig.svg.style.width = d.w * scale + "px"; rig.svg.style.height = d.h * scale + "px";
    rig.svg.style.left = (-(d.cx) * scale) + "px"; rig.svg.style.bottom = (-(d.h - d.ground) * scale) + "px";
    if (rig.parts.shadow) rig.parts.shadow.forEach(g => g.style.display = "none");
    el.append(rig.svg); views[n] = rig;
  }
  const headTop = -(kind === "police" ? 200 : 145) * base;
  let tag = null;
  if (a.team === (G.player && G.player.team)) {
    tag = document.createElement("div"); tag.className = "tag " + kind + (a.isPlayer ? " me" : ""); tag.textContent = a.isPlayer ? "나" : a.name; tag.style.top = (headTop - 46) + "px"; el.append(tag);
  }
  const c = { a, kind, el, views, tag, face: 1, faceS: new Spring(420, 34), pop: new Spring(300, 14), view: null, prev: null, tr: 1, trMode: "fade", mot: {}, mkey: {}, phase: 0, facing: "front", want: null, wantT: 0, stillT: 0, action: null, hopY: 0, input: { x: 0, y: 0 }, hide: 0, wasVisible: false };
  c.faceS.x = 1;
  goView(c, `${kind}-front`, true); ensureMotion(c, `${kind}-front`, "idleFront");
  return c;
}
function ensureMotion(c, view, motionName, opts) {
  const key = motionName + JSON.stringify(opts || {});
  if (c.mkey[view] !== key) { const rig = c.views[view]; rig.reset(); c.mot[view] = MOTIONS[motionName](rig, opts || {}); c.mkey[view] = key; }
}
function goView(c, view, instant) {
  if (c.view === view) return;
  if (!c.view || instant) { c.prev = null; c.tr = 1; }
  else {
    const a = c.view.split("-")[1], b = view.split("-")[1];
    c.trMode = (a === "front" && b === "back") || (a === "back" && b === "front") ? "spin" : "swap";
    c.prev = c.view; c.tr = 0;
  }
  c.view = view;
}
const hideOpts = { crouch: 1, period: 0.8, bob: 3 };
function desiredFacing(c, mx, my) {
  const mag = Math.hypot(mx, my); const ax = Math.abs(mx) / mag;
  if (c.facing === "side") return ax > 0.42 ? "side" : (my > 0 ? "front" : "back");
  if (ax > 0.82) return "side";
  if (c.facing === "front" && my < -0.3 * mag) return "back";
  if (c.facing === "back" && my > 0.3 * mag) return "front";
  return c.facing;
}
function locomotion(c, dt) {
  const k = c.kind, mx = c.input.x, my = c.input.y, mag = Math.hypot(mx, my);
  if (mag < 0.05) {
    c.stillT += dt;
    if (c.stillT > 0.08) c.facing = c.facing === "back" ? "back" : "front";
    const v = `${k}-${c.facing === "back" ? "back" : (c.stillT > 0.08 ? "front" : c.facing)}`;
    ensureMotion(c, v, c.facing === "side" ? "runSide" : "idleFront", c.facing === "side" && c.hide ? hideOpts : {});
    goView(c, v); return;
  }
  c.stillT = 0;
  if (Math.abs(mx) > 0.05) c.face = Math.sign(mx);
  const want = desiredFacing(c, mx, my);
  if (want !== c.facing) { if (c.want !== want) { c.want = want; c.wantT = 0; } c.wantT += dt; if (c.wantT > 0.06) { c.facing = want; c.want = null; } } else c.want = null;
  const v = `${k}-${c.facing}`;
  if (c.facing === "side") ensureMotion(c, v, "runSide", c.hide ? hideOpts : {});
  else ensureMotion(c, v, "runFront", {});
  goView(c, v);
}
function startAction(c, name, dx) {
  if (name === "catch") { c.face = dx < 0 ? -1 : 1; c.facing = "side"; goView(c, "police-side", c.view === "police-side"); c.mkey["police-side"] = null; ensureMotion(c, "police-side", "catchSide"); c.action = { name, until: 0.6 }; }
  if (name === "jail") { c.facing = "side"; goView(c, "robber-side", true); ensureMotion(c, "robber-side", "runSide"); c.action = { name: "caught", until: 0.32 }; c.pop.x = -0.15; }
  if (name === "escape") {
    c.facing = "front"; c.mkey["robber-jailed"] = null; ensureMotion(c, "robber-jailed", "breakout"); goView(c, "robber-front", true); ensureMotion(c, "robber-front", "idleFront");
    c.prev = "robber-jailed"; c.tr = 0; c.trMode = "keep"; // 창살은 남아서 튕겨 나가고, 도둥이는 정면으로 뛰어나온다
    c.action = { name: "escape", until: 0.5 }; c.pop.x = -0.15;
  }
  if (c.action) c.action.t = 0;
}
function drawChar(c, dt) {
  const a = c.a;
  c.input = (a.state === "jailed" || a.state === "caught" || a.state === "waiting" || a.action) ? { x: 0, y: 0 } : { x: a.ix, y: a.iy };
  c.hide = a.inBush ? 5 : 0;
  if (c.action) {
    c.action.t += dt;
    if (c.action.name === "caught") { const k = c.action.t / 0.32; c.views["robber-side"].all.setAttribute("transform", piv(93, 141, 6 * Math.sin(k * 30), 1, 1, 4 * Math.sin(k * 40) * (1 - k), -18 * Math.sin(Math.PI * Math.min(1, k)))); }
    if (c.action.name === "escape") { const k = c.action.t / 0.5; c.hopY = -40 * Math.sin(Math.PI * Math.min(1, k)); }
    if (c.action.until !== Infinity && c.action.t >= c.action.until) {
      const n = c.action.name; c.action = null; c.hopY = 0;
      if (n === "caught") { goView(c, "robber-jailed"); c.trMode = "swap"; c.mkey["robber-jailed"] = null; ensureMotion(c, "robber-jailed", "jailed"); c.action = { name: "jailed", until: Infinity, t: 0 }; c.pop.x = -0.1; }
    }
  } else locomotion(c, dt);
  const sp = Math.hypot(a.vx, a.vy) / CFG.RUN, spd = clamp(Math.max(0.35, sp), 0.35, 1.35);
  if (sp > 0.05) c.phase = (c.phase + dt / ((c.hide ? 0.8 : 0.44) / (0.55 + 0.45 * spd))) % 1;
  const ctx = { speed: spd, phase: c.phase };
  c.mot[c.view] && c.mot[c.view].update(dt, ctx); c.views[c.view].updateLimbs();
  if (c.prev && c.tr < 1) { c.mot[c.prev] && c.mot[c.prev].update(dt, ctx); c.views[c.prev].updateLimbs(); }
  c.tr = Math.min(1, c.tr + dt / (c.trMode === "spin" ? 0.2 : c.trMode === "keep" ? 0.42 : 0.14));
  if (c.tr >= 1) c.prev = null;
  const fs = c.faceS.step(c.face, dt), pop = c.pop.step(0, dt);
  for (const [n, rig] of Object.entries(c.views)) {
    const isCur = n === c.view, isPrev = n === c.prev;
    rig.svg.classList.toggle("on", isCur || isPrev);
    if (!isCur && !isPrev) continue;
    const d = rig.def; const side = n.endsWith("side");
    let sx = 1, op = 1;
    if (c.prev) {
      const k = c.tr, e = k * k * (3 - 2 * k);
      if (c.trMode === "spin") { if (isPrev) { sx = Math.max(0.06, 1 - 2 * e); op = k < 0.5 ? 1 : 0; } else { sx = Math.max(0.06, 2 * e - 1); op = k < 0.5 ? 0 : 1; } }
      else if (c.trMode === "keep") { sx = 1; op = 1; }
      else { if (isPrev) { sx = 1 - 0.45 * Math.min(1, 2 * e); op = k < 0.5 ? 1 : 0; } else { sx = 0.55 + 0.45 * Math.max(0, 2 * e - 1); op = k < 0.5 ? 0 : 1; } }
    }
    const flipX = side ? (Math.abs(fs) < 0.08 ? 0.08 * Math.sign(fs || 1) : clamp(fs, -1, 1)) : 1;
    rig.svg.style.opacity = op;
    rig.flip.setAttribute("transform", piv(d.cx, d.ground, 0, flipX * sx * (1 - pop * 0.5), 1 + pop));
  }
  c.el.style.opacity = a.inBush ? 0.6 : 1;
  c.el.style.transform = `translate(${a.x}px, ${a.y + (c.hopY || 0) * CS}px) scale(${CS})`;
  // 내 캐릭터는 덤불에 들어가도 비쳐 보여야 어디 있는지 안다
  c.el.style.zIndex = Math.round(a.y) + (a.isPlayer && a.inBush ? 400 : 0);
}

// ───────── 시야 ─────────
function castRay(ox, oy, dx, dy, maxR) {
  let best = maxR;
  for (const r of L.BUILDINGS) {
    let t0 = 0, t1 = best, ok = true;
    for (const [p, q] of [[-dx, ox - r.x], [dx, r.x + r.w - ox], [-dy, oy - r.y], [dy, r.y + r.h - oy]]) {
      if (Math.abs(p) < 1e-9) { if (q < 0) { ok = false; break; } continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; }
      else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; }
    }
    if (ok && t0 < best) best = t0;
  }
  return best;
}
const toScreen = (x, y) => [(x - camX) * zoom, (y - camY) * zoom];
function drawFog() {
  const p = G.player, ctx = fctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "source-over"; ctx.clearRect(0, 0, W, H);
  const out = !inZone(p.x, p.y);
  const blind = out || p.state === "waiting" || ended;
  if (!ended) { ctx.fillStyle = `rgba(${G.th.fog},${blind ? 0.86 : G.th.fogA})`; ctx.fillRect(0, 0, W, H); }
  if (!blind) {
    const R = p.vision, angs = [];
    for (let i = 0; i < 72; i++) angs.push(-Math.PI + i / 72 * Math.PI * 2);
    for (let i = -8; i <= 8; i++) { const e = i / 8 * 0.14; angs.push(p.faceA + CFG.CONE + e, p.faceA - CFG.CONE + e); }
    const reach = a => { let d = a - p.faceA; d = Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); const k = Math.min(1, Math.max(0, (CFG.CONE + 0.14 - d) / 0.28)); return CFG.NEAR + (R - CFG.NEAR) * k * k * (3 - 2 * k); };
    for (const b of L.BUILDINGS) {
      if (Math.abs(b.x + b.w / 2 - p.x) > R + b.w || Math.abs(b.y + b.h / 2 - p.y) > R + b.h) continue;
      for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) { const a = Math.atan2(y - p.y, x - p.x); angs.push(a - 0.002, a + 0.002); }
    }
    const norm = a => Math.atan2(Math.sin(a), Math.cos(a));
    for (let i = 0; i < angs.length; i++) angs[i] = norm(angs[i]);
    angs.sort((m, n) => m - n);
    const [sx, sy] = toScreen(p.x, p.y);
    ctx.globalCompositeOperation = "destination-out";
    const g = ctx.createRadialGradient(sx, sy, R * zoom * 0.72, sx, sy, R * zoom);
    g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.filter = "blur(7px)"; ctx.beginPath();
    angs.forEach((a, i) => { const dx = Math.cos(a), dy = Math.sin(a), t = castRay(p.x, p.y, dx, dy, reach(a)), [x, y] = toScreen(p.x + dx * t, p.y + dy * t); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath(); ctx.fill(); ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
  }
  drawPings(ctx);
  // 감옥 구출 진행
  if (G.rescueT > 0) {
    const [x, y] = toScreen(CFG.JAIL.x, CFG.JAIL.y);
    ctx.strokeStyle = "#35C26B"; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x, y, CFG.JAIL.r * zoom, -Math.PI / 2, -Math.PI / 2 + G.rescueT / CFG.RESCUE_SEC * Math.PI * 2); ctx.stroke();
  }
}
function drawPings(ctx) {
  for (const k of G.pings) {
    const age = (G.t - k.t) / CFG.REVEAL_SHOW;
    const mine = G.player.team === "robber" && k.id !== G.player.id;
    if (mine) continue; // 도둑은 내 자리만 본다
    let [x, y] = toScreen(k.x, k.y);
    const col = "#E2574C";
    const off = x < 30 || y < 30 || x > W - 30 || y > H - 30;
    if (off) {
      // 화면 밖이면 가장자리에 방향을 알려 준다
      const cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy, s = Math.min((W / 2 - 34) / Math.abs(dx || 1), (H / 2 - 34) / Math.abs(dy || 1));
      const ex = cx + dx * s, ey = cy + dy * s, a = Math.atan2(dy, dx);
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = col; ctx.globalAlpha = 1 - age * 0.5;
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill(); ctx.restore();
      continue;
    }
    const pulse = (G.t * 1.6) % 1;
    ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.globalAlpha = (1 - pulse) * (1 - age * 0.6);
    ctx.beginPath(); ctx.arc(x, y, (20 + pulse * 60) * zoom, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1 - age * 0.6; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 9 * zoom + 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
}

// ───────── 작은 지도 ─────────
let miniBase = null;
function bakeMini() {
  const s = mini.width / CFG.W; const c = document.createElement("canvas"); c.width = mini.width; c.height = mini.height; const x = c.getContext("2d"), T = G.th;
  x.fillStyle = T.out; x.fillRect(0, 0, c.width, c.height);
  x.beginPath(); L.ZONE.forEach((p, i) => i ? x.lineTo(p.x * s, p.y * s) : x.moveTo(p.x * s, p.y * s)); x.closePath(); x.fillStyle = T.ground; x.fill();
  x.strokeStyle = "#E2574C"; x.lineWidth = 1.5; x.stroke();
  x.fillStyle = T.roofs[0][1]; for (const b of L.BUILDINGS) if (!b.kind) x.fillRect(b.x * s, b.y * s, b.w * s, b.h * s);
  x.fillStyle = T.bushes[1]; for (const b of L.BUILDINGS) if (b.kind === "tree") { x.beginPath(); x.arc(b.x * s, b.y * s, 3.6, 0, 7); x.fill(); }
  for (const b of L.BUSHES) { x.beginPath(); x.arc(b.x * s, b.y * s, 3.2, 0, 7); x.fill(); }
  x.strokeStyle = "#7D828E"; x.lineWidth = 2; x.beginPath(); x.arc(CFG.JAIL.x * s, CFG.JAIL.y * s, CFG.JAIL.r * s, 0, 7); x.stroke();
  miniBase = c;
}
function drawMini() {
  const s = mini.width / CFG.W, p = G.player, x = mctx;
  x.drawImage(miniBase, 0, 0);
  const dot = (a, col, r) => { x.fillStyle = col; x.beginPath(); x.arc(a.x * s, a.y * s, r, 0, 7); x.fill(); };
  const teamCol = p.team === "police" ? "#2A9BEF" : "#5A6070";
  if (p.team === "police") for (const [, k] of G.intel) if (G.t - k.t < 6) dot(k, "rgba(226,87,76,.55)", 4);
  for (const k of G.pings) if (p.team === "police" || k.id === p.id) dot(k, ((G.t * 3) % 1) < 0.6 ? "#E2574C" : "#F2A29B", 5);
  for (const a of G.agents) if (a.team === p.team && a !== p) dot(a, teamCol, 3.4);
  for (const a of G.agents) if (a.team !== p.team && sees(p, a) && p.state !== "waiting") dot(a, "#E2574C", 3.4);
  x.strokeStyle = "#1D232B"; x.lineWidth = 2; dot(p, teamCol, 5); x.beginPath(); x.arc(p.x * s, p.y * s, 5, 0, 7); x.stroke();
}

// ───────── 입력 ─────────
const keys = new Set(); let padVec = { x: 0, y: 0 }, sprintBtn = false, wantCatch = false;
addEventListener("keydown", e => {
  const k = e.key.toLowerCase(); keys.add(k);
  if (k === " ") { wantCatch = true; e.preventDefault(); }
  if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
});
addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => keys.clear());
const pad = $("pad"), knob = $("knob");
function padMove(e) { const r = pad.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } padVec = m < 0.12 ? { x: 0, y: 0 } : { x, y }; knob.style.transform = `translate(${x * 40}px, ${y * 40}px)`; }
function padEnd() { padVec = { x: 0, y: 0 }; knob.style.transform = ""; }
pad.addEventListener("pointerdown", e => { pad.setPointerCapture(e.pointerId); padMove(e); });
pad.addEventListener("pointermove", e => { if (e.buttons) padMove(e); });
pad.addEventListener("pointerup", padEnd); pad.addEventListener("pointercancel", padEnd);
const hold = (el, on, off) => { el.addEventListener("pointerdown", e => { e.preventDefault(); on(); }); for (const t of ["pointerup", "pointercancel", "pointerleave"]) el.addEventListener(t, off); };
hold($("btnRun"), () => sprintBtn = true, () => sprintBtn = false);
$("btnCatch").addEventListener("pointerdown", e => { e.preventDefault(); wantCatch = true; });
function readInput() {
  let x = 0, y = 0;
  if (keys.has("arrowleft") || keys.has("a")) x -= 1; if (keys.has("arrowright") || keys.has("d")) x += 1;
  if (keys.has("arrowup") || keys.has("w")) y -= 1; if (keys.has("arrowdown") || keys.has("s")) y += 1;
  if (x || y) { const m = Math.hypot(x, y); return { x: x / m, y: y / m }; }
  return padVec;
}

// ───────── 화면 글자 ─────────
let toastT = 0, bannerT = 0, missionT = 0, lastPip = "";
const svgUrl = n => "data:image/svg+xml," + encodeURIComponent(SVGS[n]);
const ROBBER_ICON = svgUrl("robber-front"), POLICE_ICON = svgUrl("police-front");
$("imgPolice").src = POLICE_ICON; $("imgRobber").src = ROBBER_ICON;
const toast = (t, kind = "") => { const n = $("toast"); n.textContent = t; n.className = "show " + kind; toastT = 3; };
const banner = (lead, main) => { $("bannerLead").textContent = lead; $("bannerMain").textContent = main; $("banner").className = "show " + role; bannerT = 1.8; };
const fmt = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

function handleEvents() {
  const p = G.player;
  for (const e of G.events.splice(0)) {
    if (e.type === "catchStart") { startAction(chars[e.a.id], "catch", e.a.action.dx); if (e.a === p) sfx("swing"); }
    if (e.type === "jailed") { burst(e.r.x, e.r.y - 40, "#FFFFFF", 12); if (e.r === p) shake = 5; }
    if (e.type === "catchMiss" && e.a === p) toast("놓쳤어요", "bad");
    if (e.type === "caught") {
      startAction(chars[e.r.id], "jail");
      if (e.r === p || e.by === p || sees(p, e.r)) { burst(e.r.x, e.r.y - 40, "#FFC93C", 16); sfx("catch"); }
      if (e.r === p || e.by === p) { shake = 12; hitStop = 0.08; }
      if (e.r === p) toast("잡혔어요. 감옥으로 가요", "bad");
      else if (e.by === p) toast(`${e.r.name}을 잡았어요`, "good");
      else if (p.team === "police") toast(`${e.by.name}이 ${e.r.name}을 잡았어요`);
      else toast(`${e.r.name}이 잡혔어요`, "bad");
    }
    if (e.type === "unlocked") {
      startAction(chars[e.r.id], "escape"); if (sees(p, e.r) || e.r === p) sfx("free");
      if (e.r === p) toast(e.rescued ? "동료가 문을 열었어요. 밖으로 뛰어요" : "문이 열렸어요. 밖으로 뛰어요", "good");
    }
    if (e.type === "rescued" && e.by === p) toast(`동료 ${e.n}명을 구했어요`, "good");
    if (e.type === "rescued" && p.team === "police") toast("도둑이 감옥 문을 열었어요", "bad");
    if (e.type === "freed" && e.r === p) toast("탈옥했어요. 다시 숨어요", "good");
    if (e.type === "dispatch") sfx("go");
    if (e.type === "dispatch") banner(role === "police" ? "시간이 됐어요" : "경찰이 출동했어요", role === "police" ? "출동!" : "조심!");
    if (e.type === "reveal") {
      sfx("ping");
      if (role === "police") toast("도둑 위치가 공개됐어요. 빨간 표시가 있는 곳으로 가요", "good");
      else if (p.state === "free") toast("내 위치가 공개됐어요. 지금 자리를 옮겨요", "bad");
    }
    if (e.type === "over") { showEnd(); sfx(G.over.winner === p.team ? "win" : "lose"); }
  }
}

function drawHud(dt) {
  const p = G.player, left = G.phase === "wait" ? CFG.WAIT - G.t : CFG.DURATION - G.t;
  $("timer").textContent = fmt(left);
  $("timerLabel").textContent = G.phase === "wait" ? "경찰 출동까지" : "남은 시간";
  const pipKey = G.robbers.map(r => r.state === "free" ? 1 : 0).join("");
  if (pipKey !== lastPip) { lastPip = pipKey; $("pips").innerHTML = G.robbers.map(r => `<i class="${r.state === "free" ? "free" : "out"}" style="background-image:url('${ROBBER_ICON}')"></i>`).join(""); }
  let line = "";
  if (G.phase === "wait") line = role === "police" ? "도둑이 도망치는 중이에요" : "경찰에게서 멀어지는 중이에요";
  else if (p.state === "jailed") line = `${Math.ceil(p.lock)}초 뒤 풀려나요. 동료가 감옥 앞에 오면 더 빨리 나갈 수 있어요`;
  else if (p.state === "inJail") line = "감옥 밖에서 3초 동안 안 잡히면 탈옥해요";
  else if (p.state === "breaking") line = `탈옥까지 ${Math.ceil(p.breakT)}초. 잡히면 다시 감옥에 가요`;
  else {
    const n = Math.ceil(G.nextReveal - G.t);
    line = role === "police" ? `다음 위치 공개까지 ${n}초` : `내 위치 공개까지 ${n}초`;
  }
  $("status").textContent = line;
  const waitBig = role === "police" && G.phase === "wait";
  $("bigCount").className = waitBig ? "show" : ""; if (waitBig) $("bigCount").textContent = Math.ceil(left);
  $("status").className = (role === "robber" && G.phase === "play" && p.state === "free" && G.nextReveal - G.t <= 5) ? "hot" : "";
  $("stamFill").style.width = (p.stam * 100) + "%"; $("stamFill").className = p.tired ? "tired" : "";
  const out = !inZone(p.x, p.y);
  $("lock").className = out ? "show" : "";
  if (role === "police") $("btnCatch").className = p.catchCd > 0 || p.state !== "free" ? "off" : "";
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $("toast").className = ""; }
  if (missionT > 0) { missionT -= dt; if (missionT <= 0) $("mission").className = ""; }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $("banner").className = ""; }
}

function showEnd() {
  ended = true;
  const p = G.player, won = G.over.winner === p.team;
  $("endTitle").textContent = "게임 종료!";
  $("endReason").textContent = G.over.reason === "allArrested" ? "도둑이 모두 체포됐어요!" : "제한 시간이 끝났어요!";
  $("endWin").textContent = won ? "우리 팀이 이겼어요" : "이번 판은 졌어요";
  $("endBadge").textContent = titleOf(p);
  $("endHero").src = p.team === "police" ? POLICE_ICON : ROBBER_ICON;
  $("endHero").className = won ? "won" : "lost";
  const s = p.s;
  $("endStats").innerHTML = (p.team === "police"
    ? [["내 체포", s.catches + "번"], ["팀 체포", G.stats.catches + "번"], ["탈옥한 도둑", G.stats.rescues + "명"]]
    : [["잡힌 횟수", s.caught + "번"], ["구한 동료", s.rescued + "명"], ["숨어 있던 시간", Math.round(s.hideT) + "초"]]
  ).map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join("");
  setTimeout(() => $("end").className = "sheet show " + role, 500);
}
function titleOf(p) {
  const s = p.s, won = G.over && G.over.winner === p.team;
  if (p.team === "police") return s.catches >= 3 ? "드디어 검거율 상승" : s.catches >= 1 ? "오늘도 순찰 완료" : "발자국만 봤어요";
  if (s.rescued >= 1) return "감옥 문 여는 친구";
  if (s.caught >= 3) return "감옥 단골손님";
  if (!won) return "다음엔 꼭 도망쳐요";
  return s.caught === 0 ? "끝까지 안 잡힌 도둑" : "아슬아슬 도주 성공";
}

// ───────── 흐름 ─────────
let pickDiff = QS.get("diff") || "normal", pickTheme = QS.get("theme") || "random";
function start(r, seed) {
  role = r; ended = false; lastSeenBy = false; toastT = 0; bannerT = 0;
  chars.forEach(c => c.el.remove());
  G = newGame({ role: r, seed, diff: pickDiff, theme: pickTheme === "random" ? null : pickTheme, reveal: QS.get("reveal") ? Number(QS.get("reveal")) : undefined });
  document.querySelectorAll(".bush").forEach(n => n.remove());
  bakeMap(); bakeBushes(); bakeMini();
  document.body.dataset.theme = G.theme;
  chars = G.agents.map(makeChar);
  document.body.dataset.role = r;
  $("start").className = "sheet"; $("end").className = "sheet"; $("hud").className = "show"; $("toast").className = ""; $("banner").className = "";
  $("btnCatch").style.display = r === "police" ? "" : "none";
  $("mission").textContent = `${G.th.name} · ` + (r === "police" ? "도둑을 찾아 모두 체포하세요" : "끝날 때까지 잡히지 말고 도망치세요");
  $("mission").className = "show"; missionT = 3.2;
}

// 휴대폰은 가로가 기본이다. 되는 브라우저는 바꿔 주고, 안 되면 안내하는 동안 게임을 멈춘다.
// 회전을 잠갔거나 앱 안 브라우저면 돌릴 수 없으니 세로를 막지는 않는다
let paused = false, allowPortrait = false;
const isPhone = () => matchMedia("(pointer:coarse)").matches && Math.min(screen.width, screen.height) < 600;
const isPortrait = () => innerHeight > innerWidth;
const syncRotate = () => {
  const need = !!G && !ended && !allowPortrait && isPhone() && isPortrait();
  paused = need; $("rotate").className = need ? "sheet show" : "sheet";
};
async function tryLandscape() {
  if (!isPhone()) return;
  try { await document.documentElement.requestFullscreen?.(); await screen.orientation?.lock?.("landscape"); } catch { /* 안 되는 브라우저는 안내로 넘어간다 */ }
  syncRotate();
}
addEventListener("resize", syncRotate); addEventListener("orientationchange", syncRotate);
$("rotateSkip").onclick = () => { allowPortrait = true; syncRotate(); };
const begin = r => { start(r); syncRotate(); tryLandscape(); };
document.querySelectorAll("[data-role-pick]").forEach(b => b.addEventListener("click", () => begin(b.dataset.rolePick)));
$("again").onclick = () => begin(role);
$("swap").onclick = () => begin(role === "police" ? "robber" : "police");

function frame(dt) {
  if (!G) return;
  const p = G.player;
  if (paused) return;
  if (hitStop > 0) { hitStop -= dt; dt = 0.001; }
  if (!ended) {
    const v = readInput();
    p.ix = v.x; p.iy = v.y; p.sprint = keys.has("shift") || sprintBtn;
    if (wantCatch) { startCatch(G, p); wantCatch = false; }
    step(G, dt);
    handleEvents();
    drawHud(dt);
  }
  // 카메라: 살짝 늦게 따라가고 달리는 쪽을 조금 더 보여 준다
  const tx = p.x + p.vx * 0.22 - W / 2 / zoom, ty = p.y - 30 + p.vy * 0.22 - H / 2 / zoom, k = Math.min(1, dt * 6);
  camX += (tx - camX) * k; camY += (ty - camY) * k;
  shake = Math.max(0, shake - dt * 30);
  const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
  world.style.transform = `translate(${sx}px, ${sy}px) scale(${zoom}) translate(${-camX}px, ${-camY}px)`;
  wobbleBushes(dt);
  for (const c of chars) {
    const a = c.a;
    const can = ended || a.team === p.team || (p.state !== "waiting" && inZone(p.x, p.y) && sees(p, a));
    c.el.style.display = can ? "" : "none";
    c.wasVisible = can;
    if (can) dustFor(c, a, dt);
    drawChar(c, dt);
  }
  drawFx(dt);
  drawFog();
  drawMini();
}

// ───────── 효과 ─────────
let shake = 0, hitStop = 0, parts = [];
const fxc = $("fx"), fx2 = fxc.getContext("2d");
function burst(x, y, col, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 120 + Math.random() * 240; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, r: 4 + Math.random() * 6, life: 0.45 + Math.random() * 0.25, t: 0, col, g: 420 }); } }
function dustFor(c, a, dt) {
  const sp = Math.hypot(a.vx, a.vy); c.dustT = (c.dustT || 0) - dt;
  // 달릴 때 먼지. 눈 마을은 발자국이 남는다
  if (sp > CFG.RUN * 1.15 && c.dustT <= 0 && !a.inBush) { c.dustT = 0.09; parts.push({ x: a.x - a.vx * 0.05, y: a.y + 2, vx: -a.vx * 0.12, vy: -14, r: 5 + Math.random() * 5, life: 0.4, t: 0, col: G.th.dust, g: 0 }); }
}
function stampPrints(dt) {
  if (G.theme !== "snow") return;
  const x = $("map").getContext("2d");
  for (const a of G.agents) {
    if (a.state === "jailed" || a.state === "caught" || a.state === "waiting") continue;
    if (a.px === undefined || Math.hypot(a.x - a.px, a.y - a.py) > 34) {
      a.px = a.x; a.py = a.y; a.foot = !a.foot;
      const n = Math.hypot(a.vx, a.vy) || 1, ox = -a.vy / n * (a.foot ? 8 : -8), oy = a.vx / n * (a.foot ? 8 : -8);
      x.fillStyle = "rgba(120,146,176,.34)"; x.beginPath(); x.ellipse(a.x + ox, a.y + oy, 7, 5, Math.atan2(a.vy, a.vx), 0, 7); x.fill();
    }
  }
}
function drawFx(dt) {
  if (fxc.width !== W || fxc.height !== H) { fxc.width = W; fxc.height = H; }
  if (!ended) stampPrints(dt);
  fx2.clearRect(0, 0, W, H);
  parts = parts.filter(q => (q.t += dt) < q.life);
  for (const q of parts) {
    q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt;
    const [x, y] = toScreen(q.x, q.y), k = 1 - q.t / q.life;
    fx2.globalAlpha = k; fx2.fillStyle = q.col; fx2.beginPath(); fx2.arc(x, y, q.r * zoom * (q.g ? k : 2 - k), 0, 7); fx2.fill();
  }
  fx2.globalAlpha = 1;
}
// 숨을 곳 안에서 움직이면 흔들린다. 시야 안이면 보이니 알림 없이 단서가 된다
function wobbleBushes(dt) {
  const p = G.player, t = G.t;
  for (const b of L.BUSHES) {
    if (!b.el) continue;
    let m = 0;
    for (const a of G.agents) { if (L.bushAt(a.x, a.y) === b) m = Math.max(m, Math.hypot(a.vx, a.vy) / CFG.RUN); }
    const inView = !p || ended || (Math.hypot(p.x - b.x, p.y - b.y) < p.vision && (Math.hypot(p.x - b.x, p.y - b.y) < CFG.NEAR || L.inCone(p, b.x, b.y)) && L.lineOfSight(p, b));
    b.wob = (b.wob || 0) + ((inView ? m : 0) - (b.wob || 0)) * Math.min(1, dt * 10);
    b.el.style.transform = b.wob > 0.02 ? `rotate(${Math.sin(t * 22 + b.x) * 2.6 * b.wob}deg) scale(${1 + 0.02 * b.wob * Math.sin(t * 17)},1)` : "";
  }
}
// 효과음: 파일 없이 소리를 만든다
let audio = null, muted = false;
function tone(f0, f1, len, type = "sine", vol = 0.12, delay = 0) {
  if (!audio || muted) return;
  const t = audio.currentTime + delay, o = audio.createOscillator(), g = audio.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + len);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + len);
  o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + len);
}
function sfx(n) {
  if (n === "swing") tone(520, 180, 0.14, "triangle", 0.1);
  if (n === "catch") { tone(180, 70, 0.22, "square", 0.1); tone(900, 500, 0.12, "triangle", 0.08, 0.03); }
  if (n === "free") { tone(420, 840, 0.18, "triangle", 0.09); tone(620, 1240, 0.18, "triangle", 0.07, 0.09); }
  if (n === "ping") { tone(1320, 1320, 0.22, "sine", 0.07); tone(990, 990, 0.3, "sine", 0.06, 0.16); }
  if (n === "go") { tone(392, 392, 0.12, "square", 0.06); tone(587, 587, 0.24, "square", 0.06, 0.13); }
  if (n === "win") [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.2, "triangle", 0.09, i * 0.11));
  if (n === "lose") [392, 330, 262].forEach((f, i) => tone(f, f * 0.97, 0.26, "triangle", 0.08, i * 0.16));
}
function unlockAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch { audio = null; } }
$("sound").addEventListener("pointerdown", e => { e.stopPropagation(); muted = !muted; $("sound").classList.toggle("off", muted); $("sound").textContent = muted ? "소리 꺼짐" : "소리 켜짐"; });
addEventListener("pointerdown", unlockAudio); addEventListener("keydown", unlockAudio);

const pick = (attr, set) => document.querySelectorAll(`[${attr}]`).forEach(b => { b.addEventListener("click", () => { set(b.getAttribute(attr)); document.querySelectorAll(`[${attr}]`).forEach(o => o.classList.toggle("on", o === b)); }); });
pick("data-diff", v => pickDiff = v); pick("data-theme-pick", v => pickTheme = v);
// 시작 화면 뒤에도 지도를 깔아 둔다
G = newGame({ seed: 11, theme: "town" }); bakeMap(); bakeBushes(); bakeMini(); camX = (CFG.W - W / zoom) / 2; camY = (CFG.H - H / zoom) / 2; world.style.transform = `scale(${zoom}) translate(${-camX}px, ${-camY}px)`; G = null;
let last = null;
const tick = () => { const now = performance.now(); const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now; frame(dt); };
requestAnimationFrame(function loop() { tick(); requestAnimationFrame(loop); });
// 노션 임베드처럼 그리기 신호가 멈추는 곳에서도 게임이 돌게, 신호가 늦으면 타이머가 대신 돌린다
setInterval(() => { if (performance.now() - (last || 0) > 40) tick(); }, 16);
// 시험용: 정해진 시간만큼 건너뛰기
window.__game = { start, begin, frame, L, setPick: (d, t) => { pickDiff = d; pickTheme = t; }, get G() { return G; }, keys, chars: () => chars };
if (QS.get("auto")) start(QS.get("auto"), Number(QS.get("seed") || 7));
