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

export class Control extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/get") return Response.json(await this.read());
    if (request.method === "PUT" && url.pathname === "/set") {
      const next = validate(await request.json().catch(() => null));
      if (typeof next === "string") return Response.json({ error: next }, { status: 400 });
      await this.ctx.storage.put("state", next);
      return Response.json(next);
    }
    return new Response("Not found", { status: 404 });
  }

  private async read(): Promise<ControlState> {
    return (await this.ctx.storage.get<ControlState>("state")) ?? DEFAULT_CONTROL;
  }
}
