// 모드 카드(docs/zombie.md "모드 고르기"). 홈의 혼자 해 보기와 방 만들기가 먼저 연다.
// 꾸밈은 덜고(바탕 하나에 캐릭터, 이름과 한 줄), 모드마다 내 판 수와 승 수만 둔다(배지는 헷갈려서 뺐다).
// 기록은 이 폰에만 남긴다(localStorage). 서버에 보내지 않는다
const Modes = (() => {
  const LIST = ["classic", "zombie"];
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem("modes:" + k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem("modes:" + k, JSON.stringify(v)); } catch { /* 저장이 안 되면 이번에만 */ } },
  };
  const rec = mode => ({ games: 0, wins: 0, ...(store.get("rec:" + mode) || {}) });
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // 판이 끝나면 game.js showEnd 가 부른다
  function record(G, p, won) {
    const mode = G.mode === "zombie" ? "zombie" : "classic", r = rec(mode);
    r.games++; if (won) r.wins++;
    store.set("rec:" + mode, { games: r.games, wins: r.wins }); store.set("seen:" + mode, true);
  }

  let sheet = null, pick = null, done = null, ctx = "solo";
  function art(mode) {
    if (mode === "zombie") return `<div class="mArt zomb"><i class="mMoon"></i><img class="mSway" src="${ZB.url("police-front")}" alt=""></div>`;
    return `<div class="mArt classic"><img src="${svgUrl("police-front")}" alt=""><img src="${svgUrl("robber-front")}" alt=""></div>`;
  }
  function card(mode) {
    const M = tt("modes"), r = rec(mode), isNew = mode !== "classic" && !store.get("seen:" + mode);
    const stat = `<b>${esc(r.games ? M.rec(r.games, r.wins) : M.first)}</b>`;
    return `<button type="button" class="mcard ${mode}" role="radio" aria-checked="false" data-mode="${mode}">${art(mode)}${isNew ? `<span class="mNew">NEW</span>` : ""}
      <span class="mBody"><span class="mRow"><b class="mName">${esc(M.name[mode])}</b><span class="mMeta">${esc(M.meta)}</span></span><span class="mDesc">${esc(M.desc[mode])}</span>
      <span class="mRec"><span class="mStat">${stat}</span></span></span><i class="mCheck" aria-hidden="true"></i></button>`;
  }
  function render() {
    const M = tt("modes");
    sheet.innerHTML = `<div class="mTop"><button type="button" class="mBack" data-act="back"><i aria-hidden="true"></i>${esc(tt("quit"))}</button><div class="mTitle"><small>${esc(ctx === "room" ? tt("create") : tt("solo"))}</small><b id="modesTitle">${esc(M.title)}</b></div></div>
      <div class="mCards" role="radiogroup" aria-labelledby="modesTitle">${LIST.map(card).join("")}</div>
      <div class="mFoot"><button type="button" class="mGo" data-act="go"></button></div>`;
    sync();
  }
  function sync() {
    const M = tt("modes");
    sheet.querySelectorAll(".mcard").forEach(b => { const on = b.dataset.mode === pick; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); });
    const go = sheet.querySelector(".mGo");
    go.textContent = ctx === "room" ? M.goRoom : M.go[pick];
    go.dataset.mode = pick;
  }
  // context: "solo"(혼자 해 보기), "room"(방 만들기). now 는 지금 모드. 대기실에서는 모드를 바꾸지 않는다
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
        if (a === "back") { close(); openHome(); }
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
  function go() { store.set("last", pick); close(); done?.(pick); }
  function close() { if (sheet) sheet.className = "sheet"; }
  return { open, close, record, last: () => (LIST.includes(store.get("last")) ? store.get("last") : "classic") };
})();
