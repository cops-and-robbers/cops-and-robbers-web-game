// 하는 방법 안내. 게임 부품(조이스틱, 버튼, 냥파, 도둥이)을 작은 무대에 올려 직접 움직여 보여 준다.
// 영상 파일 없이 그려서 가볍고, 버튼 자리를 바꾸면 안내도 같이 바뀐다. 설계는 docs/tutorial.md
function createHowTo() {
  const touch = matchMedia("(pointer:coarse)").matches;
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);
  // t 초가 [a, b] 사이 어디쯤인지 0~1
  const at = (t, a, b) => ease((t - a) / (b - a));

  const sheet = document.createElement("div");
  sheet.id = "howto"; sheet.className = "sheet";
  sheet.innerHTML = `<div class="card howCard">
    <div class="howStage" aria-hidden="true">
      <div class="hsRoad"></div><div class="hsBush"></div>
      <div class="hsShadow cop"></div><div class="hsShadow rob"></div>
      <div class="hsAim"></div>
      <img class="hsRob" alt=""><img class="hsCop" alt="">
      <div class="hsPop">${tt("arrest")}</div>
      <div class="hsPad"><i></i></div>
      <div class="hsBtn run">${tt("run")}</div><div class="hsBtn catch">${tt("catch")}</div>
      <div class="hsKeys"><kbd data-k="d">D</kbd><kbd data-k="sp" class="wide">Space</kbd></div>
      <div class="hsFinger f1"></div><div class="hsFinger f2"></div>
    </div>
    <p class="howLine"></p>
    <div class="howFoot"><div class="howDots"></div><button class="howNext"></button></div>
    <button class="howClose" aria-label="${tt("close")}"></button>
  </div>`;
  $("stage").append(sheet);
  sheet.classList.toggle("touch", touch);
  const q = s => sheet.querySelector(s);
  const el = { cop: q(".hsCop"), rob: q(".hsRob"), copSh: q(".hsShadow.cop"), robSh: q(".hsShadow.rob"), aim: q(".hsAim"), pop: q(".hsPop"), pad: q(".hsPad"), knob: q(".hsPad i"), run: q(".hsBtn.run"), catch: q(".hsBtn.catch"), f1: q(".hsFinger.f1"), f2: q(".hsFinger.f2"), keyD: q('[data-k="d"]'), keySp: q('[data-k="sp"]') };
  el.cop.src = svgUrl("police-side"); el.rob.src = svgUrl("robber-side");

  // 무대 좌표는 320 x 180 기준. 화면 크기에 맞춰 무대째 늘린다
  const put = (node, x, y, extra = "") => { node.style.transform = `translate(${x}px,${y}px) ${extra}`; };
  const finger = (node, x, y, down) => { node.style.opacity = down === null ? 0 : 1; put(node, x - 14, y - 14, down ? "scale(.82)" : ""); node.classList.toggle("down", !!down); };

  // 장면: 경찰이 도둑을 쫓아가 노란 표시가 뜨면 잡기를 눌러 잡는다
  const catchScene = {
    line: tt("tutCatch"),
    len: 4.2,
    draw(t) {
      const walk = at(t, .25, 1.9), lunge = at(t, 2.15, 2.4), caught = t > 2.45;
      const robX = lerp(158, 186, at(t, 0, 2.2)), copX = lerp(26, 104, walk) + lerp(0, 18, lunge);
      const step = Math.sin(t * 16) * (t > .25 && t < 2.1 ? 1 : 0);
      put(el.cop, copX, 30 + Math.abs(step) * -3, `rotate(${step * 4}deg)`);
      put(el.copSh, copX + 11, 90);
      const shake = caught ? Math.sin(t * 40) * 2 : 0;
      put(el.rob, robX + shake, caught ? 34 : 32 + Math.abs(Math.sin(t * 12)) * -2, `scaleX(-1) ${caught ? "rotate(-8deg)" : ""}`);
      put(el.robSh, robX + 11, 90);
      el.rob.src = caught ? svgUrl("robber-jailed") : svgUrl("robber-side");
      // 잡을 수 있는 거리면 노란 표시와 버튼 빛
      const near = robX - copX < 80 && !caught;
      el.aim.style.opacity = near ? 1 : 0; put(el.aim, robX + 6, 86);
      el.catch.classList.toggle("ready", near);
      el.catch.classList.toggle("down", t > 2.1 && t < 2.35);
      el.pop.style.opacity = caught && t < 3.8 ? 1 : 0; put(el.pop, robX + 4, 4, `scale(${caught ? 1 + Math.max(0, .3 - (t - 2.45)) : .6})`);
      // 손가락: 왼손은 조이스틱을 오른쪽으로 민다, 오른손은 표시가 뜨면 잡기를 누른다
      const drag = at(t, .2, .5) * (1 - at(t, 1.95, 2.1));
      el.knob.style.transform = `translate(${drag * 20}px,0)`;
      finger(el.f1, 44 + drag * 20, 140, t > .15 && t < 2.05 ? true : null);
      finger(el.f2, 286, 142, t > 1.75 && t < 2.6 ? (t > 2.08 && t < 2.35) : null);
      el.keyD.classList.toggle("on", t > .2 && t < 2.05);
      el.keySp.classList.toggle("on", t > 2.08 && t < 2.35);
    },
  };
  const scenes = { police: [catchScene], robber: [catchScene] };

  let list = [], idx = 0, t0 = 0, raf = 0, open = false;
  const dots = q(".howDots"), next = q(".howNext");
  // 무대를 카드 폭에 맞춰 늘린다. 낮은 가로 화면에서는 높이에 맞춘다
  const stage = q(".howStage");
  function fit() {
    const w = q(".howCard").clientWidth - 28, z = Math.max(.8, Math.min(w / 320, (innerHeight - 150) / 180));
    stage.style.zoom = z; stage.style.marginInline = "auto";
  }
  addEventListener("resize", () => open && fit());
  function show(i) {
    idx = i; t0 = performance.now();
    q(".howLine").textContent = list[idx].line;
    dots.innerHTML = list.map((_, k) => `<i class="${k === idx ? "on" : ""}"></i>`).join("");
    next.textContent = tt(idx < list.length - 1 ? "next" : "gotIt");
  }
  function loop(now) {
    if (!open) return;
    const s = list[idx], t = (now - t0) / 1000;
    s.draw(t % s.len);
    raf = requestAnimationFrame(loop);
  }
  next.onclick = () => (idx < list.length - 1 ? show(idx + 1) : close());
  q(".howClose").onclick = () => close();
  function close() { open = false; cancelAnimationFrame(raf); sheet.classList.remove("show"); }
  return {
    open(team = "police") {
      list = scenes[team] || scenes.police; open = true; sheet.classList.add("show"); fit(); show(0);
      cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
    },
    close,
  };
}
