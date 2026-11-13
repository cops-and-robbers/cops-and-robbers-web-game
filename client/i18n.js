// 화면 문구. 한국어가 원문이고 영어, 일본어는 같은 키로 둔다. 서버가 보내는 값(봇 이름, 오류 코드)은 그대로 받고 화면에서만 바꾼다.
// 언어는 주소의 ?lang=, 언어 주소(/en/play, /ja/play), 게임 안에서 고른 언어(localStorage), 브라우저 언어 순서로 정하고, 다 아니면 영어다.
// shell.html 머리에서 먼저 읽혀서 첫 화면이 그려지기 전에 언어가 정해진다. 설계는 docs/i18n.md
const LANGS = ["ko", "en", "ja"];
const LANG_NAMES = { ko: "한국어", en: "English", ja: "日本語" };
// 언어마다 공유 카드가 다른 주소: /play 한국어, /en/play, /ja/play. 내 컴퓨터 파일로 열면 주소를 바꾸지 않고 ?lang= 만 쓴다
const PLAY_PATH = /^(.*?)(?:\/(en|ja))?\/play(?:\.html)?$/;
const LANG = (() => {
  const ok = l => LANGS.includes(l), keep = l => { try { localStorage.setItem("lang", l); } catch { /* 저장이 안 되면 이번에만 그 언어 */ } return l; };
  let q = null; try { q = new URLSearchParams(location.search).get("lang") || new URLSearchParams(location.hash.slice(1)).get("lang"); } catch { /* 주소를 못 읽으면 다음 순서로 */ }
  if (ok(q)) return keep(q);
  const fromPath = PLAY_PATH.exec(location.pathname)?.[2];
  if (fromPath) return keep(fromPath);
  let saved = null; try { saved = localStorage.getItem("lang"); } catch { /* 저장소를 못 쓰는 브라우저 */ }
  if (ok(saved)) return saved;
  for (const l of navigator.languages || [navigator.language || ""]) { const b = String(l).slice(0, 2).toLowerCase(); if (ok(b)) return b; }
  return "en";
})();
// 그 언어의 게임 주소. 초대 링크가 지금 주소를 쓰므로 받은 친구도 같은 언어의 공유 카드를 본다
function langUrl(l) {
  const u = new URL(location.href), m = PLAY_PATH.exec(u.pathname);
  if (u.protocol === "file:" || !m) { u.searchParams.set("lang", l); return u; }
  u.pathname = `${m[1]}${l === "ko" ? "" : "/" + l}/play`; u.searchParams.delete("lang"); return u;
}
if (location.protocol !== "file:" && PLAY_PATH.test(location.pathname)) { const u = langUrl(LANG); if (u.href !== location.href) history.replaceState(history.state, "", u); }
function setLang(l) { if (!LANGS.includes(l) || l === LANG) return; try { localStorage.setItem("lang", l); } catch { /* 저장이 안 돼도 이번 화면은 바꾼다 */ } location.replace(langUrl(l)); }

