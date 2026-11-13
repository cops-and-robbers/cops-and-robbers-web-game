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
let camTarget = null; // 대기실처럼 시점을 따로 잡을 때 쓴다
let G = null, chars = [], role = null, zoom = 1, camX = 0, camY = 0, W = 0, H = 0, ended = false, lastSeenBy = false;
// 사람끼리 할 때는 net.js 가 채운다. 비어 있으면 이 파일 안에서 봇과 규칙을 돌린다
let online = null;
// 게임 방법 안내(client/guide.js)가 장면을 연기시키는 동안 내 입력 대신 대본을 넣는다
let driver = null;
const seen = a => (online ? online.sees(a) : sees(G.player, a));
const fitStage = () => {
  W = stage.clientWidth; H = stage.clientHeight; fog.width = W; fog.height = H;
  zoom = clamp(Math.min(W / 1180, H / 720), 0.52, 1.25);
};
fitStage(); addEventListener("resize", fitStage);

// ───────── 맵 ─────────
// 앱 배경과 같은 결의 지도 부품(나무, 수풀, 꽃). client/brand/map 의 SVG 를 빌드할 때 경로로 바꿔 넣는다
const MAP_ART = /*MAPART*/{};
const ART_PATHS = new Map();
// 낮 색으로 그린 부품을 테마 색으로 바꾼다
function artColors(T) {
  const [lo, mid, hi] = T.bushes, dark = G.theme === "night";
  return {
    "#86C687": lo, "#A6DA97": mid, "#C9EBB4": hi,
    "#7DBE7E": dark ? "#17234A" : lo, "#93CF8C": dark ? "#22305E" : "#93CF8C", "#B7E3A1": dark ? "#2F3F70" : "#B7E3A1", "#D6F0C2": dark ? "#4A5D88" : "#D6F0C2",
    "#F4FBEF": dark ? "#5C6E9C" : "#F4FBEF", "#C99A73": T.trunk, "#AE7F5B": dark ? "#463232" : "#AE7F5B", "#FFD36B": dark ? "#E0B040" : "#FFD36B",
  };
}
function drawArt(x, name, cx, foot, w, colors) {
  const a = MAP_ART[name]; if (!a) return;
  const s = w / a.w;
  x.save(); x.translate(cx - a.fx * s, foot - a.fy * s); x.scale(s, s); x.lineCap = "round";
  for (const [d, fill, stroke, sw, op] of a.shapes) {
    let p = ART_PATHS.get(d); if (!p) ART_PATHS.set(d, p = new Path2D(d));
    x.globalAlpha = op;
    if (fill && fill !== "none") { x.fillStyle = colors[fill] || fill; x.fill(p); }
    if (stroke) { x.strokeStyle = colors[stroke] || stroke; x.lineWidth = sw; x.stroke(p); }
  }
  x.restore();
}
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
  x.strokeStyle = T.line; x.lineWidth = 3;
  for (const r of L.ROADS) { const hor = r.w > r.h, cell = 64; x.beginPath(); for (let k = cell; k < (hor ? r.w : r.h); k += cell) { if (hor) { x.moveTo(r.x + k, r.y); x.lineTo(r.x + k, r.y + r.h); } else { x.moveTo(r.x, r.y + k); x.lineTo(r.x + r.w, r.y + k); } } for (let k = cell; k < (hor ? r.h : r.w); k += cell) { if (hor) { x.moveTo(r.x, r.y + k); x.lineTo(r.x + r.w, r.y + k); } else { x.moveTo(r.x + k, r.y); x.lineTo(r.x + k, r.y + r.h); } } x.stroke(); }
  // 교차로: 가운데를 지우고 횡단보도를 그린다
  const hs = L.ROADS.filter(r => r.w > r.h), vs = L.ROADS.filter(r => r.w <= r.h); let crossN = 0;
  for (const h of hs) for (const v of vs) {
    if (v.x + v.w < h.x || v.x > h.x + h.w || h.y + h.h < v.y || h.y > v.y + v.h) continue;
    x.fillStyle = T.road; x.fillRect(v.x, h.y, v.w, h.h);
    crossN++;
    continue;
    x.fillStyle = T.cross;
    for (let k = 0; k < v.w - 12; k += 26) x.fillRect(v.x + 6 + k, h.y - 34, 13, 28);
    for (let k = 0; k < h.h - 12; k += 26) x.fillRect(v.x + v.w + 6, h.y + 6 + k, 28, 13);
  }
  // 잔디 마당과 빈터에 흰 꽃과 짧은 풀 자국을 뿌린다. 길과 감옥 마당은 피한다
  const artCol = artColors(T), onRoad = (px, py) => L.ROADS.some(r => px > r.x - 20 && px < r.x + r.w + 20 && py > r.y - 20 && py < r.y + r.h + 20);
  for (let k = 0; k < 420; k++) {
    const px = hash(k * 3.1 + seed) * CFG.W, py = hash(k * 7.7 + seed * 1.3) * CFG.H;
    if (onRoad(px, py) || Math.hypot(px - CFG.JAIL.x, py - CFG.JAIL.y) < CFG.GATE_R + 30 || L.solidAt(px, py)) continue;
    const inPark = L.PARKS.some(p => Math.hypot((px - p.x) / p.rx, (py - p.y) / p.ry) < 1);
    if (k % 3 === 0 || inPark) drawArt(x, "flower", px, py + 10, 18 + hash(k) * 8, artCol);
    else { x.strokeStyle = T.speck; x.lineWidth = 4; x.beginPath(); x.moveTo(px - 9, py + 4); x.quadraticCurveTo(px - 6, py - 6, px - 3, py + 4); x.moveTo(px + 1, py + 4); x.quadraticCurveTo(px + 4, py - 8, px + 7, py + 4); x.stroke(); }
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
  x.font = `800 30px ${getComputedStyle(document.documentElement).getPropertyValue("--font")}`; x.textAlign = "center";
  const w = x.measureText(tt("jail")).width + 78, sy = J.y - J.r - 62;
  x.fillStyle = "rgba(29,35,43,.18)"; rr(x, J.x - w / 2 + 4, sy + 6, w, 50, 16); x.fill();
  x.fillStyle = "#1D232B"; rr(x, J.x - w / 2, sy, w, 50, 16); x.fill();
  x.fillStyle = "#E2574C"; x.beginPath(); x.arc(J.x - w / 2 + 28, sy + 25, 15, 0, 7); x.fill();
  if (SIREN_IMG.complete) x.drawImage(SIREN_IMG, J.x - w / 2 + 19, sy + 14, 18, 22);
  x.fillStyle = "#fff"; x.fillText(tt("jail"), J.x + 16, sy + 36);
}
const SIREN_IMG = new Image(); SIREN_IMG.src = "data:image/svg+xml;base64,/*B64:siren.svg*/";
function drawBuilding(x, b, T, i, seed) {
    const [roof, wall] = T.roofs[(i * 7 + seed) % T.roofs.length], wh = Math.min(84, Math.max(46, b.h * 0.4)), rh = b.h - wh, night = G.theme === "night";
    x.fillStyle = night ? "rgba(8,14,34,.35)" : "rgba(70,110,160,.14)"; rr(x, b.x + 10, b.y + 14, b.w + 4, b.h + 4, 16); x.fill();
    // 벽(앞면)
    x.fillStyle = wall; rr(x, b.x, b.y, b.w, b.h, 14); x.fill();
    x.fillStyle = night ? "rgba(0,0,0,.18)" : "rgba(60,100,150,.10)"; rr(x, b.x, b.y + b.h - 10, b.w, 10, 6); x.fill();
    // 지붕(윗면): 가장자리 턱과 작은 실외기
    // 지붕: 위와 왼쪽은 빛을 받아 밝고, 벽과 만나는 아래는 그늘이 진다. 안쪽 테두리를 두르면 화면처럼 보여서 두지 않는다
    x.fillStyle = roof; rr(x, b.x, b.y, b.w, rh, 14); x.fill();
    x.save(); rr(x, b.x, b.y, b.w, rh, 14); x.clip();
    x.fillStyle = "rgba(255,255,255,.45)"; x.fillRect(b.x, b.y, b.w, 7); x.fillRect(b.x, b.y, 7, rh);
    x.fillStyle = night ? "rgba(0,0,0,.22)" : "rgba(60,100,150,.16)"; x.fillRect(b.x, b.y + rh - 9, b.w, 9);
    x.restore();
    if (T.roofEdge) { x.fillStyle = T.roofEdge; x.fillRect(b.x + 4, b.y + rh - 8, b.w - 8, 5); }
    if (hash(i + seed) < 0.55 && b.w > 120) { const ax = b.x + 22 + hash(i * 3 + seed) * (b.w - 90), ay = b.y + 22 + hash(i * 5) * Math.max(0, rh - 70); x.fillStyle = wall; rr(x, ax, ay, 46, 30, 6); x.fill(); x.fillStyle = roof; x.beginPath(); x.arc(ax + 23, ay + 15, 9, 0, 7); x.fill(); }
    // 창문: 둥근 칸이 격자로. 문은 하나
    const cols = Math.max(1, Math.floor((b.w - 24) / 40)), rows = Math.max(1, Math.floor((wh - 22) / 30)), cw = 26, ch = 20;
    const gx = b.x + (b.w - (cols * 40 - 14)) / 2, gy = b.y + rh + (wh - 10 - (rows * 30 - 10)) / 2;
    const clear = k => { const fx = gx + k * 40 + 13, fy = b.y + b.h + 46; return !L.solidAt(fx, fy) && !L.BUSHES.some(u => Math.hypot((u.x - fx) / (u.rx + 30), (u.y - fy) / (u.ry + 40)) < 1); };
    const doors = [...Array(cols).keys()].filter(clear), door = cols > 1 && doors.length ? doors[Math.floor(hash(i * 9 + seed) * doors.length)] : -1;
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const wx = gx + k * 40, wy = gy + r * 30;
      if (k === door && r === rows - 1) continue;
      const lit = night && hash(i * 13 + k + r * 7) < T.winOn;
      if (lit) { x.fillStyle = "rgba(255,217,120,.25)"; rr(x, wx - 4, wy - 4, cw + 8, ch + 8, 8); x.fill(); }
      x.fillStyle = lit ? T.win : T.winOff; rr(x, wx, wy, cw, ch, 5); x.fill();
      if (!night) { x.fillStyle = "rgba(120,170,220,.22)"; rr(x, wx, wy + ch - 6, cw, 6, 3); x.fill(); }
    }
    if (door >= 0) { const dx = gx + door * 40 - 2, dh = Math.min(wh - 16, 40); x.fillStyle = night ? "#2E3C5E" : "#A9C9E8"; rr(x, dx, b.y + b.h - 10 - dh, 30, dh, 8); x.fill(); }
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
const groundShadow = (x, cx, cy, rx, ry) => { x.fillStyle = G.theme === "night" ? "rgba(8,14,34,.32)" : G.theme === "snow" ? "rgba(29,35,43,.15)" : "rgba(52,96,72,.17)"; x.beginPath(); x.ellipse(cx + rx * 0.1, cy + ry * 0.25, rx, ry, 0, 0, 7); x.fill(); };
function drawBush(x, b, w, h, foot, pal, seed, snow) {
  const cx = w / 2;
  if (b.hedge && !snow) {
    // 생울타리도 수풀 부품을 이어 붙인 둥근 덩이 줄. 들어가 숨을 수 있는 풀숲으로 보이게 한다
    // 숨는 범위를 그림이 빈틈없이 덮도록 덩이를 겹친다. 뒤(위)부터 그려 앞 덩이가 덮게 한다
    const long = b.rx >= b.ry, col = artColors(G.th);
    groundShadow(x, cx, foot - 3, b.rx * 1.05, Math.max(b.ry, 18) * 0.3);
    if (long) {
      const n = Math.max(2, Math.round(b.rx * 2 / 90)), pw = b.rx * 2 / n * 1.5;
      for (let k = 0; k < n; k++) drawArt(x, "bush", cx - b.rx + pw * 0.45 + k * (b.rx * 2 - pw * 0.9) / (n - 1), foot, pw, col);
    } else {
      const pw = Math.max(b.rx * 2.6, 70), top = foot - b.ry * 1.5, n = Math.max(2, Math.ceil((foot - top) / (pw * 0.56 * 0.45)) + 1);
      for (let k = 0; k < n; k++) drawArt(x, "bush", cx, top + k * (foot - top) / (n - 1), pw, col);
    }
  } else {
    // 둥근 관목: 낮은 무더기
    groundShadow(x, cx, foot - 3, b.rx * 1.02, b.r * 0.2);
    if (snow) crown(x, cx, foot - b.ry * 0.86, b.rx, b.ry * 0.9, pal, seed, snow);
    else {
      // 부품 하나는 납작해서 숨는 범위 위쪽이 빈다. 뒤에 덩이를 하나 더 올려 범위를 덮는다
      const col = artColors(G.th);
      drawArt(x, "bush", cx, foot - b.ry * 0.62, b.rx * 1.85, col);
      drawArt(x, "bush", cx, foot, b.rx * 2.2, col);
    }
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
  groundShadow(x, cx, foot - 3, r * 0.8, r * 0.24);
  drawArt(x, b.species === "oval" || r < 70 ? "tree-small" : "tree", cx, foot, r * 2.3, artColors(T));
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
    const c = document.createElement("canvas"); c.className = "bush"; const w = Math.round(Math.max(b.rx * 2.6 + 20, b.rx * 2 + 60)), h = Math.round(b.ry * 2 + b.r * 1.6 + 60), foot = h - 12, by = b.y + b.ry * 0.82;
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
  // 사람끼리 할 때는 상대 이름도 보여 준다. 시야 밖 상대는 캐릭터째 숨고 이름도 받지 않는다
  if (G.player && (online || a.team === G.player.team)) {
    tag = document.createElement("div"); tag.className = "tag " + kind + (a.isPlayer ? " me" : ""); tag.textContent = a.isPlayer ? tt("me") : nameOf(a.name); tag.style.top = (headTop - 66) + "px"; el.append(tag);
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
  const [jx, jy] = toScreen(CFG.JAIL.x, CFG.JAIL.y), jailedN = jailedCount();
  // 구출 자리와 진행을 문 앞 원 하나로 보여 준다. 갇힌 친구가 있으면 도둑에게 옅은 초록 원, 구출 중이면 같은 원이 차오른다
  const gr = CFG.GATE_R * zoom, rescuing = G.rescueT > 0, showGate = rescuing || (G.player?.team === "robber" && G.player.state === "free" && jailedN > 0 && G.phase === "play");
  if (showGate) {
    ctx.save(); ctx.lineCap = "round";
    ctx.strokeStyle = rescuing ? "rgba(255,255,255,.8)" : "rgba(53,194,107,.45)"; ctx.lineWidth = rescuing ? 10 : 6; ctx.beginPath(); ctx.arc(jx, jy, gr, 0, 7); ctx.stroke();
    if (rescuing) { ctx.strokeStyle = "#35C26B"; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(jx, jy, gr, -Math.PI / 2, -Math.PI / 2 + Math.min(1, G.rescueT / CFG.RESCUE_SEC) * Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
}
// 갇힌 도둑 수. 사람끼리 할 때는 남은 수만 받아서 거기서 센다
function jailedCount() {
  if (online) return Math.max(0, G.robbers.length - online.free - G.robbers.filter(r => r.state === "breaking" || r.state === "inJail").length);
  return G.robbers.filter(r => r.state === "jailed").length;
}
// 보호 중인 도둑은 비눗방울 같은 막이 깜빡인다
function drawShields() {
  for (const c of chars) {
    const a = c.a;
    if (!(a.protect > 0) || c.el.style.display === "none") continue;
    const [x, y] = toScreen(a.x, a.y - 34), r = 46 * zoom, blink = 0.55 + Math.sin(performance.now() / 90) * 0.25;
    fx2.save(); fx2.globalAlpha = blink;
    fx2.fillStyle = "rgba(170,230,255,.22)"; fx2.strokeStyle = "#FFFFFF"; fx2.lineWidth = Math.max(2, 4 * zoom);
    fx2.beginPath(); fx2.arc(x, y, r, 0, 7); fx2.fill(); fx2.stroke();
    fx2.globalAlpha = blink * 0.9; fx2.fillStyle = "#FFFFFF"; fx2.beginPath(); fx2.ellipse(x - r * 0.38, y - r * 0.42, r * 0.18, r * 0.1, -0.6, 0, 7); fx2.fill();
    fx2.restore();
  }
}
// 감옥 소식 띠: 경찰은 문이 열리는 중이면 경고, 갇힌 도둑은 구하러 오는 중이면 알림
let jailAlertWas = false;
function drawJailAlert() {
  const p = G.player, el = $("jailAlert");
  const on = G.phase === "play" && G.rescueT > 0 && (p.team === "police" || p.state === "jailed");
  el.hidden = !on;
  if (!on) { jailAlertWas = false; return; }
  el.className = p.team === "police" ? "bad" : "good";
  $("jailAlertText").textContent = tt(p.team === "police" ? "jailOpening" : "friendOpening");
  $("jailAlertFill").style.width = Math.min(100, G.rescueT / CFG.RESCUE_SEC * 100) + "%";
  if (!jailAlertWas && p.team === "police") { play("alert"); haptic([0, 200, 100, 200]); }
  jailAlertWas = true;
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
  for (const a of G.agents) if (a.team !== p.team && seen(a) && p.state !== "waiting") dot(a, "#E2574C", 3.4);
  x.strokeStyle = "#1D232B"; x.lineWidth = 2; dot(p, teamCol, 5); x.beginPath(); x.arc(p.x * s, p.y * s, 5, 0, 7); x.stroke();
}

// ───────── 입력 ─────────
const keys = new Set(); let padVec = { x: 0, y: 0 }, sprintBtn = false, wantCatch = false;
// 화면 아래 키 안내도 누른 키를 같이 눌러 보여 준다
const KEYCAP = { arrowup: "w", arrowleft: "a", arrowdown: "s", arrowright: "d" };
const keycap = (k, on) => document.querySelector(`#hint kbd[data-k="${KEYCAP[k] || k}"]`)?.classList.toggle("on", on);
addEventListener("keydown", e => {
  const k = e.key.toLowerCase(); keys.add(k); keycap(k, true);
  if (k === " ") { wantCatch = true; e.preventDefault(); }
  if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
});
addEventListener("keyup", e => { const k = e.key.toLowerCase(); keys.delete(k); keycap(k, false); });
addEventListener("blur", () => { keys.clear(); document.querySelectorAll("#hint kbd.on").forEach(n => n.classList.remove("on")); });
// 터치 조작. 왼쪽 어디를 잡아도 그 자리에서 조이스틱이 시작된다. 손가락마다 따로 따라가서 걷기와 달리기를 함께 누를 수 있다
const pad = $("pad"), knob = $("knob"), padZone = $("padZone");
const PAD_DEAD = 0.12;
let padId = null, padCx = 0, padCy = 0, padFsAt = 0;
const haptic = ms => { try { navigator.vibrate?.(ms); } catch { /* 진동이 없는 기기는 넘어간다 */ } };
function padMove(e) {
  const R = pad.offsetWidth / 2 || 66;
  let x = (e.clientX - padCx) / R, y = (e.clientY - padCy) / R;
  if (Math.hypot(x, y) > 1.15) {
    const over = Math.hypot(x, y) - 1.15, m0 = Math.hypot(x, y);
    padCx += x / m0 * over * R; padCy += y / m0 * over * R;
    const rest = pad.getBoundingClientRect(), cur = pad.style.transform.match(/-?[\d.]+/g)?.map(Number) || [0, 0];
    pad.style.transform = `translate(${cur[0] + (padCx - (rest.left + R))}px, ${cur[1] + (padCy - (rest.top + R))}px)`;
    x = (e.clientX - padCx) / R; y = (e.clientY - padCy) / R;
  }
  const m = Math.hypot(x, y), lim = Math.min(1, m);
  if (m > 1) { x /= m; y /= m; }
  knob.style.transform = `translate(${x * R * .62}px, ${y * R * .62}px)`;
  // 살짝 건드린 흔들림은 무시하고, 그 위로는 처음부터 부드럽게 커진다
  const k = lim < PAD_DEAD ? 0 : (lim - PAD_DEAD) / (1 - PAD_DEAD) / (lim || 1);
  padVec = { x: x * k * (m > 1 ? 1 : 1), y: y * k };
}
// 지금 누르면 잡히는 도둑을 찾는다. 판정은 서버가 하고 화면은 알려 주기만 한다
function catchTarget() {
  const p = G?.player;
  if (!p || p.team !== "police" || p.state !== "free" || !inPlayView()) return null;
  let best = null, bd = CFG.CATCH_R + CFG.CATCH_GRACE;
  for (const r of G.robbers) { if ((r.state !== "free" && r.state !== "breaking") || r.protect > 0 || !(online ? online.sees(r) : sees(p, r))) continue; const d = dist(p, r); if (d < bd && L.lineOfSight(p, r)) { bd = d; best = r; } }
  return best;
}
const inPlayView = () => G.phase === "play" && !ended && !document.body.classList.contains("lobby-mode");
let beatT = 0, spottedAt = new Map(), lastEndTick = -1;
function tensionSound(dt) {
  const p = G?.player;
  if (!p || !inPlayView() || p.state !== "free") { beatT = 0; return; }
  const visible = G.agents.filter(a => a.team !== p.team && (online ? online.sees(a) : sees(p, a)) && (a.state === "free" || a.state === "breaking"));
  const near = Math.min(...visible.map(a => dist(p, a)), Infinity), close = near === Infinity ? 0 : Math.max(0, Math.min(1, 1 - (near - 120) / 520));
  const now = G.t;
  // 5초 넘게 못 보다가 다시 보인 순간에만 알린다
  for (const a of visible) {
    if (now - (spottedAt.get(a.id) ?? -99) > 5) { if (p.team === "robber") { play("spotted"); haptic(40); beatT = 0.5; } else { play("found"); haptic(12); } }
    spottedAt.set(a.id, now);
  }
  // 도둑: 경찰이 보이는 동안 심장. 가까울수록 빠르다
  if (p.team === "robber" && near !== Infinity) {
    beatT -= dt;
    if (beatT <= 0) { beatT = 0.42 + (1 - close) * 0.5; play("heart", 0.95 + close * 0.15); }
  } else beatT = 0;
  // 마지막 5초는 둘 다 시계
  const left = Math.ceil(CFG.DURATION - G.t);
  if (G.phase === "play" && left >= 1 && left <= 5 && left !== lastEndTick) { lastEndTick = left; play("tick", left <= 2 ? 1.12 : 1); }
}
function drawCatchAid() {
  const t = catchTarget(), p = G?.player, btn = $("btnCatch");
  btn.classList.toggle("ready", !!t && p.catchCd <= 0);
  if (!t) return;
  // 대상 발밑에 표시를 한다. 곤봉이 그쪽으로 간다는 걸 누르기 전에 알 수 있다
  const [x, y] = toScreen(t.x, t.y), rx = 50 * zoom, ry = 22 * zoom;
  fx2.save(); fx2.strokeStyle = "#FFD24D"; fx2.lineWidth = Math.max(3, 6 * zoom); fx2.globalAlpha = p.catchCd > 0 ? .35 : .95;
  fx2.beginPath(); fx2.ellipse(x, y + 4 * zoom, rx, ry, 0, 0, 7); fx2.stroke(); fx2.restore();
}
function padEnd() { padId = null; padVec = { x: 0, y: 0 }; knob.style.transform = ""; pad.style.transform = ""; pad.classList.remove("on"); }
padZone.addEventListener("pointerdown", e => {
  if (padId !== null) return;
  e.preventDefault();
  padId = e.pointerId; padZone.setPointerCapture(padId);
  const rest = pad.getBoundingClientRect(), R = rest.width / 2 || 66, m = 8;
  // 화면 밖으로 잘리지 않게 안쪽으로 당긴다
  padCx = clamp(e.clientX, R + m, innerWidth - R - m); padCy = clamp(e.clientY, R + m, innerHeight - R - m);
  pad.style.transform = `translate(${padCx - (rest.left + R)}px, ${padCy - (rest.top + R)}px)`;
  pad.classList.add("on"); padMove(e);
  // 전체 화면이 풀렸으면 다음 터치에 다시 시도한다
  if (document.fullscreenEnabled && !document.fullscreenElement && Date.now() - padFsAt > 5000) { padFsAt = Date.now(); tryLandscape(); }
});
padZone.addEventListener("pointermove", e => { if (e.pointerId === padId) { e.preventDefault(); padMove(e); } });
for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) padZone.addEventListener(t, e => { if (e.pointerId === padId) padEnd(); });
const hold = (el, on, off) => {
  let id = null;
  el.addEventListener("pointerdown", e => { e.preventDefault(); id = e.pointerId; el.setPointerCapture(id); el.classList.add("down"); on(); });
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) el.addEventListener(t, e => { if (e.pointerId === id) { id = null; el.classList.remove("down"); off(); } });
};
// 달리기: 누르고 있으면 그동안, 짧게 누르면 켜 둔다. 켜 두면 엄지를 잡기로 옮길 수 있다
let runDownAt = 0, runLatched = false;
const runBtn = $("btnRun");
hold(runBtn, () => { runDownAt = Date.now(); sprintBtn = true; haptic(8); }, () => {
  const tap = Date.now() - runDownAt < 180;
  runLatched = tap && !runLatched;
  sprintBtn = runLatched;
  runBtn.classList.toggle("down", runLatched);
  runBtn.classList.toggle("latched", runLatched);
  $("btnRunLabel").textContent = tt(runLatched ? "running" : "run");
});
hold($("btnCatch"), () => { wantCatch = true; haptic(15); }, () => {});
// 다른 앱으로 나갔다 오면 눌린 채로 남지 않게 푼다
const releaseAll = () => { padEnd(); sprintBtn = false; runLatched = false; runBtn.classList.remove("latched"); $("btnRunLabel").textContent = tt("run"); keys.clear(); document.querySelectorAll("#btnRun.down,#btnCatch.down").forEach(b => b.classList.remove("down")); };
addEventListener("blur", releaseAll);
document.addEventListener("visibilitychange", () => { if (document.hidden) releaseAll(); else keepAwake(); });
// 판 도중 화면이 꺼지지 않게 한다. 안 되는 브라우저는 넘어간다
let wakeLock = null;
async function keepAwake() { try { if (online && !wakeLock) { wakeLock = await navigator.wakeLock?.request("screen"); wakeLock?.addEventListener("release", () => wakeLock = null); } } catch { wakeLock = null; } }
// 브라우저 기본 동작이 게임을 방해하지 않게 막는다: 당겨서 새로고침, 두 손가락 확대, 길게 눌러 메뉴, 글자 선택
const typing = e => e.target instanceof HTMLInputElement;
// 화면보다 긴 창(안내, 결과, 방장 설정, 열린 방 목록)은 그 안에서 끌어 스크롤할 수 있어야 한다.
// 창 이름으로 고르면 새 창이 생길 때마다 빠진다(방장 설정 창이 그랬다). 실제로 스크롤되는 상자 안인지로 본다
const scrollsY = el => {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) return true;
  }
  return false;
};
document.addEventListener("touchmove", e => { if (!typing(e) && !scrollsY(e.target)) e.preventDefault(); }, { passive: false });
document.addEventListener("gesturestart", e => e.preventDefault());
document.addEventListener("dblclick", e => e.preventDefault());
document.addEventListener("contextmenu", e => { if (!typing(e)) e.preventDefault(); });
document.addEventListener("selectstart", e => { if (!typing(e)) e.preventDefault(); });
window.visualViewport?.addEventListener("resize", () => fitStage());
function readInput() {
  let x = 0, y = 0;
  if (keys.has("arrowleft") || keys.has("a")) x -= 1; if (keys.has("arrowright") || keys.has("d")) x += 1;
  if (keys.has("arrowup") || keys.has("w")) y -= 1; if (keys.has("arrowdown") || keys.has("s")) y += 1;
  if (x || y) { const m = Math.hypot(x, y); return { x: x / m, y: y / m }; }
  return padVec;
}

// ───────── 화면 글자 ─────────
let toastT = 0, bannerT = 0, missionT = 0, lastPip = "", lastRevealN = -1;
const svgUrl = n => "data:image/svg+xml," + encodeURIComponent(SVGS[n]);
const ROBBER_ICON = svgUrl("robber-front"), POLICE_ICON = svgUrl("police-front");
// 이긴 쪽은 앱의 승리 그림(트로피 냥파, 브이 도둥이)으로 보여 준다
const WIN_ICON = { police: "data:image/svg+xml;base64,/*B64:win-cop.svg*/", robber: "data:image/svg+xml;base64,/*B64:win-rob.svg*/" };
$("imgPolice").src = POLICE_ICON; $("imgRobber").src = ROBBER_ICON;
const toast = (t, kind = "") => { const n = $("toast"); n.textContent = t; n.className = "show " + kind; toastT = 3; };
const CHASE_ART = { police: "data:image/svg+xml;base64,/*B64:police-chase.svg*/", robber: "data:image/svg+xml;base64,/*B64:robber-chase.svg*/" };
const banner = (lead, main) => { $("bannerLead").textContent = lead; $("bannerMain").textContent = main; $("bannerArt").src = CHASE_ART[role] || CHASE_ART.police; $("banner").className = "show " + role; bannerT = 1.8; };
const fmt = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

function handleEvents() {
  const p = G.player;
  for (const e of G.events.splice(0)) {
    if (e.type === "catchStart") startAction(chars[e.a.id], "catch", e.a.action?.dx ?? Math.cos(e.a.faceA));
    if (e.type === "jailed") { burst(e.r.x, e.r.y - 40, "#FFFFFF", 12); if (e.r === p) shake = 5; }
    if (e.type === "catchMiss" && e.a === p) { toast(tt("missed"), "bad"); play("miss"); }
    if (e.type === "caught") {
      startAction(chars[e.r.id], "jail");
      if (e.r === p || e.by === p || seen(e.r)) burst(e.r.x, e.r.y - 40, "#FFC93C", 16);
      if (e.by === p) { play("catch"); haptic(80); } else if (e.r === p) { play("caught"); haptic(500); }
      if (e.r === p || e.by === p) { shake = 12; hitStop = 0.08; }
      if (e.r === p) toast(tt("caughtMe"), "bad");
      else if (e.by === p) toast(tt("iCaught", nameOf(e.r.name)), "good");
      else if (p.team === "police") toast(tt("xCaughtY", nameOf(e.by.name), nameOf(e.r.name)));
      else toast(tt("xCaught", nameOf(e.r.name)), "bad");
    }
    if (e.type === "unlocked") {
      startAction(chars[e.r.id], "escape"); if (e.r === p || (p.team === "robber" && e.rescued)) play("free");
      if (e.r === p) toast(tt(e.rescued ? "mateOpened" : "doorOpened"), "good");
    }
    if (e.type === "rescued" && e.by === p) toast(tt("rescuedN", e.n), "good");
    if (e.type === "rescued" && p.team === "police") toast(tt("robberOpened"), "bad");
    if (e.type === "freed" && e.r === p) toast(tt("freed"), "good");
    if (e.type === "dispatch") { play("go"); haptic(role === "police" ? [0, 90, 90, 90] : 600); }
    if (e.type === "dispatch") banner(...tt(role === "police" ? "dispatchCop" : "dispatchRob"));
    if (e.type === "reveal") {
      if (role === "police" || p.state === "free") { play("reveal"); haptic(250); }
      if (role === "police") toast(tt("revealedCop"), "good");
      else if (p.state === "free") toast(tt("revealedRob"), "bad");
    }
    if (e.type === "outReveal") {
      if (e.r === p) { play("reveal"); haptic(250); }
      else if (p.team === "police") { play("reveal"); toast(tt("outRevealCop"), "good"); }
    }
    if (e.type === "over") { showEnd(); play(G.over.winner === p.team ? "win" : "lose"); }
  }
}

// 구역 밖 안내. 도둑에게는 몇 초 뒤 위치가 보이는지, 지금 보이는 중인지까지 알려 준다
function lockText(p) {
  if (p.team !== "robber" || G.phase !== "play" || p.state !== "free") return tt("lockIn");
  const left = Math.ceil(CFG.OUT_GRACE - (p.outT || 0));
  return left > 0 ? tt("lockSoon", left) : tt("lockSeen");
}

function drawHud(dt) {
  const p = G.player, left = G.phase === "wait" ? CFG.WAIT - G.t : CFG.DURATION - G.t;
  $("timer").textContent = fmt(left);
  $("timerLabel").textContent = tt(G.phase === "wait" ? "timerWait" : "timerLeft");
  $("clock").classList.toggle("wait", G.phase === "wait");
  // 사람끼리 할 때는 다른 도둑의 상태를 받지 않아서 남은 수로 그린다
  const pips = G.robbers.map((r, i) => (online ? i < online.free : r.state === "free"));
  const pipKey = pips.map(Number).join("");
  if (pipKey !== lastPip) { lastPip = pipKey; $("pips").innerHTML = pips.map(free => `<i class="${free ? "free" : "out"}" style="background-image:url('${ROBBER_ICON}')"></i>`).join(""); }
  // 자유롭게 움직일 때는 위치 공개까지 남은 시간을 게이지로, 그 밖의 상태는 문장으로 보여 준다
  const showReveal = G.phase === "play" && !["jailed", "inJail", "breaking"].includes(p.state);
  $("reveal").hidden = !showReveal; $("status").hidden = showReveal;
  if (showReveal) {
    const rest = Math.max(0, G.nextReveal - G.t), n = Math.ceil(rest), soon = n <= 5;
    if (n !== lastRevealN) { lastRevealN = n; const el = $("revealN"); el.textContent = n; if (soon) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); } }
    $("revealLabel").textContent = tt(role === "police" ? "revealCop" : "revealRob");
    $("revealFill").style.width = Math.min(100, rest / G.revealEvery * 100) + "%";
    $("reveal").className = soon ? (role === "robber" ? "hot" : "soon") : "";
  }
  $("hint").classList.toggle("dim", G.phase === "play" && G.t - CFG.WAIT > 12);
  $("stam").classList.toggle("tired", !!p.tired);
  let line = "";
  if (G.phase === "wait") line = tt(role === "police" ? "waitCop" : "waitRob");
  else if (p.state === "jailed" && !CFG.AUTO_ESCAPE) line = tt("jailedManual");
  else if (p.state === "jailed") line = tt("jailedAuto", Math.ceil(p.lock));
  else if (p.state === "inJail") line = tt("inJail");
  else if (p.state === "breaking") line = tt("breaking", Math.ceil(p.breakT));
  else {
    const n = Math.ceil(G.nextReveal - G.t);
    line = tt(role === "police" ? "nextRevealCop" : "nextRevealRob", n);
  }
  $("status").textContent = line;
  const waitBig = role === "police" && G.phase === "wait";
  $("bigCount").className = waitBig ? "show" : ""; if (waitBig) $("bigCount").textContent = Math.ceil(left);
  $("stamFill").style.width = (p.stam * 100) + "%"; $("stamFill").className = p.tired ? "tired" : "";
  const out = !inZone(p.x, p.y);
  $("lock").className = out ? "show" : "";
  if (out) { const t = lockText(p); if ($("lock").textContent !== t) $("lock").textContent = t; }
  if (role === "police") $("btnCatch").classList.toggle("off", p.catchCd > 0 || p.state !== "free");
  // 지치면 켜 둔 달리기도 꺼 준다
  if (runLatched && p.tired) { runLatched = false; sprintBtn = false; runBtn.classList.remove("down", "latched"); $("btnRunLabel").textContent = tt("run"); }
  runBtn.classList.toggle("tired", !!p.tired);
  // 잡기를 다시 쓸 수 있을 때까지 버튼 위로 시계처럼 차오른다
  if (role === "police") $("btnCatch").style.setProperty("--cd", p.catchCd > 0 ? (1 - p.catchCd / CFG.CATCH_CD).toFixed(3) : "1");
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $("toast").className = ""; }
  if (missionT > 0) { missionT -= dt; if (missionT <= 0) $("mission").className = ""; }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $("banner").className = ""; }
}

