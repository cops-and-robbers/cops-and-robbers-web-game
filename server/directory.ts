// 열린 방 목록. 공개로 연 방만 여기에 자기 상태를 알린다. 비밀 방은 알리지 않아서 목록에 나오지 않는다.
// 방은 사람이 들고 날 때와 판이 시작하고 끝날 때만 알리고, 그 사이에는 2분마다 살아 있다고만 알린다.
// 알림이 끊긴 방(서버가 다시 뜨거나 방이 사라진 경우)은 5분 뒤 목록에서 빠진다.
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./index";

export const DIRECTORY_NAME = "all";
export const ENTRY_TTL_MS = 5 * 60_000;
const MAX_LIST = 30;

export interface RoomEntry {
  code: string;
  host: string;
  n: number;
  max: number;
  state: "open" | "full" | "playing";
  at: number;
}

const CODE = /^[A-Z0-9]{4,8}$/;
const STATES = new Set(["open", "full", "playing"]);

export class Directory extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/set") return this.set(await request.json());
    if (request.method === "GET" && url.pathname === "/list") return Response.json({ rooms: await this.list() });
    return new Response("Not found", { status: 404 });
  }

  private async set(body: any): Promise<Response> {
    const code = String(body?.code ?? "");
    if (!CODE.test(code)) return new Response("bad", { status: 400 });
    if (!body.open) {
      await this.ctx.storage.delete(code);
      return new Response(null, { status: 204 });
    }
    const entry: RoomEntry = {
      code,
      host: Array.from(String(body.host ?? "")).slice(0, 6).join(""),
      n: Math.max(0, Math.min(8, Number(body.n) | 0)),
      max: Math.max(1, Math.min(8, Number(body.max) | 0)),
      state: STATES.has(body.state) ? body.state : "open",
      at: Date.now(),
    };
    await this.ctx.storage.put(code, entry);
    return new Response(null, { status: 204 });
  }

  // 모집 중인 방을 먼저, 그 안에서는 최근에 알린 방을 먼저 보여 준다
  private async list(): Promise<Omit<RoomEntry, "at">[]> {
    const now = Date.now();
    const all = await this.ctx.storage.list<RoomEntry>();
    const live: RoomEntry[] = [], stale: string[] = [];
    for (const [code, e] of all) {
      if (now - e.at > ENTRY_TTL_MS) stale.push(code);
      else live.push(e);
    }
    if (stale.length) await this.ctx.storage.delete(stale);
    const rank = { open: 0, full: 1, playing: 2 } as const;
    return live
      .sort((a, b) => rank[a.state] - rank[b.state] || b.at - a.at)
      .slice(0, MAX_LIST)
      .map(({ at: _at, ...rest }) => rest);
  }
}