const I18N = {
  ko: {
    brand: "경찰과 도둑",
    title: "경찰과 도둑 온라인 게임",
    desc: "설치 없이 친구랑 같이 해요. 최대 8명, 한 판 3분이에요.",
    ogAlt: "경찰과 도둑 로고와 경찰, 도둑 캐릭터",
    lang: "언어",
    // 첫 화면
    bubble: "누가 내 치즈<br>훔쳐갔어!!!!🧀",
    create: "방 만들기", joinOpen: "코드로 들어가기", codeLabel: "방 코드", enter: "들어가기", codeRule: "영어와 숫자로 4~8자예요",
    liveNow: "지금 열린 방", seeAll: "모두 보기", solo: "혼자 해 보기", soloSub: "봇이랑 바로 한 판",
    roomsTitle: "열린 방", back: "뒤로", roomOf: n => `${n} 님의 방`,
    roomState: { open: "들어갈 수 있어요", full: "꽉 찼어요", playing: "게임 중" },
    listFail: "목록을 불러오지 못했어요", noRooms: "지금 열린 방이 없어요", retry: "다시 해 보기",
    // 공개 전, 점검
    gateSoonTitle: "경찰과 도둑 온라인 게임을 만들고 있어요", gateSoonMsg: "동네에서 직접 뛰는 경찰과 도둑도 눈여겨봐 주세요",
    gatePauseTitle: "점검하고 있어요", comeBackAt: t => `${t} 다시 와 주세요`, comeBackSoon: "조금 뒤에 다시 와 주세요", seeApp: "앱 구경하기",
    // 앱 안 브라우저, 화면 돌리기
    inappTitle: "크롬이나 사파리에서 열어 주세요", inappSafari: "메뉴에서 Safari로 열어 주세요", inappOpen: "브라우저로 열기", inappCopy: "링크 복사",
    linkCopied: "링크를 복사했어요", pasteIt: "브라우저 주소창에 붙여 넣어 주세요", inappStay: "여기서 할게요",
    rotateTitle: "가로로 돌려 주세요", rotateBody: "가로로 하면 더 넓게 보여요. 돌리면 바로 시작해요.", rotateSkip: "세로로 할게요",
    // 혼자 하기
    pickTeam: "팀을 선택하세요.", copName: "경찰 냥파", copGoal: "도둑 4명을 모두 체포해요", robName: "도둑 도둥이", robGoal: "3분 동안 잡히지 않고 버텨요",
    diffLabel: "난이도", diff: { easy: "쉬움", normal: "보통", hard: "어려움" }, themeLabel: "테마",
    theme: { random: "랜덤", town: "동네", night: "밤 골목", park: "공원", city: "도심", snow: "눈 마을" },
    rules: "<b>시야</b> 바라보는 쪽만 멀리 보여요. 내가 보는 상대도 나를 볼 수 있어요.<br><b>위치 공개</b> 도둑 위치가 주기적으로 경찰에게 공개돼요. 공개되면 바로 자리를 옮겨요.<br><b>숨을 곳</b> 덤불에 숨으면 멀리서 안 보여요. 달리면 흔들려 들켜요. 나무와 쓰레기통 뒤도 시야를 가려요.<br><b>달리기</b> 체력이 다 떨어지면 잠깐 못 달려요. 골목을 돌면 따돌릴 수 있어요.<br><b>구역</b> 도둑이 구역 밖에 5초 넘게 있으면 위치가 경찰에게 보여요.<br><b>감옥</b> 동료가 감옥 앞에 서 있으면 문이 열려요. 밖으로 나가 3초가 지나면 탈옥해요. 그동안은 잡히지 않아요.",
    // 들어가기 전
    invitedBy: n => `${n} 님이 경도 하재요`, nameLabel: "이름", join: "같이 하기", toHome: "처음 화면으로", connecting: "연결하는 중이에요",
    cantEnter: "지금은 들어갈 수 없어요", tryLater: "잠시 뒤에 다시 해 주세요", lostLink: "연결이 끊겼어요. 받은 링크를 다시 열어 주세요",
    reconnectingPlay: "연결이 끊겼어요. 다시 들어가는 중이에요", reconnecting: "다시 연결하는 중이에요", backAgain: "한 번 더 누르면 나가요",
    playingNow: "지금 한 판 하는 중이에요", endsSoon: "3분 안에 끝나요", roomFull: "방이 꽉 찼어요", noRoom: "이 코드로 열린 방이 없어요", kicked: "방장이 내보냈어요",
    // 대기실
    code: "방 코드", copyCode: "방 코드 복사", invite: "친구 부르기", copied: "링크를 복사했어요", quit: "나가기", seats: "인원", cop: "경찰", rob: "도둑",
    hint: "하고 싶은 편으로 걸어가요", wait: n => `${n} 님이 시작하면 바로 넘어가요`, full: "자리가 다 찼어요",
    start: "시작하기", needOne: "친구가 오거나 봇을 켜면 시작할 수 있어요", needCop: "경찰이 한 명은 있어야 해요", needRob: "도둑이 한 명은 있어야 해요",
    bots: "빈자리 봇으로 채우기", bot: "봇", host: "방장", me: "나", kick: "내보내기", addOne: n => `${n} 한 명 늘리기`, removeOne: n => `${n} 한 명 줄이기`,
    open: "공개 방", openSub: "열린 방 목록에 보여요", pub: "공개", sayOpen: "정해진 말 열기",
    say: ["시작할까요", "잠깐만요", "경찰 하고 싶어요", "도둑 하고 싶어요", "친구 부르고 있어요"], isCop: "경찰이에요", isRob: "도둑이에요",
    // 판
    move: "이동", run: "달리기", running: "달리는 중", catch: "잡기", jail: "감옥", soundOff: "소리 끄기", soundOn: "소리 켜기", sec: "초",
    missionCop: "도둑을 찾아 모두 체포하세요", missionRob: "끝날 때까지 잡히지 말고 도망치세요",
    timerWait: "경찰 출동까지", timerLeft: "남은 시간", revealCop: "도둑 위치 공개", revealRob: "내 위치 공개",
    waitCop: "도둑이 도망치는 중이에요", waitRob: "경찰에게서 멀어지는 중이에요",
    jailedManual: "같은 편이 감옥 앞 초록 원에 서면 나갈 수 있어요", jailedAuto: n => `${n}초 뒤 풀려나요. 동료가 감옥 앞에 오면 더 빨리 나갈 수 있어요`,
    inJail: "감옥 밖으로 나가면 3초 뒤 탈옥해요", breaking: n => `${n}초 동안 안 잡혀요. 멀리 달아나요`,
    nextRevealCop: n => `다음 위치 공개까지 ${n}초`, nextRevealRob: n => `내 위치 공개까지 ${n}초`,
    lockIn: "구역 안으로 돌아와요", lockSoon: n => `구역 안으로 돌아와요. ${n}초 뒤 경찰에게 위치가 보여요`, lockSeen: "경찰에게 내 위치가 보이고 있어요. 구역 안으로 돌아와요",
    jailOpening: "감옥 문이 열리고 있어요", friendOpening: "친구가 문을 열고 있어요",
    missed: "놓쳤어요", caughtMe: "잡혔어요. 감옥으로 가요", iCaught: n => `${n}을 잡았어요`, xCaughtY: (a, b) => `${a}이 ${b}을 잡았어요`, xCaught: n => `${n}이 잡혔어요`,
    mateOpened: "동료가 문을 열었어요. 밖으로 뛰어요", doorOpened: "문이 열렸어요. 밖으로 뛰어요", rescuedN: n => `동료 ${n}명을 구했어요`,
    robberOpened: "도둑이 감옥 문을 열었어요", freed: "탈옥했어요. 다시 숨어요",
    dispatchCop: ["시간이 됐어요", "출동!"], dispatchRob: ["경찰이 출동했어요", "조심!"],
    revealedCop: "도둑 위치가 공개됐어요. 빨간 표시가 있는 곳으로 가요", revealedRob: "내 위치가 공개됐어요. 지금 자리를 옮겨요", outRevealCop: "구역 밖으로 나간 도둑이 보여요. 빨간 표시를 따라가요",
    // 결과
    won: "이겼어요!", lost: "졌어요", allArrested: "도둑이 모두 체포됐어요!", timeUp: "제한 시간이 끝났어요!",
    stCatches: "내 체포", stTeamCatches: "팀 체포", stEscaped: "탈옥한 도둑", stCaught: "잡힌 횟수", stRescued: "구한 동료", stHidden: "숨어 있던 시간",
    times: n => `${n}번`, people: n => `${n}명`, secs: n => `${n}초`,
    again: "한 판 더", swap: "역할 바꾸기", appName: "경찰과 도둑 앱", appSub: "동네에서 직접 잡고 도망가요", getApp: "앱 받기",
    // 하는 방법
    arrest: "체포!", close: "닫기", tutCatch: "도둑 발밑에 노란 표시가 뜨면 잡기를 눌러요", next: "다음", gotIt: "다 봤어요",
    // 서버가 붙이는 이름(봇, 이름을 비운 사람). 화면에서만 바꾼다
    // 게임 방법(client/guide.js). touch 는 폰, pc 는 키보드로 할 때. 없으면 text
    guide: "게임 방법",
    guideCopy: {
      team: { all: "모두", police: "경찰", robber: "도둑" }, prev: "이전", next: "다음", done: "다 봤어요", pause: "멈추기", play: "다시 재생",
      steps: [
        {team: "all", title: "경찰은 잡고 도둑은 도망쳐요", text: "경찰은 도둑을 모두 감옥에 가두면 이겨요. 도둑은 끝날 때 한 명이라도 감옥 밖에 있으면 이겨요. 처음 잠깐은 경찰이 감옥 앞에서 기다리니, 도둑은 그동안 멀리 도망쳐요."},
        {team: "all", title: "움직이고 달려요", touch: "왼쪽 조이스틱으로 움직여요. 달리기 버튼을 누르면 빨라져요. 아래 막대가 다 줄어들면 잠깐 달리지 못해요.", pc: "WASD나 방향키로 움직여요. Shift를 누르면 빨라져요. 아래 막대가 다 줄어들면 잠깐 달리지 못해요."},
        {team: "all", title: "앞쪽은 멀리 보여요", text: "앞쪽은 멀리, 다른 쪽은 가까이만 보여요. 수풀에 숨은 도둑은 바로 옆에 가야 보여요. 수풀 안에서 달리면 수풀이 흔들려서 들켜요."},
        {team: "police", title: "노란 표시가 뜨면 잡아요", touch: "도둑 발밑에 노란 표시가 뜨면 잡기 버튼을 눌러요. 잡힌 도둑은 감옥으로 가요.", pc: "도둑 발밑에 노란 표시가 뜨면 Space를 눌러요. 잡힌 도둑은 감옥으로 가요."},
        {team: "all", title: "빨간 표시를 살펴봐요", text: "때때로 경찰 지도에 도둑이 있는 곳이 빨간 표시로 떠요. 빨간 점선 밖에 오래 머문 도둑도 빨간 표시로 떠요."},
        {team: "robber", title: "감옥 문을 열어 줘요", text: "잡히면 감옥에 갇혀요. 같은 편이 감옥 문 앞에 잠깐 서 있으면 문이 열려요. 막 나온 도둑은 잠깐 동안 잡히지 않아요."},
      ],
    },
    names: { 도둥이: "도둥이", 살금이: "살금이", 번개발: "번개발", 치즈손: "치즈손", 냥파: "냥파", 수사반장: "수사반장", 참가자: "참가자" },
  },
  en: {
    brand: "Cops and Robbers",
    title: "Cops and Robbers Online",
    desc: "Play with friends, no install. Up to 8 players, 3 minutes a round.",
    ogAlt: "Cops and Robbers logo with the cop and robber characters",
    lang: "Language",
    bubble: "Who stole<br>my cheese?!!🧀",
    create: "Create room", joinOpen: "Join with code", codeLabel: "Room code", enter: "Join", codeRule: "4 to 8 letters and numbers",
    liveNow: "Open rooms", seeAll: "See all", solo: "Play solo", soloSub: "Jump in with bots",
    roomsTitle: "Open rooms", back: "Back", roomOf: n => `${n}'s room`,
    roomState: { open: "Open", full: "Full", playing: "In a game" },
    listFail: "Couldn't load rooms", noRooms: "No open rooms right now", retry: "Try again",
    gateSoonTitle: "We're building Cops and Robbers Online", gateSoonMsg: "Meanwhile, check out the real-life Cops and Robbers app",
    gatePauseTitle: "Down for maintenance", comeBackAt: t => `Come back around ${t}`, comeBackSoon: "Come back in a bit", seeApp: "See the app",
    inappTitle: "Open in Chrome or Safari", inappSafari: "Open it in Safari from the menu", inappOpen: "Open in browser", inappCopy: "Copy link",
    linkCopied: "Link copied", pasteIt: "Paste it into your browser's address bar", inappStay: "Play here",
    rotateTitle: "Turn your phone sideways", rotateBody: "You'll see more in landscape. The game starts when you turn.", rotateSkip: "Play in portrait",
    pickTeam: "Pick your side.", copName: "Cop Nyangpa", copGoal: "Arrest all 4 robbers", robName: "Robber Dodungi", robGoal: "Don't get caught for 3 minutes",
    diffLabel: "Level", diff: { easy: "Easy", normal: "Normal", hard: "Hard" }, themeLabel: "Theme",
    theme: { random: "Random", town: "Town", night: "Night alley", park: "Park", city: "Downtown", snow: "Snow village" },
    rules: "<b>Vision</b> You see far only in the direction you face. If you can see them, they can see you.<br><b>Reveal</b> Robbers' locations are shown to the cops every so often. When yours is shown, move.<br><b>Hiding</b> Hide in a bush and you can't be seen from afar. Running shakes the bush and gives you away. Trees and trash cans block vision too.<br><b>Running</b> Run out of stamina and you can't run for a moment. Turn corners to lose them.<br><b>Zone</b> A robber outside the zone for more than 5 seconds is shown to the cops.<br><b>Jail</b> The door opens when a teammate stands in front of the jail. Get out and stay out for 3 seconds to break free. You can't be caught until then.",
    invitedBy: n => `${n} invited you to play`, nameLabel: "Name", join: "Join in", toHome: "Back to start", connecting: "Connecting",
    cantEnter: "Can't join right now", tryLater: "Try again in a bit", lostLink: "Disconnected. Reopen your invite link",
    reconnectingPlay: "Disconnected. Getting you back in", reconnecting: "Reconnecting", backAgain: "Press again to leave",
    playingNow: "A round is in progress", endsSoon: "It'll end within 3 minutes", roomFull: "This room is full", noRoom: "No open room with this code", kicked: "The host removed you",
    code: "Room code", copyCode: "Copy room code", invite: "Invite friends", copied: "Link copied", quit: "Leave", seats: "Players", cop: "Cops", rob: "Robbers",
    hint: "Walk to the side you want", wait: n => `Waiting for ${n} to start`, full: "This side is full",
    start: "Start", needOne: "Invite a friend or turn on bots to start", needCop: "You need at least one cop", needRob: "You need at least one robber",
    bots: "Fill empty seats with bots", bot: "Bot", host: "Host", me: "Me", kick: "Remove", addOne: n => `Add one to ${n}`, removeOne: n => `Remove one from ${n}`,
    open: "Public room", openSub: "Shows up in the open rooms list", pub: "Public", sayOpen: "Open quick chat",
    say: ["Shall we start?", "Hold on", "I want to be a cop", "I want to be a robber", "Inviting a friend"], isCop: "You're a cop", isRob: "You're a robber",
    move: "Move", run: "Run", running: "Running", catch: "Catch", jail: "Jail", soundOff: "Mute", soundOn: "Unmute", sec: "s",
    missionCop: "Find and arrest every robber", missionRob: "Run and don't get caught until time's up",
    timerWait: "Cops head out in", timerLeft: "Time left", revealCop: "Robber reveal", revealRob: "Your reveal",
    waitCop: "The robbers are running", waitRob: "Get away from the cops",
    jailedManual: "A teammate on the jail's green circle can free you", jailedAuto: n => `Free in ${n}s. Teammates can free you sooner`,
    inJail: "Step out of the jail to break free in 3s", breaking: n => `Can't be caught for ${n}s. Get far away`,
    nextRevealCop: n => `Next reveal in ${n}s`, nextRevealRob: n => `You'll be revealed in ${n}s`,
    lockIn: "Get back inside the zone", lockSoon: n => `Return to the zone. Visible to cops in ${n}s`, lockSeen: "Cops can see you. Return to the zone",
    jailOpening: "The jail door is opening", friendOpening: "A friend is opening the door",
    missed: "Missed", caughtMe: "Caught. Off to jail", iCaught: n => `You caught ${n}`, xCaughtY: (a, b) => `${a} caught ${b}`, xCaught: n => `${n} got caught`,
    mateOpened: "A teammate opened the door. Run out", doorOpened: "The door is open. Run out", rescuedN: n => `You freed ${n} ${n === 1 ? "teammate" : "teammates"}`,
    robberOpened: "A robber opened the jail door", freed: "You broke free. Hide again",
    dispatchCop: ["It's time", "Go!"], dispatchRob: ["The cops are coming", "Watch out!"],
    revealedCop: "Robbers revealed. Head for the red marks", revealedRob: "You've been revealed. Move now", outRevealCop: "A robber left the zone. Follow the red mark",
    won: "You won!", lost: "You lost", allArrested: "Every robber was arrested!", timeUp: "Time's up!",
    stCatches: "Your arrests", stTeamCatches: "Team arrests", stEscaped: "Robbers escaped", stCaught: "Times caught", stRescued: "Teammates freed", stHidden: "Time hidden",
    times: n => `${n}`, people: n => `${n}`, secs: n => `${n}s`,
    again: "Play again", swap: "Switch sides", appName: "Cops and Robbers app", appSub: "Chase and escape in your neighborhood", getApp: "Get the app",
    arrest: "Arrest!", close: "Close", tutCatch: "Yellow mark under a robber? Press Catch", next: "Next", gotIt: "Got it",
    guide: "How to play",
    guideCopy: {
      team: { all: "Everyone", police: "Cops", robber: "Robbers" }, prev: "Back", next: "Next", done: "Got it", pause: "Pause", play: "Replay",
      steps: [
        {team: "all", title: "Chase and hide", text: "Cops win when every robber is in jail. Robbers win if anyone is still free when time runs out. Cops wait at the jail for a moment at the start, so robbers get a head start."},
        {team: "all", title: "Move and run", touch: "Use the joystick on the left to move. Press Run to speed up. When the bar at the bottom runs out, you can't run for a moment.", pc: "Use WASD or the arrow keys to move. Press Shift to speed up. When the bar at the bottom runs out, you can't run for a moment."},
        {team: "all", title: "Look ahead", text: "You can see far ahead, but only close by in other directions. Robbers hiding in bushes only show up when you're very close. Running inside a bush makes it shake and gives you away."},
        {team: "police", title: "Catch on the yellow mark", touch: "When a yellow mark appears under a robber, press Catch. The robber goes to jail.", pc: "When a yellow mark appears under a robber, press Space. The robber goes to jail."},
        {team: "all", title: "Watch for red marks", text: "Every so often, red marks on the cops' map show where the robbers are. Robbers who stay outside the red dotted line too long also show up as red marks."},
        {team: "robber", title: "Let your teammates out", text: "Caught robbers are locked in jail. Stand in front of the jail door for a moment to open it for your teammates. Robbers who just got out can't be caught for a short while."},
      ],
    },
    names: { 도둥이: "Dodungi", 살금이: "Sneaky", 번개발: "Flash", 치즈손: "Cheesehands", 냥파: "Nyangpa", 수사반장: "Chief", 참가자: "Player" },
  },
  ja: {
    brand: "ケイドロ",
    title: "ケイドロ オンライン",
    desc: "インストールなしで友だちと遊べる。最大8人、1回3分。",
    ogAlt: "ケイドロのロゴと警察、泥棒のキャラクター",
    lang: "言語",
    bubble: "ぼくのチーズ<br>盗んだの誰!!!!🧀",
    create: "部屋をつくる", joinOpen: "コードで入る", codeLabel: "部屋コード", enter: "入る", codeRule: "英数字4-8文字です",
    liveNow: "いま開いている部屋", seeAll: "すべて見る", solo: "ひとりで遊ぶ", soloSub: "ボットとすぐに遊べます",
    roomsTitle: "開いている部屋", back: "戻る", roomOf: n => `${n}さんの部屋`,
    roomState: { open: "入れます", full: "満員", playing: "ゲーム中" },
    listFail: "部屋の一覧を読み込めませんでした", noRooms: "いま開いている部屋はありません", retry: "もう一度",
    gateSoonTitle: "ケイドロ オンラインを準備しています", gateSoonMsg: "外で本当に走るケイドロアプリもチェックしてね",
    gatePauseTitle: "メンテナンス中です", comeBackAt: t => `${t}ごろにまた来てください`, comeBackSoon: "少し待ってまた来てください", seeApp: "アプリを見る",
    inappTitle: "ChromeかSafariで開いてください", inappSafari: "メニューからSafariで開いてください", inappOpen: "ブラウザで開く", inappCopy: "リンクをコピー",
    linkCopied: "リンクをコピーしました", pasteIt: "ブラウザのアドレスバーに貼り付けよう", inappStay: "ここで遊ぶ",
    rotateTitle: "横向きにしてください", rotateBody: "横にすると広く見えます。回すとすぐ始まります。", rotateSkip: "縦のまま遊ぶ",
    pickTeam: "チームを選んでください。", copName: "警察 ニャンパ", copGoal: "泥棒4人を全員逮捕しよう", robName: "泥棒 ドドゥンイ", robGoal: "3分間捕まらずに逃げ切ろう",
    diffLabel: "難易度", diff: { easy: "かんたん", normal: "ふつう", hard: "むずかしい" }, themeLabel: "テーマ",
    theme: { random: "ランダム", town: "住宅街", night: "夜の路地", park: "公園", city: "都心", snow: "雪の町" },
    rules: "<b>視界</b> 向いている方向だけ遠くまで見えます。自分から見える相手には、自分も見えています。<br><b>位置公開</b> 泥棒の位置は一定時間ごとに警察に公開されます。公開されたらすぐ移動してください。<br><b>隠れ場所</b> 茂みに隠れると遠くからは見えません。走ると茂みが揺れてばれます。木やゴミ箱も視界をさえぎります。<br><b>ダッシュ</b> スタミナが切れると少しの間走れません。角を曲がるとまけます。<br><b>エリア</b> 泥棒がエリアの外にいる時間が5秒を超えると、位置が警察に見えます。<br><b>牢屋</b> 仲間が牢屋の前に立つと扉が開きます。外に出て3秒たつと脱獄成功です。その間は捕まりません。",
    invitedBy: n => `${n}さんがケイドロに誘っています`, nameLabel: "名前", join: "参加する", toHome: "最初の画面へ", connecting: "接続中です",
    cantEnter: "いまは入れません", tryLater: "少し待ってもう一度試してください", lostLink: "接続が切れました。招待リンクを開き直してください",
    reconnectingPlay: "接続が切れました。入り直しています", reconnecting: "再接続しています", backAgain: "もう一度押すと退出します",
    playingNow: "いまゲーム中です", endsSoon: "3分以内に終わります", roomFull: "部屋が満員です", noRoom: "このコードの部屋はありません", kicked: "ホストに部屋から出されました",
    code: "部屋コード", copyCode: "部屋コードをコピー", invite: "友だちを呼ぶ", copied: "リンクをコピーしました", quit: "退出", seats: "人数", cop: "警察", rob: "泥棒",
    hint: "やりたいチームのほうへ歩こう", wait: n => `${n}さんのスタートを待っています`, full: "このチームは満員です",
    start: "スタート", needOne: "友だちを呼ぶかボットをオンにしよう", needCop: "警察が1人は必要です", needRob: "泥棒が1人は必要です",
    bots: "空いた席をボットで埋める", bot: "ボット", host: "ホスト", me: "自分", kick: "退出させる", addOne: n => `${n}を1人増やす`, removeOne: n => `${n}を1人減らす`,
    open: "公開部屋", openSub: "開いている部屋の一覧に表示されます", pub: "公開", sayOpen: "定型メッセージを開く",
    say: ["始めようか", "ちょっと待って", "警察やりたい", "泥棒やりたい", "友だち呼んでるよ"], isCop: "警察です", isRob: "泥棒です",
    move: "移動", run: "ダッシュ", running: "ダッシュ中", catch: "捕まえる", jail: "牢屋", soundOff: "音を消す", soundOn: "音を出す", sec: "秒",
    missionCop: "泥棒を見つけて全員逮捕しよう", missionRob: "終わるまで捕まらずに逃げよう",
    timerWait: "警察の出動まで", timerLeft: "残り時間", revealCop: "泥棒の位置公開", revealRob: "自分の位置公開",
    waitCop: "泥棒が逃げています", waitRob: "警察から離れています",
    jailedManual: "仲間が牢屋前の緑の円に立つと出られます", jailedAuto: n => `あと${n}秒で出られます。仲間が来れば早まります`,
    inJail: "牢屋の外に出ると3秒で脱獄できます", breaking: n => `あと${n}秒は捕まりません。遠くへ逃げましょう`,
    nextRevealCop: n => `次の位置公開まで${n}秒`, nextRevealRob: n => `自分の位置公開まで${n}秒`,
    lockIn: "エリアの中に戻ろう", lockSoon: n => `エリアに戻って。${n}秒後に警察に見えるよ`, lockSeen: "警察に見えているよ。エリアに戻ろう",
    jailOpening: "牢屋の扉が開いています", friendOpening: "友だちが扉を開けています",
    missed: "逃しました", caughtMe: "捕まりました。牢屋へ", iCaught: n => `${n}を捕まえました`, xCaughtY: (a, b) => `${a}が${b}を捕まえました`, xCaught: n => `${n}が捕まりました`,
    mateOpened: "仲間が扉を開けたよ。外へ走ろう", doorOpened: "扉が開いたよ。外へ走ろう", rescuedN: n => `仲間を${n}人助けました`,
    robberOpened: "泥棒が牢屋の扉を開けました", freed: "脱獄成功。また隠れよう",
    dispatchCop: ["時間です", "出動!"], dispatchRob: ["警察が出動しました", "気をつけて!"],
    revealedCop: "泥棒の位置が見えるよ。赤い印へ向かおう", revealedRob: "位置が公開されたよ。すぐ移動しよう", outRevealCop: "エリア外の泥棒が見えるよ。赤い印を追おう",
    won: "勝ちました!", lost: "負けました", allArrested: "泥棒が全員逮捕されました!", timeUp: "制限時間が終わりました!",
    stCatches: "自分の逮捕", stTeamCatches: "チームの逮捕", stEscaped: "脱獄した泥棒", stCaught: "捕まった回数", stRescued: "助けた仲間", stHidden: "隠れていた時間",
    times: n => `${n}回`, people: n => `${n}人`, secs: n => `${n}秒`,
    again: "もう1回", swap: "役割を変える", appName: "ケイドロアプリ", appSub: "近所で実際に追いかけて逃げよう", getApp: "アプリを入手",
    arrest: "逮捕!", close: "閉じる", tutCatch: "泥棒の足元に黄色い印が出たら「捕まえる」を押そう", next: "次へ", gotIt: "わかった",
    guide: "遊び方",
    guideCopy: {
      team: { all: "みんな", police: "警察", robber: "泥棒" }, prev: "戻る", next: "次へ", done: "わかった", pause: "一時停止", play: "もう一度見る",
      steps: [
        {team: "all", title: "追いかけて、隠れて", text: "警察は泥棒を全員牢屋に入れたら勝ちです。泥棒は時間切れのときに1人でも逃げていれば勝ちです。最初は警察が少しの間牢屋の前で待つので、泥棒はその間に遠くへ逃げましょう。"},
        {team: "all", title: "動いて、走ろう", touch: "左のスティックで動きます。「ダッシュ」を押すと速くなります。下のバーがなくなると、少しの間走れなくなります。", pc: "WASDか矢印キーで動きます。Shiftを押すと速くなります。下のバーがなくなると、少しの間走れなくなります。"},
        {team: "all", title: "前は遠くまで見える", text: "前は遠くまで、それ以外は近くだけ見えます。茂みに隠れた泥棒は、すぐそばまで近づくと見えます。茂みの中で走ると、茂みが揺れて見つかってしまいます。"},
        {team: "police", title: "黄色い印が出たら", touch: "泥棒の足元に黄色い印が出たら、「捕まえる」を押しましょう。捕まった泥棒は牢屋に入ります。", pc: "泥棒の足元に黄色い印が出たら、Spaceを押しましょう。捕まった泥棒は牢屋に入ります。"},
        {team: "all", title: "赤い印をチェック", text: "ときどき警察の地図に赤い印が出て、泥棒がどこにいるかわかります。赤い点線の外に長くいる泥棒も、赤い印で表示されます。"},
        {team: "robber", title: "仲間を牢屋から出そう", text: "捕まると牢屋に閉じ込められます。仲間が牢屋の扉の前に少しの間立つと、扉が開きます。出たばかりの泥棒は、少しの間は捕まりません。"},
      ],
    },
    names: { 도둥이: "ドドゥンイ", 살금이: "こっそり", 번개발: "いなずま", 치즈손: "チーズハンド", 냥파: "ニャンパ", 수사반장: "捜査班長", 참가자: "プレイヤー" },
  },
};
const TX = I18N[LANG];
// 문구 한 줄. 함수면 값을 넣어 부른다
const tt = (key, ...a) => { const v = TX[key] ?? I18N.ko[key]; return typeof v === "function" ? v(...a) : v; };
// 서버가 붙인 이름은 봇이나 빈 이름일 때만 바꾸고, 사람이 정한 이름은 그대로 둔다
const nameOf = n => TX.names[n] ?? n;
document.documentElement.lang = LANG;
if (LANG !== "ko") document.title = tt("title");
// 문서 안의 정해진 문구. data-t 는 글자, data-th 는 굵은 글씨나 줄바꿈이 있는 글, data-ta 는 읽어 주는 이름, data-talt 는 그림 설명
function applyI18n(root = document) {
  const get = k => k.split(".").reduce((o, p) => o?.[p], TX);
  root.querySelectorAll("[data-t]").forEach(e => { const v = get(e.dataset.t); if (typeof v === "string") e.textContent = v; });
  root.querySelectorAll("[data-th]").forEach(e => { const v = get(e.dataset.th); if (typeof v === "string") e.innerHTML = v; });
  root.querySelectorAll("[data-ta]").forEach(e => { const v = get(e.dataset.ta); if (typeof v === "string") e.setAttribute("aria-label", v); });
  root.querySelectorAll("[data-talt]").forEach(e => { const v = get(e.dataset.talt); if (typeof v === "string") e.alt = v; });
  root.querySelectorAll("img[data-logo]").forEach(e => { e.src = LOGOS[LANG]; e.dataset.lang = LANG; });
  root.querySelectorAll("[data-langname]").forEach(e => { e.textContent = LANG_NAMES[LANG]; });
  if (APP_ICONS[LANG]) root.querySelectorAll("img[data-appicon]").forEach(e => { e.src = APP_ICONS[LANG]; });
  root.querySelectorAll("[data-langpick]").forEach(langPick);
}
const LOGOS = { ko: "data:image/svg+xml;base64,/*B64:logo-ko.svg*/", en: "data:image/svg+xml;base64,/*B64:logo-en.svg*/", ja: "data:image/svg+xml;base64,/*B64:logo-ja.svg*/" };
// 결과 화면 앱 카드 아이콘. 한국어는 문서에 이미 들어 있다
const APP_ICONS = { en: "data:image/webp;base64,/*B64:app-icon-en.webp*/", ja: "data:image/webp;base64,/*B64:app-icon-ja.webp*/" };
// 언어 메뉴. 세 개뿐이라 화면을 막지 않는 작은 메뉴로 버튼 옆에 띄운다. 언어 이름은 그 언어로 쓰고 lang 을 붙여 읽어 주는 소리도 그 언어로 나온다
let langMenu = null, langFrom = null;
function langPick(btn) {
  if (btn.dataset.ready) return; btn.dataset.ready = "1";
  btn.addEventListener("click", e => { e.stopPropagation(); langMenu?.classList.contains("show") && langFrom === btn ? closeLangMenu(true) : openLangMenu(btn); });
  btn.addEventListener("keydown", e => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); openLangMenu(btn); } });
}
function openLangMenu(btn) {
  if (!langMenu) {
    langMenu = document.createElement("div"); langMenu.id = "langMenu"; langMenu.setAttribute("role", "menu"); langMenu.setAttribute("aria-label", tt("lang"));
    const check = '<svg class="ck" aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 10.5l3.8 3.8 7.2-8.6"/></svg>';
    langMenu.innerHTML = LANGS.map(l => `<button type="button" role="menuitemradio" aria-checked="${l === LANG}" lang="${l}" translate="no" data-l="${l}" tabindex="-1"><span>${LANG_NAMES[l]}</span>${check}</button>`).join("");
    langMenu.addEventListener("click", e => { const b = e.target.closest("[data-l]"); if (!b) return; if (b.dataset.l === LANG) closeLangMenu(true); else setLang(b.dataset.l); });
    langMenu.addEventListener("keydown", e => {
      const items = [...langMenu.querySelectorAll("[data-l]")], k = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[(k + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus(); }
      else if (e.key === "Home" || e.key === "End") { e.preventDefault(); items[e.key === "Home" ? 0 : items.length - 1].focus(); }
      else if (e.key === "Escape") { e.preventDefault(); closeLangMenu(true); }
      else if (e.key === "Tab") closeLangMenu(false);
    });
    document.body.append(langMenu);
    document.addEventListener("pointerdown", e => { if (langMenu.classList.contains("show") && !langMenu.contains(e.target) && !langFrom?.contains(e.target)) closeLangMenu(false); }, true);
    addEventListener("resize", () => closeLangMenu(false));
  }
  langFrom = btn; btn.setAttribute("aria-expanded", "true");
  // 버튼 오른쪽 끝에 맞추고, 아래 자리가 모자라면 위로 연다
  const r = btn.getBoundingClientRect(), w = Math.max(184, r.width), h = langMenu.offsetHeight || 170, gap = 8;
  const up = innerHeight - r.bottom < h + gap + 8 && r.top > h + gap;
  const left = Math.min(Math.max(8, r.right - w), innerWidth - w - 8);
  Object.assign(langMenu.style, { left: left + "px", top: (up ? r.top - gap - h : r.bottom + gap) + "px", minWidth: w + "px" });
  langMenu.style.setProperty("--from", `${up ? "bottom" : "top"} right`);
  langMenu.classList.toggle("up", up);
  requestAnimationFrame(() => { langMenu.classList.add("show"); langMenu.querySelector('[aria-checked="true"]').focus({ preventScroll: true }); });
}
function closeLangMenu(refocus) {
  if (!langMenu?.classList.contains("show")) return;
  langMenu.classList.remove("show"); langFrom?.setAttribute("aria-expanded", "false");
  if (refocus) langFrom?.focus({ preventScroll: true });
}
