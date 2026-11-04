// 방 하나. 대기 중에는 잠들어 있고, 판이 시작되면 초당 20번 규칙을 돌린다.
// 규칙은 shared/logic.js 를 그대로 쓰고, 사람은 입력만 보낸다.
import { DurableObject } from "cloudflare:workers";
import "../shared/logic.js";
import { eventsFor, viewFor } from "../shared/view.js";
import type { Env } from "./index";

const MAX_PLAYERS = 6;
const TICK_MS = 50;
const TICK_SEC = TICK_MS / 1000;
const MAX_MESSAGE = 200;
const MAX_INPUT_PER_SEC = 20;
const REJOIN_MS = 30_000;
const EMPTY_STOP_MS = 30_000;
const THEMES = ["town", "night", "park", "city", "snow"];

interface Attachment {
  token: string;
  name: string;
  joinedAt: number;
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
  private rates = new Map<WebSocket, Rate>();
  private colo: string | null = null;

  async fetch(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    // 잠들 수 있는 방식으로 받는다. 대기실에서 기다리는 동안 실행 시간이 잡히지 않는다.
    this.ctx.acceptWebSocket(pair[1], [`entry:${request.headers.get("X-Entry-Colo") ?? "unknown"}`]);
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

  private broadcastLobby(): void {
    const members = this.members();
    const hostToken = members[0]?.me.token;
    for (const { ws, me } of members) {
      this.send(ws, {
        t: "lobby",
        host: me.token === hostToken,
        players: members.map(m => m.me.name),
        max: MAX_PLAYERS,
      });
    }
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
        name: agent.name,
        joinedAt: Date.now(),
        agentId: rejoin.agentId,
      } satisfies Attachment);
      this.send(ws, { t: "joined", token: msg.token, rejoined: true });
      this.sendStart(ws, agent);
      return;
    }

    if (this.members().length >= MAX_PLAYERS) {
      this.send(ws, { t: "error", code: "full" });
      ws.close(4002, "full");
      return;
    }
    const token = crypto.randomUUID();
    const name = typeof msg.name === "string" ? msg.name.trim().slice(0, 12) : "";
    ws.serializeAttachment({ token, name: name || "참가자", joinedAt: Date.now() } satisfies Attachment);
    this.send(ws, { t: "joined", token });
    this.broadcastLobby();
  }

  private onStart(ws: WebSocket): void {
    const members = this.members();
    const me = ws.deserializeAttachment() as Attachment | null;
    if (this.game || !me || members[0]?.me.token !== me.token) {
      this.send(ws, { t: "error", code: "notHost" });
      return;
    }
    this.begin(members);
  }

  private begin(members: { ws: WebSocket; me: Attachment }[]): void {
    const logic = globalThis.createGameLogic();
    logic.CFG.WAIT = Number(this.env.WAIT_SEC);
    logic.CFG.DURATION = Number(this.env.GAME_SEC);

    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const theme = THEMES[seed % THEMES.length];
    const G = logic.newGame({ seed, theme, diff: "normal" });
    this.seed = seed;
    this.logic = logic;
    this.game = G;
    this.emptySince = 0;
    this.lost.clear();

    // 어느 쪽도 기본값으로 두지 않는다. 사람 순서와 자리를 섞어서 앉히고, 빈자리는 봇이 그대로 맡는다.
    // 경찰 자리가 셋에 하나라 사람도 그 비율로 앉힌다. 둘 이상이면 사람끼리 쫓도록 경찰이 꼭 한 명은 있다.
    const shuffle = <T>(list: T[]): T[] => {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(G.rnd() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    };
    const policeSeats = shuffle<any>([...G.police]);
    const robberSeats = shuffle<any>([...G.robbers]);
    const people = shuffle([...members]);
    const policeCount = people.length === 1 ? (G.rnd() < 1 / 3 ? 1 : 0) : Math.min(policeSeats.length, Math.max(1, Math.round(people.length / 3)));
    people.forEach(({ ws, me }, i) => {
      const agent = i < policeCount ? policeSeats[i] : robberSeats[i - policeCount];
      agent.isPlayer = true;
      agent.name = me.name;
      ws.serializeAttachment({ ...me, agentId: agent.id } satisfies Attachment);
      this.sendStart(ws, agent);
    });

    this.timer = setInterval(() => this.tick(), TICK_MS);
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
      this.broadcastLobby();
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
      ws.serializeAttachment({ token: me.token, name: me.name, joinedAt: me.joinedAt } satisfies Attachment);
    }
    this.broadcastLobby();
  }
}
