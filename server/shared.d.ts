// shared 폴더는 아직 JavaScript 예요. 서버가 쓰는 부분만 적어 둬요.
declare module "*/shared/view.js" {
  export function viewFor(logic: unknown, game: unknown, me: unknown): unknown;
  export function eventsFor(logic: unknown, game: unknown, me: unknown, events: unknown[]): unknown[];
}
