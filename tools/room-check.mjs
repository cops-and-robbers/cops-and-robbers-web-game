// 가짜 접속으로 방 서버를 끝까지 돌려 본다.
//   내 컴퓨터:  node tools/room-check.mjs            (비용 없음)
//   올린 서버:  ROOM_URL=https://... ACCESS_KEY=... [ROOM_HINT=apac-ne] node tools/room-check.mjs --players 4 --seconds 45
// 올린 서버에는 아래 상한을 넘겨 보낼 수 없다. docs/cost-guard.md
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};

import "../shared/logic.js";

const REMOTE = process.env.ROOM_URL;
const PLAYERS = arg("players", 4);
const INPUT_PER_SEC = arg("rate", 5);
const SECONDS = arg("seconds", 14);
const REMOTE_MAX = { players: 4, rate: 5, seconds: 60 };

if (REMOTE && (PLAYERS > REMOTE_MAX.players || INPUT_PER_SEC > REMOTE_MAX.rate || SECONDS > REMOTE_MAX.seconds)) {
  console.error(`올린 서버 시험은 ${JSON.stringify(REMOTE_MAX)} 를 넘길 수 없어요`);
  process.exit(2);
}

const SITE = "http://site.test";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const problems = [];
const check = (ok, message) => {
  console.log(`${ok ? "통과" : "실패"} ${message}`);
  if (!ok) problems.push(message);
};

async function startLocal() {
  const { unstable_startWorker } = await import("wrangler");
  const worker = await unstable_startWorker({
    config: "wrangler.toml",
    bindings: {
      ACCESS_KEY: { type: "plain_text", value: "local-check" },
      ADMIN_KEY: { type: "plain_text", value: "local-admin" },
      ALLOWED_ORIGINS: { type: "plain_text", value: SITE },
      WAIT_SEC: { type: "plain_text", value: "2" },
      GAME_SEC: { type: "plain_text", value: String(SECONDS - 4) },
    },
    dev: { server: { hostname: "127.0.0.1", port: 0 }, inspector: false, logLevel: "error" },
  });
  await worker.ready;
  return { base: String(await worker.url).replace(/\/$/, ""), key: "local-check", stop: () => worker.dispose() };
}

function connect(base, key, code) {
  const hint = process.env.ROOM_HINT ? `&hint=${process.env.ROOM_HINT}` : "";
  const url = `${base.replace(/^http/, "ws")}/room/${code}?key=${encodeURIComponent(key)}${hint}`;
  const ws = new WebSocket(url);
  const c = {
    ws,
    inbox: [],
    snaps: 0,
    bytes: 0,
    maxOthers: 0,
    minOthers: Infinity,
    events: new Set(),
    token: null,
    host: false,
    start: null,
    over: null,
    errors: [],
    pongs: [],
    lastSnap: null,
    pending: new Map(),
    closed: false,
  };
  ws.addEventListener("message", e => {
    const text = String(e.data);
    const m = JSON.parse(text);
    if (m.t === "s") {
      c.snaps++;
      c.bytes += text.length;
      c.lastSnap = m;
      c.firstSnap ||= m;
      if (m.phase === "play") {
        const enemies = m.others.filter(o => o.team !== m.me.team).length;
        c.maxOthers = Math.max(c.maxOthers, enemies);
        c.minOthers = Math.min(c.minOthers, enemies);
      }
    } else if (m.t === "joined") c.token = m.token;
    else if (m.t === "lobby") c.host = m.host, c.lobby = m;
    else if (m.t === "start") c.start = m;
    else if (m.t === "over") c.over = m;
    else if (m.t === "error") c.errors.push(m.code);
    else if (m.t === "where") c.where = m;
    else if (m.t === "pong") {
      const sent = c.pending.get(m.n);
      if (sent) c.pongs.push(Date.now() - sent);
    } else if (m.t === "e") for (const event of m.list) c.events.add(event.type);
  });
  ws.addEventListener("close", () => (c.closed = true));
  c.open = new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  c.sendJson = data => ws.send(JSON.stringify(data));
  return c;
}

