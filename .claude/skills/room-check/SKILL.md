---
name: room-check
description: 방 서버나 규칙을 고친 뒤 비용 없이 내 컴퓨터에서 한 판을 끝까지 돌려 본다. "서버 돌려 봐", "멀티 되는지 봐줘", "방 시험", server 나 shared 를 고친 뒤에 쓴다.
---

# 방 서버 확인

전부 내 컴퓨터에서 돌아 Cloudflare 사용량이 잡히지 않아요.

```bash
pnpm run typecheck
pnpm run check:rooms
pnpm run check:view
pnpm run check:server
```

- `check:server` 는 실제 런타임에서 가짜 접속 4개로 대기실, 시작, 끊김, 재접속, 판 끝까지 돌려요
- 인원과 시간을 바꾸려면 `node tools/room-check.mjs --players 2 --seconds 20`

## 고칠 때 함께 볼 것

- 보내는 내용을 바꿨으면 `docs/protocol.md` 를 고치고, 숨은 상대가 새는 경우를 `tools/viewtest.mjs` 에 더해요
- 실패한 항목을 지우거나 기준을 낮춰서 통과시키지 않아요. 원인을 찾아요
- 결과는 통과 수와 지연, 메시지 수를 그대로 보고해요
