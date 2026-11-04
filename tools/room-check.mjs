// 가짜 접속으로 방 서버를 끝까지 돌려 본다.
//   내 컴퓨터:  node tools/room-check.mjs            (비용 없음)
//   올린 서버:  ROOM_URL=https://... ACCESS_KEY=... [ROOM_HINT=apac-ne] node tools/room-check.mjs --players 4 --seconds 45
// 올린 서버에는 아래 상한을 넘겨 보낼 수 없다. docs/cost-guard.md
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};

const REMOTE = process.env.ROOM_URL;
const PLAYERS = arg("players", 4);
const INPUT_PER_SEC = arg("rate", 5);
const SECONDS = arg("seconds", 14);
const REMOTE_MAX = { players: 4, rate: 5, seconds: 60 };

if (REMOTE && (PLAYERS > REMOTE_MAX.players || INPUT_PER_SEC > REMOTE_MAX.rate || SECONDS > REMOTE_MAX.seconds)) {
  console.error(`올린 서버 시험은 ${JSON.stringify(REMOTE_MAX)} 를 넘길 수 없어요`);
  process.exit(2);
}

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

  const clients = [];
  for (let i = 0; i < PLAYERS; i++) {
    const c = connect(env.base, env.key, code);
    await c.open;
    connections++;
    c.sendJson({ t: "join", name: `시험${i + 1}` });
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

  clients[0].sendJson({ t: "start" });
  sentMessages++;
  await waitFor(() => clients.every(c => c.start), 5000, "시작");
  check(clients.every(c => c.start), "시작 신호를 모두 받아요");
  check(new Set(clients.map(c => c.start.seed)).size === 1, "모두 같은 지도 씨앗을 받아요");
  check(new Set(clients.map(c => c.start.you)).size === PLAYERS, "모두 다른 캐릭터를 맡아요");

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
} catch (error) {
  problems.push(String(error));
  console.error("오류", error);
} finally {
  await env.stop();
}

console.log(problems.length ? `\n문제 ${problems.length}건` : "\n문제 0건");
process.exit(problems.length ? 1 : 0);