function showEnd() {
  ended = true;
  const p = G.player, won = G.over.winner === p.team;
  // 결과 창에서 제일 먼저 봐야 하는 건 이겼는지 졌는지다. 색으로 한 번 더 알린다
  $("endTitle").textContent = tt(won ? "won" : "lost");
  $("endTitle").className = won ? "won" : "lost";
  $("endReason").textContent = tt(G.over.reason === "allArrested" ? "allArrested" : "timeUp");
  $("endHero").src = won ? WIN_ICON[p.team] : p.team === "police" ? POLICE_ICON : ROBBER_ICON;
  $("endHero").className = won ? "won" : "lost";
  const s = p.s;
  $("endStats").innerHTML = (p.team === "police"
    ? [[tt("stCatches"), tt("times", s.catches)], [tt("stTeamCatches"), tt("times", G.stats.catches)], [tt("stEscaped"), tt("people", G.stats.rescues)]]
    : [[tt("stCaught"), tt("times", s.caught)], [tt("stRescued"), tt("people", s.rescued)], [tt("stHidden"), tt("secs", Math.round(s.hideT))]]
  ).map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join("");
  setTimeout(() => $("end").className = "sheet show " + role, 500);
}
// ───────── 흐름 ─────────
let pickDiff = QS.get("diff") || "normal", pickTheme = QS.get("theme") || "random";
function start(r, seed) {
  showGame(r, { role: r, seed, diff: pickDiff, theme: pickTheme === "random" ? null : pickTheme, reveal: QS.get("reveal") ? Number(QS.get("reveal")) : undefined });
}
function showGame(r, opts, setup) {
  role = r; ended = false; lastSeenBy = false; toastT = 0; bannerT = 0; lastPip = "";
  chars.forEach(c => c.el.remove());
  G = newGame(opts);
  if (setup) setup(G);
  document.querySelectorAll(".bush").forEach(n => n.remove());
  bakeMap(); bakeBushes(); bakeMini();
  document.body.dataset.theme = G.theme;
  chars = G.agents.map(makeChar);
  document.body.dataset.role = r;
  $("start").className = "sheet"; $("end").className = "sheet"; $("hud").className = "show"; $("toast").className = ""; $("banner").className = "";
  $("btnCatch").style.display = r === "police" ? "" : "none";
  $("mission").textContent = `${TX.theme[G.theme] ?? G.th.name} · ` + tt(r === "police" ? "missionCop" : "missionRob");
  $("mission").className = "show"; missionT = 3.2;
}

