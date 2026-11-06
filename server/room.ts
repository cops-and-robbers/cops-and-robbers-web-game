// 방 하나. 대기 중에는 잠들어 있고, 판이 시작되면 초당 20번 규칙을 돌린다.
// 규칙은 shared/logic.js 를 그대로 쓰고, 사람은 입력만 보낸다.
import { DurableObject } from "cloudflare:workers";
import "../shared/logic.js";
import { eventsFor, viewFor } from "../shared/view.js";
import type { Env } from "./index";
import { DIRECTORY_NAME } from "./directory";

const MAX_PLAYERS = 8;
const COUNT_MS = 3000;
const MAX_NAME = 6;
// 사람끼리 하는 판: 같은 편이 구해 줘야만 감옥에서 나온다. 그만큼 구출을 빠르게, 위치 공개를 드물게 한다
const RESCUE_SEC = 1.2;
const REVEAL_SEC = 35;
// 사람이 폰으로 잡기엔 짧다는 시험 의견이 있어 넓혀 본다
const CATCH_RANGE = 90;
const CATCH_HIT_SEC = 0.16;
const SAY_LINES = 5;
// 처음에는 비밀 방이다. 친구끼리 하는 게임이라 모르는 사람이 갑자기 들어오지 않게 한다
const DEFAULT_SEATS: Seats = { cops: 2, robs: 4, bots: false, open: false };
// 공개 방은 이 간격으로 목록에 살아 있다고 알린다. 목록은 5분 동안 소식이 없는 방을 지운다
const LIST_BEAT_MS = 2 * 60_000;
const TICK_MS = 50;
const TICK_SEC = TICK_MS / 1000;
const MAX_MESSAGE = 200;
const MAX_INPUT_PER_SEC = 20;
const REJOIN_MS = 30_000;
const EMPTY_STOP_MS = 30_000;
const THEMES = ["town", "night", "park", "city", "snow"];

type Side = "cop" | "any" | "rob";
interface Seats {
  cops: number;
  robs: number;
  bots: boolean;
  open: boolean;
}
// 대기실 상태는 접속에 붙여 둔다. 방이 잠들어도 남고 저장 비용이 들지 않는다
interface Attachment {
  token: string;
  pid: string;
  name: string;
  joinedAt: number;
  side: Side;
  seats: Seats;
  agentId?: number;
}
interface Rate {
  windowStart: number;
  count: number;
}
// 규칙 파일은 아직 JavaScript 라 쓰는 부분만 느슨하게 적는다
type Logic = any;
type Game = any;

declare global {
  var createGameLogic: () => Logic;
}

export class Room extends DurableObject<Env> {
  private logic: Logic | null = null;
  private game: Game | null = null;
  private seed = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private emptySince = 0;
  private lost = new Map<string, { agentId: number; at: number }>();
  private lobbyLost = new Map<string, { pid: string; joinedAt: number; side: Side; at: number }>();
  private rates = new Map<WebSocket, Rate>();
  private colo: string | null = null;
  private counting: ReturnType<typeof setTimeout> | null = null;
  private code: string | null = null;
  private listed = "";

