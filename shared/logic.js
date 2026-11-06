// 게임 규칙과 봇. 화면을 모른다. 봇끼리 수백 판을 돌려 균형을 재려고 그리기와 나눴다.
// 방마다 createGameLogic() 을 불러 지도와 길 찾기 상태를 따로 들게 한다.
function createGameLogic() {
  const CFG = {
    W: 3600, H: 2700,
    DURATION: 180, WAIT: 15, REVEAL_EVERY: 25, REVEAL_SHOW: 4,
    RADIUS: 24,
    RUN: 230,
    SPRINT: { police: 322, robber: 316 },
    STAMINA: { police: 2.4, robber: 3.4 }, REGEN: 6.5,
    VISION: 510, NEAR: 150, CONE: 1.15, TURN: 7, BUSH_SEE: 120,
    CATCH_R: 74, CATCH_CD: 1.6, CATCH_DASH: 230, CATCH_HIT_AT: 0.24, CATCH_LEN: 0.6, CATCH_ASSIST: false, CATCH_GRACE: 35,
    JAIL: { x: 1800, y: 1350, r: 175 }, GATE_R: 235, RESCUE_SEC: 2.2,
    LOCK_BASE: 16, LOCK_STEP: 5, LOCK_MAX: 32, BREAK_SEC: 3, AUTO_ESCAPE: true,
    POLICE: 2, ROBBERS: 4,
  };

  // 테마는 색만이 아니라 판의 성격을 바꾼다. 건물과 덤불의 양, 시야, 골목 폭
  const THEMES = {
    town: { speck: "#E9E2D3", curb: "#F8F4EB", cross: "rgba(255,255,255,.75)", flower: ["#F4A6A0", "#F7D774", "#FFFFFF"], winOff: "rgba(255,255,255,.55)", winOn: 0, dust: "#D8CDB7", name: "동네", cover: 1, bush: 1, vision: 1, lot: 1, ground: "#F3EEE4", road: "#E7DFD0", line: "#D5CBB8", out: "#DDD7CB", park: "#DCE8CF", plaza: "#E4DBC9", jail: "#D8CDB7",
      roofs: [["#C9D6E8", "#A9BAD2"], ["#E8D9C6", "#CDB99F"], ["#D3E3CF", "#B2C9AC"], ["#F2DCCB", "#D9BDA7"], ["#CFE5F4", "#A9CCE4"], ["#E2DCEB", "#C4BBD3"]], win: "rgba(255,255,255,.55)", bin: [["#4F6B5A", "#3F5849"], ["#6B7482", "#566070"]], trees: 0.5, species: "round", trunk: "#8A6F5B", bushes: ["#5E9A7D", "#78B194", "#98CAAF"], fog: "18,23,32", fogA: 0.5 },
    night: { speck: "#333B52", curb: "#454F6B", cross: "rgba(200,210,235,.3)", flower: ["#5F6F8F", "#7A6F9F"], winOff: "#2A3048", winOn: 0.55, dust: "#6B7696", name: "밤 골목", cover: 1.05, bush: 1, vision: 0.78, lot: 1, ground: "#39425A", road: "#2F374C", line: "#4C5671", out: "#232939", park: "#34504F", plaza: "#465070", jail: "#535E80",
      roofs: [["#56617F", "#3E4762"], ["#62597C", "#494260"], ["#4D6A78", "#38505D"], ["#6B5F73", "#4F4557"]], win: "#FFD978", bin: [["#2E3A4A", "#232D3B"], ["#343E4F", "#272F3E"]], trees: 0.4, species: "round", trunk: "#3B3846", bushes: ["#27464A", "#33595C", "#426E70"], fog: "6,9,18", fogA: 0.7 },
    park: { speck: "#CFE2B8", curb: "#E5DAB8", cross: "rgba(255,255,255,.45)", flower: ["#F2849E", "#FFD24D", "#FFFFFF", "#B98CE8"], winOff: "rgba(255,255,255,.5)", winOn: 0, dust: "#C9D8A8", name: "공원", cover: 0.42, bush: 2.1, vision: 1.05, lot: 0.8, ground: "#DCEBC9", road: "#EFE6CF", line: "#DDD0AE", out: "#BFD3A8", park: "#C9E2B3", plaza: "#EFE6CF", jail: "#E3D7B8",
      roofs: [["#F0D5B8", "#D6B48F"], ["#F3E2B5", "#D9C58D"], ["#E5C9C2", "#C9A79E"]], win: "rgba(255,255,255,.5)", bin: [["#5E7A4E", "#4C653E"]], trees: 0.42, species: "round", trunk: "#8A6F5B", bushes: ["#5B9B70", "#76B386", "#9ACCA3"], fog: "18,32,23", fogA: 0.42 },
    city: { speck: "#D5DAE0", curb: "#EDF0F3", cross: "rgba(255,255,255,.9)", flower: ["#A9C9B0", "#FFFFFF"], winOff: "rgba(214,238,255,.75)", winOn: 0, dust: "#C4CAD3", name: "도심", cover: 1.3, bush: 0.55, vision: 0.95, lot: 0.82, ground: "#DFE3E8", road: "#CDD3DB", line: "#F4F6F8", out: "#BDC3CC", park: "#D3DFD4", plaza: "#D3D8DF", jail: "#C4CAD3",
      roofs: [["#AEB8C6", "#8894A6"], ["#9FB2CC", "#7A90AF"], ["#C2B7AE", "#A0948A"], ["#A8BDB7", "#859C95"]], win: "rgba(214,238,255,.75)", bin: [["#56616F", "#454F5C"], ["#3F6A73", "#32565E"]], trees: 0.8, species: "oval", trunk: "#7A6A5F", bushes: ["#6E9A63", "#8AB178", "#ABCB96"], fog: "16,20,30", fogA: 0.52 },
    snow: { speck: "#EAF1F8", curb: "#F4F8FB", cross: "rgba(255,255,255,.85)", flower: ["#FFFFFF", "#DCE8F3"], winOff: "#9FB6CC", winOn: 0.6, roofEdge: "#DCE8F3", dust: "#FFFFFF", name: "눈 마을", cover: 0.9, bush: 0.9, vision: 0.92, lot: 1.1, ground: "#E6EEF5", road: "#D3DFEA", line: "#BCCCDB", out: "#C5D2DF", park: "#DCE7F0", plaza: "#DAE5EF", jail: "#CAD7E4",
      roofs: [["#FFFFFF", "#B9806C"], ["#FFFFFF", "#8FA7BE"], ["#FFFFFF", "#C2A070"], ["#FFFFFF", "#9B8FB5"]], win: "#FFE6A6", bin: [["#5E7188", "#4B5C70"]], trees: 0.42, species: "pine", trunk: "#6F5A4C", bushes: ["#3F6E67", "#4F857C", "#6E9C95"], fog: "28,38,58", fogA: 0.46 },
  };

  // 어렵다는 건 고른 진영 기준이다. 경찰이면 넓고 가릴 것이 많을수록, 도둑이면 좁고 트일수록 어렵다
  const DIFF = {
    easy: { name: "쉬움", police: { scale: 0.94, cover: 0.6, reveal: 22 }, robber: { scale: 1.05, cover: 0.78, reveal: 28 }, think: 0.5, vision: 0.85, sprintAt: 0.8 },
    normal: { name: "보통", police: { scale: 1, cover: 0.66, reveal: 25 }, robber: { scale: 1, cover: 0.66, reveal: 25 }, think: 0.25, vision: 1, sprintAt: 1 },
    hard: { name: "어려움", police: { scale: 1.2, cover: 0.82, reveal: 30 }, robber: { scale: 0.9, cover: 0.55, reveal: 22 }, think: 0.14, vision: 1.1, sprintAt: 1.15 },
  };

  // ───────── 공간 ─────────
  let BUILDINGS = [], BUSHES = [], SOLID = [], SPOTS = [], ZONE = [], ROADS = [], PARKS = [];
  const inflate = (b, r) => ({ x: b.x - r, y: b.y - r, w: b.w + 2 * r, h: b.h + 2 * r });
  const inRect = (r, x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
  const solidAt = (x, y) => SOLID.some(r => inRect(r, x, y));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function inPoly(poly, x, y) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  }
  const inZone = (x, y) => inPoly(ZONE, x, y);

  function segHits(rects, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    for (const r of rects) {
      let t0 = 0, t1 = 1, ok = true;
      for (const [p, q] of [[-dx, x1 - r.x], [dx, r.x + r.w - x1], [-dy, y1 - r.y], [dy, r.y + r.h - y1]]) {
        if (p === 0) { if (q < 0) { ok = false; break; } continue; }
        const t = q / p;
        if (p < 0) { if (t > t1) { ok = false; break; } if (t > t0) t0 = t; }
        else { if (t < t0) { ok = false; break; } if (t < t1) t1 = t; }
      }
      if (ok) return true;
    }
    return false;
  }
  const lineOfSight = (a, b) => !segHits(BUILDINGS, a.x, a.y, b.x, b.y);
  // 구역이 오목할 수 있어 곧은 길도 구역 안인지 본다
  const walkable = (x1, y1, x2, y2) => {
    if (segHits(SOLID, x1, y1, x2, y2)) return false;
    const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 120);
    for (let i = 1; i < n; i++) if (!inZone(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n)) return false;
    return true;
  };
  const bushAt = (x, y) => BUSHES.find(b => Math.hypot((b.x - x) / b.rx, (b.y - y) / b.ry) < 1);

  // ───────── 지도 만들기 ─────────
  // 1) 물결 진 닫힌 곡선으로 구역 모양을 잡는다. 앱에서 손으로 그린 구역처럼
  // 2) 큰길은 공간을 재귀로 나눠 낸다(BSP). 나눈 자리가 제각각이라 바둑판이 되지 않는다
  // 3) 나뉜 땅을 다시 필지로 쪼개 건물을 앉히고, 빈 필지는 마당이 된다
  // 4) 덤불은 서로 일정 거리를 둔 채(포아송 원반) 건물 가까이에 더 잘 앉는다
  // 5) 감옥에서 갈 수 없는 칸이 많으면 그 지도는 버리고 다음 씨앗으로 다시 만든다
  function genMap(seed0, opt) {
    let seed = seed0 >>> 0;
    const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const rr = (a, b) => a + (b - a) * rnd();
    const th = THEMES[opt.theme], cover = Math.min(0.95, opt.cover * th.cover);
    const W = Math.round(3600 * opt.scale), H = Math.round(2700 * opt.scale), cx = W / 2, cy = H / 2;
    const A = [0, 0, rr(0, 0.15), rr(0.03, 0.12), rr(0, 0.06), rr(0, 0.04)], P = A.map(() => rr(0, Math.PI * 2));
    let zone = [];
    for (let i = 0; i < 72; i++) {
      const a = i / 72 * Math.PI * 2; let k = 1;
      for (let h = 2; h < A.length; h++) k += A[h] * Math.cos(h * a + P[h]);
      zone.push({ x: Math.cos(a) * W * 0.44 * k, y: Math.sin(a) * H * 0.44 * k });
    }
    const fit = Math.min((W / 2 - 110) / Math.max(...zone.map(p => Math.abs(p.x))), (H / 2 - 110) / Math.max(...zone.map(p => Math.abs(p.y))), 1);
    zone = zone.map(p => ({ x: cx + p.x * fit, y: cy + p.y * fit }));
    const zin = (x, y) => inPoly(zone, x, y);
    const jail = { x: cx + rr(-120, 120), y: cy + rr(-90, 90) };
    const plazaR = CFG.GATE_R + 70;

    const roads = [], lots = [], blockMax = rr(760, 1020) * Math.sqrt(opt.scale);
    const box = { x: Math.min(...zone.map(p => p.x)), y: Math.min(...zone.map(p => p.y)) };
    box.w = Math.max(...zone.map(p => p.x)) - box.x; box.h = Math.max(...zone.map(p => p.y)) - box.y;
    const split = (r, depth) => {
      const canW = r.w > blockMax, canH = r.h > blockMax;
      if (!canW && !canH) { lots.push(r); return; }
      const alongX = canW && (!canH || r.w / r.h > rr(0.8, 1.25));
      const t = rr(0.37, 0.63), road = depth < 2 ? rr(118, 140) : rr(96, 116);
      if (alongX) {
        const X = r.x + r.w * t; roads.push({ x: X - road / 2, y: r.y, w: road, h: r.h });
        split({ x: r.x, y: r.y, w: X - road / 2 - r.x, h: r.h }, depth + 1); split({ x: X + road / 2, y: r.y, w: r.x + r.w - X - road / 2, h: r.h }, depth + 1);
      } else {
        const Y = r.y + r.h * t; roads.push({ x: r.x, y: Y - road / 2, w: r.w, h: road });
        split({ x: r.x, y: r.y, w: r.w, h: Y - road / 2 - r.y }, depth + 1); split({ x: r.x, y: Y + road / 2, w: r.w, h: r.y + r.h - Y - road / 2 }, depth + 1);
      }
    };
    split(box, 0);

    const buildings = [], parks = [], lotMax = rr(225, 330) * th.lot;
    const blockHitsPlaza = b => { const nx = Math.max(b.x, Math.min(jail.x, b.x + b.w)), ny = Math.max(b.y, Math.min(jail.y, b.y + b.h)); return Math.hypot(nx - jail.x, ny - jail.y) < plazaR; };
    const place = l => {
      if (rnd() > cover) { if (rnd() < 0.5 && zin(l.x + l.w / 2, l.y + l.h / 2)) parks.push({ x: l.x + l.w / 2, y: l.y + l.h / 2, rx: l.w * 0.42, ry: l.h * 0.42 }); return; }
      const ix = rr(4, 26), iy = rr(4, 26), b = { x: Math.round(l.x + ix), y: Math.round(l.y + iy), w: Math.round(l.w - ix - rr(4, 26)), h: Math.round(l.h - iy - rr(4, 26)) };
      // 구역 경계에 걸치면 버리지 않고 안쪽으로 줄여 앉힌다
      const m = 24, inside = () => [[b.x - m, b.y - m], [b.x + b.w + m, b.y - m], [b.x - m, b.y + b.h + m], [b.x + b.w + m, b.y + b.h + m]].every(([x, y]) => zin(x, y));
      for (let k = 0; k < 6 && !inside(); k++) {
        const nw = Math.round(b.w * 0.86), nh = Math.round(b.h * 0.86);
        b.x += Math.round((cx > b.x + b.w / 2 ? 1 : 0) * (b.w - nw)); b.y += Math.round((cy > b.y + b.h / 2 ? 1 : 0) * (b.h - nh)); b.w = nw; b.h = nh;
      }
      if (b.w < 110 || b.h < 90 || !inside()) return;
      if (blockHitsPlaza(b)) return;
      buildings.push(b);
    };
    // 건물을 앉힐 수 없는 크기로는 나누지 않는다. 그래야 필지가 버려지지 않는다
    const minLot = 178;
    const subdivide = (r, gapBase) => {
      const gap = rr(gapBase, gapBase + 30);
      const canX = r.w > lotMax && r.w >= minLot * 2 + gap, canY = r.h > lotMax && r.h >= minLot * 2 + gap;
      if ((!canX && !canY) || rnd() < 0.08) { place(r); return; }
      const alongX = canX && (!canY || r.w > r.h * rr(0.85, 1.15));
      const len = alongX ? r.w : r.h, lo = (minLot + gap / 2) / len, t = rr(Math.max(lo, 0.36), Math.min(1 - lo, 0.64));
      if (alongX) { const X = r.x + r.w * t; subdivide({ x: r.x, y: r.y, w: X - gap / 2 - r.x, h: r.h }, gapBase); subdivide({ x: X + gap / 2, y: r.y, w: r.x + r.w - X - gap / 2, h: r.h }, gapBase); }
      else { const Y = r.y + r.h * t; subdivide({ x: r.x, y: r.y, w: r.w, h: Y - gap / 2 - r.y }, gapBase); subdivide({ x: r.x, y: Y + gap / 2, w: r.w, h: r.y + r.h - Y - gap / 2 }, gapBase); }
    };
    for (const l of lots) subdivide({ x: l.x + 16, y: l.y + 16, w: l.w - 32, h: l.h - 32 }, opt.theme === "city" ? 112 : 122);

    const homes = buildings.slice();
    const clear = (r, pad) => !buildings.some(o => r.x - pad < o.x + o.w && r.x + r.w + pad > o.x && r.y - pad < o.y + o.h && r.y + r.h + pad > o.y);
    // 쓰레기통: 건물 벽 옆에만 둔다. 부딪히고 시야를 가려서 뒤에 숨을 수 있다
    const binWant = Math.round(homes.length * (opt.theme === "park" ? 0.25 : 0.55));
    for (let t = 0, made = 0; t < 160 && made < binWant && homes.length; t++) {
      const h = homes[Math.floor(rnd() * homes.length)], w = 86, d = 48, side = rnd();
      const r = side < 0.6 ? { x: Math.round(rr(h.x + 6, h.x + h.w - w - 6)), y: h.y + h.h + 6, w, h: d } : side < 0.8 ? { x: h.x - w - 6, y: Math.round(rr(h.y + 8, h.y + h.h - d)), w, h: d } : { x: h.x + h.w + 6, y: Math.round(rr(h.y + 8, h.y + h.h - d)), w, h: d };
      if (h.w < 110 || !zin(r.x - 30, r.y - 30) || !zin(r.x + w + 30, r.y + d + 30) || blockHitsPlaza(r)) continue;
      if (buildings.some(o => o !== h && r.x - 100 < o.x + o.w && r.x + w + 100 > o.x && r.y - 100 < o.y + o.h && r.y + d + 100 > o.y)) continue;
      buildings.push({ ...r, kind: "bin" }); made++;
    }
    // 나무는 있을 만한 자리에만 심는다: 큰길을 따라 간격을 둔 가로수, 마당에 한두 그루, 공원에는 무리
    const onRoad = (x, y) => roads.some(q => inRect(inflate(q, 26), x, y));
    const plant = (x, y, cr) => {
      const r = { x: Math.round(x - 14), y: Math.round(y - 10), w: 28, h: 20 };
      if (!zin(x - cr * 0.7, y) || !zin(x + cr * 0.7, y) || !zin(x, y - cr) || !zin(x, y + 40) || onRoad(x, y) || !clear(r, 78) || blockHitsPlaza(inflate(r, 44))) return false;
      buildings.push({ ...r, kind: "tree", crown: Math.round(cr), species: th.species, pit: opt.theme === "city" }); return true;
    };
    for (const q of roads) {
      const hor = q.w > q.h, len = hor ? q.w : q.h, half = (hor ? q.h : q.w) / 2 + 38, step = rr(300, 390);
      for (let k = rr(80, 170); k < len - 60; k += step + rr(-22, 22)) for (const sd of [-1, 1]) {
        if (rnd() > th.trees) continue;
        plant(hor ? q.x + k : q.x + q.w / 2 + sd * half, hor ? q.y + q.h / 2 + sd * half : q.y + k, rr(70, 86));
      }
    }
    for (const q of parks) if (rnd() < 0.7) plant(q.x + rr(-q.rx, q.rx) * 0.35, q.y + rr(-q.ry, q.ry) * 0.35, rr(84, 104));
    if (opt.theme === "park") for (let t = 0; t < 7; t++) {
      const gx = rr(box.x, box.x + box.w), gy = rr(box.y, box.y + box.h);
      for (let k = 0; k < 3; k++) plant(gx + rr(-120, 120), gy + rr(-100, 100), rr(78, 100));
    }
    const bushes = [], area = W * H * 0.6, target = area / 230000 * (0.55 + cover * 0.6) * th.bush;
    const minD = Math.max(150, 245 / Math.sqrt(th.bush));
    const nearB = (x, y, d) => buildings.some(b => inRect(inflate(b, d), x, y));
    for (let t = 0; t < 2600 && bushes.length < target; t++) {
      let x = rr(box.x, box.x + box.w), y = rr(box.y, box.y + box.h), r = rr(48, 66), rx = r * 0.98, ry = r * 0.78, hedge = false;
      if (homes.length && rnd() < (opt.theme === "park" ? 0.25 : 0.88)) {
        const w = homes[Math.floor(rnd() * homes.length)], side = rnd(); hedge = true;
        if (side < 0.5) { rx = r * rr(1.25, 1.75); ry = r * 0.5; x = rr(w.x + rx * 0.7, w.x + w.w - rx * 0.7); y = w.y + w.h + ry + 8; }
        else { rx = r * 0.5; ry = r * rr(0.8, 1.15); x = side < 0.75 ? w.x - rx - 8 : w.x + w.w + rx + 8; y = rr(w.y + ry, Math.max(w.y + ry, w.y + w.h - ry)); }
      }
      if (!zin(x - rx, y) || !zin(x + rx, y) || !zin(x, y + ry) || !zin(x, y - ry) || (!hedge && nearB(x, y, 30)) || buildings.some(o => o.kind === "bin" && inRect(inflate(o, 40), x, y)) || buildings.some(o => inRect(o, x, y)) || Math.hypot(x - jail.x, y - jail.y) < CFG.GATE_R + 50) continue;
      if (bushes.some(b => Math.hypot(b.x - x, b.y - y) < minD)) continue;
      if (!hedge && opt.theme !== "park" && !nearB(x, y, 170)) continue;
      bushes.push({ x: Math.round(x), y: Math.round(y), r: Math.round(r), rx: Math.round(rx), ry: Math.round(ry), hedge });
    }
    return { W, H, zone, jail: { ...jail, r: CFG.JAIL.r }, buildings, bushes, roads, parks, theme: opt.theme, seed: seed0 };
  }

  // 길 찾기: 격자 A*. 지름길은 끈 당기기로 편다
  const CELL = 40, NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let GW = 0, GH = 0, blocked = null, gScore = null, from = null, stamp = null, stampN = 0, reachable = null, MAP = null;
  const cellOf = (x, y) => Math.floor(y / CELL) * GW + Math.floor(x / CELL);
  const nearestOpen = (x, y) => {
    const ci = Math.floor(x / CELL), cj = Math.floor(y / CELL);
    for (let r = 0; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const i = ci + di, j = cj + dj;
      if (i >= 0 && j >= 0 && i < GW && j < GH && !blocked[j * GW + i]) return j * GW + i;
    }
    return -1;
  };
  // 지도를 판에 올린다. 감옥에서 닿는 칸의 비율을 돌려준다
  function loadMap(m) {
    MAP = m; BUILDINGS = m.buildings; BUSHES = m.bushes; ZONE = m.zone; ROADS = m.roads; PARKS = m.parks;
    // 옆으로는 몸 폭만큼 더 띄운다. 벽이 팔을 잘라 먹지 않게
    SOLID = BUILDINGS.map(b => b.kind === "tree" ? inflate(b, CFG.RADIUS) : { x: b.x - 36, y: b.y - CFG.RADIUS, w: b.w + 72, h: b.h + CFG.RADIUS * 2 });
    CFG.W = m.W; CFG.H = m.H; CFG.JAIL = m.jail;
    GW = Math.ceil(m.W / CELL); GH = Math.ceil(m.H / CELL);
    blocked = new Uint8Array(GW * GH); gScore = new Float32Array(GW * GH); from = new Int32Array(GW * GH); stamp = new Int32Array(GW * GH); stampN = 0;
    let open = 0;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const x = i * CELL + CELL / 2, y = j * CELL + CELL / 2, b = solidAt(x, y) || !inZone(x, y);
      blocked[j * GW + i] = b ? 1 : 0; if (!b) open++;
    }
    reachable = new Uint8Array(GW * GH);
    const s = nearestOpen(m.jail.x, m.jail.y); let seen = 0;
    if (s >= 0) { const q = [s]; reachable[s] = 1; while (q.length) { const c = q.pop(); seen++; const ci = c % GW, cj = Math.floor(c / GW); for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= GW || j >= GH) continue; const n = j * GW + i; if (!blocked[n] && !reachable[n]) { reachable[n] = 1; q.push(n); } } } }
    const ok = (x, y) => { const c = cellOf(x, y); return c >= 0 && c < reachable.length && reachable[c]; };
    const openNear = b => { for (const [dx, dy] of [[0, 0], [b.rx * 0.6, 0], [-b.rx * 0.6, 0], [0, b.ry * 0.6], [0, -b.ry * 0.6]]) if (!solidAt(b.x + dx, b.y + dy) && ok(b.x + dx, b.y + dy)) return { x: b.x + dx, y: b.y + dy, bush: true }; return null; };
    SPOTS = BUSHES.map(openNear).filter(Boolean);
    for (const b of BUILDINGS) {
      // 쓰레기통과 나무는 뒤쪽이 숨을 자리다
      if (b.kind) { const x = b.x + b.w / 2, y = b.y - 40; if (!solidAt(x, y) && inZone(x, y) && ok(x, y)) SPOTS.push({ x, y, bush: false }); continue; }
      if (b.w < 160) continue;
      for (const [x, y] of [[b.x - 46, b.y + b.h / 2], [b.x + b.w + 46, b.y + b.h / 2]]) if (!solidAt(x, y) && inZone(x, y) && ok(x, y)) SPOTS.push({ x, y, bush: false });
    }
    return open ? seen / open : 0;
  }
  function makeMap(seed, opt) {
    // 끊긴 지도는 버린다. 씨앗이 같으면 늘 같은 지도가 나온다
    for (let k = 0; k < 12; k++) {
      const m = genMap((seed + k * 7919) >>> 0, opt), r = loadMap(m);
      if (r >= 0.97 && SPOTS.length >= 14) { m.reach = r; return m; }
    }
    const m = genMap(seed >>> 0, { ...opt, cover: opt.cover * 0.7 }); m.reach = loadMap(m); return m;
  }
  function findPath(sx, sy, gx, gy) {
    if (walkable(sx, sy, gx, gy)) return [{ x: gx, y: gy }];
    const s = nearestOpen(sx, sy), g = nearestOpen(gx, gy);
    if (s < 0 || g < 0) return [];
    stampN++;
    const gi = g % GW, gj = Math.floor(g / GW);
    const heap = [[0, s]];
    const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const t = heap[0], e = heap.pop(); if (heap.length) { heap[0] = e; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
    gScore[s] = 0; stamp[s] = stampN; from[s] = -1;
    let found = false;
    while (heap.length) {
      const [, c] = pop();
      if (c === g) { found = true; break; }
      const ci = c % GW, cj = Math.floor(c / GW);
      for (const [di, dj, w] of NB) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= GW || j >= GH) continue;
        const n = j * GW + i;
        if (blocked[n]) continue;
        if (di && dj && (blocked[cj * GW + i] || blocked[j * GW + ci])) continue;
        const ng = gScore[c] + w;
        if (stamp[n] === stampN && ng >= gScore[n]) continue;
        stamp[n] = stampN; gScore[n] = ng; from[n] = c;
        push([ng + Math.hypot(i - gi, j - gj), n]);
      }
    }
    if (!found) return [];
    const raw = [];
    for (let c = g; c !== -1; c = from[c]) raw.push({ x: (c % GW) * CELL + CELL / 2, y: Math.floor(c / GW) * CELL + CELL / 2 });
    raw.reverse(); raw.push({ x: gx, y: gy });
    const out = []; let ax = sx, ay = sy, k = 0;
    while (k < raw.length) {
      let far = k;
      for (let t = raw.length - 1; t > k; t--) if (walkable(ax, ay, raw[t].x, raw[t].y)) { far = t; break; }
      out.push(raw[far]); ax = raw[far].x; ay = raw[far].y; k = far + 1;
    }
    return out;
  }

  // ───────── 한 판 ─────────
  const ROBBER_NAMES = ["도둥이", "살금이", "번개발", "치즈손"];
  const POLICE_NAMES = ["냥파", "수사반장"];

  function newGame(opts = {}) {
    let seed = (opts.seed ?? Math.floor(Math.random() * 1e9)) >>> 0;
    const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    // 고른 진영과 난이도로 지도 조건과 상대 봇의 실력을 정한다
    const diff = DIFF[opts.diff || "normal"], side = diff[opts.role || "police"];
    const names = Object.keys(THEMES);
    const theme = opts.theme && THEMES[opts.theme] ? opts.theme : names[Math.floor(rnd() * names.length)];
    const th = THEMES[theme];
    const map = makeMap(seed ^ 0x51ED27, { scale: opts.scale ?? side.scale, cover: opts.cover ?? side.cover, theme });
    const G = { t: 0, rnd, over: null, phase: "wait", agents: [], police: [], robbers: [], intel: new Map(), pings: [], revealEvery: opts.reveal ?? side.reveal, rescueT: 0, events: [], playerRole: opts.role || null, stats: { catches: 0, rescues: 0, reveals: 0 }, map, theme, th, diff: opts.diff || "normal", vision: CFG.VISION * th.vision };
    G.nextReveal = CFG.WAIT + G.revealEvery;
    const mk = (team, name, x, y, isPlayer) => {
      const enemy = opts.role && team !== opts.role;
      const a = { id: G.agents.length, team, name, x, y, vision: G.vision * (enemy ? diff.vision : 1), thinkEvery: enemy ? diff.think : 0.25, sprintAt: enemy ? diff.sprintAt : 1, vx: 0, vy: 0, ix: 0, iy: 0, faceA: team === "police" ? Math.PI / 2 : rnd() * 6.28, sprint: false, stam: 1, tired: false, state: team === "police" ? "waiting" : "free", action: null, catchCd: 0, caughtN: 0, lock: 0, breakT: 0, inBush: false, isPlayer: !!isPlayer && !opts.botPlayer, path: [], goal: null, thinkT: rnd() * 0.3, repathT: 0, ai: { mode: "go", seenT: -99, hideUntil: 0, q: [], lastX: x, lastY: y, stuckT: 0 }, s: { catches: 0, caught: 0, rescued: 0, escapes: 0, spotted: 0, hideT: 0 } };
      G.agents.push(a); (team === "police" ? G.police : G.robbers).push(a); return a;
    };
    // 경찰은 감옥 앞에서 대기, 도둑은 네 귀퉁이 쪽 먼 자리에서 시작한다
    // 인원은 방장이 정한다. 정하지 않으면 기본 인원이다
    const nPolice = opts.police ?? CFG.POLICE, nRobbers = opts.robbers ?? CFG.ROBBERS, gap = nPolice > 2 ? 110 : 180;
    for (let i = 0; i < nPolice; i++) mk("police", POLICE_NAMES[i % POLICE_NAMES.length], CFG.JAIL.x + (i - (nPolice - 1) / 2) * gap, CFG.JAIL.y + 40, opts.role === "police" && i === 0);
    const pool = SPOTS.filter(s => { const d = dist(s, CFG.JAIL); return d > 420 && d < 1000; }).sort(() => rnd() - 0.5);
    const starts = [];
    for (const s of pool.concat(SPOTS)) { if (starts.length < nRobbers && starts.every(o => dist(o, s) > 420)) starts.push(s); }
    while (starts.length < nRobbers) starts.push(SPOTS[starts.length % SPOTS.length]);
    for (let i = 0; i < nRobbers; i++) mk("robber", ROBBER_NAMES[i % ROBBER_NAMES.length], starts[i].x, starts[i].y, opts.role === "robber" && i === 0);
    G.player = G.agents.find(a => a.isPlayer) || null;
    return G;
  }

  const emit = (G, type, data) => G.events.push({ type, ...data });

  // 누가 누구를 보는가: 거리, 건물, 덤불. 덤불 안은 바로 옆이거나 달리면 들킨다
  // 바라보는 쪽은 멀리, 등 뒤와 옆은 바로 곁만 보인다. 경찰과 도둑이 같은 규칙이다
  function inCone(a, x, y) {
    let da = Math.atan2(y - a.y, x - a.x) - a.faceA;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    return Math.abs(da) <= CFG.CONE;
  }
  function sees(a, b) {
    const d = dist(a, b);
    if (d > (a.vision || CFG.VISION)) return false;
    if (d > CFG.NEAR && !inCone(a, b.x, b.y)) return false;
    if (!lineOfSight(a, b)) return false;
    if (b.inBush && d > CFG.BUSH_SEE) {
      const moving = Math.hypot(b.vx, b.vy) > CFG.RUN * 1.1;
      if (!moving) return false;
    }
    return true;
  }
  // 감옥 안은 안전하다. 나와서 3초를 버티는 동안만 다시 잡힌다
  const catchable = r => r.state === "free" || r.state === "breaking";

  function move(G, a, dt) {
    const blockedNow = a.action || a.state === "jailed" || a.state === "caught" || a.state === "waiting";
    let tx = 0, ty = 0;
    if (!blockedNow) {
      const m = Math.hypot(a.ix, a.iy);
      const canSprint = a.sprint && !a.tired && a.stam > 0 && m > 0.1;
      const speed = canSprint ? CFG.SPRINT[a.team] : CFG.RUN;
      if (m > 0.05) { const s = Math.min(1, m); tx = a.ix / m * s * speed; ty = a.iy / m * s * speed; }
      if (canSprint) { a.stam = Math.max(0, a.stam - dt / CFG.STAMINA[a.team]); if (a.stam === 0) a.tired = true; }
      else { a.stam = Math.min(1, a.stam + dt / CFG.REGEN); if (a.tired && a.stam > 0.3) a.tired = false; }
    } else if (a.action && a.action.name === "catch" && a.action.t < CFG.CATCH_HIT_AT) {
      tx = a.action.dx * CFG.CATCH_DASH; ty = a.action.dy * CFG.CATCH_DASH;
    }
    const k = Math.min(1, dt * 12);
    a.vx += (tx - a.vx) * k; a.vy += (ty - a.vy) * k;
    const margin = 40;
    let nx = a.x + a.vx * dt, ny = a.y + a.vy * dt;
    nx = Math.max(margin, Math.min(CFG.W - margin, nx)); ny = Math.max(margin, Math.min(CFG.H - margin, ny));
    if (!solidAt(nx, a.y)) a.x = nx; else a.vx = 0;
    if (!solidAt(a.x, ny)) a.y = ny; else a.vy = 0;
    a.inBush = !!bushAt(a.x, a.y);
    // 고개는 움직이는 쪽으로 돌린다. 봇은 멈춰 있으면 주변을 살핀다
    const mv = Math.hypot(a.ix, a.iy);
    if (a.action && a.action.name === "catch") a.faceA = Math.atan2(a.action.dy, a.action.dx);
    else if (mv > 0.1 && !blockedNow) {
      const want = Math.atan2(a.iy, a.ix); let da = want - a.faceA; da = Math.atan2(Math.sin(da), Math.cos(da));
      a.faceA += Math.sign(da) * Math.min(Math.abs(da), CFG.TURN * dt);
    } else if (!a.isPlayer && !blockedNow) a.faceA += Math.sin(G.t * 1.1 + a.id * 2.3) * 1.5 * dt;
    if (a.inBush && a.team === "robber") a.s.hideT += dt;
  }

  function startCatch(G, a) {
    if (a.team !== "police" || a.action || a.catchCd > 0 || a.state !== "free") return false;
    // 가까운 도둑 쪽으로 몸을 던진다. 없으면 움직이던 쪽으로
    let best = null, bd = 240;
    for (const r of G.robbers) { if (!catchable(r)) continue; const d = dist(a, r); if (d < bd && lineOfSight(a, r) && sees(a, r)) { bd = d; best = r; } }
    let dx = a.ix, dy = a.iy;
    if (best) { dx = best.x - a.x; dy = best.y - a.y; }
    const m = Math.hypot(dx, dy) || 1;
    a.action = { name: "catch", t: 0, hit: false, dx: dx / m, dy: dy / m };
    // 사람끼리 하는 판: 누른 순간 닿는 도둑을 정해 둔다. 판정까지 짧은 사이에 도망간 만큼 억울하지 않게
    if (CFG.CATCH_ASSIST && best && bd <= CFG.CATCH_R + CFG.CATCH_GRACE) a.action.lock = best;
    a.catchCd = CFG.CATCH_CD;
    emit(G, "catchStart", { a });
    return true;
  }

  function jailSlot(G, r) {
    const i = G.robbers.indexOf(r), ang = i / G.robbers.length * Math.PI * 2 + 0.6;
    return { x: CFG.JAIL.x + Math.cos(ang) * 74, y: CFG.JAIL.y + Math.sin(ang) * 60 };
  }

  function arrest(G, r, by) {
    r.state = "caught"; r.action = null; r.caughtT = 0.7; r.caughtN++; r.s.caught++;
    by.s.catches++; G.stats.catches++; G.intel.delete(r.id);
    r.path = []; r.goal = null; r.vx = r.vy = 0;
    emit(G, "caught", { r, by });
  }

  function updateAction(G, a, dt) {
    if (!a.action) return;
    a.action.t += dt;
    if (a.action.name === "catch") {
      const lock = a.action.lock;
      if (lock && !a.action.hit) { const dx = lock.x - a.x, dy = lock.y - a.y, m = Math.hypot(dx, dy) || 1; a.action.dx = dx / m; a.action.dy = dy / m; }
      if (!a.action.hit && a.action.t >= CFG.CATCH_HIT_AT) {
        a.action.hit = true;
        let hit = null, bd = CFG.CATCH_R;
        for (const r of G.robbers) { if (!catchable(r)) continue; const d = dist(a, r); if (d < bd && lineOfSight(a, r)) { bd = d; hit = r; } }
        if (!hit && lock && catchable(lock) && dist(a, lock) < CFG.CATCH_R + CFG.CATCH_GRACE && lineOfSight(a, lock)) hit = lock;
        if (hit) arrest(G, hit, a); else emit(G, "catchMiss", { a });
      }
      if (a.action.t >= CFG.CATCH_LEN) a.action = null;
    }
  }

  function updateRobberState(G, r, dt) {
    if (r.state === "caught") {
      r.caughtT -= dt;
      if (r.caughtT <= 0) {
        const s = jailSlot(G, r); r.x = s.x; r.y = s.y; r.state = "jailed";
        r.lock = Math.min(CFG.LOCK_MAX, CFG.LOCK_BASE + CFG.LOCK_STEP * (r.caughtN - 1));
        emit(G, "jailed", { r });
      }
    } else if (r.state === "jailed") {
      if (CFG.AUTO_ESCAPE) {
        r.lock -= dt;
        if (r.lock <= 0) { r.state = "inJail"; emit(G, "unlocked", { r }); }
      }
    } else if (r.state === "inJail") {
      if (dist(r, CFG.JAIL) > CFG.JAIL.r) { r.state = "breaking"; r.breakT = CFG.BREAK_SEC; emit(G, "breaking", { r }); }
    } else if (r.state === "breaking") {
      if (dist(r, CFG.JAIL) <= CFG.JAIL.r) { r.state = "inJail"; }
      else { r.breakT -= dt; if (r.breakT <= 0) { r.state = "free"; emit(G, "freed", { r }); } }
    }
  }

  function updateRescue(G, dt) {
    const jailed = G.robbers.filter(r => r.state === "jailed");
    const rescuers = G.robbers.filter(r => r.state === "free" && dist(r, CFG.JAIL) < CFG.GATE_R);
    if (jailed.length && rescuers.length) {
      G.rescueT += dt;
      if (G.rescueT >= CFG.RESCUE_SEC) {
        for (const r of jailed) { r.state = "inJail"; emit(G, "unlocked", { r, rescued: true }); }
        rescuers[0].s.rescued += jailed.length; G.stats.rescues += jailed.length; G.rescueT = 0;
        emit(G, "rescued", { by: rescuers[0], n: jailed.length });
      }
    } else G.rescueT = Math.max(0, G.rescueT - dt * 1.5);
  }

  function reveal(G) {
    const list = G.robbers.filter(r => r.state === "free");
    for (const r of list) {
      G.intel.set(r.id, { x: r.x, y: r.y, t: G.t });
      G.pings.push({ x: r.x, y: r.y, t: G.t, id: r.id });
      r.ai.revealedT = G.t;
    }
    G.stats.reveals++;
    emit(G, "reveal", { n: list.length });
  }

  // ───────── 봇 ─────────
  function setGoal(G, a, x, y) {
    if (a.goal && Math.hypot(a.goal.x - x, a.goal.y - y) < 30 && a.path.length) return;
    a.goal = { x, y }; a.path = findPath(a.x, a.y, x, y); a.repathT = 0.9;
  }
  function follow(G, a, dt) {
    a.repathT -= dt;
    if (a.goal && a.repathT <= 0) { a.path = findPath(a.x, a.y, a.goal.x, a.goal.y); a.repathT = 0.9; }
    while (a.path.length && Math.hypot(a.path[0].x - a.x, a.path[0].y - a.y) < 26) a.path.shift();
    if (a.path.length) { a.ix = a.path[0].x - a.x; a.iy = a.path[0].y - a.y; const m = Math.hypot(a.ix, a.iy) || 1; a.ix /= m; a.iy /= m; }
    else { a.ix = 0; a.iy = 0; }
    // 끼면 옆으로 비켜 새로 찾는다
    a.ai.stuckT += dt;
    if (a.ai.stuckT > 0.8) {
      const moved = Math.hypot(a.x - a.ai.lastX, a.y - a.ai.lastY);
      if (moved < 12 && a.path.length && !a.action) a.repathT = 0;
      a.ai.lastX = a.x; a.ai.lastY = a.y; a.ai.stuckT = 0;
    }
  }
  const reached = (a, r = 42) => !a.goal || Math.hypot(a.goal.x - a.x, a.goal.y - a.y) < r;

  function thinkPolice(G, a, idx) {
    if (a.state !== "free") return;
    const vis = G.robbers.filter(r => catchable(r) && sees(a, r));
    for (const r of vis) { G.intel.set(r.id, { x: r.x, y: r.y, t: G.t, by: a.id }); r.s.spotted++; }
    if (vis.length) {
      vis.sort((p, q) => dist(a, p) - dist(a, q));
      const r = vis[0], d = dist(a, r);
      a.ai.mode = "chase"; a.ai.chaseId = r.id; a.ai.seenT = G.t;
      const lead = Math.min(0.45, d / 700);
      setGoal(G, a, r.x + r.vx * lead, r.y + r.vy * lead);
      a.sprint = d < 380 * a.sprintAt;
      if (d < CFG.CATCH_R * 1.1 && a.catchCd <= 0) startCatch(G, a);
      return;
    }
    a.sprint = false;
    if (a.ai.mode === "chase") {
      // 놓쳤다. 마지막 본 자리까지 간 뒤 주변 숨을 곳을 뒤진다
      const k = G.intel.get(a.ai.chaseId);
      if (k) { setGoal(G, a, k.x, k.y); a.sprint = true; a.ai.mode = "lost"; return; }
      a.ai.mode = "patrol";
    }
    if (a.ai.mode === "lost" && !reached(a, 70)) { a.sprint = G.t - a.ai.seenT < 1.5; return; }
    if (a.ai.mode === "lost") {
      const at = { x: a.x, y: a.y };
      a.ai.q = SPOTS.filter(s => dist(s, at) < 520).sort((p, q) => dist(p, at) - dist(q, at)).slice(0, 3);
      G.intel.delete(a.ai.chaseId);
      a.ai.mode = "search";
    }
    if (a.ai.mode === "search") {
      if (a.goal && !reached(a, 70) && a.ai.searching) return;
      const next = a.ai.q.shift();
      if (next) { setGoal(G, a, next.x, next.y); a.ai.searching = true; return; }
      a.ai.searching = false; a.ai.mode = "patrol";
      const lostR = G.agents[a.ai.chaseId];
      if (lostR && lostR.team === "robber" && lostR.state === "free") { lostR.s.escapes++; emit(G, "escaped", { r: lostR }); }
    }
    // 무전으로 받은 위치가 있으면 그쪽으로. 두 경찰이 같은 곳을 맡지 않게 한다
    const others = G.police.filter(p => p !== a);
    const claims = new Set(others.map(p => p.ai.claim));
    let best = null, bd = 1e9;
    for (const [id, k] of G.intel) {
      if (G.t - k.t > 30) { G.intel.delete(id); continue; }
      if (claims.has(id)) continue;
      const d = dist(a, k); if (d < bd) { bd = d; best = [id, k]; }
    }
    if (best) {
      a.ai.claim = best[0]; setGoal(G, a, best[1].x, best[1].y); a.sprint = bd > 900 && a.stam > 0.8;
      if (bd < 90) { G.intel.delete(best[0]); a.ai.mode = "lost"; a.goal = { x: a.x, y: a.y }; }
      return;
    }
    a.ai.claim = null;
    // 갇힌 도둑이 있으면 한 명은 감옥 근처를 돈다
    const jailed = G.robbers.filter(r => r.state === "jailed" || r.state === "inJail" || r.state === "breaking").length;
    if (idx === 1 && jailed > 0 && reached(a, 70) && G.rnd() < 0.5) {
      const ang = G.rnd() * Math.PI * 2;
      setGoal(G, a, CFG.JAIL.x + Math.cos(ang) * 520, CFG.JAIL.y + Math.sin(ang) * 440);
      return;
    }
    if (reached(a, 70) || !a.path.length) {
      const here = { x: a.x, y: a.y };
      const pool = SPOTS.filter(s => { const d = dist(s, here); return d > 300 && d < 1100; });
      const s = pool[Math.floor(G.rnd() * pool.length)] || SPOTS[0];
      setGoal(G, a, s.x, s.y);
    }
  }

  function pickHide(G, a, threats) {
    // 경찰에게서 멀고, 내게서 너무 멀지 않고, 덤불이면 더 좋은 자리
    const known = threats.length ? threats : G.police.filter(p => p.state === "free" && dist(a, p) < 900 && lineOfSight(a, p));
    let best = null, bs = -1e9;
    for (const s of SPOTS) {
      const mine = dist(a, s);
      const waiting = G.phase === "wait";
      if (mine < 120 || mine > (waiting ? 2600 : 1500)) continue;
      let sc = (s.bush ? 200 : 0) - mine * (waiting ? 0 : 0.25) + G.rnd() * 120;
      if (waiting) sc += dist(s, CFG.JAIL) * 0.6;
      for (const p of known) {
        const pd = dist(p, s);
        sc += Math.min(pd, 900) * 0.8;
        if (pd < mine) sc -= 700;                  // 경찰 쪽으로 달려들지 않는다
        if (lineOfSight(p, s)) sc -= 260;
      }
      if (dist(s, CFG.JAIL) < 420) sc -= 300;
      // 같은 자리에 몰리지 않는다
      for (const o of G.robbers) if (o !== a && o.goal && dist(o.goal, s) < 120) sc -= 300;
      if (sc > bs) { bs = sc; best = s; }
    }
    return best;
  }

  function thinkRobber(G, a) {
    if (a.state === "caught" || a.state === "jailed") { a.ix = a.iy = 0; a.sprint = false; return; }
    const threats = G.police.filter(p => p.state === "free" && sees(a, p));
    const near = threats.length ? Math.min(...threats.map(p => dist(a, p))) : 1e9;
    if (a.state === "inJail" || a.state === "breaking") {
      if (a.state === "inJail" || !a.goal || reached(a)) {
        const s = pickHide(G, a, threats) || SPOTS[0];
        setGoal(G, a, s.x, s.y); a.ai.mode = "go";
      }
      a.sprint = near < 420;
      return;
    }
    if (threats.length && near < 480) {
      const cut = a.goal && threats.some(p => dist(p, a.goal) < dist(a, a.goal));
      if (a.ai.mode !== "flee" || reached(a) || (cut && G.t - a.ai.fleeAt > 0.7)) {
        const s = pickHide(G, a, threats);
        if (s) setGoal(G, a, s.x, s.y);
        a.ai.mode = "flee"; a.ai.fleeAt = G.t;
      }
      a.sprint = near < 330 * a.sprintAt;
      return;
    }
    a.sprint = false;
    // 공개되면 들킨 자리를 떠난다
    if (a.ai.revealedT && a.ai.revealedT > (a.ai.movedAfter || -1)) {
      a.ai.movedAfter = G.t;
      const s = pickHide(G, a, threats); if (s) { setGoal(G, a, s.x, s.y); a.ai.mode = "go"; }
      return;
    }
    // 동료 구하기: 숨어 있다가 감옥 주변이 비었다고 믿으면 간다
    const jailedN = G.robbers.filter(r => r.state === "jailed").length;
    if (jailedN && a.ai.mode !== "rescue" && G.rnd() < 0.012 * jailedN) {
      const others = G.robbers.filter(r => r !== a && r.ai.mode === "rescue");
      if (!others.length) { a.ai.mode = "rescue"; setGoal(G, a, CFG.JAIL.x + (G.rnd() - 0.5) * 240, CFG.JAIL.y + 150 + G.rnd() * 60); return; }
    }
    if (a.ai.mode === "rescue") {
      if (!jailedN) { a.ai.mode = "go"; const s = pickHide(G, a, threats); if (s) setGoal(G, a, s.x, s.y); }
      return;
    }
    if (a.ai.mode === "flee" && reached(a)) a.ai.mode = "hide";
    if (a.ai.mode === "go" && reached(a)) { a.ai.mode = "hide"; a.ai.hideUntil = G.t + 18 + G.rnd() * 26; }
    if (a.ai.mode === "hide" && G.t > a.ai.hideUntil) {
      const s = pickHide(G, a, threats); if (s) { setGoal(G, a, s.x, s.y); a.ai.mode = "go"; }
    }
    if (!a.goal) { const s = pickHide(G, a, threats); if (s) { setGoal(G, a, s.x, s.y); a.ai.mode = "go"; } }
  }

  // ───────── 한 걸음 ─────────
  function step(G, dt) {
    if (G.over) return;
    G.t += dt;
    if (G.phase === "wait" && G.t >= CFG.WAIT) {
      G.phase = "play"; for (const p of G.police) p.state = "free";
      emit(G, "dispatch", {});
    }
    if (G.phase === "play" && G.t >= G.nextReveal) { G.nextReveal += G.revealEvery; reveal(G); }
    G.pings = G.pings.filter(p => G.t - p.t < CFG.REVEAL_SHOW);
    G.agents.forEach((a, i) => {
      if (a.catchCd > 0) a.catchCd -= dt;
      if (!a.isPlayer) {
        a.thinkT -= dt;
        if (a.thinkT <= 0) {
          a.thinkT = a.thinkEvery * (0.8 + G.rnd() * 0.4);
          if (a.team === "police") thinkPolice(G, a, G.police.indexOf(a)); else thinkRobber(G, a);
        }
        follow(G, a, dt);
      }
      updateAction(G, a, dt);
      move(G, a, dt);
      if (a.team === "robber") updateRobberState(G, a, dt);
    });
    // 몸끼리 통과하지 않게 살짝 밀어낸다
    const body = G.agents.filter(a => a.state !== "jailed" && a.state !== "caught" && a.state !== "waiting");
    for (let i = 0; i < body.length; i++) for (let j = i + 1; j < body.length; j++) {
      const a = body[i], b = body[j]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 46) {
        const k = (46 - d) / 2 / d;
        if (!solidAt(a.x - dx * k, a.y - dy * k)) { a.x -= dx * k; a.y -= dy * k; }
        if (!solidAt(b.x + dx * k, b.y + dy * k)) { b.x += dx * k; b.y += dy * k; }
      }
    }
    updateRescue(G, dt);
    if (G.phase === "play") {
      if (!G.robbers.some(r => r.state === "free")) { G.over = { winner: "police", reason: "allArrested", at: G.t }; emit(G, "over", {}); }
      else if (G.t >= CFG.DURATION) { G.over = { winner: "robber", reason: "timeUp", at: G.t }; emit(G, "over", {}); }
    }
  }

  return { loadMap, inCone, CFG, THEMES, DIFF, newGame, step, sees, startCatch, catchable, dist, bushAt, solidAt, inRect, inZone, lineOfSight, jailSlot, genMap, makeMap,
    get BUILDINGS() { return BUILDINGS; }, get BUSHES() { return BUSHES; }, get SPOTS() { return SPOTS; }, get ZONE() { return ZONE; }, get ROADS() { return ROADS; }, get PARKS() { return PARKS; } };
}

// 화면은 방이 하나라 하나만 쓴다.
const gameRoot = typeof window !== "undefined" ? window : globalThis;
gameRoot.createGameLogic = createGameLogic;
gameRoot.GameLogic = createGameLogic();
