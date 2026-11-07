# 배포

`main` 에 머지되면 GitHub Actions(`.github/workflows/deploy.yml`)가 올려요. 손으로 올릴 일은 시험 서버를 따로 띄울 때뿐이고, 그때는 `safe-deploy` 스킬을 따라요.

## 순서

1. `pnpm run check`: 타입, 지도, 방 섞임, 시야, 가짜 접속 한 판
2. 오늘 사용량(`tools/usage-guard.mjs`): Worker 요청과 Durable Object 요청을 더해 하루 10만 건, 실행량은 1만 3천 GB-s 기준. 하나라도 70% 를 넘거나 조회가 안 되면 여기서 멈춰요
3. 빌드(`pnpm run build`)
4. 도는 판 기다리기(`tools/wait-live.mjs`): 방 서버를 새로 올리면 메모리에 있던 판이 사라져요. `/live` 를 20초마다 읽어 도는 판이 없을 때 넘어가요. 10분을 기다려도 판이 계속 돌거나 `/live` 를 못 읽으면 여기서 멈춰요
5. 방 서버(Worker). 대기 15초, 판 180초, 허용 사이트는 `pages.dev` 입구
6. `pages.dev` 입구
7. 확인: `/play` 가 뜨고 `/status` 가 운영 상태를 돌려주는지

기다린 뒤 올리기 시작하는 1~2분 사이에 새 판이 시작되면 그 판은 끊길 수 있어요. 판이 아무리 길어도 4분 남짓이라, 그 틈은 남겨 두었어요.

게임 화면, 서버, 입구, 빌드, 의존성을 바꾼 머지만 올려요. 문서만 바꾼 머지는 올리지 않아요. Actions 탭의 Deploy 에서 손으로 다시 돌릴 수도 있어요(`Run workflow`).

## 처음 한 번 설정

공개 저장소라 토큰은 저장소 파일이 아니라 GitHub 비밀값에 넣어요.

1. Cloudflare 대시보드 > 내 프로필 > API 토큰 > 사용자 지정 토큰. 이 계정 하나만 고르고 권한 세 개만 줘요
   - 계정 > Workers 스크립트: 편집
   - 계정 > Cloudflare Pages: 편집
   - 계정 > 계정 분석: 읽기
2. GitHub 저장소 > Settings > Environments 에서 `production` 을 만들고, 배포할 수 있는 브랜치를 `main` 하나로 정해요
3. `production` 환경 비밀값 두 개
   - `CLOUDFLARE_API_TOKEN`: 1번에서 만든 토큰
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare 대시보드 오른쪽 아래 계정 ID
4. 방 열쇠(`ACCESS_KEY`)와 어드민 비밀값(`ADMIN_KEY`)은 Cloudflare 에만 넣고 GitHub 에는 넣지 않아요. 방 서버와 입구 둘 다 넣어요(`docs/ops.md`)

## 멈췄을 때

| 멈춘 곳 | 할 일 |
| --- | --- |
| Usage today: 한도에 가까움 | 오전 9시(UTC 0시)에 풀려요. 급하면 무엇이 요청을 쓰는지 먼저 봐요 |
| Usage today: 조회 실패 | 토큰 권한(계정 분석 읽기)과 계정 ID 를 확인해요. 조회 한도에 걸렸으면 5분 뒤 다시 돌려요 |
| Wait for running games: 판이 계속 돎 | 공개 뒤 판이 끊이지 않으면 생겨요. 조금 뒤 다시 돌리거나, 급하면 Actions > Deploy > Run workflow 에서 `force` 를 켜고 돌려요. 그때 돌던 판은 끊겨요 |
| Wait for running games: 읽지 못함 | 입구나 운영 상태 서버가 응답하지 않아요. 판이 끊길 수 있어 올리지 않았어요. `/live` 가 뜨는지 먼저 봐요 |
| Room server, Gateway | 토큰 권한(Workers, Pages 편집)을 확인해요 |
| Smoke test | 방금 올린 화면이나 입구 함수가 깨졌어요. 직전 커밋으로 되돌린 PR 을 머지하면 다시 올라가요 |