  async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    // 잠들 수 있는 방식으로 받는다. 대기실에서 기다리는 동안 실행 시간이 잡히지 않는다.
    this.ctx.acceptWebSocket(pair[1], [`entry:${request.headers.get("X-Entry-Colo") ?? "unknown"}`, `room:${request.headers.get("X-Room-Code") ?? ""}`]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== "string" || raw.length > MAX_MESSAGE) return;
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    switch (msg?.t) {
      case "join":
        return this.onJoin(ws, msg);
      case "start":
        return this.onStart(ws);
      case "side":
        return this.onSide(ws, msg);
      case "seats":
        return this.onSeats(ws, msg);
      case "say":
        return this.onSay(ws, msg);
      case "kick":
        return this.onKick(ws, msg);
      case "input":
        return this.onInput(ws, msg);
      case "ping":
        return this.send(ws, { t: "pong", n: msg.n });
      case "where":
        return this.onWhere(ws);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.leave(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.leave(ws);
  }

  // 들어온 곳과 방 서버 위치를 알려 준다. 위치는 방이 깨어 있는 동안 한 번만 알아낸다
  private async onWhere(ws: WebSocket): Promise<void> {
    if (!this.colo) {
      try {
        const trace = await (await fetch("https://cloudflare.com/cdn-cgi/trace")).text();
        this.colo = /^colo=(.+)$/m.exec(trace)?.[1] ?? "unknown";
      } catch {
        return this.send(ws, { t: "where", entry: this.entryOf(ws), room: "unknown" });
      }
    }
    this.send(ws, { t: "where", entry: this.entryOf(ws), room: this.colo });
  }

  private entryOf(ws: WebSocket): string {
    return this.ctx.getTags(ws).find(tag => tag.startsWith("entry:"))?.slice("entry:".length) ?? "unknown";
  }

  private members(): { ws: WebSocket; me: Attachment }[] {
    const list: { ws: WebSocket; me: Attachment }[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const me = ws.deserializeAttachment() as Attachment | null;
      if (me) list.push({ ws, me });
    }
    return list.sort((a, b) => a.me.joinedAt - b.me.joinedAt);
  }

  private send(ws: WebSocket, data: unknown): void {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      // 끊긴 접속은 닫힘 처리에서 정리한다
    }
  }

  private seats(): Seats {
    return { ...DEFAULT_SEATS, ...this.members()[0]?.me.seats };
  }

  // 방 코드는 접속에 붙여 둔 표에서 읽는다. 방은 자기 이름을 모른다
  private roomCode(): string | null {
    if (!this.code) {
      for (const ws of this.ctx.getWebSockets()) {
        const tag = this.ctx.getTags(ws).find(t => t.startsWith("room:"))?.slice("room:".length);
        if (tag) { this.code = tag; break; }
      }
    }
    return this.code;
  }

  // 공개 방이면 목록에 지금 상태를 알린다. 바뀐 게 없으면 보내지 않는다.
  // 비밀 방은 아무것도 보내지 않고, 공개였다가 닫히거나 모두 나가면 목록에서 빼 달라고 한다
  private report(wasOpen = false, beat = false): void {
    const code = this.roomCode();
    if (!code) return;
    const members = this.members();
    const seats = this.seats();
    const open = seats.open && members.length > 0;
    const max = seats.cops + seats.robs;
    const body = open
      ? { code, open: true, host: members[0].me.name, n: members.length, max, state: this.game || this.counting ? "playing" : members.length >= max ? "full" : "open" }
      : { code, open: false };
    const key = JSON.stringify(body);
    if (!beat && key === this.listed) return;
    if (!open && !wasOpen && !this.listed.includes('"open":true')) return;
    this.listed = key;
    const dir = this.env.DIRECTORY;
    if (!dir) return;
    dir.get(dir.idFromName(DIRECTORY_NAME)).fetch("https://directory/set", { method: "POST", body: key }).catch(() => {});
    if (open) this.ctx.storage.setAlarm(Date.now() + LIST_BEAT_MS).catch(() => {});
  }

  async alarm(): Promise<void> {
    if (this.seats().open && this.members().length) this.report(false, true);
  }

  private broadcastLobby(wasOpen = false): void {
    const members = this.members();
    const hostToken = members[0]?.me.token;
    const seats = this.seats();
    for (const { ws, me } of members) {
      this.send(ws, {
        t: "lobby",
        host: me.token === hostToken,
        you: me.pid,
        players: members.map(m => ({ id: m.me.pid, name: m.me.name, side: m.me.side })),
        cops: seats.cops,
        robs: seats.robs,
        bots: seats.bots,
        open: seats.open,
        max: MAX_PLAYERS,
      });
    }
    this.report(wasOpen);
  }

  private inLobby(): boolean {
    return !this.game && !this.counting;
  }

  // 칸에 들어가면 자리를 맡는다. 걷는 건 화면에서 처리하고 칸이 바뀔 때만 받는다
  private onSide(ws: WebSocket, msg: any): void {
    const me = ws.deserializeAttachment() as Attachment | null;
    if (!me || !this.inLobby() || !this.allowInput(ws)) return;
    const side = msg.side;
    if (side !== "cop" && side !== "any" && side !== "rob") return;
    if (side === me.side) return;
    const seats = this.seats();
    if (side !== "any") {
      const here = this.members().filter(m => m.me.side === side).length;
      if (here >= (side === "cop" ? seats.cops : seats.robs)) {
        this.send(ws, { t: "error", code: "sideFull", side: me.side });
        return;
      }
    }
    ws.serializeAttachment({ ...me, side } satisfies Attachment);
    this.broadcastLobby();
  }

