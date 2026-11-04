// workers.dev 입구. 규칙은 room.ts 가 돌린다.
import { routeToRoom, type RouteEnv } from "./route";
export { Room } from "./room";

export interface Env extends RouteEnv {
  WAIT_SEC: string;
  GAME_SEC: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === "/health") return Response.json({ ok: true });
    return routeToRoom(request, env);
  },
} satisfies ExportedHandler<Env>;