// 열린 방 목록에서 이 방을 찾는다. 입구가 목록을 몇 초씩 나눠 쓰니 바뀔 때까지 기다린다
async function listedAs(base, key, code, want, ms = 9000) {
  const until = Date.now() + ms;
  let found;
  while (Date.now() < until) {
    const res = await fetch(`${base}/rooms?key=${encodeURIComponent(key)}`);
    found = res.ok ? (await res.json()).rooms.find(r => r.code === code) : undefined;
    if (want(found)) return found;
    await sleep(700);
  }
  return found;
}

async function waitFor(condition, ms, label) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (condition()) return true;
    await sleep(50);
  }
  console.log(`시간 초과 ${label}`);
  return false;
}

const env = REMOTE
  ? { base: REMOTE.replace(/\/$/, ""), key: process.env.ACCESS_KEY, stop: async () => {} }
  : await startLocal();

const plannedInputs = PLAYERS * INPUT_PER_SEC * SECONDS;
console.log(`${REMOTE ? "올린 서버" : "내 컴퓨터"} | ${PLAYERS}명 | 입력 초당 ${INPUT_PER_SEC}번 | ${SECONDS}초 | 계획한 입력 약 ${plannedInputs}건`);

const code = `T${Date.now().toString(36).slice(-6).toUpperCase()}`;
let sentMessages = 0;
let connections = 0;