  // 방장이 인원을 정한다. 줄여서 넘치면 가장 나중에 온 사람부터 가운데로 돌아간다
  private onSeats(ws: WebSocket, msg: any): void {
    const members = this.members();
    const me = ws.deserializeAttachment() as Attachment | null;
    if (!me || !this.inLobby() || !this.allowInput(ws)) return;
    if (members[0]?.me.token !== me.token) {
      this.send(ws, { t: "error", code: "notHost" });
      return;
    }
    const cops = Number(msg.cops), robs = Number(msg.robs);
    if (!Number.isInteger(cops) || !Number.isInteger(robs) || cops < 1 || robs < 1) return;
    if (cops + robs > MAX_PLAYERS || cops + robs < members.length) return;
    const before = this.seats();
    const seats: Seats = { cops, robs, bots: !!msg.bots, open: typeof msg.open === "boolean" ? msg.open : before.open };
    const left: Record<Side, number> = { cop: cops, rob: robs, any: Infinity };
    for (const { ws: w, me: m } of members) {
      const side: Side = left[m.side] > 0 ? m.side : "any";
      left[side]--;
      w.serializeAttachment({ ...m, side, seats } satisfies Attachment);
    }
    this.broadcastLobby(before.open);
  }

  // 방장이 내보낸다. 내보낸 사람은 이번에 받은 표로 돌아오지 못한다
  private onKick(ws: WebSocket, msg: any): void {
    const members = this.members();
    const me = ws.deserializeAttachment() as Attachment | null;
    if (!me || !this.inLobby() || members[0]?.me.token !== me.token || msg.id === me.pid) return;
    const target = members.find(m => m.me.pid === msg.id);
    if (!target) return;
    this.send(target.ws, { t: "error", code: "kicked" });
    target.ws.serializeAttachment(null);
    target.ws.close(4003, "kicked");
    this.broadcastLobby();
  }

  private onSay(ws: WebSocket, msg: any): void {
    const me = ws.deserializeAttachment() as Attachment | null;
    if (!me || !this.inLobby() || !this.allowInput(ws)) return;
    if (!Number.isInteger(msg.i) || msg.i < 0 || msg.i >= SAY_LINES) return;
    for (const { ws: w } of this.members()) this.send(w, { t: "say", id: me.pid, i: msg.i });
  }

  private canStart(members: { me: Attachment }[]): boolean {
    if (members.length === 0) return false;
    if (this.seats().bots) return true;
    if (members.length < 2) return false;
    const n = (side: Side) => members.filter(m => m.me.side === side).length;
    return n("cop") + n("any") > 0 && n("rob") + n("any") > 0;
  }

