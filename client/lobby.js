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
  async function paintChalk() {
    const m = $("map").getContext("2d"), H = ZY[1] - ZY[0], w = ZX[1] - ZX[0];
    m.fillStyle = "rgba(42,155,239,.045)"; m.fillRect(ZX[0], ZY[0], w, H); m.fillStyle = "rgba(53,194,107,.045)"; m.fillRect(ZX[2], ZY[0], w, H);
    // 분필은 따로 그려 가루 자국을 낸 뒤 바닥에 얹는다
    const pad = 40, off = document.createElement("canvas"); off.width = ZX[3] - ZX[0] + pad * 2; off.height = H + pad * 2;
    const x = off.getContext("2d"); x.translate(pad - ZX[0], pad - ZY[0]);
    chalkRect(x, "#1C72B8", ZX[0] + 8, ZY[0] + 10, w - 22, H - 20, 5); chalkRect(x, "#1C8A4B", ZX[2] + 14, ZY[0] + 10, w - 22, H - 20, 11);
    chalkOval(x, "#6D6351", 1600, 750, 196, 190, 8);
    chalkArrow(x, "#1C72B8", ZX[1] + 36, 620, -1, 21); chalkArrow(x, "#1C8A4B", ZX[2] - 36, 620, 1, 22);
    {
      await chalkCharacter(x, "police-front", (ZX[0] + ZX[1]) / 2, 950, 334, "#1C5F9E", 3);
      await chalkCharacter(x, "robber-front", (ZX[2] + ZX[3]) / 2, 950, 290, "#3F444D", 9);
      chalkQuestion(x, 1600, 640);
    }
    const r = rng(77); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 70000; i++) { x.globalAlpha = .25 + r() * .6; const sz = r() < .86 ? 1.4 : 2.6 + r() * 2; x.fillRect(r() * off.width, r() * off.height, sz, sz * (.6 + r())); }
    x.globalCompositeOperation = "source-over"; x.globalAlpha = 1;
    m.globalAlpha = .82; m.drawImage(off, ZX[0] - pad, ZY[0] - pad); m.globalAlpha = 1;
  }

  const COPY = {
    code: "방 코드", invite: "친구 부르기", copied: "링크를 복사했어요", quit: "나가기", seats: "인원", copN: "경찰", robN: "도둑",
    hint: "하고 싶은 편으로 걸어가요", wait: n => `${n} 님이 시작하면 바로 넘어가요`, full: "자리가 다 찼어요",
    start: "시작하기", needOne: "친구가 오거나 봇을 켜면 시작할 수 있어요", needCop: "경찰이 한 명은 있어야 해요", needRob: "도둑이 한 명은 있어야 해요",
    bots: "빈자리 봇으로 채우기", bot: "봇", host: "방장", me: "나", kick: "내보내기",
    open: "공개 방", openSub: "열린 방 목록에 보여요", pub: "공개",
    say: ["시작할까요", "잠깐만요", "경찰 하고 싶어요", "도둑 하고 싶어요", "친구 부르고 있어요"], isCop: "경찰이에요", isRob: "도둑이에요",
  };
  const MAX_TOTAL = 8, HOME = { cop: "police", rob: "robber" };
  const ICON = {
    copy: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M7 6.500V4.200c0-.7.5-1.200 1.200-1.200h7.600c.7 0 1.200.5 1.200 1.200v7.600c0 .7-.5 1.200-1.200 1.200h-2.300"/><rect x="3" y="7" width="10" height="10" rx="1.400"/></svg>`,
    check: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.400" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.500l4 4 8-9"/></svg>`,
    say: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.100" stroke-linecap="round" stroke-linejoin="round"><path d="M4.400 5.600c4-1.100 11-1.200 15.200 0 .6 2.700.6 6.300 0 9-2 .6-4.800.8-7.300.8L7.800 19.300l.2-4C6.600 15.200 5.300 15 4.400 14.700c-.6-2.800-.6-6.300 0-9.100Z"/></svg>`,
  };
  let active = false, S = null, pool = [], people = new Map(), bots = [], me = null;
  let lob = null, fullEl = null, counts = {}, bumpT = 0, countN = 0, revealed = null, seatsOpen = false, sayOpen = false, moved = false, copied = false, codeDone = false, flash = false;
  const sideAt = x => x < ZX[1] ? "cop" : x > ZX[2] ? "rob" : "any";
  const capOf = side => side === "cop" ? S.cops : side === "rob" ? S.robs : Infinity;
  const here = side => [...people.values()].filter(p => p.side === side).length;
  const spotIn = (side, i = 0) => { const z = { cop: [ZX[0], ZX[1]], any: [ZX[1], ZX[2]], rob: [ZX[2], ZX[3]] }[side], cw = (z[1] - z[0] - 60) / 3, col = i % 3, row = Math.floor(i / 3); return { x: z[0] + 30 + cw * (col + .5), y: 775 + (row % 2) * 130 + (col % 2) * 14 }; };
  const rig = (a, kind) => { const t = a.team, pl = G.player; a.team = kind; G.player = null; const c = makeChar(a); a.team = t; G.player = pl; chars.push(c); return c; };
  // 가운데 사람의 회색 모습. 이름으로 정해서 모두의 화면에서 같고, 칸에 들어가기 전에는 바뀌지 않는다
  const lookOf = name => [...String(name)].reduce((h, c) => h * 31 + c.codePointAt(0) | 0, 7) & 1 ? "rob" : "cop";
  function makePerson(name, side, isBot) {
    const a = pool.pop(); a.state = "free"; a.isPlayer = true; a.ix = a.iy = 0; a.stam = 1; a.team = side === "rob" ? "robber" : "police"; a.name = name;
    G.agents.push(a);
    const p = { a, name, side, isBot, rigC: rig(a, "police"), rigR: rig(a, "robber"), tag: document.createElement("div"), say: null, sayT: 0, go: null, morphT: 0, flip: lookOf(name) };
    p.tag.className = "wtag"; world.append(p.tag);
    return p;
  }
  function dropPerson(p) {
    p.rigC.el.remove(); p.rigR.el.remove(); p.tag.remove(); if (p.say) p.say.remove();
    chars = chars.filter(c => c !== p.rigC && c !== p.rigR); G.agents = G.agents.filter(a => a !== p.a); pool.push(p.a);
  }
  function renderTag(p) {
    const mine = p === me;
    p.tag.className = `wtag ${mine ? "me " + (p.side === "any" ? "" : p.side) : ""} ${p.isBot ? "bot" : ""}`;
    p.tag.textContent = p.isBot ? COPY.bot : p.name;
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
    const add = (side, n, from) => { for (let i = 0; i < n; i++) { const p = makePerson(COPY.bot, side, true), sp = spotIn(side, from + i); p.a.x = sp.x; p.a.y = sp.y; bots.push(p); renderTag(p); } };
    add("cop", c, here("cop")); add("rob", r, here("rob"));
  }
  const startState = () => { const c = here("cop"), r = here("rob"), a = here("any"), n = people.size; if (S.bots) return { ok: true }; if (n < 2) return { ok: false, why: COPY.needOne }; if (c + a === 0) return { ok: false, why: COPY.needCop }; if (r + a === 0) return { ok: false, why: COPY.needRob }; return { ok: true }; };
  const stepBtn = (side, d) => { const total = S.cops + S.robs, cur = side === "cop" ? S.cops : S.robs, off = d > 0 ? total >= MAX_TOTAL : (cur <= 1 || total - 1 < people.size), nm = side === "cop" ? COPY.copN : COPY.robN; return `<button class="step" data-act="n-${side}-${d}" aria-disabled="${off}" aria-label="${nm} 한 명 ${d > 0 ? "늘리기" : "줄이기"}"><i>${d > 0 ? "+" : "−"}</i></button>`; };
  function renderHud() {
    if (!active) return;
    const st = startState(), total = S.cops + S.robs, n = people.size, alone = n === 1 && !S.bots, hostName = [...people.values()].find(p => p.hostMark)?.name || "";
    const line = !moved ? COPY.hint : (S.host ? "" : COPY.wait(""));
    let h = `<div class="row1"><div class="lp code"><div><small>${COPY.code}<b>${n}/${total}</b>${S.open ? `<em class="pub">${COPY.pub}</em>` : ""}</small><strong>${net.room}</strong></div><button class="icon" data-act="copycode" aria-label="방 코드 복사">${codeDone ? ICON.check : ICON.copy}</button></div>
      <button class="bt ${S.host && alone ? "main" : ""}" data-act="invite">${copied ? COPY.copied : COPY.invite}</button>
      <button class="bt ic" data-act="say" aria-label="정해진 말 열기" aria-expanded="${sayOpen}">${ICON.say}</button>
      <div class="grow">${line ? `<div class="line" data-line></div>` : ""}</div>
      ${S.host ? `<button class="bt" data-act="seats" aria-expanded="${seatsOpen}">${COPY.seats}</button>` : ""}
      <button class="bt quiet" data-act="quit">${COPY.quit}</button></div>`;
    if (seatsOpen && S.host) h += `<div class="lp sheetR">
      <div class="srow cop"><span class="nm">${COPY.copN}</span>${stepBtn("cop", -1)}<span class="num">${S.cops}</span>${stepBtn("cop", 1)}</div>
      <div class="srow rob"><span class="nm">${COPY.robN}</span>${stepBtn("rob", -1)}<span class="num">${S.robs}</span>${stepBtn("rob", 1)}</div>
      <div class="srow"><button class="switch" role="switch" data-act="bots" aria-checked="${S.bots}"><span>${COPY.bots}</span><i></i></button></div>
      <div class="srow tall"><button class="switch" role="switch" data-act="open" aria-checked="${!!S.open}"><span>${COPY.open}<small>${COPY.openSub}</small></span><i></i></button></div>
      ${S.players.slice(1).map(p => `<div class="srow kick"><span class="nm" data-name="${p.id}"></span><button class="bt quiet" data-act="kick-${p.id}">${COPY.kick}</button></div>`).join("")}</div>`;
    if (sayOpen) h += `<div class="lp tray">${COPY.say.map((t, i) => `<button data-act="said-${i}">${t}</button>`).join("")}</div>`;
    if (S.host) { h += `<button id="startBtn" class="${flash ? "shake" : ""}" data-act="start" aria-disabled="${!st.ok}">${COPY.start}</button>`; if (!st.ok) h += `<div class="why ${flash ? "flash" : ""}">${st.why}</div>`; }
    if (countN) h += `<div class="count3">${countN}</div>`;
    const focus = lob.contains(document.activeElement) ? document.activeElement.dataset.act : null;
    lob.innerHTML = h;
    lob.querySelectorAll("[data-name]").forEach(e => { e.textContent = S.players.find(p => p.id === e.dataset.name)?.name ?? ""; });
    const lineEl = lob.querySelector("[data-line]"); if (lineEl) lineEl.textContent = !moved ? COPY.hint : COPY.wait(hostName);
    if (focus) { const b = lob.querySelector(`[data-act="${focus}"]`); if (b) b.focus({ preventScroll: true }); }
    for (const side of ["cop", "rob"]) { const e = counts[side], cur = here(side), cap = capOf(side); e.textContent = `${cur}/${cap}`; e.className = "wcount" + (cur >= cap ? " full" : ""); }
  }
  const later = (fn, ms) => setTimeout(() => { fn(); renderHud(); }, ms);
  function onClick(e) {
    const b = e.target.closest("[data-act]"); if (!b) return; const a = b.dataset.act;
    const seat = /^n-(cop|rob)-(-?1)$/.exec(a);
    if (seat) { if (b.getAttribute("aria-disabled") === "true") return; const d = Number(seat[2]); net.send({ t: "seats", cops: S.cops + (seat[1] === "cop" ? d : 0), robs: S.robs + (seat[1] === "rob" ? d : 0), bots: S.bots }); return; }
    if (a.startsWith("kick-")) { net.kick(a.slice(5)); return; }
    if (a === "bots") { net.send({ t: "seats", cops: S.cops, robs: S.robs, bots: !S.bots }); return; }
    if (a === "open") { net.send({ t: "seats", cops: S.cops, robs: S.robs, bots: S.bots, open: !S.open }); return; }
    if (a === "seats") { seatsOpen = !seatsOpen; return renderHud(); }
    if (a === "say") { sayOpen = !sayOpen; return renderHud(); }
    if (a.startsWith("said-")) { sayOpen = false; net.send({ t: "say", i: +a.slice(5) }); return renderHud(); }
    if (a === "copycode") { navigator.clipboard?.writeText(net.room).catch(() => {}); codeDone = true; renderHud(); later(() => codeDone = false, 1800); return; }
    if (a === "invite") return net.invite(() => { copied = true; renderHud(); later(() => copied = false, 1800); });
    if (a === "quit") return net.quit();
    if (a === "start") { if (!startState().ok) { flash = true; renderHud(); later(() => flash = false, 420); return; } net.send({ t: "start" }); }
  }
  function bump(side) { bumpT = 1.4; fullEl.style.display = ""; fullEl.style.transform = `translate(${(side === "cop" ? ZX[1] - 170 : ZX[2] + 170) - 130}px,${me.a.y - 170}px)`; }

  const scene = {
    get active() { return active; },
    enter(m) {
      active = true; revealed = null; countN = 0; moved = false;
      document.body.classList.add("lobby-mode");
      chars.forEach(c => c.el.remove()); chars = [];
      G = newGame({ seed: 11, theme: "town", role: "police", police: 4, robbers: 4 });
      L.loadMap(LOBBY_MAP); G.map = LOBBY_MAP; CFG.WAIT = 1e9; G.phase = "wait"; G.nextReveal = 1e9; role = "police"; ended = false;
      pool = [...G.agents]; G.agents = []; G.events.length = 0; people = new Map(); bots = []; me = null; G.player = pool[0];
      document.querySelectorAll(".bush").forEach(n => n.remove());
      bakeMap(); paintChalk(); bakeBushes(); bakeMini();
      stage.style.background = G.th.ground; document.body.dataset.theme = "town";
      for (const side of ["cop", "rob"]) { const e = document.createElement("div"); e.style.left = ((side === "cop" ? ZX[0] : ZX[2]) + 34) + "px"; e.style.top = (ZY[0] + 26) + "px"; world.append(e); counts[side] = e; }
      fullEl = document.createElement("div"); fullEl.className = "wfull"; fullEl.textContent = COPY.full; fullEl.style.display = "none"; fullEl.style.zIndex = 5000; world.append(fullEl);
      lob = document.createElement("div"); lob.id = "lob"; $("hud").append(lob); lob.addEventListener("click", onClick);
      $("start").className = "sheet"; $("end").className = "sheet"; $("hud").className = "show"; $("banner").className = ""; $("toast").className = "";
      camTarget = p => { const vw = W / zoom, vh = H / zoom, ax0 = ZX[0] - 40, ax1 = ZX[3] + 40, ay = (ZY[0] + ZY[1]) / 2 + 6; return [vw >= ax1 - ax0 ? (ax0 + ax1 - vw) / 2 : clamp(p.x - vw / 2, ax0, ax1 - vw), ay - vh / 2]; };
      scene.update(m);
      const [cx0, cy0] = camTarget(G.player); camX = cx0; camY = cy0;
      syncRotate();
    },
    update(m) {
      S = m;
      const ids = new Set(m.players.map(p => p.id));
      for (const [id, p] of people) if (!ids.has(id)) { dropPerson(p); people.delete(id); }
      m.players.forEach((info, i) => {
        let p = people.get(info.id);
        if (!p) {
          p = makePerson(info.name, info.side, false); people.set(info.id, p);
          const sp = spotIn(info.side, here(info.side) - 1); p.a.x = sp.x; p.a.y = sp.y;
          if (info.id === m.you) { me = p; G.player = p.a; }
          if (p.a !== G.player) p.a.isPlayer = true;
        }
        p.hostMark = i === 0;
        if (p.side !== info.side) {
          p.side = info.side; p.a.team = info.side === "rob" ? "robber" : "police";
          // 칸을 옮긴 사람은 그 칸으로 걸어간다. 내 움직임은 내 폰에서 처리하니 밀려났을 때만 옮긴다
          if (p !== me || sideAt(p.a.x) !== info.side) { const sp = spotIn(info.side, here(info.side) - 1); if (p === me) { p.a.x = sp.x; p.a.y = sp.y; } else p.go = sp; }
          morph(p, info.side);
        }
        renderTag(p);
      });
      placeBots(); renderHud();
    },
    refused(side) { if (!me) return; me.side = side; me.a.team = side === "rob" ? "robber" : "police"; renderTag(me); renderHud(); },
    say(id, i) { const p = people.get(id); if (p && COPY.say[i]) saying(p, COPY.say[i]); },
    count(ms) { seatsOpen = sayOpen = false; countN = Math.round(ms / 1000); renderHud(); const t = setInterval(() => { countN--; if (countN <= 0) { countN = 0; clearInterval(t); } renderHud(); }, 1000); },
    cant() { flash = true; renderHud(); later(() => flash = false, 420); },
    reveal(team) { const side = team === "robber" ? "rob" : "cop"; revealed = side; countN = 0; renderHud(); if (me && me.side === "any") { me.side = side; morph(me, side); } document.body.dataset.role = team; role = team; banner("", side === "rob" ? COPY.isRob : COPY.isCop); },
    leave() {
      active = false; camTarget = null; document.body.classList.remove("lobby-mode");
      for (const p of [...people.values(), ...bots]) dropPerson(p);
      people = new Map(); bots = []; me = null;
      Object.values(counts).forEach(e => e.remove()); counts = {}; if (fullEl) fullEl.remove(); if (lob) lob.remove(); lob = null;
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
      const a = me.a; a.x = clamp(a.x, WALK.x0, WALK.x1); a.y = clamp(a.y, WALK.y0, WALK.y1);
      for (const p of people.values()) { p.a.x = clamp(p.a.x, WALK.x0, WALK.x1); p.a.y = clamp(p.a.y, WALK.y0, WALK.y1); }
      if ((a.ix || a.iy) && !moved) { moved = true; renderHud(); }
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
        const grey = p.side === "any" || p.morphT > .26;
        p.rigC.el.style.display = look === "cop" ? "" : "none"; p.rigR.el.style.display = look === "rob" ? "" : "none";
        p.rigC.el.classList.toggle("shade", grey); p.rigR.el.classList.toggle("shade", grey);
        p.rigC.el.classList.toggle("botc", p.isBot); p.rigR.el.classList.toggle("botc", p.isBot);
        p.tag.style.transform = `translate(calc(${a.x}px - 50%),${a.y - 132}px)`; p.tag.style.zIndex = Math.round(a.y) + 1;
        if (p.say) { p.say.style.transform = `translate(calc(${a.x}px - 50%),${a.y - 216}px)`; p.sayT -= dt; if (p.sayT <= 0) { p.say.remove(); p.say = null; } }
      }
    },
  };
  return scene;
}
