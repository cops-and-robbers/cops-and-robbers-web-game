// 지금 도는 판 수. 자동 배포가 판이 끝날 때까지 기다리는 데 쓴다.
import { routeToRoom, type RouteEnv } from "../../server/route";

export const onRequest: PagesFunction<RouteEnv> = ({ request, env }) => routeToRoom(request, env);
