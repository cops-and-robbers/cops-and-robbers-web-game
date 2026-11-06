// 방 코드를 보고 그 방 서버로 연결한다. workers.dev 와 pages.dev 입구가 함께 쓴다.
import { DIRECTORY_NAME } from "./directory";

export interface RouteEnv {
  ROOMS: DurableObjectNamespace;
  DIRECTORY: DurableObjectNamespace;
  ACCESS_KEY?: string;
  ALLOWED_ORIGINS: string;
}

const ROOM_PATH = /^\/room\/([A-Z0-9]{4,8})$/;
// 목록을 보는 사람이 많아도 목록 서버 요청이 사람 수만큼 늘지 않게, 같은 입구 서버 안에서는 잠깐 같은 답을 나눠 쓴다
const LIST_SHARE_MS = 4000;
let shared: { at: number; body: string } | null = null;

// 공개 전에는 열쇠가 있어야 한다. 열쇠가 설정되지 않았으면 아무도 못 들어온다.
// 브라우저 접속은 허용한 사이트에서만 받는다. 검증 도구처럼 Origin 이 없는 접속은 열쇠로 막는다.
function allowed(request: Request, url: URL, env: RouteEnv): boolean {
  if (!env.ACCESS_KEY || url.searchParams.get("key") !== env.ACCESS_KEY) return false;
  const origin = request.headers.get("Origin");
  const sites = env.ALLOWED_ORIGINS.split(",").map(s => s.trim()).filter(Boolean);
  return !origin || sites.includes(origin);
}

async function listRooms(env: RouteEnv): Promise<Response> {
  const now = Date.now();
  if (!shared || now - shared.at > LIST_SHARE_MS) {
    const res = await env.DIRECTORY.get(env.DIRECTORY.idFromName(DIRECTORY_NAME)).fetch("https://directory/list");
    shared = { at: now, body: await res.text() };
  }
  return new Response(shared.body, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export function routeToRoom(request: Request, env: RouteEnv): Response | Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/rooms") {
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
    if (!allowed(request, url, env)) return new Response("Forbidden", { status: 403 });
    return listRooms(env);
  }
  const match = ROOM_PATH.exec(url.pathname);
  if (!match) return new Response("Not found", { status: 404 });
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("WebSocket only", { status: 426 });
  }
  if (!allowed(request, url, env)) return new Response("Forbidden", { status: 403 });

  // 방은 처음 만들어질 때 자리가 정해지고 옮겨지지 않는다. 위치 지정은 처음 한 번만 듣는다.
  const hint = url.searchParams.get("hint") === "apac-ne" ? { locationHint: "apac-ne" as const } : undefined;
  const stub = env.ROOMS.get(env.ROOMS.idFromName(match[1]), hint);

  const forwarded = new Request(request);
  forwarded.headers.set("X-Entry-Colo", String(request.cf?.colo ?? "local"));
  forwarded.headers.set("X-Room-Code", match[1]);
  return stub.fetch(forwarded);
}
