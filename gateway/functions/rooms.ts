// 열린 방 목록. 방 연결과 같은 확인(열쇠, 출처)을 거쳐 목록 서버로 넘긴다.
import { routeToRoom, type RouteEnv } from "../../server/route";

export const onRequest: PagesFunction<RouteEnv> = ({ request, env }) => routeToRoom(request, env);