// 휴대폰은 가로가 기본이다. 되는 브라우저는 바꿔 주고, 안 되면 안내하는 동안 게임을 멈춘다.
// 회전을 잠갔거나 앱 안 브라우저면 돌릴 수 없으니 세로를 막지는 않는다
let paused = false, allowPortrait = false;
const isPhone = () => matchMedia("(pointer:coarse)").matches && Math.min(screen.width, screen.height) < 600;
const isPortrait = () => innerHeight > innerWidth;
const syncRotate = () => {
  const need = !!G && !ended && !allowPortrait && !driver && isPhone() && isPortrait();
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
$("again").onclick = () => (online ? online.toLobby() : begin(role));
$("swap").onclick = () => begin(role === "police" ? "robber" : "police");

function frame(dt) {
  if (!G) return;
  const p = G.player;
  if (paused) return;
  if (hitStop > 0) { hitStop -= dt; dt = 0.001; }
  if (!ended) {
    const v = driver ? driver.drive(dt) : readInput();
    p.ix = v.x; p.iy = v.y; p.sprint = driver ? !!v.sprint : keys.has("shift") || sprintBtn;
    if (driver && v.catch) wantCatch = true;
    if (online) {
      online.input(v, p.sprint, wantCatch);
      wantCatch = false;
      online.step(dt);
    } else {
      if (wantCatch) { startCatch(G, p); wantCatch = false; }
      step(G, dt);
    }
    handleEvents();
    drawHud(dt);
  }
  // 카메라: 살짝 늦게 따라가고 달리는 쪽을 조금 더 보여 준다
  const [tx, ty] = camTarget ? camTarget(p) : [p.x + p.vx * 0.22 - W / 2 / zoom, p.y - 30 + p.vy * 0.22 - H / 2 / zoom], k = Math.min(1, dt * 6);
  camX += (tx - camX) * k; camY += (ty - camY) * k;
  shake = Math.max(0, shake - dt * 30);
  const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
  world.style.transform = `translate(${sx}px, ${sy}px) scale(${zoom}) translate(${-camX}px, ${-camY}px)`;
  wobbleBushes(dt);
  for (const c of chars) {
    const a = c.a;
    const can = online ? a.team === p.team || seen(a) : ended || a.team === p.team || (p.state !== "waiting" && inZone(p.x, p.y) && sees(p, a));
    c.el.style.display = can ? "" : "none";
    c.wasVisible = can;
    if (can) dustFor(c, a, dt);
    drawChar(c, dt);
  }
  drawFx(dt);
  drawShields();
  drawJailAlert();
  drawCatchAid();
  tensionSound(dt);
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
// 효과음: CC0 소리 파일을 다듬어 쓴다(docs/sound.md)
let audio = null, muted = false;
// 모든 소리는 한 줄기(bus)로 모아 낸다. 소리 끄기와 크기를 한곳에서 다룬다
let bus = null;
function ensureBus() { if (audio && !bus) { bus = audio.createGain(); bus.connect(audio.destination); } }
const SOUND_SRC = { spotted: "data:audio/mpeg;base64,/*B64:sound/spotted.mp3*/", heart: "data:audio/mpeg;base64,/*B64:sound/heart.mp3*/", found: "data:audio/mpeg;base64,/*B64:sound/found.mp3*/", catch: "data:audio/mpeg;base64,/*B64:sound/catch.mp3*/", caught: "data:audio/mpeg;base64,/*B64:sound/caught.mp3*/", miss: "data:audio/mpeg;base64,/*B64:sound/miss.mp3*/", reveal: "data:audio/mpeg;base64,/*B64:sound/reveal.mp3*/", free: "data:audio/mpeg;base64,/*B64:sound/free.mp3*/", go: "data:audio/mpeg;base64,/*B64:sound/go.mp3*/", alert: "data:audio/mpeg;base64,/*B64:sound/alert.mp3*/", tick: "data:audio/mpeg;base64,/*B64:sound/tick.mp3*/", win: "data:audio/mpeg;base64,/*B64:sound/win.mp3*/", lose: "data:audio/mpeg;base64,/*B64:sound/lose.mp3*/" };
// 순간마다 크기(0~1)와 같은 소리 사이 최소 간격(초). 파일마다 귀에 들리는 크기(LUFS)를 재서 맞췄다. 잡기와 들킴이 기준(1), 사이렌은 같은 최고점이어도 8dB 크게 들려 낮췄다
const SOUND_MIX = { spotted: [1, 4], heart: [0.68, 0.2], found: [0.45, 3], catch: [0.9, 0.3], caught: [1, 1], miss: [0.78, 0.4], reveal: [0.74, 2], free: [0.65, 1], go: [0.36, 2], alert: [0.36, 4], tick: [0.93, 0.5], win: [0.78, 2], lose: [0.48, 2] };
// 자주 반복되는 소리만 높이를 조금씩 흔든다. 멜로디가 있는 소리는 흔들면 음이 틀어져 들린다
const JITTER = new Set(["heart", "miss", "tick"]);
const sounds = {}, lastPlayed = {};
async function loadSounds() {
  if (!audio || sounds.go) return;
  for (const [k, src] of Object.entries(SOUND_SRC)) {
    try { sounds[k] = await audio.decodeAudioData(await (await fetch(src)).arrayBuffer()); } catch { /* 못 읽은 소리는 조용히 넘어간다 */ }
  }
}
function play(name, rate = 1) {
  if (!audio || muted || !sounds[name]) return;
  ensureBus();
  const [vol, gap] = SOUND_MIX[name] || [0.6, 0.2], now = audio.currentTime;
  if (now - (lastPlayed[name] ?? -9) < gap) return;
  lastPlayed[name] = now;
  const s = audio.createBufferSource(), g = audio.createGain();
  s.buffer = sounds[name];
  s.playbackRate.value = rate * (JITTER.has(name) ? 1 + (Math.random() - 0.5) * 0.08 : 1);
  g.gain.value = vol * (1 + (Math.random() - 0.5) * 0.2);
  s.connect(g); g.connect(bus); s.start();
}
function unlockAudio() { try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); loadSounds(); } catch { audio = null; } }
$("sound").addEventListener("pointerdown", e => { e.stopPropagation(); muted = !muted; $("sound").classList.toggle("off", muted); $("sound").setAttribute("aria-label", tt(muted ? "soundOn" : "soundOff")); });
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
