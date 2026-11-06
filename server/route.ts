// 방 코드를 보고 그 방 서버로 연결한다. workers.dev 와 pages.dev 입구가 함께 쓴다.
import { DIRECTORY_NAME } from "./directory";
import { CONTROL_NAME, DEFAULT_CONTROL, type ControlState } from "./control";

export interface RouteEnv {
  ROOMS: DurableObjectNamespace;
  DIRECTORY: DurableObjectNamespace;
  CONTROL: DurableObjectNamespace;
  ACCESS_KEY?: string;
  ADMIN_KEY?: string;
  ALLOWED_ORIGINS: string;
}

const ROOM_PATH = /^\/room\/([A-Z0-9]{4,8})$/;
// 목록을 보는 사람이 많아도 목록 서버 요청이 사람 수만큼 늘지 않게, 같은 입구 서버 안에서는 잠깐 같은 답을 나눠 쓴다
const LIST_SHARE_MS = 4000;
let shared: { at: number; body: string } | null = null;
// 운영 상태도 같은 이유로 잠깐 나눠 쓴다. 어드민이 바꾸면 늦어도 이만큼 뒤에 모든 입구에 닿는다
const CONTROL_SHARE_MS = 4000;
let control: { at: number; state: ControlState } | null = null;

const controlStub = (env: RouteEnv) => env.CONTROL.get(env.CONTROL.idFromName(CONTROL_NAME));

async function readControl(env: RouteEnv): Promise<ControlState> {
  const now = Date.now();
  if (!control || now - control.at > CONTROL_SHARE_MS) {
    try {
      control = { at: now, state: await (await controlStub(env).fetch("https://control/get")).json() };
    } catch {
      // 상태를 못 읽으면 지금처럼 열쇠가 있는 사람만 들인다
      return control?.state ?? DEFAULT_CONTROL;
    }
  }
  return control.state;
}

// 들어올 수 있는지는 운영 상태가 정한다. 누구나(open)면 열쇠가 없어도, 곧 열려요(soon)면 열쇠가 있어야, 점검 중(pause)이면 아무도 못 들어온다.
// 열쇠가 설정되지 않았으면 열쇠로는 아무도 못 들어온다.
// 브라우저 접속은 허용한 사이트에서만 받는다. 검증 도구처럼 Origin 이 없는 접속은 열쇠로 막는다.
// 열쇠 없이 들어올 때 방 연결은 허용한 사이트에서 연 것만 받는다(브라우저는 웹소켓에 Origin 을 꼭 붙인다). 같은 사이트의 목록 요청은 Origin 이 없을 수 있다.
function allowed(request: Request, url: URL, env: RouteEnv, state: ControlState, socket: boolean): boolean {
  if (state.mode === "pause") return false;
  const keyed = !!env.ACCESS_KEY && url.searchParams.get("key") === env.ACCESS_KEY;
  const origin = request.headers.get("Origin");
  const sites = env.ALLOWED_ORIGINS.split(",").map(s => s.trim()).filter(Boolean);
  if (origin && !sites.includes(origin)) return false;
  if (keyed) return true;
  return state.mode === "open" && (!socket || !!origin);
}

// 첫 화면과 웹사이트가 읽는 운영 상태. 누가 바꿨는지는 내보내지 않는다
async function status(env: RouteEnv): Promise<Response> {
  const { mode, message, until } = await readControl(env);
  return Response.json({ mode, message, until }, { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
}

// 길이가 같을 때 끝까지 비교해서, 걸린 시간으로 비밀값을 짐작하지 못하게 한다
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// 어드민 전용. 웹사이트 서버가 비밀값을 붙여 부른다. 브라우저에서 바로 부르지 않는다
async function admin(request: Request, env: RouteEnv): Promise<Response> {
  const given = (request.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!env.ADMIN_KEY || !sameSecret(given, env.ADMIN_KEY)) return new Response("Forbidden", { status: 403 });
  const stub = controlStub(env);
  if (request.method === "GET") return stub.fetch("https://control/get");
  if (request.method !== "PUT") return new Response("Method not allowed", { status: 405 });
  const res = await stub.fetch("https://control/set", { method: "PUT", body: await request.text() });
  if (res.ok) control = null; // 이 입구는 바로 새 상태를 쓴다
  return res;
}

// 최근 판 결과(밸런스 보기용). 운영 상태와 같은 비밀값으로만 읽는다
async function results(request: Request, env: RouteEnv): Promise<Response> {
  const given = (request.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
  if (!env.ADMIN_KEY || !sameSecret(given, env.ADMIN_KEY)) return new Response("Forbidden", { status: 403 });
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  return controlStub(env).fetch("https://control/results");
}

async function listRooms(env: RouteEnv): Promise<Response> {
  const now = Date.now();
  if (!shared || now - shared.at > LIST_SHARE_MS) {
    const res = await env.DIRECTORY.get(env.DIRECTORY.idFromName(DIRECTORY_NAME)).fetch("https://directory/list");
    shared = { at: now, body: await res.text() };
  }
  return new Response(shared.body, { headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export async function routeToRoom(request: Request, env: RouteEnv): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/status") return request.method === "GET" ? status(env) : new Response("Method not allowed", { status: 405 });
  if (url.pathname === "/admin/control") return admin(request, env);
  if (url.pathname === "/admin/results") return results(request, env);
  if (url.pathname === "/rooms") {
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
    if (!allowed(request, url, env, await readControl(env), false)) return new Response("Forbidden", { status: 403 });
    return listRooms(env);
  }
  const match = ROOM_PATH.exec(url.pathname);
  if (!match) return new Response("Not found", { status: 404 });
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("WebSocket only", { status: 426 });
  }
  if (!allowed(request, url, env, await readControl(env), true)) return new Response("Forbidden", { status: 403 });

  // 방은 처음 만들어질 때 자리가 정해지고 옮겨지지 않는다. 위치 지정은 처음 한 번만 듣는다.
  const hint = url.searchParams.get("hint") === "apac-ne" ? { locationHint: "apac-ne" as const } : undefined;
  const stub = env.ROOMS.get(env.ROOMS.idFromName(match[1]), hint);

  const forwarded = new Request(request);
  forwarded.headers.set("X-Entry-Colo", String(request.cf?.colo ?? "local"));
  forwarded.headers.set("X-Room-Code", match[1]);
  return stub.fetch(forwarded);
}
