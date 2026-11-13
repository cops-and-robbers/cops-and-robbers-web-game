// 혼자 하기: 팀, 난이도, 지도를 고르고 시작한다. 고르는 동안 뒤에서 고른 지도가 실제 그림으로 천천히 지나가고,
// 그 지도(같은 씨앗)로 판이 시작된다. 화면 크기마다 고르는 칸 자리가 다르다. 설계는 docs/solo-start.md
function createSolo() {
  const THEME_KEYS = ["town", "night", "park", "city", "snow"];
  const store = {
    get(k) { try { return localStorage.getItem("solo:" + k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem("solo:" + k, v); } catch { /* 저장이 안 되면 이번에만 기억한다 */ } },
  };
  const sheet = $("start"), card = sheet.querySelector(".startCard");
  // 게임 화면이 줄어도 고르는 칸은 제자리에 있게 게임 화면 밖으로 옮긴다
  document.body.append(sheet);
  const q = s => sheet.querySelector(s), qa = s => sheet.querySelectorAll(s);
  // 두 편은 대등하다. 처음 온 사람에게 한쪽을 미리 골라 두지 않고, 전에 고른 편만 기억한다
  let team = ["police", "robber"].includes(store.get("team")) ? store.get("team") : null;
  let diff = ["easy", "normal", "hard"].includes(store.get("diff")) ? store.get("diff") : "normal";
  let theme = ["random", ...THEME_KEYS].includes(store.get("theme")) ? store.get("theme") : "random";
  let seed = newSeed(), shown = null, t = 0, spin = 0, spinT = 0, open = false, fromHome = false, wentFull = false;
  // 폰에서는 나가기를 고르는 칸 밖, 지도 위에 띄운다. 설정을 얼마나 내렸든 바로 나갈 수 있다
  const exitBtn = document.createElement("button");
  exitBtn.type = "button"; exitBtn.className = "soloExit"; exitBtn.setAttribute("aria-label", tt("toHome"));
  exitBtn.innerHTML = `<i aria-hidden="true"></i><span>${tt("quit")}</span>`;
  document.body.append(exitBtn);
  function newSeed() { return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0; }

  // ── 지도 카드의 작은 그림: 테마마다 지도 하나를 만들어 위에서 본 모양으로 그린다 ──
  function thumb(canvas, key) {
    const th = THEMES[key], m = L.genMap(1000 + THEME_KEYS.indexOf(key) * 37, { theme: key, scale: 1, cover: 0.66 });
    const w = canvas.width, h = canvas.height, s = Math.min(w / m.W, h / m.H) * 1.08, ox = (w - m.W * s) / 2, oy = (h - m.H * s) / 2;
    const x = canvas.getContext("2d");
    x.fillStyle = th.out; x.fillRect(0, 0, w, h);
    x.save(); x.translate(ox, oy); x.scale(s, s);
    x.beginPath(); m.zone.forEach((p, i) => i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)); x.closePath(); x.fillStyle = th.ground; x.fill();
    x.fillStyle = th.park; for (const p of m.parks) { x.beginPath(); x.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, 7); x.fill(); }
    x.fillStyle = th.road; for (const r of m.roads) x.fillRect(r.x, r.y, r.w, r.h);
    m.buildings.forEach((b, i) => {
      if (b.kind === "tree") { x.fillStyle = th.bushes[0]; x.beginPath(); x.arc(b.x + b.w / 2, b.y, (b.crown || 60) * 0.9, 0, 7); x.fill(); return; }
      x.fillStyle = b.kind === "bin" ? th.bin[0][1] : th.roofs[i % th.roofs.length][1]; x.fillRect(b.x, b.y, b.w, b.h);
    });
    x.fillStyle = th.bushes[1]; for (const b of m.bushes) { x.beginPath(); x.ellipse(b.x, b.y, b.rx, b.ry, 0, 0, 7); x.fill(); }
    x.strokeStyle = "#E2574C"; x.lineWidth = 14; x.setLineDash([60, 40]); x.beginPath(); m.zone.forEach((p, i) => i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)); x.closePath(); x.stroke();
    x.restore();
  }
  qa("[data-theme-pick] canvas").forEach(c => { const k = c.closest("[data-theme-pick]").dataset.themePick; if (k !== "random") thumb(c, k); });

  // ── 뒤에서 보이는 지도 ──
  // 혼자 하기 판과 같은 값(편, 난이도에 따라 지도 크기와 건물 양이 다르다)으로 만든다. 편을 아직 안 골랐으면 경찰 값으로 만들고, 고르면 다시 만든다
  const previewTheme = () => (theme === "random" ? THEME_KEYS[spin % THEME_KEYS.length] : theme);
  function render() {
    const key = previewTheme(), want = `${key}:${seed}:${team || "-"}:${diff}`;
    if (shown === want) return;
    shown = want;
    chars.forEach(c => c.el.remove()); chars = [];
    G = newGame({ seed: theme === "random" ? 1000 + spin * 7 : seed, theme: key, role: team || "police", diff });
    ended = false;
    document.querySelectorAll(".bush").forEach(n => n.remove());
    bakeMap(); bakeBushes();
    document.body.dataset.theme = G.theme; stage.style.background = G.th.out;
    const f = $("soloMap");
    f.querySelector("b").textContent = TX.theme[key];
    f.querySelector("span").textContent = TX.solo.mapNote[key];
    f.classList.toggle("random", theme === "random");
  }
  // 카메라는 지도 가운데를 크게 돌며 천천히 지나간다. 움직임을 줄이도록 설정한 사람에게는 멈춰 있다
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function drift(dt) {
    if (theme === "random") { spinT += dt; if (spinT > 3.2) { spinT = 0; spin++; render(); } }
    t += still ? 0 : dt;
    const cx = CFG.W / 2 + Math.cos(t * 0.09) * CFG.W * 0.22, cy = CFG.H / 2 + Math.sin(t * 0.13) * CFG.H * 0.2;
    camX = cx - W / 2 / zoom; camY = cy - H / 2 / zoom;
    world.style.transform = `scale(${zoom}) translate(${-camX}px, ${-camY}px)`;
  }

  // ── 화면 나누기: 넓은 화면은 왼쪽 고르는 칸, 폰 가로는 오른쪽(시작 버튼이 오른손 엄지 자리), 폰 세로는 아래 고르는 칸. 지도는 남은 자리 ──
  function layout() {
    const portrait = innerHeight > innerWidth, wide = innerWidth >= 900, root = document.documentElement.style;
    sheet.dataset.mode = portrait ? "sheet" : wide ? "side" : "split";
    document.body.classList.toggle("solo-float", fromHome && !(wide && !portrait));
    root.setProperty("--sl", !portrait && wide ? `${Math.round(Math.min(500, innerWidth * 0.42))}px` : "0px");
    root.setProperty("--sr", !portrait && !wide ? `${Math.round(Math.min(420, innerWidth * 0.56))}px` : "0px");
    root.setProperty("--sb", portrait ? `${Math.round(Math.min(innerHeight * 0.66, card.scrollHeight + 8))}px` : "0px");
    fitStage();
  }

  function sync() {
    qa("[data-role-pick]").forEach(b => { const on = b.dataset.rolePick === team; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    qa("[data-diff]").forEach(b => { const on = b.dataset.diff === diff; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    qa("[data-theme-pick]").forEach(b => { const on = b.dataset.themePick === theme; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    const go = $("soloGo");
    go.disabled = !team;
    go.dataset.team = team || "";
    go.textContent = team ? TX.solo.go[team] : TX.solo.pickTeam;
    q(".reroll").hidden = theme === "random";
    sheet.dataset.team = team || "";
    render();
  }
  qa("[data-role-pick]").forEach(b => b.onclick = () => { team = b.dataset.rolePick; store.set("team", team); sync(); });
  qa("[data-diff]").forEach(b => b.onclick = () => { diff = b.dataset.diff; store.set("diff", diff); sync(); });
  qa("[data-theme-pick]").forEach(b => b.onclick = () => { theme = b.dataset.themePick; store.set("theme", theme); seed = newSeed(); sync(); });
  q(".reroll").onclick = () => { seed = newSeed(); sync(); };
  // 같은 줄 안에서는 화살표로 옮긴다(라디오 묶음)
  qa("[role=radiogroup]").forEach(g => g.addEventListener("keydown", e => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    const items = [...g.querySelectorAll("[role=radio]")], k = items.indexOf(document.activeElement); if (k < 0) return;
    e.preventDefault(); e.stopPropagation();
    const n = items[(k + (e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]; n.focus(); n.click();
  }));

  function show(home, full) {
    open = true; fromHome = !!home;
    q(".stBack").hidden = !fromHome;
    // 폰에서 첫 화면 버튼으로 들어오면 주소창 없이 전체 화면으로. 누른 순간에만 허락되어 그 자리에서 부른다(아이폰 사파리는 지원하지 않아 그대로)
    if (full && isPhone() && !document.fullscreenElement) document.documentElement.requestFullscreen?.().then(() => { wentFull = true; }, () => {});
    sheet.className = "sheet show"; document.body.classList.add("picking");
    $("hud").className = ""; preview = drift;
    shown = null; layout(); sync();
  }
  function hide() {
    open = false; preview = null;
    document.body.classList.remove("picking", "solo-float");
    for (const v of ["--sl", "--sr", "--sb"]) document.documentElement.style.setProperty(v, "0px");
    fitStage();
  }
  $("soloGo").onclick = () => {
    if (!team) return;
    const go = theme === "random" ? undefined : seed;
    hide(); sheet.className = "sheet";
    pickDiff = diff; pickTheme = theme;
    start(team, go); syncRotate(); tryLandscape();
  };
  const leave = () => {
    hide(); sheet.className = "sheet"; chars.forEach(c => c.el.remove()); chars = []; G = null;
    if (wentFull && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    wentFull = false; openHome();
  };
  q(".stBack").onclick = leave; exitBtn.onclick = leave;
  // 고르는 칸의 게임 방법: 안내를 보는 동안 지도 미리보기를 멈추고, 닫으면 다시 그린다
  q("[data-solo-guide]").onclick = e => { const b = e.currentTarget; hide(); (guide ||= createGuide()).open(b, () => show(fromHome)); };
  addEventListener("resize", () => { if (open) { layout(); } });
  return { show, hide, get open() { return open; } };
}
let solo = null;
const openSolo = (fromHome, full) => (solo ||= createSolo()).show(fromHome, full);
