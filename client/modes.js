// 모드 카드(docs/zombie.md "모드 고르기"). 홈의 혼자 해 보기와 방 만들기가 먼저 연다.
// 꾸밈은 덜고(바탕 하나에 캐릭터, 이름과 한 줄), 모드마다 배지 세 개와 내 기록을 둬 다음 목표가 보이게 한다.
// 기록은 이 폰에만 남긴다(localStorage). 서버에 보내지 않는다
const Modes = (() => {
  const LIST = ["classic", "zombie"];
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem("modes:" + k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem("modes:" + k, JSON.stringify(v)); } catch { /* 저장이 안 되면 이번에만 */ } },
  };
  const BADGES = { classic: ["win", "catch3", "holdout"], zombie: ["escape", "bite4", "clean"] };
  // 배지 그림: 트로피, 수갑, 방패 / 구조차, 이빨, 초승달
  const ICON = {
    win: '<path d="M6 3h8v3.5a4 4 0 0 1-8 0zM8.5 12.5h3v2.5H8.5zM6.5 15.5h7v1.8h-7z"/>',
    catch3: '<circle cx="7" cy="10" r="3.4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="13" cy="10" r="3.4" fill="none" stroke="currentColor" stroke-width="2"/>',
    holdout: '<path d="M10 2.8l5.5 2.2v4.4c0 3.6-2.4 6-5.5 7.4-3.1-1.4-5.5-3.8-5.5-7.4V5z"/>',
    escape: '<path d="M2.5 6.5h9v7h-9zM11.5 9h3.5l2.5 2.5v2h-6z"/><circle cx="6" cy="14.5" r="1.8"/><circle cx="14.5" cy="14.5" r="1.8"/>',
    bite4: '<path d="M4 7h12l-1.5 3L13 7.5 11.5 10.5 10 7.5 8.5 10.5 7 7.5 5.5 10z"/><path d="M5 12.5h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    clean: '<path d="M12.5 3a7 7 0 1 0 5 11.5A6 6 0 1 1 12.5 3z"/>',
  };
  const rec = mode => ({ games: 0, wins: 0, badges: [], ...(store.get("rec:" + mode) || {}) });
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // 판이 끝나면 game.js showEnd 가 부른다
  function record(G, p, won) {
    const mode = G.mode === "zombie" ? "zombie" : "classic", r = rec(mode), got = new Set(r.badges), s = p.s || {};
    r.games++; if (won) r.wins++;
    if (mode === "classic") {
      if (won) got.add("win");
      if (p.team === "police" && s.catches >= 3) got.add("catch3");
      if (won && p.team === "robber") got.add("holdout");
    } else {
      if (s.escapeAt !== undefined) got.add("escape");
      if (s.catches >= 4) got.add("bite4");
      // 생존자로 시작해 끝까지 물리지 않았다
      if ((p.origin || G.zOrigin) === "robber" && !s.caught) got.add("clean");
    }
    r.badges = BADGES[mode].filter(b => got.has(b));
    store.set("rec:" + mode, r); store.set("seen:" + mode, true);
  }

  let sheet = null, pick = null, done = null, ctx = "solo";
  function art(mode) {
    if (mode === "zombie") return `<div class="mArt zomb"><i class="mMoon"></i><img class="mSway" src="${ZB.url("police-front")}" alt=""></div>`;
    return `<div class="mArt classic"><img src="${svgUrl("police-front")}" alt=""><img src="${svgUrl("robber-front")}" alt=""></div>`;
  }
  function card(mode) {
    const M = tt("modes"), r = rec(mode), isNew = mode !== "classic" && !store.get("seen:" + mode);
    const badges = BADGES[mode].map(b => `<span class="bdg${r.badges.includes(b) ? " on" : ""}" title="${esc(M.badge[b])}" aria-label="${esc(M.badge[b])}"><svg viewBox="0 0 20 20" fill="currentColor">${ICON[b]}</svg></span>`).join("");
    const stat = r.games ? `<b>${esc(M.rec(r.games, r.wins))}</b><small>${esc(M.badges(r.badges.length))}</small>` : `<b>${esc(M.first)}</b><small>${esc(M.firstSub)}</small>`;
    return `<button type="button" class="mcard ${mode}" role="radio" aria-checked="false" data-mode="${mode}">${art(mode)}${isNew ? `<span class="mNew">NEW</span>` : ""}
      <span class="mBody"><span class="mRow"><b class="mName">${esc(M.name[mode])}</b><span class="mMeta">${esc(M.meta)}</span></span><span class="mDesc">${esc(M.desc[mode])}</span>
      <span class="mRec">${badges}<span class="mStat">${stat}</span></span></span><i class="mCheck" aria-hidden="true"></i></button>`;
  }
  function render() {
    const M = tt("modes");
    const lob = ctx === "lobby";
    sheet.innerHTML = `<div class="mTop"><button type="button" class="mBack" data-act="back"><i aria-hidden="true"></i>${esc(lob ? M.close : tt("quit"))}</button><div class="mTitle"><small>${esc(lob ? M.lobbySub : ctx === "room" ? tt("create") : tt("solo"))}</small><b id="modesTitle">${esc(lob ? M.titleChange : M.title)}</b></div></div>
      <div class="mCards" role="radiogroup" aria-labelledby="modesTitle">${LIST.map(card).join("")}</div>
      <div class="mFoot"><button type="button" class="mGo" data-act="go"></button></div>`;
    sync();
  }
  function sync() {
    const M = tt("modes");
    sheet.querySelectorAll(".mcard").forEach(b => { const on = b.dataset.mode === pick; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    const go = sheet.querySelector(".mGo");
    go.textContent = ctx === "lobby" ? M.goChange : ctx === "room" ? M.goRoom : M.go[pick];
    go.dataset.mode = pick;
  }
  // context: "solo"(혼자 해 보기), "room"(방 만들기), "lobby"(대기실에서 모드 바꾸기). now 는 지금 모드
  function open(context, onPick, now) {
    ctx = context; done = onPick; pick = LIST.includes(now) ? now : LIST.includes(store.get("last")) ? store.get("last") : "classic";
    if (!sheet) {
      sheet = document.createElement("div"); sheet.id = "modes"; sheet.className = "sheet"; sheet.setAttribute("role", "dialog");
      document.body.append(sheet);
      sheet.addEventListener("click", e => {
        const c = e.target.closest(".mcard");
        // 카드를 한 번 누르면 고르고, 고른 카드를 한 번 더 누르면 넘어간다
        if (c) { if (pick === c.dataset.mode) return go(); pick = c.dataset.mode; return sync(); }
        const a = e.target.closest("[data-act]")?.dataset.act;
        if (a === "back") { close(); if (ctx !== "lobby") openHome(); }
        if (a === "go") go();
      });
      sheet.addEventListener("keydown", e => {
        if (!["ArrowRight", "ArrowLeft"].includes(e.key) || !e.target.closest(".mcard")) return;
        e.preventDefault(); pick = LIST[(LIST.indexOf(pick) + 1) % LIST.length]; sync(); sheet.querySelector(`.mcard[data-mode="${pick}"]`).focus();
      });
    }
    render();
    sheet.className = "sheet show";
    sheet.querySelector(`.mcard[data-mode="${pick}"]`)?.focus({ preventScroll: true });
  }
  function go() { if (ctx !== "lobby") store.set("last", pick); close(); done?.(pick); }
  function close() { if (sheet) sheet.className = "sheet"; }
  return { open, close, record, last: () => (LIST.includes(store.get("last")) ? store.get("last") : "classic") };
})();