try {
  const wrong = new WebSocket(`${env.base.replace(/^http/, "ws")}/room/${code}?key=wrong`);
  connections++;
  const refused = await new Promise(resolve => {
    wrong.addEventListener("open", () => resolve(false), { once: true });
    wrong.addEventListener("error", () => resolve(true), { once: true });
  });
  check(refused, "열쇠가 틀리면 방에 못 들어와요");

  // 아무도 없는 방에 코드로 들어오면 없는 방이라고 알려 준다
  {
    const ghost = connect(env.base, env.key, `NO${code}`.slice(0, 8));
    await ghost.open;
    connections++;
    ghost.sendJson({ t: "join", name: "없는방" });
    sentMessages++;
    await waitFor(() => ghost.errors.includes("noRoom"), 3000, "없는 방");
    check(ghost.errors.includes("noRoom"), "아무도 없는 방에 코드로 오면 없는 방이라고 해요");
  }

  const clients = [];
  for (let i = 0; i < PLAYERS; i++) {
    const c = connect(env.base, env.key, code);
    await c.open;
    connections++;
    c.sendJson({ t: "join", name: `시험${i + 1}`, create: i === 0 });
    sentMessages++;
    await waitFor(() => c.token, 5000, "입장");
    clients.push(c);
  }
  await waitFor(() => clients.every(c => c.lobby?.players.length === PLAYERS), 5000, "대기실");
  check(clients.every(c => c.lobby?.players.length === PLAYERS), "모두 같은 대기실 명단을 받아요");
  check(clients.filter(c => c.host).length === 1 && clients[0].host, "방장은 먼저 들어온 한 명이에요");

  clients[0].sendJson({ t: "where" });
  sentMessages++;
  await waitFor(() => clients[0].where, 5000, "위치");
  check(typeof clients[0].where?.entry === "string" && typeof clients[0].where?.room === "string", `들어온 곳과 방 위치를 알려 줘요 (${clients[0].where?.entry}, ${clients[0].where?.room})`);

  clients[1].sendJson({ t: "start" });
  sentMessages++;
  await waitFor(() => clients[1].errors.includes("notHost"), 3000, "방장 아님 거절");
  check(clients[1].errors.includes("notHost") && !clients[0].start, "방장이 아니면 시작하지 못해요");

  // 편 고르기와 인원. 칸이 차면 못 들어가고, 고른 편은 시작해도 그대로다
  if (PLAYERS >= 3) {
    clients[1].sendJson({ t: "seats", cops: 1, robs: PLAYERS });
    sentMessages++;
    await waitFor(() => clients[1].errors.filter(e => e === "notHost").length >= 2, 3000, "방장 아닌 인원 변경 거절");
    check(true, "방장이 아니면 인원을 못 바꿔요");
    clients[0].sendJson({ t: "seats", cops: 1, robs: PLAYERS, bots: false });
    sentMessages++;
    await waitFor(() => clients.every(c => c.lobby?.cops === 1 && c.lobby?.robs === PLAYERS), 3000, "인원 변경");
    check(clients.every(c => c.lobby.cops === 1), "방장이 정한 인원을 모두 받아요");
    clients[1].sendJson({ t: "side", side: "cop" });
    sentMessages++;
    await waitFor(() => clients.every(c => c.lobby.players[1].side === "cop"), 3000, "칸 이동");
    check(true, "칸에 들어가면 모두에게 알려요");
    clients[2].sendJson({ t: "side", side: "cop" });
    sentMessages++;
    await waitFor(() => clients[2].errors.includes("sideFull"), 3000, "꽉 찬 칸 거절");
    check(clients[2].errors.includes("sideFull"), "자리가 찬 칸에는 못 들어가요");
    clients[0].sendJson({ t: "side", side: "rob" });
    sentMessages++;
    await waitFor(() => clients.every(c => c.lobby.players[0].side === "rob"), 3000, "도둑 칸 이동");
  }

  // 방장이 내보내면 그 사람은 나가고 명단에서 빠진다
  if (PLAYERS >= 3) {
    const extra = connect(env.base, env.key, code);
    await extra.open;
    connections++;
    extra.sendJson({ t: "join", name: "나갈사람" });
    sentMessages++;
    await waitFor(() => clients[0].lobby?.players.some(p => p.name === "나갈사람"), 3000, "추가 입장");
    const id = clients[0].lobby.players.find(p => p.name === "나갈사람").id;
    clients[0].sendJson({ t: "kick", id });
    sentMessages++;
    await waitFor(() => extra.errors.includes("kicked") && !clients[0].lobby.players.some(p => p.name === "나갈사람"), 3000, "내보내기");
    check(extra.errors.includes("kicked"), "방장이 내보내면 그 사람은 방에서 나가요");
  }

  // 비밀 방은 목록에 나오지 않고, 방장이 공개로 바꾸면 방장 이름과 인원이 나온다
  if (!REMOTE) {
    const refused = await fetch(`${env.base}/rooms?key=wrong`);
    check(refused.status === 403, "열쇠가 틀리면 방 목록을 못 봐요");
    check(!(await listedAs(env.base, env.key, code, r => !r, 1500)), "비밀 방은 목록에 나오지 않아요");
    const L = clients[0].lobby;
    clients[0].sendJson({ t: "seats", cops: L.cops, robs: L.robs, bots: L.bots, open: true });
    sentMessages++;
    await waitFor(() => clients.every(c => c.lobby?.open), 3000, "공개로 바꾸기");
    check(clients.every(c => c.lobby.open), "방장이 공개로 바꾸면 모두 알아요");
    const shown = await listedAs(env.base, env.key, code, r => r?.n === PLAYERS);
    check(shown?.n === PLAYERS && shown.host === clients[0].lobby.players[0].name && shown.state === "open", `공개 방은 방장 이름과 인원으로 목록에 나와요 (${JSON.stringify(shown)})`);
  }

  clients[0].sendJson({ t: "start" });
  sentMessages++;
  await waitFor(() => clients.every(c => c.start), 9000, "시작");
  if (!REMOTE) {
    const playing = await listedAs(env.base, env.key, code, r => r?.state === "playing");
    check(playing?.state === "playing", "판이 시작하면 목록에 게임 중으로 바뀌어요");
  }
  if (PLAYERS >= 3) {
    check(clients[1].start.team === "police" && clients[0].start.team === "robber", "고른 편은 시작해도 그대로예요");
    check(clients[0].start.police + clients[0].start.robbers === PLAYERS, "봇을 끄면 들어온 사람 수만큼만 판이 열려요");
  }
  check(clients.every(c => c.start), "시작 신호를 모두 받아요");
  check(new Set(clients.map(c => c.start.seed)).size === 1, "모두 같은 지도 씨앗을 받아요");
  check(new Set(clients.map(c => c.start.you)).size === PLAYERS, "모두 다른 캐릭터를 맡아요");
  check(PLAYERS < 2 || new Set(clients.map(c => c.start.team)).size === 2, "둘 이상이면 사람이 경찰과 도둑으로 나뉘어요");

  // 화면은 씨앗으로 같은 지도와 자리를 만들어 그린다. 어긋나면 벽을 통과해 보여요
  await waitFor(() => clients.every(c => c.firstSnap), 3000, "첫 갱신");
  const sameWorld = clients.every(c => {
    const logic = globalThis.createGameLogic();
    const seat = logic.newGame({ seed: c.start.seed, theme: c.start.theme, diff: "normal", police: c.start.police, robbers: c.start.robbers }).agents[c.start.you];
    return seat.team === c.start.team && Math.hypot(seat.x - c.firstSnap.me.x, seat.y - c.firstSnap.me.y) < 80;
  });
  check(sameWorld, "시작 신호의 값으로 화면이 같은 지도와 자리를 만들어요");
  check(typeof clients[0].firstSnap?.nextReveal === "number", "다음 위치 공개 시각을 받아요");

  const startedAt = Date.now();
  let inputRound = 0;
  const startPositions = new Map();
  const waitEnds = clients[0].start.wait * 1000;
  const inputLoop = setInterval(() => {
    inputRound++;
    clients.forEach((c, i) => {
      if (c.ws.readyState !== WebSocket.OPEN || c.over) return;
      const angle = inputRound / 12 + i;
      c.sendJson({ t: "input", x: Math.cos(angle), y: Math.sin(angle), s: inputRound % 40 < 12 ? 1 : 0, c: inputRound % 15 === 0 ? 1 : 0 });
      sentMessages++;
    });
  }, 1000 / INPUT_PER_SEC);

  const pingLoop = setInterval(() => {
    const c = clients[0];
    if (c.ws.readyState !== WebSocket.OPEN) return;
    const n = Date.now();
    c.pending.set(n, n);
    c.sendJson({ t: "ping", n });
    sentMessages++;
  }, 1000);

  await sleep(waitEnds + 500);
  for (const c of clients) startPositions.set(c, { x: c.lastSnap?.me.x, y: c.lastSnap?.me.y });

  // 판 도중 한 명을 끊었다가 다시 들여보낸다
  const leaver = clients[PLAYERS - 1];
  await sleep(1500);
  const leaverToken = leaver.token;
  const leaverAgent = leaver.start.you;
  const othersSnapsBefore = clients[0].snaps;
  leaver.ws.close();
  await sleep(1500);
  check(clients[0].snaps > othersSnapsBefore, "한 명이 끊겨도 나머지 판은 계속돼요");

  const back = connect(env.base, env.key, code);
  await back.open;
  connections++;
  back.sendJson({ t: "join", token: leaverToken });
  sentMessages++;
  await waitFor(() => back.start && back.lastSnap, 5000, "다시 들어오기");
  check(back.start?.you === leaverAgent && !!back.lastSnap, "끊겼다 돌아오면 같은 캐릭터로 이어 해요");
  clients[PLAYERS - 1] = back;

  const stranger = connect(env.base, env.key, code);
  await stranger.open;
  connections++;
  stranger.sendJson({ t: "join", name: "낯선 사람" });
  sentMessages++;
  await waitFor(() => stranger.errors.includes("playing"), 3000, "판 중 입장 거절");
  check(stranger.errors.includes("playing"), "판이 돌아가는 방에는 새로 못 들어와요");

  await waitFor(() => clients.every(c => c.over), (SECONDS + 25) * 1000, "판 끝");
  clearInterval(inputLoop);
  clearInterval(pingLoop);
  const elapsed = (Date.now() - startedAt) / 1000;

  check(clients.every(c => c.over), "판이 끝나면 모두 결과를 받아요");
  check(clients.every(c => c.over?.mine && typeof c.over.mine.caught === "number"), "판이 끝나면 내 기록을 받아요");
  const moved = clients.slice(0, -1).some(c => {
    const a = startPositions.get(c);
    return a?.x !== undefined && (a.x !== c.lastSnap?.me.x || a.y !== c.lastSnap?.me.y);
  });
  check(moved, "입력대로 캐릭터가 움직여요");

  const first = clients[0];
  const rate = first.snaps / elapsed;
  check(rate >= 15, `받은 갱신이 초당 15번 이상이에요 (${rate.toFixed(1)}번)`);
  const hides = clients.some(c => c.minOthers < PLAYERS && c.minOthers !== Infinity);
  check(hides, "시야 밖 상대는 보내지 않아요");

  const rtt = first.pongs.slice().sort((a, b) => a - b);
  const median = rtt[Math.floor(rtt.length / 2)] ?? -1;
  const avgBytes = Math.round(first.bytes / Math.max(1, first.snaps));
  const estimatedRequests = Math.ceil(sentMessages / 20) + connections;
  console.log("");
  console.log(`결과 ${first.over?.winner ?? "없음"} (${first.over?.reason})`);
  console.log(`왕복 지연 중간값 ${median}ms | 갱신 한 번 평균 ${avgBytes}바이트 | 진행 ${elapsed.toFixed(0)}초`);
  console.log(`보낸 메시지 ${sentMessages}건 | 접속 ${connections}번 | 요청으로 치면 약 ${estimatedRequests}건 (하루 무료 100,000건)`);

  for (const c of clients) if (c.ws.readyState === WebSocket.OPEN) c.ws.close();
  if (stranger.ws.readyState === WebSocket.OPEN) stranger.ws.close();
  if (!REMOTE) {
    const gone = await listedAs(env.base, env.key, code, r => !r);
    check(!gone, "모두 나가면 목록에서 빠져요");
    await checkControl(env);
  }
} catch (error) {
  problems.push(String(error));
  console.error("오류", error);
} finally {
  await env.stop();
}

