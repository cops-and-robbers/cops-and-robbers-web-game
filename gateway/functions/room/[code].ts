// pages.dev 입구. 방 서버는 별도 Worker 에 있고 wrangler.toml 의 묶음으로 연결한다.
import { routeToRoom, type RouteEnv } from "../../../server/route";

export const onRequest: PagesFunction<RouteEnv> = ({ request, env }) => routeToRoom(request, env);
