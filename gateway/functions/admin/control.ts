// 운영 상태 바꾸기. 웹사이트 어드민 서버만 비밀값을 붙여 부른다.
import { routeToRoom, type RouteEnv } from "../../../server/route";

export const onRequest: PagesFunction<RouteEnv> = ({ request, env }) => routeToRoom(request, env);
