// 게임 방법. 영상 대신 실제 게임 엔진으로 짧은 장면을 연기시켜 보여 준다.
// 지도, 캐릭터, 시야, 위치 공개, 감옥, 화면 위 표시는 게임 그대로이고, 사람 입력 자리에 대본(drive)이 들어간다.
// 화면을 둘로 나눠 한쪽은 설명, 한쪽은 게임 장면이다. 넓은 화면은 왼쪽, 폰 가로는 오른쪽(넘기는 손), 폰 세로는 아래 설명. 설계는 docs/guide.md
function createGuide() {
  const touch = matchMedia("(pointer:coarse)").matches;
  const copy = TX.guideCopy;

  // 장면 지도 하나: 가운데 큰길과 세로 길, 왼쪽 아래 감옥, 길가 수풀. 모든 장면이 같은 동네라 장면이 바뀌어도 낯설지 않다
  const tree = (x, y, crown) => ({ x, y, w: 28, h: 20, kind: "tree", crown, species: "round" });
  const MAP = {
    W: 2600, H: 1700, seed: 2611, theme: "town",
    zone: [{ x: 40, y: 40 }, { x: 2560, y: 40 }, { x: 2560, y: 1660 }, { x: 40, y: 1660 }],
    jail: { x: 800, y: 1180, r: 175 },
    roads: [{ x: 0, y: 760, w: 2600, h: 120 }, { x: 1480, y: 0, w: 110, h: 1700 }],
    parks: [{ x: 2300, y: 1500, rx: 200, ry: 110 }],
    buildings: [
      { x: 240, y: 300, w: 380, h: 300 }, { x: 760, y: 280, w: 420, h: 330 }, { x: 1700, y: 260, w: 380, h: 330 }, { x: 2200, y: 300, w: 300, h: 300 },
      { x: 1720, y: 1020, w: 400, h: 280 }, { x: 2240, y: 1040, w: 300, h: 300 }, { x: 120, y: 1080, w: 300, h: 300 }, { x: 1080, y: 1460, w: 320, h: 200 },
      { x: 2000, y: 670, w: 92, h: 64, kind: "bin" },
      tree(1330, 650, 70), tree(560, 690, 64), tree(1660, 960, 70), tree(2190, 960, 66),
    ],
    bushes: [
      { x: 1200, y: 690, r: 60, rx: 92, ry: 52, hedge: false }, { x: 2020, y: 960, r: 60, rx: 100, ry: 56, hedge: false },
      { x: 420, y: 690, r: 50, rx: 80, ry: 48, hedge: false }, { x: 1950, y: 1420, r: 56, rx: 90, ry: 50, hedge: false },
    ],
  };

  // 대본에서 쓰는 손: 사람을 목표 쪽으로 걷게 하고, 도착하면 멈춘다
  const toward = (a, x, y, stop = 12) => { const dx = x - a.x, dy = y - a.y, d = Math.hypot(dx, dy); if (d < stop) { a.ix = a.iy = 0; return { x: 0, y: 0, at: true }; } a.ix = dx / d; a.iy = dy / d; return { x: a.ix, y: a.iy, at: false }; };
  const still = a => { a.ix = a.iy = 0; };
  const place = (a, x, y, state) => { a.x = x; a.y = y; a.vx = a.vy = 0; if (state) a.state = state; };

  // 장면. team 은 그 장면에서 내가 맡는 편, focus 는 카메라가 볼 곳(점이나 계산, 없으면 나를 따라간다)
  const SCENES = [
    // 시작: 경찰이 감옥 앞에서 기다리는 동안 도둑 셋이 흩어지고, 시간이 되면 "경찰이 출동했어요"
    { key: "goal", team: "robber", police: 2, robbers: 3, wait: 4, len: 8.5,
      setup(G) { const [c1, c2] = G.police, [me, r2, r3] = G.robbers; place(c1, 740, 1010, "waiting"); place(c2, 860, 1010, "waiting"); place(me, 1000, 830); place(r2, 940, 800); place(r3, 1060, 860); },
      drive(t, G) {
        const [c1, c2] = G.police, [me, r2, r3] = G.robbers;
        toward(r2, 1535, t < 1.8 ? 790 : 420); toward(r3, 1535, t < 1.6 ? 850 : 1350);
        if (G.phase === "play") { toward(c1, 900, 820); toward(c2, 1150, 840); }
        return toward(me, 1900, 820);
      } },
    { key: "move", team: "police", police: 1, robbers: 1, len: 6.5,
      setup(G) { place(G.police[0], 640, 820, "free"); place(G.robbers[0], 2450, 1550); },
      drive(t, G) { const v = t < 0.4 ? { x: 0, y: 0 } : toward(G.player, 2500, 820); return { ...v, sprint: t > 1.4 && t < 4.4 }; } },
    { key: "see", team: "police", police: 1, robbers: 2, len: 7,
      setup(G) { place(G.police[0], 640, 820, "free"); place(G.robbers[0], 1215, 680); place(G.robbers[1], 2450, 1550); G.robbers[0].faceA = Math.PI; },
      drive(t, G) {
        const r = G.robbers[0];
        // 수풀에 가만히 있으면 길에서는 안 보이고, 뛰어나오는 순간 보인다
        if (t > 3.4) { r.sprint = true; toward(r, 820, 700); } else still(r);
        const v = t < 2.6 ? toward(G.player, 1180, 820) : t > 3.9 ? toward(G.player, r.x, 820) : { x: 0, y: 0 };
        return { ...v, sprint: t > 3.9 };
      } },
    { key: "catch", team: "police", police: 1, robbers: 2, len: 6,
      setup(G) { place(G.police[0], 900, 820, "free"); place(G.robbers[0], 1260, 830); place(G.robbers[1], 2450, 1550); G.robbers[0].faceA = 0; },
      drive(t, G) {
        const r = G.robbers[0], p = G.player;
        if (r.state === "free") toward(r, 2200, 830); else still(r);
        const near = r.state === "free" && Math.hypot(r.x - p.x, r.y - p.y) < 96;
        const v = r.state === "free" ? toward(p, r.x, r.y) : { x: 0, y: 0 };
        return { ...v, sprint: r.state === "free", catch: near };
      } },
    { key: "reveal", team: "police", police: 1, robbers: 2, len: 8, focus: G => ({ x: G.player.x + (G.robbers[0].x - G.player.x) * 0.3, y: G.player.y + 40 }),
      setup(G) { place(G.police[0], 1180, 820, "free"); place(G.robbers[0], 1880, 1390); place(G.robbers[1], 300, 1550); G.nextReveal = 2.4; },
      drive(t, G) {
        const r = G.robbers[0], p = G.player;
        if (t > 3.2) toward(r, 2350, 1400); else still(r);
        if (t < 2.6) return { x: 0, y: 0 };
        const leg = p.x < 1520 ? toward(p, 1535, 820) : toward(p, 1535, 1360);
        return { ...leg, sprint: true };
      } },
    { key: "rescue", team: "robber", police: 1, robbers: 3, len: 9, focus: { x: 960, y: 1050 },
      setup(G) {
        const [me, j1, j2] = G.robbers;
        place(me, 1320, 820, "free"); place(G.police[0], 260, 830, "free");
        for (const r of [j1, j2]) { const s = L.jailSlot(G, r); place(r, s.x, s.y, "jailed"); r.lock = 99; }
      },
      drive(t, G) {
        const [me, j1, j2] = G.robbers, c = G.police[0];
        // 문이 열리면 갇혔던 둘이 밖으로 뛰어나간다. 나와서 3초는 보호받는다
        for (const [r, x, y] of [[j1, 1150, 1000], [j2, 1100, 1300]]) { if (r.state === "inJail" || r.state === "breaking" || (r.state === "free" && t < 8)) { r.sprint = true; toward(r, x, y); } else still(r); }
        if (t > 2.5) toward(c, 560, 900); else still(c);
        return me.x > 1010 ? toward(me, 1000, 830) : toward(me, 920, 985);
      } },
  ];

  // ── 화면 ──
  const el = document.createElement("div");
  el.id = "guide"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "gTitle");
  const chip = team => `<span class="gChip ${team}">${copy.team[team]}</span>`;
  el.innerHTML = `<div class="gPanel">
      <div class="gHead"><b class="gKicker">${tt("guide")}</b><span class="gCount" aria-hidden="true"></span><button class="gClose" aria-label="${tt("close")}"></button></div>
      <ol class="gList">${copy.steps.map((s, i) => `<li><button data-step="${i}"><span class="n">${i + 1}</span><span class="t">${s.title}</span>${chip(s.team)}</button></li>`).join("")}</ol>
      <div class="gNow"><div class="gNowHead">${""}</div><h2 id="gTitle" tabindex="-1"></h2><p class="gText"></p></div>
      <div class="gFoot"><div class="gDots" aria-hidden="true"></div><button class="gPause" aria-label="${copy.pause}"></button><button class="gPrev">${copy.prev}</button><button class="gNext"></button></div>
      <div class="gLoop" aria-hidden="true"><i></i></div>
    </div>
    <div class="gFinger f1" aria-hidden="true"></div><div class="gFinger f2" aria-hidden="true"></div>`;
  document.body.append(el);
  const q = s => el.querySelector(s);
  el.classList.toggle("touch", touch);

  let idx = 0, t = 0, sc = null, open = false, hold = false, saved = null, restore = null, opener = null, catchT = 0, keptOnline = null;
  const KEYS = ["w", "a", "s", "d", "shift", " "];

  // 화면 크기마다 설명 자리. side 넓은 화면, split 폰 가로, sheet 폰 세로. 게임 화면은 남은 자리로 줄여 다시 맞춘다
  const mode = () => (innerHeight > innerWidth ? "sheet" : innerWidth >= 900 && innerHeight >= 520 ? "side" : "split");
  function layout() {
    const m = mode(), root = document.documentElement.style; el.dataset.mode = m;
    root.setProperty("--gl", m === "side" ? "360px" : "0px");
    root.setProperty("--gr", m === "split" ? `${Math.round(Math.min(320, innerWidth * 0.4))}px` : "0px");
    root.setProperty("--gb", "0px");
    if (m === "sheet") root.setProperty("--gb", `${Math.ceil(q(".gPanel").getBoundingClientRect().height)}px`);
    fitStage();
    if (G && camTarget) { const [cx, cy] = aim(G.player); camX = cx; camY = cy; }
  }
  // 카메라가 볼 곳: 정해 둔 점, 장면이 계산하는 점(나와 상대의 가운데 등), 없으면 나
  const aim = p => { const f = typeof sc.focus === "function" ? sc.focus(G) : sc.focus || p; return [f.x - W / 2 / zoom, f.y - 30 - H / 2 / zoom]; };

  // 손가락(폰)과 눌린 키(컴퓨터). 실제 조이스틱과 버튼 위에서 움직인다
  const pad = $("pad"), knob = $("knob"), runBtn = $("btnRun"), catchBtn = $("btnCatch");
  function hands(v, dt) {
    const moving = Math.hypot(v.x, v.y) > 0.1;
    if (catchT > 0) catchT -= dt;
    if (v.catch) catchT = 0.28;
    if (touch) {
      const R = pad.offsetWidth / 2 || 66, b = pad.getBoundingClientRect();
      knob.style.transform = moving ? `translate(${v.x * R * .62}px, ${v.y * R * .62}px)` : "";
      pad.classList.toggle("on", moving);
      const f1 = q(".f1"); f1.style.opacity = moving ? 1 : 0;
      f1.style.transform = `translate(${b.left + R + v.x * R * .62 - 17}px, ${b.top + R + v.y * R * .62 - 17}px)`;
      const btn = catchT > 0 ? catchBtn : v.sprint ? runBtn : null, f2 = q(".f2");
      runBtn.classList.toggle("down", !!v.sprint); catchBtn.classList.toggle("down", catchT > 0);
      f2.style.opacity = btn ? 1 : 0;
      if (btn) { const c = btn.getBoundingClientRect(); f2.style.transform = `translate(${c.left + c.width / 2 + 2}px, ${c.top + c.height / 2 + 10}px) scale(.9)`; }
    } else {
      keycap("w", v.y < -.35); keycap("s", v.y > .35); keycap("a", v.x < -.35); keycap("d", v.x > .35);
      keycap("shift", !!v.sprint && moving); keycap(" ", catchT > 0);
    }
  }
  function clearHands() {
    knob.style.transform = ""; pad.classList.remove("on"); runBtn.classList.remove("down"); catchBtn.classList.remove("down");
    for (const k of KEYS) keycap(k, false);
    q(".f1").style.opacity = q(".f2").style.opacity = 0;
  }

  function load(i) {
    idx = i; sc = SCENES[i]; t = 0; catchT = 0;
    // 판 길이는 실제와 같게 둔다. 장면은 몇 초라 판이 끝나지 않는다
    Object.assign(CFG, { WAIT: sc.wait ?? 0, DURATION: 180, AUTO_ESCAPE: false, RESCUE_SEC: 1.2 });
    showGame(sc.team, { role: sc.team, seed: 2611, theme: "town", diff: "normal", police: sc.police, robbers: sc.robbers, reveal: 35 }, G2 => {
      L.loadMap(MAP); G2.map = MAP; G2.theme = "town"; G2.th = THEMES.town;
      if (!sc.wait) { G2.phase = "play"; for (const c of G2.police) c.state = "free"; }
      G2.nextReveal = G2.t + 35;
      sc.setup(G2);
      for (const a of G2.agents) { a.tx = undefined; a.path = []; a.goal = null; }
      G2.events.length = 0;
    });
    // 나 말고는 봇이 아니라 대본이 움직인다(isPlayer 면 규칙 파일이 봇 생각을 건너뛴다). 이름표는 위에서 이미 그렸다
    for (const a of G.agents) a.isPlayer = true;
    $("mission").className = ""; missionT = 0; toastT = 0; $("toast").className = ""; bannerT = 0; $("banner").className = "";
    clearHands();
    const s = copy.steps[i];
    q("#gTitle").textContent = s.title;
    q(".gText").textContent = touch ? (s.touch || s.text) : (s.pc || s.text);
    q(".gCount").textContent = `${i + 1} / ${SCENES.length}`;
    q(".gNowHead").innerHTML = chip(s.team);
    el.querySelectorAll("[data-step]").forEach(b => { const on = +b.dataset.step === i; b.classList.toggle("on", on); b.setAttribute("aria-current", on ? "step" : "false"); });
    q(".gDots").innerHTML = SCENES.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("");
    q(".gPrev").disabled = i === 0;
    q(".gNext").textContent = i < SCENES.length - 1 ? copy.next : copy.done;
    camTarget = aim; const [cx, cy] = aim(G.player); camX = cx; camY = cy;
    layout();
  }

  const loopBar = q(".gLoop i");
  driver = null;
  const drv = {
    drive(dt) {
      if (hold) return { x: 0, y: 0 };
      t += dt;
      loopBar.style.transform = `scaleX(${Math.min(1, t / sc.len)})`;
      if (t >= sc.len) { load(idx); return { x: 0, y: 0 }; }
      const v = sc.drive(t, G) || { x: 0, y: 0 };
      hands(v, dt);
      return v;
    },
  };

  function setHold(on) {
    hold = on; paused = on;
    const b = q(".gPause"); b.classList.toggle("play", on); b.setAttribute("aria-label", on ? copy.play : copy.pause);
  }
  function show(i) { setHold(false); load(Math.max(0, Math.min(SCENES.length - 1, i))); q("#gTitle").focus({ preventScroll: true }); }
  q(".gPrev").onclick = () => show(idx - 1);
  q(".gNext").onclick = () => (idx < SCENES.length - 1 ? show(idx + 1) : close());
  q(".gClose").onclick = () => close();
  q(".gPause").onclick = () => setHold(!hold);
  el.querySelectorAll("[data-step]").forEach(b => { b.onclick = () => show(+b.dataset.step); });
  const onKey = e => {
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowRight" && !e.target.closest?.("input")) { e.preventDefault(); if (idx < SCENES.length - 1) show(idx + 1); }
    else if (e.key === "ArrowLeft" && !e.target.closest?.("input")) { e.preventDefault(); if (idx > 0) show(idx - 1); }
    e.stopPropagation();
  };
  addEventListener("keydown", onKey, true);
  addEventListener("resize", () => { if (open) layout(); });

  function openGuide(from) {
    if (open) return;
    open = true; opener = from || document.activeElement;
    // 지금 떠 있는 첫 화면을 기억했다가 닫으면 그대로 돌려놓는다
    restore = [...document.querySelectorAll(".sheet.show")].map(s => [s, s.className]);
    restore.forEach(([s]) => s.classList.remove("show"));
    saved = { WAIT: CFG.WAIT, DURATION: CFG.DURATION, AUTO_ESCAPE: CFG.AUTO_ESCAPE, RESCUE_SEC: CFG.RESCUE_SEC, W: CFG.W, H: CFG.H, JAIL: CFG.JAIL };
    keptOnline = online; online = null;
    document.body.classList.add("guide-on");
    el.classList.add("show");
    unlockAudio();
    driver = drv;
    show(0);
  }
  function close() {
    if (!open) return;
    open = false; setHold(false); driver = null; camTarget = null; clearHands();
    el.classList.remove("show"); document.body.classList.remove("guide-on");
    for (const v of ["--gl", "--gr", "--gb"]) document.documentElement.style.setProperty(v, "0px");
    fitStage();
    chars.forEach(c => c.el.remove()); chars = []; G = null; ended = false;
    document.querySelectorAll(".bush").forEach(n => n.remove());
    $("hud").className = ""; $("toast").className = ""; $("banner").className = ""; $("mission").className = "";
    Object.assign(CFG, saved); online = keptOnline;
    restore.forEach(([s, c]) => { s.className = c; });
    opener?.focus?.({ preventScroll: true });
  }
  return { open: openGuide, close };
}

// 첫 화면과 초대받아 들어온 화면의 "게임 방법" 버튼. 처음 누를 때 만든다. ?guide=1 이면 바로 연다(시안 보기)
let guide = null;
document.querySelectorAll("[data-guide]").forEach(b => b.addEventListener("click", () => (guide ||= createGuide()).open(b)));
if (new URLSearchParams(location.search).get("guide")) { const wait = setInterval(() => { if (document.documentElement.hasAttribute("data-boot")) return; clearInterval(wait); (guide ||= createGuide()).open(); }, 200); }
