# 배포

`main` 에 머지되면 GitHub Actions(`.github/workflows/deploy.yml`)가 올려요. 손으로 올릴 일은 시험 서버를 따로 띄울 때뿐이고, 그때는 `safe-deploy` 스킬을 따라요.

## 순서

1. `pnpm run check`: 타입, 지도, 방 섞임, 시야, 가짜 접속 한 판
2. 오늘 사용량(`tools/usage-guard.mjs`): Worker 요청과 Durable Object 요청을 더해 하루 10만 건, 실행량은 1만 3천 GB-s 기준. 하나라도 70% 를 넘거나 조회가 안 되면 여기서 멈춰요
3. 빌드(`pnpm run build`)
4. 방 서버(Worker). 대기 15초, 판 180초, 허용 사이트는 `pages.dev` 입구
5. `pages.dev` 입구
6. 확인: `/play` 가 뜨고 `/status` 가 운영 상태를 돌려주는지

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
| Room server, Gateway | 토큰 권한(Workers, Pages 편집)을 확인해요 |
| Smoke test | 방금 올린 화면이나 입구 함수가 깨졌어요. 직전 커밋으로 되돌린 PR 을 머지하면 다시 올라가요 |