  private onJoin(ws: WebSocket, msg: any): void {
    if (ws.deserializeAttachment()) return;
    const rejoin = typeof msg.token === "string" ? this.lost.get(msg.token) : undefined;

    if (this.game) {
      if (!rejoin || Date.now() - rejoin.at > REJOIN_MS) {
        this.send(ws, { t: "error", code: "playing" });
        ws.close(4001, "playing");
        return;
      }
      const agent = this.game.agents[rejoin.agentId];
      agent.isPlayer = true;
      this.lost.delete(msg.token);
      ws.serializeAttachment({
        token: msg.token,
        pid: crypto.randomUUID().slice(0, 8),
        name: agent.name,
        joinedAt: Date.now(),
        side: agent.team === "police" ? "cop" : "rob",
        seats: this.seats(),
        agentId: rejoin.agentId,
      } satisfies Attachment);
      this.send(ws, { t: "joined", token: msg.token, rejoined: true });
      this.sendStart(ws, agent);
      return;
    }

    // 아무도 없는 방은 만든 사람만 연다. 링크나 코드로 왔는데 비어 있으면 없는 방이다
    if (!this.members().length && !msg.create && !(typeof msg.token === "string" && this.lobbyLost.has(msg.token))) {
      this.send(ws, { t: "error", code: "noRoom" });
      ws.close(4004, "noRoom");
      return;
    }
    const seats = this.seats();
    if (this.counting || this.members().length >= seats.cops + seats.robs) {
      this.send(ws, { t: "error", code: this.counting ? "playing" : "full" });
      ws.close(4002, "full");
      return;
    }
    const back = typeof msg.token === "string" ? this.lobbyLost.get(msg.token) : undefined;
    const fresh = back && Date.now() - back.at <= REJOIN_MS ? back : undefined;
    if (fresh) this.lobbyLost.delete(msg.token);
    const token = fresh ? msg.token as string : crypto.randomUUID();
    const sideBack: Side = fresh && (fresh.side === "any" || this.members().filter(m => m.me.side === fresh.side).length < (fresh.side === "cop" ? seats.cops : seats.robs)) ? fresh.side : "any";
    // 게임 안에서 머리 위에 뜨니 짧게 받는다. 글자가 잘리지 않게 글자 단위로 자른다
    const name = typeof msg.name === "string" ? Array.from(msg.name.replace(/\s+/g, " ").trim()).slice(0, MAX_NAME).join("") : "";
    ws.serializeAttachment({ token, pid: fresh?.pid ?? crypto.randomUUID().slice(0, 8), name: name || "참가자", joinedAt: fresh?.joinedAt ?? Date.now(), side: sideBack, seats } satisfies Attachment);
    this.send(ws, { t: "joined", token });
    this.broadcastLobby();
  }

  private onStart(ws: WebSocket): void {
    const members = this.members();
    const me = ws.deserializeAttachment() as Attachment | null;
    if (!this.inLobby() || !me || members[0]?.me.token !== me.token) {
      this.send(ws, { t: "error", code: "notHost" });
      return;
    }
    if (!this.canStart(members)) {
      this.send(ws, { t: "error", code: "cantStart" });
      return;
    }
    for (const { ws: w } of members) this.send(w, { t: "count", ms: COUNT_MS });
    this.counting = setTimeout(() => {
      this.counting = null;
      const now = this.members();
      if (this.canStart(now)) this.begin(now);
      else this.broadcastLobby();
    }, COUNT_MS);
    this.report();
  }

  private begin(members: { ws: WebSocket; me: Attachment }[]): void {
    const logic = globalThis.createGameLogic();
    logic.CFG.WAIT = Number(this.env.WAIT_SEC);
    logic.CFG.DURATION = Number(this.env.GAME_SEC);
    logic.CFG.AUTO_ESCAPE = false;
    logic.CFG.RESCUE_SEC = RESCUE_SEC;
    logic.CFG.CATCH_R = CATCH_RANGE;
    logic.CFG.CATCH_ASSIST = true;
    logic.CFG.CATCH_HIT_AT = CATCH_HIT_SEC;

    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const theme = THEMES[seed % THEMES.length];
    const seats = this.seats();
    const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
    const shuffle = <T>(list: T[]): T[] => {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    };
    // 고른 편은 바꾸지 않는다. 가운데 사람만 남은 자리로 들어가고, 한쪽이 비지 않게 먼저 채운다
    const cops = members.filter(m => m.me.side === "cop");
    const robs = members.filter(m => m.me.side === "rob");
    const free = shuffle(members.filter(m => m.me.side === "any"));
    if (!seats.bots && !cops.length && free.length) cops.push(free.pop()!);
    if (!seats.bots && !robs.length && free.length) robs.push(free.pop()!);
    for (const m of free) {
      const copLeft = seats.cops - cops.length, robLeft = seats.robs - robs.length;
      (copLeft > 0 && (robLeft <= 0 || rnd() < copLeft / (copLeft + robLeft)) ? cops : robs).push(m);
    }

    const police = seats.bots ? seats.cops : cops.length, robbers = seats.bots ? seats.robs : robs.length;
    const G = logic.newGame({ seed, theme, diff: "normal", police, robbers, reveal: REVEAL_SEC });
    this.seed = seed;
    this.logic = logic;
    this.game = G;
    this.emptySince = 0;
    this.lost.clear();

    const seat = (list: { ws: WebSocket; me: Attachment }[], agents: any[]) => {
      const open = shuffle([...agents]);
      list.forEach(({ ws, me }, i) => {
        const agent = open[i];
        agent.isPlayer = true;
        agent.name = me.name;
        ws.serializeAttachment({ ...me, agentId: agent.id } satisfies Attachment);
        this.sendStart(ws, agent);
      });
    };
    seat(cops, G.police);
    seat(robs, G.robbers);

    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.report();
  }