console.log(problems.length ? `\n문제 ${problems.length}건` : "\n문제 0건");
process.exit(problems.length ? 1 : 0);

// 운영 상태: 곧 열려요는 열쇠가 있어야, 누구나는 허용한 사이트에서 연 접속만, 점검 중은 아무도 못 들어온다
async function checkControl(env) {
  const status = async () => (await fetch(`${env.base}/status`)).json();
  const put = (body, key = "local-admin") => fetch(`${env.base}/admin/control`, { method: "PUT", headers: { Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
  const opens = (key, headers) => new Promise(resolve => {
    const ws = new WebSocket(`${env.base.replace(/^http/, "ws")}/room/CTRL1?key=${encodeURIComponent(key)}`, headers ? { headers } : undefined);
    ws.addEventListener("open", () => { ws.close(); resolve(true); }, { once: true });
    ws.addEventListener("error", () => resolve(false), { once: true });
  });
  check((await status()).mode === "soon", "아무도 정하지 않았으면 곧 열려요예요");
  check(!(await opens("")) && (await opens(env.key)), "곧 열려요에는 열쇠가 있어야 들어와요");
  check((await put({ mode: "open" }, "wrong")).status === 403, "어드민 비밀값이 틀리면 상태를 못 바꿔요");
  check((await put({ mode: "late" })).status === 400, "없는 상태로는 못 바꿔요");
  check((await put({ mode: "open", by: "검사" })).ok && (await status()).mode === "open", "어드민이 누구나로 바꾸면 바로 읽혀요");
  check((await fetch(`${env.base}/rooms`)).ok, "누구나일 때는 열쇠 없이 목록을 봐요");
  check(await opens("", { Origin: SITE }), "누구나일 때는 허용한 사이트에서 열쇠 없이 들어와요");
  check(!(await opens("")) && !(await opens("", { Origin: "https://other.test" })), "누구나여도 다른 사이트나 Origin 없는 접속은 열쇠가 있어야 해요");
  await put({ mode: "pause", message: "서버를 고치고 있어요", until: "2026-11-06T13:00:00Z" });
  const paused = await status();
  check(paused.mode === "pause" && paused.message === "서버를 고치고 있어요" && paused.until === "2026-11-06T13:00:00.000Z" && !("by" in paused), "점검 중과 안내를 읽고, 바꾼 사람은 내보내지 않아요");
  check(!(await opens(env.key)) && (await fetch(`${env.base}/rooms?key=${env.key}`)).status === 403, "점검 중에는 열쇠가 있어도 못 들어와요");
  await put({ mode: "soon" });
  // 앞에서 돌린 한 판의 결과가 남았는지. 비밀값 없이는 못 읽고, 이름은 들어가지 않는다
  const results = key => fetch(`${env.base}/admin/results`, { headers: { Authorization: `Bearer ${key}` } });
  check((await results("wrong")).status === 403, "판 결과는 어드민 비밀값이 틀리면 못 읽어요");
  const rows = await (await results("local-admin")).json().catch(() => []);
  const last = rows[0];
  check(Array.isArray(rows) && last && "winner" in last && last.humans >= 1 && last.scale >= 1 && !JSON.stringify(rows).includes("시험"), "판이 끝나면 결과 한 줄이 이름 없이 남아요");
}
