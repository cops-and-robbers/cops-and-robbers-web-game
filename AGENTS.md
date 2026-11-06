# cops-and-robbers-web-game

경찰과 도둑을 웹에서 친구들과 바로 한 판 하는 2.5D 미니게임이에요. 서버가 판정하고, 사람은 입력만 보내요.

```bash
pnpm install
pnpm run check   # 타입, 지도, 방 섞임, 시야, 가짜 접속으로 한 판 (비용 없음)
pnpm run build   # dist/game.html
```

## 절대 규칙

- **공개 저장소예요.** 열쇠, 토큰, 계정 번호, 개인 메일을 파일이나 커밋에 넣지 않아요
- **비용:** Cloudflare 에 올리거나 시험할 때는 `docs/cost-guard.md` 를 먼저 읽고 `safe-deploy` 스킬을 따라요. 검사 CI 는 배포하지 않고, `main` 에 머지되면 `deploy.yml` 이 사용량을 본 뒤 올려요
- **시야:** 못 보는 상대의 위치와 이름은 그 사람에게 보내지 않아요. `shared/view.js` 를 고치면 `pnpm run check:view` 를 돌려요
- **규칙은 한 벌:** 판정은 `shared/logic.js` 에만 둬요. 화면이나 서버에 규칙을 다시 만들지 않아요
- **두 진영은 대등해요.** 경찰도 도둑도 기본값이나 주인공으로 두지 않아요
- 커밋: 한 줄 한국어 `feat: 문장 (#번호)`, 논리 단위로 나눠요. 트레일러와 AI 표시는 넣지 않아요
- 긴 대시 금지, 하이픈 사용
- 사용자에게 보이는 문구는 다음 행동만 말하고, 몰라도 되는 시스템 동작은 쓰지 않아요

## 상황별로 읽는 문서

| 이런 작업을 한다면 | 먼저 읽기 |
| --- | --- |
| 구조 파악, 파일 위치 | `docs/architecture.md` |
| 서버와 화면이 주고받는 내용 | `docs/protocol.md` |
| 배포, 사용량, 비용 | `docs/deploy.md`, `docs/cost-guard.md` |
| 이슈, 브랜치, 커밋, PR | `docs/conventions.md` |
| 무엇을 어떤 순서로 만드는지 | `docs/roadmap.md` |

## 스킬 (.claude/skills)

| 스킬 | 언제 |
| --- | --- |
| `room-check` | 서버나 규칙을 고친 뒤 한 판을 끝까지 돌려 볼 때 |
| `safe-deploy` | Cloudflare 에 올리거나 실제 통신을 시험할 때 |
| `balance-check` | 속도, 사거리, 시야 같은 수치를 바꿀 때 |
