// 구역 축소 화면(방 옵션). 언제 얼마나 줄어드는지는 shared/logic.js 의 shrinkState 가 정하고, 여기서는 보여 주기만 한다.
// 배그의 자기장 표시를 따른다: 다음 구역은 흰 선으로 미리, 지금 경계는 빨간 점선이 걸어 들어오듯, 미니맵에 두 선,
// 미니맵 아래 남은 시간 칸, 10초 전 알림, 들어갈 쪽 화살표, 구역 밖이면 화면 가장자리 붉은 빛. 설계는 docs/shrink.md
// game.js 뒤에 이어 붙어 같은 판(G), 카메라(toScreen, zoom), 알림(toast, play)을 쓴다
let zoneSoonFor = -1, zoneTickN = -1, zoneDoneN = 0, zoneKey = "";

// 처음 구역을 감옥 가운데로 k 배 줄인 모양을 map(x, y) 좌표로 그린다
function zonePath(x, k, map) {
  const P = G.shrink;
  x.beginPath();
  L.ZONE.forEach((p, i) => { const [a, b] = map(P.cx + (p.x - P.cx) * k, P.cy + (p.y - P.cy) * k); i ? x.lineTo(a, b) : x.moveTo(a, b); });
  x.closePath();
}
// k 배 구역 경계에서 (px, py) 와 가장 가까운 점. 화살표가 가리킬 곳이다
function zoneNearest(k, px, py) {
  const P = G.shrink, Z = L.ZONE, at = i => ({ x: P.cx + (Z[i].x - P.cx) * k, y: P.cy + (Z[i].y - P.cy) * k });
  let best = null, bd = 1e18;
  for (let i = 0, j = Z.length - 1; i < Z.length; j = i++) {
    const a = at(j), b = at(i), dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const x = a.x + dx * t, y = a.y + dy * t, d = (x - px) ** 2 + (y - py) ** 2;
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}
// 지금 나에게 해당하는 구역 상태: 밖(out), 곧 밖이 됨(warn), 안전(null)
function zoneDanger(p, z) {
  if (!z || p.state === "waiting" || !["free", "breaking"].includes(p.state)) return null;
  if (!L.inZoneNow(G, p.x, p.y)) return "out";
  if (z.next !== null && (z.moving || z.left <= z.warnAt) && !L.inZoneK(G.shrink, z.next, p.x, p.y)) return "warn";
  return null;
}
function zoneInfo() {
  const z = L.shrinkState(G);
  if (z) z.warnAt = G.shrink.warn;
  return z;
}

// 지도 위: 안개 위에 그려서 어두운 곳에서도 선이 보인다(두 진영 모두 같은 걸 본다)
function drawZone() {
  const z = zoneInfo(), p = G.player, x = fctx;
  if (!z || ended) return;
  const danger = zoneDanger(p, z);
  x.save();
  // 지금 구역 밖은 옅은 붉은 막. 내가 밖이면 이미 안개로 어두워서 막은 빼고 가장자리 빛만 둔다
  if (danger !== "out") {
    x.beginPath(); x.rect(0, 0, W, H);
    L.ZONE.forEach((q, i) => { const P = G.shrink, [a, b] = toScreen(P.cx + (q.x - P.cx) * z.k, P.cy + (q.y - P.cy) * z.k); i ? x.lineTo(a, b) : x.moveTo(a, b); });
    x.closePath(); x.fillStyle = "rgba(226,87,76,.11)"; x.fill("evenodd");
  }
  // 지금 경계: 붉은 띠 위에 빨간 점선. 줄어드는 동안 점선이 안쪽으로 흐른다
  zonePath(x, z.k, toScreen);
  x.lineJoin = "round"; x.lineWidth = 30 * zoom; x.strokeStyle = z.moving ? "rgba(226,87,76,.26)" : "rgba(226,87,76,.14)"; x.stroke();
  x.lineWidth = 8 * zoom; x.setLineDash([40 * zoom, 26 * zoom]); x.lineDashOffset = z.moving ? -G.t * 90 * zoom : 0; x.strokeStyle = "#E2574C"; x.stroke(); x.setLineDash([]);
  // 다음 구역: 흰 선. 눈 마을처럼 밝은 바닥에서도 보이게 어두운 테를 두른다
  if (z.next !== null) {
    zonePath(x, z.next, toScreen);
    x.lineWidth = 10 * zoom; x.strokeStyle = "rgba(29,35,43,.32)"; x.stroke();
    x.lineWidth = 5 * zoom; x.strokeStyle = "#fff"; x.stroke();
  }
  // 들어갈 쪽 화살표: 내 둘레에서 가장 가까운 안쪽을 가리킨다
  if (danger) {
    const k = danger === "out" ? z.k : z.next, n = zoneNearest(k, p.x, p.y), P = G.shrink;
    // 경계선 위가 아니라 한 걸음 안쪽을 가리킨다
    const ix = n.x + (P.cx - n.x) * 0.04, iy = n.y + (P.cy - n.y) * 0.04, a = Math.atan2(iy - p.y, ix - p.x);
    const [sx, sy] = toScreen(p.x, p.y - 30), r = 92 * zoom + Math.sin(G.t * 6) * 5 * zoom, s = 26 * zoom;
    x.translate(sx + Math.cos(a) * r, sy + Math.sin(a) * r); x.rotate(a);
    x.beginPath(); x.moveTo(s, 0); x.lineTo(-s * 0.7, -s * 0.8); x.lineTo(-s * 0.25, 0); x.lineTo(-s * 0.7, s * 0.8); x.closePath();
    x.lineJoin = "round"; x.lineWidth = 6 * zoom; x.strokeStyle = "rgba(29,35,43,.35)"; x.stroke();
    x.fillStyle = danger === "out" ? "#E2574C" : "#FFB800"; x.fill();
  }
  x.restore();
}

// 미니맵: 지금 구역 밖을 어둡게, 지금 경계 빨간 선, 다음 구역 흰 선
function drawZoneMini(x, s) {
  const z = zoneInfo();
  if (!z) return;
  const m = (a, b) => [a * s, b * s];
  x.save();
  x.beginPath(); x.rect(0, 0, mini.width, mini.height);
  L.ZONE.forEach((q, i) => { const P = G.shrink, [a, b] = m(P.cx + (q.x - P.cx) * z.k, P.cy + (q.y - P.cy) * z.k); i ? x.lineTo(a, b) : x.moveTo(a, b); });
  x.closePath(); x.fillStyle = "rgba(29,35,43,.32)"; x.fill("evenodd");
  zonePath(x, z.k, m); x.lineWidth = 3; x.strokeStyle = "#E2574C"; x.stroke();
  if (z.next !== null) { zonePath(x, z.next, m); x.lineWidth = 4.5; x.strokeStyle = "rgba(29,35,43,.4)"; x.stroke(); x.lineWidth = 2.5; x.strokeStyle = "#fff"; x.stroke(); }
  x.restore();
}

// 미니맵 아래 칸과 알림. 칸 막대는 네 칸으로 판 전체의 축소를 보여 주고, 지금 칸이 다음 축소까지 차오른다
function drawZoneHud() {
  const z = zoneInfo(), el = $("zone"), p = G.player;
  el.hidden = !z || ended;
  const danger = z ? zoneDanger(p, z) : null;
  drawZoneEdge(p, danger);
  if (!z || ended) return;
  const P = G.shrink, start = z.done ? P.at[z.done - 1] + P.move : CFG.WAIT;
  const fill = z.final ? 1 : z.moving ? (G.t - z.at) / P.move : 1 - z.left / Math.max(1, z.at - start);
  const state = z.final ? "final" : z.moving ? "moving" : z.left <= 3 ? "hot" : z.left <= z.warnAt ? "soon" : "";
  const label = tt(z.final ? "zoneFinal" : z.moving ? "zoneMoving" : "zoneNext"), value = z.final ? "" : z.moving ? `${z.done + 1}/${z.stages}` : fmt(z.left);
  const key = `${state}|${label}|${value}`;
  if (key !== zoneKey) {
    zoneKey = key; el.className = state;
    $("zoneLabel").textContent = label; $("zoneN").textContent = value;
    $("zoneSegs").innerHTML = P.at.map((_, i) => `<i class="${i < z.done ? "done" : ""}"><b></b></i>`).join("");
  }
  const cur = $("zoneSegs").children[z.done]?.firstElementChild;
  if (cur) cur.style.width = Math.max(0, Math.min(100, fill * 100)) + "%";
  // 10초 전: 소리와 한 줄 알림. 다음 구역 밖에 있으면 무엇을 할지까지 말한다
  if (!z.final && !z.moving && G.phase === "play" && z.left <= P.warn && zoneSoonFor !== z.done) {
    zoneSoonFor = z.done; play("alert"); haptic(120);
    toast(tt("zoneSoon", Math.ceil(z.left)), danger ? "bad" : "");
  }
  const n = Math.ceil(z.left ?? 99);
  if (!z.moving && n <= 3 && n >= 1 && n !== zoneTickN) { zoneTickN = n; play("tick"); }
  if (n > 3) zoneTickN = -1;
  // 다 줄어든 뒤 한 번
  if (z.done > zoneDoneN) { zoneDoneN = z.done; toast(z.final ? tt("zoneFinalNotice") : tt("zoneShrunk", z.done, z.stages)); }
}
// 줄어들기 시작할 때. 다음 구역 밖이면 진동으로 한 번 더 알린다(할 일은 아래 칸과 화살표가 말한다)
function onShrinkEvent() {
  const z = zoneInfo(), p = G.player;
  if (z && zoneDanger(p, z)) haptic(250);
}
// 구역 밖: 화면 가장자리가 붉게. 오래 있을수록 진해진다(깜빡이지 않는다). 곧 밖이 되면 아래 안내만 바뀐다
function drawZoneEdge(p, danger) {
  const out = danger === "out" || (!G.shrink && G.phase !== "wait" && !L.inZoneNow(G, p.x, p.y) && ["free", "breaking"].includes(p.state));
  const k = out ? (p.team === "robber" ? 0.55 + 0.45 * Math.min(1, (p.outT || 0) / CFG.OUT_GRACE) : 0.7) : 0;
  $("edge").style.opacity = k.toFixed(2);
  if (danger === "warn") { const t = tt("zoneGoIn"); $("lock").className = "show warn"; if ($("lock").textContent !== t) $("lock").textContent = t; }
  else $("lock").classList.remove("warn");
}
function resetZone() { zoneSoonFor = -1; zoneTickN = -1; zoneDoneN = 0; zoneKey = ""; $("edge").style.opacity = "0"; $("zone").hidden = true; }
