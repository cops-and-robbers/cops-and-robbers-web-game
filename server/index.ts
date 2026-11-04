// 방 코드를 보고 그 방 서버로 연결한다. 규칙은 room.ts 가 돌린다.
export { Room } from "./room";

export interface Env {
  ROOMS: DurableObjectNamespace;
  ACCESS_KEY?: string;
  WAIT_SEC: string;
  GAME_SEC: string;
  ALLOWED_ORIGINS: string;
}

const ROOM_PATH = /^\/room\/([A-Z0-9]{4,8})$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true });

    const match = ROOM_PATH.exec(url.pathname);
    if (!match) return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket only", { status: 426 });
    }

    // 공개 전에는 열쇠가 있어야 방을 열 수 있다. 열쇠가 설정되지 않았으면 아무도 못 들어온다.
    if (!env.ACCESS_KEY || url.searchParams.get("key") !== env.ACCESS_KEY) {
      return new Response("Forbidden", { status: 403 });
    }

    // 브라우저 접속은 허용한 사이트에서만 받는다. 검증 도구처럼 Origin 이 없는 접속은 열쇠로 막는다.
    const origin = request.headers.get("Origin");
    const allowed = env.ALLOWED_ORIGINS.split(",").map(s => s.trim()).filter(Boolean);
    if (origin && !allowed.includes(origin)) {
      return new Response("Forbidden", { status: 403 });
    }

    const id = env.ROOMS.idFromName(match[1]);
    return env.ROOMS.get(id).fetch(request);
  },
} satisfies ExportedHandler<Env>;
