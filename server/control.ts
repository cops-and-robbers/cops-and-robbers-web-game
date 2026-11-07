// 운영 상태. 어드민(dongsim-web)이 서버에서 바꾸고, 첫 화면과 입구가 읽는다.
//   open  누구나 들어와요
//   soon  곧 열려요. 열쇠가 있는 사람(팀)만 들어와요
//   pause 점검 중. 아무도 새로 못 들어와요. 이미 돌아가는 판은 끝까지 가요
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./index";

export const CONTROL_NAME = "ops";
export const MODES = ["open", "soon", "pause"] as const;
export type Mode = (typeof MODES)[number];

export interface ControlState {
  mode: Mode;
  message: string;      // 점검 안내에 덧붙이는 말. 비우면 화면의 기본 문장
  until: string | null; // 다시 여는 예정 시각(ISO). 보여 주기만 하고 저절로 풀리지 않아요
  at: number;           // 마지막으로 바꾼 때
  by: string;           // 바꾼 사람
}

// 아무도 정하지 않았으면 곧 열려요. 공개는 어드민에서 open 으로 바꿔야 시작된다
export const DEFAULT_CONTROL: ControlState = { mode: "soon", message: "", until: null, at: 0, by: "" };
const MESSAGE_MAX = 80;
const BY_MAX = 20;

export function validate(body: any): ControlState | string {
  if (!MODES.includes(body?.mode)) return "mode 는 open, soon, pause 중 하나예요";
  const message = String(body.message ?? "").trim();
  if (Array.from(message).length > MESSAGE_MAX) return `message 는 ${MESSAGE_MAX}자까지예요`;
  let until: string | null = null;
  if (body.until) {
    const t = new Date(String(body.until));
    if (Number.isNaN(t.getTime())) return "until 은 날짜와 시각이어야 해요";
    until = t.toISOString();
  }
  const by = Array.from(String(body.by ?? "").trim()).slice(0, BY_MAX).join("");
  return { mode: body.mode, message, until, at: Date.now(), by };
}

// 판 결과는 최근 것만 둔다. 밸런스를 볼 만큼이면 되고, 쌓아 두는 기록이 아니다
const RESULTS_KEEP = 500;
const RESULTS_SHOW = 200;
// 판 하나가 아무리 길어도 이 안에 끝난다(대기 15초 + 판 3분 + 여유). 방이 보낸 만료가 이보다 길면 줄인다
const LIVE_MAX_MS = 10 * 60_000;

export class Control extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/get") return Response.json(await this.read());
    // 방 서버가 판이 끝날 때 한 줄 남긴다(server/room.ts saveResult). 밖에서는 어드민 비밀값으로만 읽는다
    if (request.method === "POST" && url.pathname === "/result") {
      const row = await request.json().catch(() => null);
      if (!row || typeof row !== "object") return new Response("Bad result", { status: 400 });
      const sql = this.results();
      sql.exec("INSERT INTO results (at, data) VALUES (?, ?)", Date.now(), JSON.stringify(row));
      sql.exec("DELETE FROM results WHERE id <= (SELECT MAX(id) FROM results) - ?", RESULTS_KEEP);
      return new Response(null, { status: 204 });
    }
    // 판이 도는 방. 방이 시작과 끝에 알리고(server/room.ts reportLive), 자동 배포가 판이 끝날 때까지 기다리는 데 쓴다
    if (request.method === "POST" && url.pathname === "/live") {
      const body = (await request.json().catch(() => null)) as { room?: unknown; on?: unknown; until?: unknown } | null;
      if (!body || typeof body.room !== "string" || body.room.length > 128) return new Response("Bad live", { status: 400 });
      const sql = this.live();
      if (body.on) sql.exec("INSERT OR REPLACE INTO live (room, until) VALUES (?, ?)", body.room, Math.min(Number(body.until) || 0, Date.now() + LIVE_MAX_MS));
      else sql.exec("DELETE FROM live WHERE room = ?", body.room);
      return new Response(null, { status: 204 });
    }
    if (request.method === "GET" && url.pathname === "/live") {
      const sql = this.live();
      // 끝을 알리지 못하고 사라진 방이 배포를 영원히 막지 않게, 만료된 기록은 센 적 없는 것으로 친다
      sql.exec("DELETE FROM live WHERE until < ?", Date.now());
      const row = sql.exec("SELECT COUNT(*) AS n, MAX(until) AS last FROM live").one();
      return Response.json({ playing: Number(row.n), until: row.last ? new Date(Number(row.last)).toISOString() : null });
    }
    if (request.method === "GET" && url.pathname === "/results") {
      const rows = this.results().exec("SELECT data FROM results ORDER BY id DESC LIMIT ?", RESULTS_SHOW).toArray();
      return Response.json(rows.map(r => JSON.parse(String(r.data))));
    }
    if (request.method === "PUT" && url.pathname === "/set") {
      const next = validate(await request.json().catch(() => null));
      if (typeof next === "string") return Response.json({ error: next }, { status: 400 });
      await this.ctx.storage.put("state", next);
      return Response.json(next);
    }
    return new Response("Not found", { status: 404 });
  }

  private live() {
    const sql = this.ctx.storage.sql;
    sql.exec("CREATE TABLE IF NOT EXISTS live (room TEXT PRIMARY KEY, until INTEGER NOT NULL)");
    return sql;
  }

  private results() {
    const sql = this.ctx.storage.sql;
    sql.exec("CREATE TABLE IF NOT EXISTS results (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, data TEXT NOT NULL)");
    return sql;
  }

  private async read(): Promise<ControlState> {
    return (await this.ctx.storage.get<ControlState>("state")) ?? DEFAULT_CONTROL;
  }
}