  private sendStart(ws: WebSocket, agent: any): void {
    const G = this.game;
    this.send(ws, {
      t: "start",
      seed: this.seed,
      theme: G.theme,
      you: agent.id,
      team: agent.team,
      wait: this.logic.CFG.WAIT,
      duration: this.logic.CFG.DURATION,
      police: G.police.length,
      robbers: G.robbers.length,
      rescue: this.logic.CFG.RESCUE_SEC,
      autoEscape: this.logic.CFG.AUTO_ESCAPE,
      catchRange: this.logic.CFG.CATCH_R,
      reveal: G.revealEvery,
    });
  }

  private onInput(ws: WebSocket, msg: any): void {
    const me = ws.deserializeAttachment() as Attachment | null;
    if (!this.game || me?.agentId === undefined || !this.allowInput(ws)) return;
    const agent = this.game.agents[me.agentId];
    const clamp = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
    agent.ix = clamp(msg.x);
    agent.iy = clamp(msg.y);
    agent.sprint = !!msg.s;
    if (msg.c) this.logic.startCatch(this.game, agent);
  }

  // 받는 메시지만 사용량에 잡혀서, 지나치게 보내는 접속은 처리하지 않는다
  private allowInput(ws: WebSocket): boolean {
    const now = Date.now();
    let rate = this.rates.get(ws);
    if (!rate || now - rate.windowStart >= 1000) {
      rate = { windowStart: now, count: 0 };
      this.rates.set(ws, rate);
    }
    rate.count++;
    return rate.count <= MAX_INPUT_PER_SEC;
  }

  private leave(ws: WebSocket): void {
    this.rates.delete(ws);
    const me = ws.deserializeAttachment() as Attachment | null;
    ws.serializeAttachment(null);
    if (!me) return;
    if (this.game && me.agentId !== undefined) {
      // 돌아올 때까지 봇이 대신한다
      this.game.agents[me.agentId].isPlayer = false;
      this.lost.set(me.token, { agentId: me.agentId, at: Date.now() });
    } else if (!this.game) {
      this.lobbyLost.set(me.token, { pid: me.pid, joinedAt: me.joinedAt, side: me.side, at: Date.now() });
      this.broadcastLobby(!!me.seats.open);
    }
  }

  private tick(): void {
    const G = this.game;
    if (!G) return;
    this.logic.step(G, TICK_SEC);

    const members = this.members().filter(m => m.me.agentId !== undefined);
    const events = G.events.splice(0);
    for (const { ws, me } of members) {
      const agent = G.agents[me.agentId as number];
      this.send(ws, viewFor(this.logic, G, agent));
      const list = eventsFor(this.logic, G, agent, events);
      if (list.length) this.send(ws, { t: "e", list });
    }

    if (G.over) return this.finish(G.over.winner, G.over.reason);
    // 비용을 지키는 안전장치. 아무도 없거나 시간을 넘긴 방은 돌리지 않는다
    if (G.t > this.logic.CFG.WAIT + this.logic.CFG.DURATION + 30) return this.finish(null, "timeLimit");
    if (members.length > 0) {
      this.emptySince = 0;
    } else {
      this.emptySince ||= Date.now();
      if (Date.now() - this.emptySince > EMPTY_STOP_MS) this.finish(null, "empty");
    }
  }

  private finish(winner: string | null, reason: string): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const G = this.game;
    const stats = G?.stats;
    this.game = null;
    this.logic = null;
    this.lost.clear();
    for (const { ws, me } of this.members()) {
      this.send(ws, { t: "over", winner, reason, stats, mine: me.agentId !== undefined ? G?.agents[me.agentId].s : undefined });
      const { agentId: _played, ...rest } = me;
      ws.serializeAttachment(rest satisfies Attachment);
    }
    this.broadcastLobby();
  }
}
