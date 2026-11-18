// 대기실. 게임 규칙과 그림, 조작은 game.js 를 그대로 쓰고 지도만 대기실용으로 바꾼다.
// 걷는 건 내 폰에서만 처리하고, 서버에는 칸이 바뀔 때만 알린다. 위치를 계속 보내면 방이 잠들지 못해 비용이 는다.
function createLobbyScene(net) {
  // 대기실 지도. 가운데 큰길에 세 구역을 분필로 그렸다
  const ZX = [900, 1367, 1833, 2300], ZY = [540, 960], MW = 3200, MH = 1500, WALK = { x0: 930, x1: 2270, y0: 745, y1: 935 };
  const tree = (x, y, c) => ({ x, y, w: 28, h: 20, kind: "tree", crown: c, species: "round" });
  const hedge = (x, y, rx) => ({ x, y, r: 52, rx, ry: 30, hedge: true });
  const LOBBY_MAP = {
    W: MW, H: MH, seed: 411,
    zone: [{ x: 0, y: 0 }, { x: MW, y: 0 }, { x: MW, y: MH }, { x: 0, y: MH }],
    jail: { x: -3000, y: -3000, r: 175 },
    roads: [{ x: 0, y: 540, w: MW, h: 420 }, { x: 1324, y: 0, w: 86, h: MH }, { x: 1790, y: 0, w: 86, h: MH }],
    parks: [{ x: 1600, y: 1120, rx: 170, ry: 90 }],
    buildings: [
      { x: 560, y: 240, w: 300, h: 210 }, { x: 900, y: 220, w: 380, h: 240 }, { x: 1440, y: 240, w: 310, h: 210 }, { x: 1920, y: 220, w: 380, h: 240 }, { x: 2340, y: 240, w: 300, h: 210 },
      { x: 560, y: 1060, w: 320, h: 210 }, { x: 930, y: 1060, w: 340, h: 220 }, { x: 1930, y: 1060, w: 360, h: 210 }, { x: 2340, y: 1060, w: 300, h: 210 },
      { x: 1620, y: 452, w: 92, h: 64, kind: "bin" }, { x: 1080, y: 1000, w: 92, h: 64, kind: "bin" },
      tree(1465, 510, 72), tree(1770, 1010, 76), tree(2320, 510, 70), tree(1290, 1010, 72), tree(880, 510, 68), tree(2310, 1000, 70),
    ],
    bushes: [hedge(1100, 496, 84), hedge(2110, 498, 88), hedge(700, 1002, 70), hedge(2100, 1004, 84), hedge(1560, 1000, 62), hedge(852, 660, 42), hedge(852, 840, 42), hedge(2348, 660, 42), hedge(2348, 840, 42)],
    theme: "town",
  };
  // 좀비 모드 대기실: 칸 없는 밤 공터. 집들이 둘레를 감싸고 가운데는 비어 있다. 편은 시작할 때 조명이 정한다
  const LOT = { x0: 780, x1: 2420, y0: 650, y1: 1110, cx: 1600, cy: 880 };
  const ZOMBIE_LOBBY_MAP = {
    W: MW, H: MH, seed: 613,
    zone: [{ x: 0, y: 0 }, { x: MW, y: 0 }, { x: MW, y: MH }, { x: 0, y: MH }],
    jail: { x: -3000, y: -3000, r: 175 },
    roads: [{ x: 0, y: 1250, w: MW, h: 150 }],
    parks: [],
    buildings: [
      { x: 420, y: 150, w: 300, h: 220 }, { x: 780, y: 130, w: 360, h: 240 }, { x: 1220, y: 160, w: 280, h: 210 }, { x: 1700, y: 140, w: 340, h: 230 }, { x: 2120, y: 160, w: 300, h: 210 }, { x: 2480, y: 140, w: 320, h: 240 },
      { x: 320, y: 520, w: 260, h: 220 }, { x: 330, y: 840, w: 250, h: 230 }, { x: 2620, y: 520, w: 260, h: 220 }, { x: 2620, y: 850, w: 260, h: 220 },
      { x: 700, y: 430, w: 92, h: 64, kind: "bin" }, { x: 2380, y: 1120, w: 92, h: 64, kind: "bin" },
      tree(700, 1150, 74), tree(1180, 470, 66), tree(2060, 470, 70), tree(2500, 1180, 72), tree(640, 760, 64), tree(2560, 760, 68),
    ],
    bushes: [hedge(860, 700, 58), hedge(2350, 700, 62), hedge(1170, 1160, 72), hedge(2060, 1170, 70), hedge(620, 1000, 50), hedge(2580, 980, 50)],
    theme: "zombie", bare: true,
  };
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const stroke2 = (x1, y1, x2, y2, r, j) => { const n = a => (r() - .5) * a; return `M${(x1 + n(6)).toFixed(1)} ${(y1 + n(6)).toFixed(1)}Q${((x1 + x2) / 2 + n(j)).toFixed(1)} ${((y1 + y2) / 2 + n(j)).toFixed(1)} ${(x2 + n(6)).toFixed(1)} ${(y2 + n(6)).toFixed(1)}`; };
  function chalkRect(x, c, X, Y, w, h, seed) {
    const r = rng(seed), o = 12; x.save(); x.strokeStyle = c; x.lineCap = "round"; x.globalAlpha = .55; x.lineWidth = 6;
    for (let p = 0; p < 2; p++) x.stroke(new Path2D(stroke2(X - o, Y, X + w + o, Y, r, 16) + stroke2(X + w, Y - o, X + w, Y + h + o, r, 16) + stroke2(X + w + o, Y + h, X - o, Y + h, r, 16) + stroke2(X, Y + h + o, X, Y - o, r, 16)));
    x.restore();
  }
  function chalkOval(x, c, cx, cy, rx, ry, seed) {
    const r = rng(seed); x.save(); x.strokeStyle = c; x.globalAlpha = .55; x.lineWidth = 6; x.lineCap = "round"; x.setLineDash([22, 26]); x.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, k = 1 + (r() - .5) * .02, px = cx + Math.cos(a) * rx * k, py = cy + Math.sin(a) * ry * k; i ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke(); x.restore();
  }
  function chalkArrow(x, c, X, Y, dir, seed) {
    const r = rng(seed), n = a => (r() - .5) * a, len = 74, tip = X + dir * len; x.save(); x.strokeStyle = c; x.globalAlpha = .62; x.lineWidth = 7; x.lineCap = "round"; x.lineJoin = "round";
    x.stroke(new Path2D(`M${X} ${Y + n(8)}Q${X + dir * len / 2} ${Y + n(12)} ${tip} ${Y}M${tip - dir * 24} ${Y - 20 + n(5)}L${tip} ${Y}L${tip - dir * 24} ${Y + 20 + n(5)}`)); x.restore();
  }
  // 바닥 그림: 실제 캐릭터의 모양과 색을 가져와 분필로 칠한 것처럼 만든다
  const loadImg = svg => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = "data:image/svg+xml," + encodeURIComponent(svg); });
  function chalkCharacter(x, name, cx, footY, h, outline, seed) {
    const src = SVGS[name], vb = /viewBox="([\d.\s-]+)"/.exec(src)[1].trim().split(/\s+/).map(Number), inner = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    const w = h * vb[2] / vb[3], W2 = Math.round(w * 2), H2 = Math.round(h * 2), wobble = a => `<filter id="w" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="${vb[3] * a}"/></filter>`;
    const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${W2}" height="${H2}" viewBox="${vb.join(" ")}" overflow="visible">`;
    const fillSvg = `${open}<defs>${wobble(.01)}</defs><g filter="url(#w)">${inner}</g></svg>`;
    const lines = inner.replace(/\sfill="(?!none)[^"]*"/g, ' fill="none"').replace(/\sstroke="[^"]*"/g, "").replace(/\sstroke-width="[^"]*"/g, "").replace(/\sfill-opacity="[^"]*"/g, "").replace(/\sstyle="[^"]*"/g, "");
    const lineSvg = `${open}<defs>${wobble(.012)}</defs><g filter="url(#w)" fill="none" stroke="${outline}" stroke-width="${vb[3] * .0085}" stroke-linecap="round" stroke-linejoin="round">${lines}</g></svg>`;
    return Promise.all([loadImg(fillSvg), loadImg(lineSvg)]).then(([fi, li]) => {
      const c = document.createElement("canvas"); c.width = W2; c.height = H2; const q = c.getContext("2d"), r = rng(seed * 13 + 1);
      if (fi) { q.drawImage(fi, 0, 0, W2, H2);
        // 면은 비스듬히 문지른 자국처럼 비운다
        q.globalCompositeOperation = "destination-out"; q.save(); q.translate(W2 / 2, H2 / 2); q.rotate(-.62); q.lineCap = "round";
        for (let k = -H2; k < H2; k += 5 + r() * 7) { q.globalAlpha = .28 + r() * .55; q.lineWidth = 1.5 + r() * 3.5; q.beginPath(); q.moveTo(-W2 * 1.2, k + (r() - .5) * 6); q.lineTo(W2 * 1.2, k + (r() - .5) * 6); q.stroke(); }
        q.restore(); q.globalCompositeOperation = "source-over"; q.globalAlpha = 1; }
      x.save(); if (fi) { x.globalAlpha = .22; x.drawImage(fi, cx - w / 2, footY - h, w, h); } x.globalAlpha = .5; x.drawImage(c, cx - w / 2, footY - h, w, h); x.globalAlpha = .85; if (li) x.drawImage(li, cx - w / 2, footY - h, w, h); x.globalAlpha = .4; if (li) x.drawImage(li, cx - w / 2 + 1.5, footY - h - 1.5, w, h); x.restore();
    });
  }
  function chalkQuestion(x, cx, top) {
    const r = rng(31), n = a => (r() - .5) * a; x.save(); x.strokeStyle = x.fillStyle = "#6D6351"; x.lineCap = "round"; x.lineJoin = "round";
    for (const pass of [0, 1]) { x.globalAlpha = pass ? .4 : .85; x.lineWidth = pass ? 4 : 10; x.save(); x.translate(n(pass ? 7 : 2), n(pass ? 7 : 2));
      x.stroke(new Path2D(`M${cx - 60} ${top + 58}C${cx - 56} ${top - 8} ${cx + 64} ${top - 14} ${cx + 64} ${top + 54}C${cx + 64} ${top + 108} ${cx + 2} ${top + 102} ${cx + 2} ${top + 164}`)); x.restore(); }
    x.globalAlpha = .85; x.beginPath(); x.ellipse(cx + 3, top + 204, 11, 12, .3, 0, 7); x.fill(); x.restore();
  }
  // 좀비 공터 바닥: 버려진 주차장. 갈라진 아스팔트, 지워진 주차선, 웅덩이, 끌고 간 발자국, 찢어진 철망과 출입 금지 띠.
  // 무섭되 피나 상처는 그리지 않는다(아이도 하는 게임). 바닥 그림이라 부딪히지 않는다
  function paintLot() {
    const m = $("map").getContext("2d"), r = rng(907), A = { x0: 650, x1: 2550, y0: 600, y1: 1190 };
    m.save();
    // 가장자리가 부서진 아스팔트
    const edge = new Path2D(), jag = () => (r() - .5) * 34;
    edge.moveTo(A.x0, A.y0 + jag());
    for (let x = A.x0; x <= A.x1; x += 56) edge.lineTo(x, A.y0 + jag());
    for (let y = A.y0; y <= A.y1; y += 56) edge.lineTo(A.x1 + jag(), y);
    for (let x = A.x1; x >= A.x0; x -= 56) edge.lineTo(x, A.y1 + jag());
    for (let y = A.y1; y >= A.y0; y -= 56) edge.lineTo(A.x0 + jag(), y);
    edge.closePath();
    m.fillStyle = "rgba(0,0,0,.28)"; m.save(); m.translate(0, 10); m.fill(edge); m.restore();
    m.fillStyle = "#2B3134"; m.fill(edge);
    m.save(); m.clip(edge);
    // 덧칠한 땜질 자국과 알갱이
    for (let i = 0; i < 9; i++) { m.save(); m.translate(A.x0 + r() * (A.x1 - A.x0), A.y0 + r() * (A.y1 - A.y0)); m.rotate((r() - .5) * .3); m.fillStyle = r() < .5 ? "rgba(16,20,22,.35)" : "rgba(70,76,74,.22)"; m.fillRect(-60 - r() * 90, -30 - r() * 40, 140 + r() * 180, 70 + r() * 70); m.restore(); }
    for (let i = 0; i < 14000; i++) { m.fillStyle = r() < .55 ? "rgba(255,255,255,.035)" : "rgba(0,0,0,.09)"; const s = 1.5 + r() * 3; m.fillRect(A.x0 + r() * (A.x1 - A.x0), A.y0 + r() * (A.y1 - A.y0), s, s); }
    // 지워진 주차선: 위아래 두 줄
    const lines = document.createElement("canvas"); lines.width = A.x1 - A.x0; lines.height = A.y1 - A.y0; const q = lines.getContext("2d");
    q.strokeStyle = "#D9D3C0"; q.lineWidth = 11;
    for (let i = 0; i < 10; i++) { const x = 170 + i * 180; q.beginPath(); q.moveTo(x, 70); q.lineTo(x + 6, 200); q.moveTo(x - 30, 420); q.lineTo(x - 24, 560); q.stroke(); }
    q.beginPath(); q.moveTo(120, 70); q.lineTo(1840, 64); q.stroke();
    q.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 26000; i++) { q.globalAlpha = .3 + r() * .7; q.fillRect(r() * lines.width, r() * lines.height, 2 + r() * 5, 2 + r() * 4); }
    for (let i = 0; i < 12; i++) { q.globalAlpha = 1; q.beginPath(); q.ellipse(r() * lines.width, r() * lines.height, 40 + r() * 80, 20 + r() * 30, r() * 3, 0, 7); q.fill(); }
    m.globalAlpha = .26; m.drawImage(lines, A.x0, A.y0); m.globalAlpha = 1;
    // 갈라진 금과 틈에 난 마른 풀
    const tuft = (x, y) => { m.strokeStyle = r() < .5 ? "#56644A" : "#6B7556"; m.lineWidth = 4; m.lineCap = "round"; m.beginPath(); for (let k = -2; k <= 2; k++) { m.moveTo(x + k * 4, y); m.quadraticCurveTo(x + k * 7, y - 12, x + k * 9 + (r() - .5) * 6, y - 20 - r() * 10); } m.stroke(); };
    const crack = (x, y, a, n, w) => {
      m.lineCap = "round"; m.lineJoin = "round";
      for (let i = 0; i < n; i++) {
        const L = 26 + r() * 38, nx = x + Math.cos(a) * L, ny = y + Math.sin(a) * L;
        m.strokeStyle = "rgba(160,170,165,.10)"; m.lineWidth = 1.5; m.beginPath(); m.moveTo(x + 2, y + 2); m.lineTo(nx + 2, ny + 2); m.stroke();
        m.strokeStyle = "#141819"; m.lineWidth = Math.max(1.5, w * (1 - i / n)); m.beginPath(); m.moveTo(x, y); m.lineTo(nx, ny); m.stroke();
        if (r() < .22 && i < n - 2) crack(nx, ny, a + (r() < .5 ? -1 : 1) * (.6 + r() * .5), Math.ceil((n - i) / 2), w * .6);
        if (r() < .16) tuft(nx, ny + 4);
        x = nx; y = ny; a += (r() - .5) * .9;
      }
    };
    for (let i = 0; i < 8; i++) crack(A.x0 + 80 + r() * (A.x1 - A.x0 - 160), A.y0 + 60 + r() * (A.y1 - A.y0 - 120), r() * 6.3, 6 + Math.floor(r() * 6), 4);
    // 웅덩이: 달빛이 비친다
    for (const [x, y, rx, ry] of [[1060, 830, 92, 30], [2010, 1020, 112, 34], [1470, 1090, 64, 20], [2230, 770, 56, 18]]) {
      m.fillStyle = "rgba(12,16,20,.5)"; m.beginPath(); m.ellipse(x, y, rx, ry, 0, 0, 7); m.fill();
      const pg = m.createLinearGradient(x - rx, y - ry, x + rx, y + ry); pg.addColorStop(0, "rgba(150,170,196,.16)"); pg.addColorStop(.5, "rgba(150,170,196,.03)"); pg.addColorStop(1, "rgba(150,170,196,.10)");
      m.fillStyle = pg; m.beginPath(); m.ellipse(x, y, rx - 5, ry - 3, 0, 0, 7); m.fill();
      m.strokeStyle = "rgba(198,214,236,.20)"; m.lineWidth = 4; m.beginPath(); m.ellipse(x, y, rx - 6, ry - 4, 0, 3.6, 5.6); m.stroke();
      m.fillStyle = "rgba(220,232,250,.16)"; m.beginPath(); m.ellipse(x - rx * .35, y - ry * .25, rx * .22, ry * .18, 0, 0, 7); m.fill();
    }
    // 무언가 한쪽 발을 끌며 지나간 발자국
    const path = u => [820 + 1560 * u, 1080 - 400 * u + Math.sin(u * 6.3) * 70];
    for (let k = 0, u = 0.02; u < 0.98; k++, u += 0.023) {
      const [x0, y0] = path(u), [x1, y1] = path(u + .01), a = Math.atan2(y1 - y0, x1 - x0), side = k % 2 ? 1 : -1;
      const fx = x0 - Math.sin(a) * 14 * side, fy = y0 + Math.cos(a) * 14 * side;
      m.save(); m.translate(fx, fy); m.rotate(a); m.fillStyle = "rgba(8,11,10,.42)";
      m.beginPath(); m.ellipse(0, 0, 13, 8, 0, 0, 7); m.fill(); m.beginPath(); m.ellipse(14, 0, 6, 6.5, 0, 0, 7); m.fill();
      if (side > 0) { m.strokeStyle = "rgba(8,11,10,.2)"; m.lineWidth = 9; m.lineCap = "round"; m.beginPath(); m.moveTo(-6, 0); m.lineTo(-38, 0); m.stroke(); }
      m.restore();
    }
    m.restore();
    // 잔해: 타이어, 상자, 넘어진 고깔, 흩어진 종이
    const tire = (x, y) => { m.fillStyle = "rgba(0,0,0,.3)"; m.beginPath(); m.ellipse(x + 6, y + 8, 46, 26, 0, 0, 7); m.fill(); m.fillStyle = "#1A1C1F"; m.beginPath(); m.ellipse(x, y, 46, 26, 0, 0, 7); m.fill(); m.fillStyle = "#30353A"; m.beginPath(); m.ellipse(x, y - 2, 22, 11, 0, 0, 7); m.fill(); m.strokeStyle = "#3C4248"; m.lineWidth = 3; m.beginPath(); m.ellipse(x, y, 36, 19, 0, 3.4, 5.9); m.stroke(); };
    const box = (x, y, w, h, a) => { m.save(); m.translate(x, y); m.rotate(a); m.fillStyle = "rgba(0,0,0,.3)"; m.fillRect(-w / 2 + 6, -h / 2 + 8, w, h); m.fillStyle = "#7A6248"; m.fillRect(-w / 2, -h / 2, w, h); m.fillStyle = "#8E7454"; m.fillRect(-w / 2, -h / 2, w, h * .38); m.strokeStyle = "#5C4935"; m.lineWidth = 3; m.beginPath(); m.moveTo(-w / 2, -h / 2 + h * .38); m.lineTo(w / 2, -h / 2 + h * .38); m.moveTo(0, -h / 2); m.lineTo(0, -h / 2 + h * .38); m.stroke(); m.restore(); };
    const cone = (x, y, a) => { m.save(); m.translate(x, y); m.rotate(a); m.fillStyle = "rgba(0,0,0,.28)"; m.beginPath(); m.ellipse(4, 10, 44, 14, 0, 0, 7); m.fill(); m.fillStyle = "#C8642E"; m.beginPath(); m.moveTo(-40, -14); m.lineTo(30, -6); m.lineTo(30, 6); m.lineTo(-40, 14); m.closePath(); m.fill(); m.fillStyle = "#E7E1D2"; m.fillRect(-14, -11, 12, 22); m.fillStyle = "#3A3F44"; m.fillRect(28, -16, 10, 32); m.restore(); };
    tire(930, 1090); tire(985, 1110); box(2300, 1060, 74, 58, .12); box(2370, 1092, 60, 48, -.2); box(2338, 1018, 52, 40, .35); cone(760, 900, .5); cone(2470, 860, -2.6);
    for (let i = 0; i < 16; i++) { m.save(); m.translate(A.x0 + 60 + r() * (A.x1 - A.x0 - 120), A.y0 + 40 + r() * (A.y1 - A.y0 - 80)); m.rotate(r() * 6.3); m.fillStyle = r() < .5 ? "rgba(214,208,192,.42)" : "rgba(170,178,168,.36)"; m.fillRect(-10, -7, 20 + r() * 8, 14); m.restore(); }
    // 위쪽 철망 울타리: 가운데가 찢겨 휘어졌다
    const FY = 600, FH = 108, posts = []; for (let x = 640; x <= 2560; x += 160) posts.push(x);
    m.save(); m.strokeStyle = "rgba(168,180,186,.30)"; m.lineWidth = 2;
    for (let i = 0; i < posts.length - 1; i++) {
      const xa = posts[i], xb = posts[i + 1], torn = xa === 1440 || xa === 1600;
      m.save(); m.beginPath(); m.rect(xa, FY - FH, xb - xa, FH); m.clip(); m.beginPath();
      for (let k = -FH; k < xb - xa + FH; k += 18) {
        if (torn && k > 30 && k < 130) continue;
        m.moveTo(xa + k, FY - FH); m.lineTo(xa + k + FH, FY); m.moveTo(xa + k + FH, FY - FH); m.lineTo(xa + k, FY);
      }
      m.stroke(); m.restore();
      if (torn) { m.strokeStyle = "rgba(168,180,186,.4)"; m.beginPath(); for (let k = 0; k < 5; k++) { m.moveTo(xa + 40 + k * 18, FY - FH + 6); m.quadraticCurveTo(xa + 48 + k * 18, FY - 30, xa + 30 + k * 22, FY - 8 + (k % 2) * 6); } m.stroke(); m.strokeStyle = "rgba(168,180,186,.30)"; }
    }
    m.strokeStyle = "#5E666E"; m.lineWidth = 6; m.beginPath(); m.moveTo(posts[0], FY - FH); m.lineTo(posts.at(-1), FY - FH); m.stroke();
    for (const x of posts) { m.fillStyle = "rgba(0,0,0,.3)"; m.fillRect(x - 3, FY - 4, 14, 10); m.fillStyle = "#6C747C"; m.fillRect(x - 6, FY - FH - 8, 12, FH + 8); m.fillStyle = "#4E555C"; m.fillRect(x + 2, FY - FH - 8, 4, FH + 8); }
    // 출입 금지 띠: 기둥 사이에서 처지고, 찢긴 곳은 늘어져 있다
    const tape = new Path2D(); tape.moveTo(posts[0], FY - 64);
    for (let i = 0; i < posts.length - 1; i++) {
      const xa = posts[i], xb = posts[i + 1];
      if (xa === 1440) { tape.quadraticCurveTo(xa + 30, FY - 10, xa + 50, FY + 24); tape.moveTo(xb + 60, FY + 30); tape.quadraticCurveTo(xb + 120, FY - 20, xb + 160, FY - 64); i++; continue; }
      tape.quadraticCurveTo((xa + xb) / 2, FY - 38, xb, FY - 64);
    }
    m.lineCap = "round"; m.lineWidth = 16; m.strokeStyle = "#D9B533"; m.stroke(tape);
    m.setLineDash([16, 16]); m.lineCap = "butt"; m.strokeStyle = "#26231B"; m.stroke(tape); m.setLineDash([]);
    m.restore();
  }
  async function paintChalk(z) {
    const m = $("map").getContext("2d"), H = ZY[1] - ZY[0], w = ZX[1] - ZX[0];
    // 좀비 모드: 칸은 편이 아니라 생김새만 고르니 파랑·초록 대신 옅은 분필 한 색으로 칠하고 칸 이름을 쓴다
    const CC = z ? { cop: "#E6E0D3", rob: "#E6E0D3", mid: "#C9C2B5", copLine: "#E6E0D3", robLine: "#E6E0D3" } : { cop: "#1C72B8", rob: "#1C8A4B", mid: "#6D6351", copLine: "#1C5F9E", robLine: "#3F444D" };
    m.fillStyle = z ? "rgba(230,224,211,.05)" : "rgba(42,155,239,.045)"; m.fillRect(ZX[0], ZY[0], w, H); m.fillStyle = z ? "rgba(230,224,211,.05)" : "rgba(53,194,107,.045)"; m.fillRect(ZX[2], ZY[0], w, H);
    // 분필은 따로 그려 가루 자국을 낸 뒤 바닥에 얹는다
    const pad = 40, off = document.createElement("canvas"); off.width = ZX[3] - ZX[0] + pad * 2; off.height = H + pad * 2;
    const x = off.getContext("2d"); x.translate(pad - ZX[0], pad - ZY[0]);
    chalkRect(x, CC.cop, ZX[0] + 8, ZY[0] + 10, w - 22, H - 20, 5); chalkRect(x, CC.rob, ZX[2] + 14, ZY[0] + 10, w - 22, H - 20, 11);
    chalkOval(x, CC.mid, 1600, 750, 196, 190, 8);
    chalkArrow(x, CC.cop, ZX[1] + 36, 620, -1, 21); chalkArrow(x, CC.rob, ZX[2] - 36, 620, 1, 22);
    {
      await chalkCharacter(x, "police-front", (ZX[0] + ZX[1]) / 2, 950, 334, CC.copLine, 3);
      await chalkCharacter(x, "robber-front", (ZX[2] + ZX[3]) / 2, 950, 290, CC.robLine, 9);
      chalkQuestion(x, 1600, 640);
    }
    const r = rng(77); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 70000; i++) { x.globalAlpha = .25 + r() * .6; const sz = r() < .86 ? 1.4 : 2.6 + r() * 2; x.fillRect(r() * off.width, r() * off.height, sz, sz * (.6 + r())); }
    x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
    m.globalAlpha = .82; m.drawImage(off, ZX[0] - pad, ZY[0] - pad); m.globalAlpha = 1;
  }

  // 문구는 client/i18n.js. 정해진 말은 번호로 주고받아 보는 사람의 언어로 보인다
  const COPY = {
    code: tt("code"), invite: tt("invite"), copied: tt("copied"), quit: tt("quit"), seats: tt("seats"), copN: tt("cop"), robN: tt("rob"),
    hint: tt("hint"), wait: n => tt("wait", n), full: tt("full"),
    start: tt("start"), needOne: tt("needOne"), needCop: tt("needCop"), needRob: tt("needRob"),
    bots: tt("bots"), bot: tt("bot"), host: tt("host"), me: tt("me"), kick: tt("kick"),
    open: tt("open"), openSub: tt("openSub"), pub: tt("pub"), shrink: tt("shrinkOpt"), shrinkSub: tt("shrinkSub"),
    say: TX.say, isCop: tt("isCop"), isRob: tt("isRob"), guide: tt("guide"),
  };
  const MAX_TOTAL = 8, HOME = { cop: "police", rob: "robber" };
  const ICON = {
    copy: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 6.500V4.200c0-.7.5-1.200 1.200-1.200h7.600c.7 0 1.200.5 1.200 1.200v7.600c0 .7-.5 1.200-1.200 1.200h-2.300"/><rect x="3" y="7" width="10" height="10" rx="1.400"/></svg>`,
    check: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.500l4 4 8-9"/></svg>`,
    guide: `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="currentColor"/><path d="M8.3 6.6c0-.5.5-.8.9-.5l4.6 3.2c.4.3.4.8 0 1.1l-4.6 3.2c-.4.3-.9 0-.9-.5V6.6Z" fill="#fff"/></svg>`,
    say: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.100" stroke-linecap="round" stroke-linejoin="round"><path d="M4.400 5.600c4-1.100 11-1.200 15.200 0 .6 2.700.6 6.300 0 9-2 .6-4.800.8-7.300.8L7.800 19.300l.2-4C6.600 15.200 5.300 15 4.400 14.700c-.6-2.800-.6-6.300 0-9.100Z"/></svg>`,
  };
  let active = false, S = null, pool = [], people = new Map(), bots = [], me = null;
  // 좀비 모드 대기실의 구조차 정류장 표지판(오른쪽 칸 바깥 길가)
  const STOP = { x: 2250, y: 1000 };
  // 공터를 엿보는 눈: 수풀과 어두운 틈에서 가끔 반짝인다
  const EYES = [[860, 672, 0], [2350, 668, 3.1], [1170, 1128, 5.6], [2060, 1140, 1.7], [620, 972, 7.4], [2580, 950, 4.3]];
  let stopEl = null, stopTip = null, moodEl = null, lotEls = [];
  let lob = null, fullEl = null, counts = {}, bumpT = 0, countN = 0, revealed = null, seatsOpen = false, sayOpen = false, moved = false, copied = false, codeDone = false, flash = false;
  const sideAt = x => x < ZX[1] ? "cop" : x > ZX[2] ? "rob" : "any";
  // 좀비 모드 공터에서 사람이 서는 자리: 가운데 둘레로 흩어 선다
  // 뽑기 도중의 시점과 정리(방을 나가면 바로 걷는다)
  let spotCam = null, spotEnd = null;
  // 뽑힌 사람: 스포트라이트가 멈추는 동안 도둥이가 냥파로 변해 간다(판 위와 같은 연출을 0.65초로, client/zombie.js turning)
  function startTurn(p) {
    if (p.turning) return; p.turning = true; p.a.state = "turning";
    for (const c of [p.rigC, p.rigR]) { c.turnAt = performance.now(); c.turnDur = 650; }
  }
  // 그리고 좀비 냥파로 튀어 오른다. 판이 시작되면 게임이 다시 그린다
  function zombify(p) { p.a.state = "free"; p.zRig = rig(p.a, "zcat"); p.zRig.popAt = performance.now(); ZB.sparks(p.a); }
  const lotSpot = i => { const a = i * 2.39996 + 0.6, r = 120 + (i % 4) * 70; return { x: LOT.cx + Math.cos(a) * r * 1.6, y: LOT.cy + Math.sin(a) * r * 0.7 }; };
  const zm = () => S?.mode === "zombie", ZL = () => tt("zb").lobby;
  const capOf = side => zm() ? Infinity : side === "cop" ? S.cops : side === "rob" ? S.robs : Infinity;
  const sayList = () => (zm() ? ZL().say : COPY.say);
  const here = side => [...people.values()].filter(p => p.side === side).length;
  const spotIn = (side, i = 0) => { const z = { cop: [ZX[0], ZX[1]], any: [ZX[1], ZX[2]], rob: [ZX[2], ZX[3]] }[side], cw = (z[1] - z[0] - 60) / 3, col = i % 3, row = Math.floor(i / 3); return { x: z[0] + 30 + cw * (col + .5), y: 775 + (row % 2) * 130 + (col % 2) * 14 }; };
  // 그림 묶음(game.js VIEWS)을 골라 캐릭터를 만든다. 좀비 모드 대기실은 모두 생존자 도둥이로 서고, 뽑힌 사람만 좀비 냥파가 된다
  const rig = (a, kind) => {
    const keep = [a.team, G.mode, G.player], z = kind === "zcat" || kind === "zsurv";
    a.team = kind === "police" || kind === "zcat" ? "police" : "robber"; G.mode = z ? "zombie" : "classic"; G.player = null;
    let c; try { c = makeChar(a); } finally { [a.team, G.mode, G.player] = keep; }
    chars.push(c); return c;
  };
  // 가운데 사람의 회색 모습. 이름으로 정해서 모두의 화면에서 같고, 칸에 들어가기 전에는 바뀌지 않는다
  const lookOf = name => [...String(name)].reduce((h, c) => h * 31 + c.codePointAt(0) | 0, 7) & 1 ? "rob" : "cop";
  function makePerson(name, side, isBot) {
    const a = pool.pop(); a.state = "free"; a.isPlayer = true; a.ix = a.iy = 0; a.stam = 1; a.team = side === "rob" ? "robber" : "police"; a.name = name;
    G.agents.push(a);
    const p = { a, name, side, isBot, rigC: rig(a, zm() ? "zsurv" : "police"), rigR: rig(a, zm() ? "zsurv" : "robber"), tag: document.createElement("div"), say: null, sayT: 0, go: null, morphT: 0, flip: lookOf(name) };
    p.tag.className = "wtag"; world.append(p.tag);
    return p;
  }
  function dropPerson(p) {
    p.rigC.el.remove(); p.rigR.el.remove(); p.zRig?.el.remove(); p.tag.remove(); if (p.say) p.say.remove();
    chars = chars.filter(c => c !== p.rigC && c !== p.rigR && c !== p.zRig); G.agents = G.agents.filter(a => a !== p.a); pool.push(p.a);
  }
  function renderTag(p) {
    const mine = p === me;
    // 좀비 모드의 칸은 편이 아니라 생김새라 이름표를 경찰 파랑, 도둑 초록으로 칠하지 않는다
    p.tag.className = `wtag ${mine ? "me " + (p.side === "any" || zm() ? "" : p.side) : ""} ${p.isBot ? "bot" : ""}`;
    p.tag.textContent = p.isBot ? COPY.bot : nameOf(p.name);
    const add = t => { const e = document.createElement("em"); e.textContent = t; p.tag.append(e); };
    if (p.hostMark) add(COPY.host);
    if (mine) add(COPY.me);
  }
  // 전환: 납작해졌다가 가루가 피어오르며 튀어나오고, 회색에서 색이 차오른다
  function morph(p, side) {
    const a = p.a, col = side === "cop" ? "#2A9BEF" : side === "rob" ? "#35C26B" : "#BDB19B";
    burst(a.x, a.y - 24, col, side === "any" ? 8 : 16); burst(a.x, a.y - 6, "#F8F4EB", 6);
    // 칸에 들어가면 그 캐릭터가 되고, 가운데로 돌아오면 마지막 모습 그대로 회색이 된다
    p.morphT = .4; if (side !== "any") p.flip = side;
    (side === "rob" ? p.rigR : side === "cop" ? p.rigC : (p.flip === "rob" ? p.rigR : p.rigC)).pop.x = side === "any" ? -.18 : -.42;
  }
  function saying(p, t) { if (p.say) p.say.remove(); const e = document.createElement("div"); e.className = "wsay"; e.textContent = t; e.style.zIndex = 4000; world.append(e); p.say = e; p.sayT = 2.6; }
  function placeBots() {
    bots.forEach(dropPerson); bots = [];
    if (!S.bots) return;
    let c = Math.max(0, S.cops - here("cop")), r = Math.max(0, S.robs - here("rob")), a = here("any");
    const ur = Math.min(a, r); r -= ur; a -= ur; c -= Math.min(a, c);
    if (zm()) { const n = Math.max(0, S.cops + S.robs - people.size); c = Math.ceil(n / 2); r = n - c; }
    const add = (side, n, from) => { for (let i = 0; i < n; i++) { const p = makePerson(COPY.bot, side, true), sp = zm() ? lotSpot(people.size + bots.length) : spotIn(side, from + i); p.a.x = sp.x; p.a.y = sp.y; bots.push(p); renderTag(p); } };
    add("cop", c, here("cop")); add("rob", r, here("rob"));
  }
  const startState = () => { const c = here("cop"), r = here("rob"), a = here("any"), n = people.size; if (zm() && (S.bots || n >= 2)) return { ok: true, why: ZL().draw }; if (S.bots) return { ok: true }; if (n < 2) return { ok: false, why: COPY.needOne }; if (c + a === 0) return { ok: false, why: COPY.needCop }; if (r + a === 0) return { ok: false, why: COPY.needRob }; return { ok: true }; };
  const stepBtn = (side, d) => { const total = S.cops + S.robs, cur = side === "cop" ? S.cops : S.robs, off = d > 0 ? total >= MAX_TOTAL : (cur <= 1 || total - 1 < people.size), nm = side === "cop" ? COPY.copN : COPY.robN; return `<button class="step" data-act="n-${side}-${d}" aria-disabled="${off}" aria-label="${tt(d > 0 ? "addOne" : "removeOne", nm)}"><i>${d > 0 ? "+" : "−"}</i></button>`; };
  function renderHud() {
    if (!active) return;
    const st = startState(), total = S.cops + S.robs, n = people.size, alone = n === 1 && !S.bots, hostName = [...people.values()].find(p => p.hostMark)?.name || "";
    const line = !moved ? (zm() ? ZL().hint : COPY.hint) : (S.host ? "" : COPY.wait(""));
    let h = `<div class="row1"><div class="lp code${zm() ? " zroom" : ""}">${zm() ? `<img class="zIcon" src="${ZB.url("zcat-front")}" alt="">` : ""}<div><small>${COPY.code}<b>${n}/${total}</b>${S.open ? `<em class="pub">${COPY.pub}</em>` : ""}${S.shrink ? `<em class="zoneTag">${COPY.shrink}</em>` : ""}${zm() ? `<em class="zTag">${tt("modes").name.zombie}</em>` : ""}</small><strong>${net.room}</strong></div><button class="icon" data-act="copycode" aria-label="${tt("copyCode")}">${codeDone ? ICON.check : ICON.copy}</button></div>
      <button class="bt ${S.host && alone ? "main" : ""}" data-act="invite">${copied ? COPY.copied : COPY.invite}</button>
      <button class="bt ic" data-act="say" aria-label="${tt("sayOpen")}" aria-expanded="${sayOpen}">${ICON.say}</button>
      <button class="bt guideBt" data-act="guide" aria-label="${COPY.guide}">${ICON.guide}<span>${COPY.guide}</span></button>
      <div class="grow">${line ? `<div class="line" data-line></div>` : ""}</div>
      ${S.host ? `<button class="bt" data-act="seats" aria-expanded="${seatsOpen}">${COPY.seats}</button>` : ""}
      <button class="bt quiet" data-act="quit">${COPY.quit}</button></div>`;
    const totStep = d => { const off = d > 0 ? total >= MAX_TOTAL : total - 1 < Math.max(2, people.size); return `<button class="step" data-act="tot-${d}" aria-disabled="${off}" aria-label="${tt(d > 0 ? "addOne" : "removeOne", ZL().people)}"><i>${d > 0 ? "+" : "−"}</i></button>`; };
    if (seatsOpen && S.host) h += `<div class="lp sheetR">
      ${zm() ? `<div class="srow"><span class="nm">${ZL().people}</span>${totStep(-1)}<span class="num">${total}</span>${totStep(1)}</div>` : `<div class="srow cop"><span class="nm">${COPY.copN}</span>${stepBtn("cop", -1)}<span class="num">${S.cops}</span>${stepBtn("cop", 1)}</div>
      <div class="srow rob"><span class="nm">${COPY.robN}</span>${stepBtn("rob", -1)}<span class="num">${S.robs}</span>${stepBtn("rob", 1)}</div>`}
      <div class="srow"><button class="switch" role="switch" data-act="bots" aria-checked="${S.bots}"><span>${COPY.bots}</span><i></i></button></div>
      <div class="srow tall"><button class="switch" role="switch" data-act="shrink" aria-checked="${!!S.shrink}"><span>${COPY.shrink}<small>${COPY.shrinkSub}</small></span><i></i></button></div>
      <div class="srow tall"><button class="switch" role="switch" data-act="open" aria-checked="${!!S.open}"><span>${COPY.open}<small>${COPY.openSub}</small></span><i></i></button></div>
      ${S.players.slice(1).map(p => `<div class="srow kick"><span class="nm" data-name="${p.id}"></span><button class="bt quiet" data-act="kick-${p.id}">${COPY.kick}</button></div>`).join("")}</div>`;
    if (sayOpen) h += `<div class="lp tray">${sayList().map((t, i) => `<button data-act="said-${i}">${t}</button>`).join("")}</div>`;
    // 좀비 모드는 시작할 수 있을 때도 다음에 일어날 일(첫 좀비 뽑기)을 한 줄로 말해 준다
    if (S.host) { h += `<button id="startBtn" class="${flash ? "shake" : ""}" data-act="start" aria-disabled="${!st.ok}">${COPY.start}</button>`; if (!st.ok || st.why) h += `<div class="why ${flash ? "flash" : ""} ${st.ok ? "next" : ""}">${st.why}</div>`; }
    if (countN) h += `<div class="count3">${countN}</div>`;
    const focus = lob.contains(document.activeElement) ? document.activeElement.dataset.act : null;
    // 누가 들어오거나 인원을 바꿀 때마다 새로 그린다. 방장 설정 창을 내려 둔 자리는 지킨다
    const keepScroll = lob.querySelector(".sheetR")?.scrollTop ?? 0;
    lob.innerHTML = h;
    const sheet = lob.querySelector(".sheetR"); if (sheet) sheet.scrollTop = keepScroll;
    lob.querySelectorAll("[data-name]").forEach(e => { e.textContent = nameOf(S.players.find(p => p.id === e.dataset.name)?.name ?? ""); });
    const lineEl = lob.querySelector("[data-line]"); if (lineEl) lineEl.textContent = !moved ? (zm() ? ZL().hint : COPY.hint) : COPY.wait(nameOf(hostName));
    if (focus) { const b = lob.querySelector(`[data-act="${focus}"]`); if (b) b.focus({ preventScroll: true }); }
    for (const side of ["cop", "rob"]) { const e = counts[side]; if (!e) continue; const cur = here(side), cap = capOf(side); e.textContent = cap === Infinity ? `${cur}` : `${cur}/${cap}`; e.className = "wcount" + (cur >= cap ? " full" : ""); }
  }
  const later = (fn, ms) => setTimeout(() => { fn(); renderHud(); }, ms);
  function onClick(e) {
    const b = e.target.closest("[data-act]"); if (!b) return; const a = b.dataset.act;
    const seat = /^n-(cop|rob)-(-?1)$/.exec(a);
    if (seat) { if (b.getAttribute("aria-disabled") === "true") return; const d = Number(seat[2]); net.send({ t: "seats", cops: S.cops + (seat[1] === "cop" ? d : 0), robs: S.robs + (seat[1] === "rob" ? d : 0), bots: S.bots }); return; }
    if (a.startsWith("kick-")) { net.kick(a.slice(5)); return; }
    if (a === "bots") { net.send({ t: "seats", cops: S.cops, robs: S.robs, bots: !S.bots }); return; }
    // 놀이 방식은 방을 만들 때만 정한다. 좀비 모드의 인원은 한 칸(cops 1 + robs 나머지)으로 보낸다
    const tot = /^tot-(-?1)$/.exec(a);
    if (tot) { if (b.getAttribute("aria-disabled") === "true") return; const n = S.cops + S.robs + Number(tot[1]); net.send({ t: "seats", cops: 1, robs: n - 1, bots: S.bots }); return; }
    if (a === "open") { net.send({ t: "seats", cops: S.cops, robs: S.robs, bots: S.bots, open: !S.open }); return; }
    if (a === "shrink") { net.send({ t: "seats", cops: S.cops, robs: S.robs, bots: S.bots, shrink: !S.shrink }); return; }
    if (a === "seats") { seatsOpen = !seatsOpen; return renderHud(); }
    if (a === "say") { sayOpen = !sayOpen; return renderHud(); }
    if (a.startsWith("said-")) { sayOpen = false; net.send({ t: "say", i: +a.slice(5) }); return renderHud(); }
    if (a === "copycode") { navigator.clipboard?.writeText(net.room).catch(() => {}); codeDone = true; renderHud(); later(() => codeDone = false, 1800); return; }
    if (a === "invite") return net.invite(() => { copied = true; renderHud(); later(() => copied = false, 1800); });
    if (a === "quit") return net.quit();
    if (a === "guide") { seatsOpen = sayOpen = false; return net.guide(b); }
    if (a === "start") { if (!startState().ok) { flash = true; renderHud(); later(() => flash = false, 420); return; } net.send({ t: "start" }); }
  }
  function bump(side) { bumpT = 1.4; fullEl.style.display = ""; fullEl.style.transform = `translate(${(side === "cop" ? ZX[1] - 170 : ZX[2] + 170) - 130}px,${me.a.y - 170}px)`; }

  const scene = {
    get active() { return active; },
    enter(m) {
      active = true; revealed = null; countN = 0; moved = false;
      document.body.classList.add("lobby-mode");
      chars.forEach(c => c.el.remove()); chars = [];
      // 지난 판의 장면(MVP 공개 등)이 남아 있으면 걷는다. 대기실에서는 시작 장면을 띄우지 않는다(game.js drawHud)
      Scenes.reset();
      const z = m.mode === "zombie", theme = z ? "zombie" : "town", MAP = z ? ZOMBIE_LOBBY_MAP : LOBBY_MAP;
      // 좀비 지도는 좀비 판에서만 고르게 되어 있어(newGame) 대기실은 테마를 직접 입힌다
      G = newGame({ seed: 11, theme, role: "police", police: 4, robbers: 4 }); G.theme = theme; G.th = THEMES[theme];
      L.loadMap(MAP); G.map = MAP; CFG.WAIT = 1e9; G.phase = "wait"; G.nextReveal = 1e9; role = "police"; ended = false;
      pool = [...G.agents]; G.agents = []; G.events.length = 0; people = new Map(); bots = []; me = null; G.player = pool[0];
      document.querySelectorAll(".bush").forEach(n => n.remove());
      bakeMap(); if (z) paintLot(); else paintChalk(z); bakeBushes(); bakeMini();
      stage.style.background = G.th.ground; document.body.dataset.theme = theme; document.body.dataset.lobbyMode = z ? "zombie" : "classic";
      // 구조차 정류장 표지판: 다가가면 규칙 한 줄이 뜬다
      stopEl = null; if (z) {
        stopEl = document.createElement("div"); stopEl.className = "wstop"; stopEl.innerHTML = `<em></em><b><svg viewBox="0 0 40 24" aria-hidden="true"><path d="M3 6h21v12H3zM24 10h8l5 5v3H24z"/><circle cx="10" cy="19" r="3.4"/><circle cx="30" cy="19" r="3.4"/></svg><span></span></b><i></i>`;
        stopEl.querySelector("span").textContent = tt("zb").lobby.stop; stopEl.style.transform = `translate(${STOP.x - 90}px,${STOP.y - 210}px)`; stopEl.style.zIndex = STOP.y; world.append(stopEl);
        // 흔들리는 가로등 빛 한 웅덩이와 엿보는 눈들. 바닥 위, 사람 아래에 깐다
        const pool = document.createElement("div"); pool.className = "zPool"; pool.style.transform = `translate(${LOT.cx - 620}px,${LOT.cy - 300}px)`; world.append(pool); lotEls.push(pool);
        for (const [x, y, d] of EYES) { const e = document.createElement("div"); e.className = "zEyes"; e.innerHTML = "<i></i><i></i>"; e.style.transform = `translate(${x - 22}px,${y - 10}px)`; e.style.animationDelay = `-${d}s`; e.style.zIndex = y + 40; world.append(e); lotEls.push(e); }
      }
      if (!z) for (const side of ["cop", "rob"]) { const e = document.createElement("div"); e.style.left = ((side === "cop" ? ZX[0] : ZX[2]) + 34) + "px"; e.style.top = (ZY[0] + 26) + "px"; world.append(e); counts[side] = e; }
      fullEl = document.createElement("div"); fullEl.className = "wfull"; fullEl.textContent = COPY.full; fullEl.style.display = "none"; fullEl.style.zIndex = 5000; world.append(fullEl);
      lob = document.createElement("div"); lob.id = "lob"; $("hud").append(lob); lob.addEventListener("click", onClick);
      // 좀비 공터의 밤 기운: 가장자리를 어둡게 누르고 낮은 안개가 천천히 흐른다(화면 위 겹, 누르기를 막지 않는다)
      moodEl?.remove(); moodEl = null; if (z) { moodEl = document.createElement("div"); moodEl.className = "zMood"; moodEl.innerHTML = "<i></i><i></i><i></i>"; $("hud").prepend(moodEl); }
      $("start").className = "sheet"; $("end").className = "sheet"; $("hud").className = "show"; $("banner").className = ""; $("toast").className = "";
      camTarget = z ? p => { if (spotCam) return spotCam(); const vw = W / zoom, vh = H / zoom, ax0 = LOT.x0 - 260, ax1 = LOT.x1 + 260, ay = LOT.cy - 24; return [vw >= ax1 - ax0 ? (ax0 + ax1 - vw) / 2 : clamp(p.x - vw / 2, ax0, ax1 - vw), ay - vh / 2]; } : p => { const vw = W / zoom, vh = H / zoom, ax0 = ZX[0] - 40, ax1 = ZX[3] + 40, ay = (ZY[0] + ZY[1]) / 2 + 6; return [vw >= ax1 - ax0 ? (ax0 + ax1 - vw) / 2 : clamp(p.x - vw / 2, ax0, ax1 - vw), ay - vh / 2]; };
      scene.update(m);
      const [cx0, cy0] = camTarget(G.player); camX = cx0; camY = cy0;
      syncRotate();
    },
    update(m) {
      if (S && (S.mode || "classic") !== (m.mode || "classic")) {
        if (!m.host) toast(tt("zb").lobby.changed[m.mode || "classic"], m.mode === "zombie" ? "zomb" : "");
        const open = seatsOpen; scene.leave(); scene.enter(m); seatsOpen = open; renderHud(); return;
      }
      S = m;
      const ids = new Set(m.players.map(p => p.id));
      for (const [id, p] of people) if (!ids.has(id)) { dropPerson(p); people.delete(id); }
      m.players.forEach((info, i) => {
        let p = people.get(info.id);
        if (!p) {
          p = makePerson(info.name, info.side, false); people.set(info.id, p);
          const sp = zm() ? lotSpot(people.size - 1) : spotIn(info.side, here(info.side) - 1); p.a.x = sp.x; p.a.y = sp.y;
          if (info.id === m.you) { me = p; G.player = p.a; }
          if (p.a !== G.player) p.a.isPlayer = true;
        }
        p.hostMark = i === 0;
        if (p.side !== info.side) {
          p.side = info.side; p.a.team = info.side === "rob" ? "robber" : "police";
          // 칸을 옮긴 사람은 그 칸으로 걸어간다. 내 움직임은 내 폰에서 처리하니 밀려났을 때만 옮긴다
          if (!zm() && (p !== me || sideAt(p.a.x) !== info.side)) { const sp = spotIn(info.side, here(info.side) - 1); if (p === me) { p.a.x = sp.x; p.a.y = sp.y; } else p.go = sp; }
          morph(p, info.side);
        }
        renderTag(p);
      });
      placeBots(); renderHud();
    },
    refused(side) { if (!me) return; me.side = side; me.a.team = side === "rob" ? "robber" : "police"; renderTag(me); renderHud(); },
    say(id, i) { const p = people.get(id), list = sayList(); if (p && list[i]) saying(p, list[i]); },
    count(ms) { seatsOpen = sayOpen = false; countN = Math.round(ms / 1000); renderHud(); const t = setInterval(() => { countN--; if (countN <= 0) { countN = 0; clearInterval(t); } renderHud(); }, 1000); },
    cant() { flash = true; renderHud(); later(() => flash = false, 420); },
    reveal(team) { const side = team === "robber" ? "rob" : "cop"; revealed = side; countN = 0; renderHud(); if (me && me.side === "any") { me.side = side; morph(me, side); } document.body.dataset.role = team; role = team; banner("", side === "rob" ? COPY.isRob : COPY.isCop); },
    // 좀비 뽑기(docs/zombie.md "좀비 뽑기"), 모두 약 5초(서버 ZOMBIE_DRAW_SEC 와 같게): 불이 꺼지고, 위에서 내리꽂는 탐조등이 사람 사이를 옮겨 다니다 점점 느려지고,
    // 한 사람 옆에 들렀다 돌아와 멈춘다. 두어 번 깜빡인 뒤 초록 빛으로 바뀌며 그 사람이 좀비 모습이 된다. 소리: 꺼짐, 딸깍, 쾅과 으르렁
    spotlight(names, done) {
      const all = [...people.values(), ...bots], quiet = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const target = all.find(p => names.includes(p.name)) || all[0];
      if (!lob || !target) { done(); return; }
      seatsOpen = sayOpen = false; countN = 0; renderHud(); lob.classList.add("drawing");
      const box = document.createElement("div"); box.className = "zSpot"; box.innerHTML = `<canvas></canvas><div class="zSpotTx"><small></small><b></b></div>`; lob.append(box);
      box.querySelector("small").textContent = tt("zb").lobby.drawLead; const nameEl = box.querySelector("b");
      const cv = box.querySelector("canvas"), dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const c = cv.getContext("2d"); c.scale(dpr, dpr);
      // 옮겨 다닐 순서: 왼쪽부터 훑되 가끔 하나를 건너뛰고, 간격이 점점 벌어진다. 마지막엔 뽑힌 사람 옆에 들렀다 돌아온다
      const order = all.slice().sort((p, q) => p.a.x - q.a.x), hops = [];
      let at = 0.4, gap = 0.12, i = Math.floor(Math.random() * order.length);
      if (!quiet) while (gap < 0.4) { hops.push({ t: at, p: order[i % order.length] }); i += Math.random() < 0.3 ? 2 : 1; at += gap; gap *= 1.2; }
      const near = order[(order.indexOf(target) + 1) % order.length];
      if (order.length > 1 && !quiet) { if (hops.at(-1)?.p === target) hops.at(-1).p = near; hops.push({ t: at, p: target }); at += 0.36; hops.push({ t: at, p: near }); at += 0.4; }
      hops.push({ t: at, p: target });
      const LAND = at + 0.35, motes = Array.from({ length: 34 }, () => ({ u: Math.random(), v: Math.random() * 2 - 1, s: 0.05 + Math.random() * 0.08, r: 0.6 + Math.random() * 1.6 }));
      const sp = { x: W / 2, y: H * 0.62, vx: 0, vy: 0 };
      let hop = null, revealed = false, closing = 0, last = performance.now(), revealT = 0;
      const t0 = last, z0 = zoom;
      play("zDark"); haptic(30);
      // 뽑히면 그 사람을 화면 가운데로 천천히 당긴다
      spotCam = () => { const vw = W / zoom, vh = H / zoom, p = revealed ? target : null; return p ? [p.a.x - vw / 2, p.a.y - 70 - vh / 2] : [clamp(G.player.x - vw / 2, LOT.x0 - 260, LOT.x1 + 260 - vw), LOT.cy - vh / 2]; };
      const draw = (x, y, on, green, dark, dt) => {
        c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, W, H); c.fillStyle = `rgba(5,4,10,${dark})`; c.fillRect(0, 0, W, H);
        if (!on) return;
        const z = zoom, rx = 104 * z, ry = 34 * z, ox = W / 2 + (x - W / 2) * 0.3, oy = -40, top = 16;
        const cone = new Path2D(); cone.moveTo(ox - top, oy); cone.lineTo(x - rx, y); cone.ellipse(x, y, rx, ry, 0, Math.PI, 0, true); cone.lineTo(ox + top, oy); cone.closePath();
        const col = green ? "176,255,136" : "255,238,196";
        // 빛이 닿은 곳만 어둠을 걷어 낸다: 빛 기둥, 사람 몸, 바닥 동그라미
        c.globalCompositeOperation = "destination-out";
        let g = c.createLinearGradient(0, oy, 0, y); g.addColorStop(0, "rgba(0,0,0,.22)"); g.addColorStop(1, "rgba(0,0,0,.7)"); c.fillStyle = g; c.fill(cone);
        c.save(); c.translate(x, y - 58 * z); c.scale(1, 1.45); g = c.createRadialGradient(0, 0, 0, 0, 0, 62 * z); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(.7, "rgba(0,0,0,.85)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 62 * z, 0, 7); c.fill(); c.restore();
        c.save(); c.translate(x, y); c.scale(1, ry / rx); g = c.createRadialGradient(0, 0, 0, 0, 0, rx * 1.15); g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(.75, "rgba(0,0,0,.9)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx * 1.15, 0, 7); c.fill(); c.restore();
        // 빛 기둥의 색과 떠다니는 먼지, 바닥에 고인 빛
        c.globalCompositeOperation = "lighter";
        g = c.createLinearGradient(0, oy, 0, y); g.addColorStop(0, `rgba(${col},.02)`); g.addColorStop(1, `rgba(${col},${green ? .2 : .13})`); c.fillStyle = g; c.fill(cone);
        c.save(); c.translate(x, y); c.scale(1, ry / rx); g = c.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(${col},${green ? .34 : .24})`); g.addColorStop(1, `rgba(${col},0)`); c.fillStyle = g; c.beginPath(); c.arc(0, 0, rx, 0, 7); c.fill(); c.restore();
        c.fillStyle = `rgba(${col},.55)`;
        for (const m of motes) {
          m.u = (m.u + m.s * dt) % 1;
          const u = m.u, hw = top + (rx - top) * u, mx = ox + (x - ox) * u + m.v * hw * .8, my = oy + (y - oy) * u;
          c.globalAlpha = Math.sin(u * Math.PI) * .7; c.beginPath(); c.arc(mx, my, m.r, 0, 7); c.fill();
        }
        c.globalAlpha = 1;
      };
      const reveal = () => {
        revealed = true; revealT = (performance.now() - t0) / 1000; zombify(target);
        nameEl.textContent = nameOf(target.name); box.classList.add("land");
        burst(target.a.x, target.a.y - 50, "#6EB69B", 26); burst(target.a.x, target.a.y - 20, "#B6FF8A", 12);
        play("zSpot"); haptic([0, 90, 50, 160]); shake = 9;
      };
      const finish = () => { spotEnd = null; spotCam = null; zoom = z0; box.remove(); lob?.classList.remove("drawing"); };
      spotEnd = finish;
      const tick = now => {
        if (!box.isConnected) return;
        const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
        const h = hops.filter(x => x.t <= t).at(-1);
        if (h && h !== hop) { const first = !hop; hop = h; if (t < LAND) play("zSweep", h.p === target ? 0.92 : 1); if (first) { const [gx, gy] = toScreen(h.p.a.x, h.p.a.y + 4); sp.x = gx; sp.y = gy; } }
        const [gx, gy] = hop ? toScreen(hop.p.a.x, hop.p.a.y + 4) : [sp.x, sp.y];
        // 용수철처럼 따라가 살짝 넘쳤다 돌아온다
        const k = 120, d = 2 * Math.sqrt(k) * 0.72;
        sp.vx += ((gx - sp.x) * k - sp.vx * d) * dt; sp.vy += ((gy - sp.y) * k - sp.vy * d) * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt;
        const dark = closing ? Math.max(0, .9 - (t - closing) / 0.35 * .9) : Math.min(.9, t / 0.25 * .9);
        // 처음 켜질 때와 멈출 때 형광등처럼 깜빡인다
        const L = t - LAND, flick = (t > 0.46 && t < 0.52) || (L > 0 && L < 0.07) || (L > 0.13 && L < 0.25);
        const on = t >= 0.4 && !flick;
        if (t >= hops.at(-1).t && !quiet) startTurn(target);
        if (L >= 0.25 && !revealed) reveal();
        // 멈추면 화면이 좀비 쪽으로 천천히 다가가고, 끝날 때 원래대로 돌아온다
        if (revealed) { const k = Math.min(1, (t - revealT) / 0.6), back = closing ? Math.min(1, (t - closing) / 0.35) : 0; zoom = z0 * (1 + 0.38 * (1 - (1 - k) ** 3) * (1 - back)); }
        draw(sp.x, sp.y, on, revealed, dark, dt);
        if (revealed && L > 1.55 && !closing) closing = t;
        if (closing && t - closing > 0.36) { finish(); done(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    leave() {
      active = false; camTarget = null; document.body.classList.remove("lobby-mode");
      for (const p of [...people.values(), ...bots]) dropPerson(p);
      people = new Map(); bots = []; me = null;
      Object.values(counts).forEach(e => e.remove()); counts = {}; if (fullEl) fullEl.remove(); if (lob) lob.remove(); lob = null;
      stopEl?.remove(); stopEl = null; stopTip?.remove(); stopTip = null; moodEl?.remove(); moodEl = null; lotEls.forEach(e => e.remove()); lotEls = []; spotEnd?.();
      // 다시 들어올 때 지난 방 설정과 견주지 않게 비운다(모드를 바꾸면 나갔다 다시 들어온다)
      S = null;
    },
    step(dt) {
      for (const p of people.values()) {
        if (p === me || !p.go) continue;
        const dx = p.go.x - p.a.x, dy = p.go.y - p.a.y, d = Math.hypot(dx, dy);
        if (d < 14) { p.a.ix = p.a.iy = 0; p.go = null; } else { p.a.ix = dx / d; p.a.iy = dy / d; }
      }
      step(G, dt);
      if (bumpT > 0) { bumpT -= dt; if (bumpT <= 0) fullEl.style.display = "none"; }
      if (!me) return;
      const A = zm() ? LOT : WALK;
      const a = me.a; a.x = clamp(a.x, A.x0, A.x1); a.y = clamp(a.y, A.y0, A.y1);
      for (const p of people.values()) { p.a.x = clamp(p.a.x, A.x0, A.x1); p.a.y = clamp(p.a.y, A.y0, A.y1); }
      if ((a.ix || a.iy) && !moved) { moved = true; renderHud(); }
      if (stopEl) {
        const near = Math.hypot(a.x - STOP.x, a.y - STOP.y) < 260;
        if (near && !stopTip) { stopTip = document.createElement("div"); stopTip.className = "wsay tip"; stopTip.textContent = tt("zb").lobby.stopTip; stopTip.style.zIndex = 4000; stopTip.style.transform = `translate(calc(${STOP.x}px - 50%),${STOP.y - 300}px)`; world.append(stopTip); }
        if (!near && stopTip) { stopTip.remove(); stopTip = null; }
      }
      if (zm()) return;
      const side = sideAt(a.x);
      if (side === me.side || countN) return;
      // 경계에서 깜빡이지 않게 칸 안쪽으로 조금 더 들어가야 바뀐다
      if (here(side) >= capOf(side)) { a.x = side === "cop" ? ZX[1] + 3 : ZX[2] - 3; a.vx = 0; if (bumpT <= 0) bump(side); return; }
      if (Math.min(Math.abs(a.x - ZX[1]), Math.abs(a.x - ZX[2])) < 20) return;
      me.side = side; a.team = side === "rob" ? "robber" : "police"; morph(me, side); renderTag(me);
      document.body.dataset.role = side === "rob" ? "robber" : "police";
      net.send({ t: "side", side }); placeBots(); renderHud();
    },
    after(dt) {
      if (!active) return;
      for (const p of [...people.values(), ...bots]) {
        const a = p.a;
        const look = p.side === "any" ? p.flip : p.side;
        if (p.morphT > 0) p.morphT -= dt;
        const grey = (p.side === "any" && !zm()) || p.morphT > .26;
        p.rigC.el.style.display = look === "cop" && !p.zRig ? "" : "none"; p.rigR.el.style.display = look === "rob" && !p.zRig ? "" : "none";
        p.rigC.el.classList.toggle("shade", grey); p.rigR.el.classList.toggle("shade", grey);
        p.rigC.el.classList.toggle("botc", p.isBot); p.rigR.el.classList.toggle("botc", p.isBot);
        p.tag.style.transform = `translate(calc(${a.x}px - 50%),${a.y - 132}px)`; p.tag.style.zIndex = Math.round(a.y) + 1;
        if (p.say) { p.say.style.transform = `translate(calc(${a.x}px - 50%),${a.y - 216}px)`; p.sayT -= dt; if (p.sayT <= 0) { p.say.remove(); p.say = null; } }
      }
    },
  };
  return scene;
}
