// 운영 상태(누구나, 곧 열려요, 점검 중). 첫 화면과 웹사이트가 읽는다.
import { routeToRoom, type RouteEnv } from "../../server/route";

export const onRequest: PagesFunction<RouteEnv> = ({ request, env }) => routeToRoom(request, env);
