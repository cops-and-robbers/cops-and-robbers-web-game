---
name: safe-deploy
description: Cloudflare 에 방 서버를 올리거나 실제 통신을 시험할 때 쓴다. 돈이 나가지 않게 요금제를 확인하고, 열쇠를 걸고, 적은 트래픽으로 시험한 뒤 사용량을 재고 지운다. "배포", "올려 봐", "실제 서버 시험", "비용 검증" 에 쓴다.
---

# 안전하게 올리기

정식 배포는 `main` 에 머지하면 `deploy.yml` 이 해요(`docs/deploy.md`). 이 스킬은 손으로 시험 서버를 올리거나 실제 통신을 시험할 때 써요.

**순서를 건너뛰지 않아요.** 요금제를 확인하지 못하면 올리지 않고 담당자에게 물어요. 배포는 담당자가 요청했을 때만 해요.

## 1. 요금제 확인
Cloudflare 대시보드 Workers 요금제가 **Free** 인지 확인해요. Paid 면 멈추고 담당자에게 알려요. 무료 요금제는 한도를 넘으면 막히고, 유료 요금제는 청구돼요.

## 2. 오늘 사용량 확인
같은 계정의 다른 서비스와 무료 한도를 함께 쓸 수 있어요. 시험 전 오늘 사용량을 봐요. `CLOUDFLARE_API_TOKEN` 과 `CLOUDFLARE_ACCOUNT_ID` 를 넣고 `node tools/usage-guard.mjs` 를 돌려요. 끝 코드가 0 이 아니면 올리지 않아요.

## 3. 시험용으로 올리기
- 시험 시간을 짧게: `pnpm exec wrangler deploy --var WAIT_SEC:3 --var GAME_SEC:30`
- 열쇠는 무작위로 만들어 `pnpm exec wrangler secret put ACCESS_KEY` 로 넣어요. 파일, 커밋, 로그, 채팅에 남기지 않아요
- 도메인 연결은 담당자 결정 후에 해요. 입구가 바뀌면 지연도 바뀌니 연결 전에 다시 재요

방 서버를 먼저 올린 뒤 `pages.dev` 입구를 올려요. 입구에도 같은 열쇠를 넣어요.
```bash
cd gateway
pnpm exec wrangler pages secret put ACCESS_KEY --project-name cops-and-robbers-game
pnpm exec wrangler pages deploy --project-name cops-and-robbers-game --branch main
```
방 서버에는 입구 주소를 허용해요: `--var "ALLOWED_ORIGINS:https://cops-and-robbers-game.pages.dev"`

## 4. 시험
```bash
ROOM_URL=https://<주소> ACCESS_KEY=<열쇠> node tools/room-check.mjs --players 4 --seconds 35
```
도구가 4명, 초당 5번, 60초를 넘지 못하게 막아요. 이 상한은 늘리지 않아요. 큰 부하 시험이 필요하면 내 컴퓨터에서 해요.

폰에서는 측정 페이지를 열어요: `https://cops-and-robbers-game.pages.dev/#key=<열쇠>&w=<workers 주소>`

## 5. 사용량 재기
**지우기 전에** Cloudflare 수치로 요청과 실행량을 확인하고 계산과 견줘요. 수치는 늦게 집계되니 몇 분 뒤에 다시 봐요. 다르면 원인을 찾은 뒤에 넘어가요.

## 6. 지우기
공개 전에는 시험이 끝나면 서버를 지워요: `pnpm exec wrangler pages project delete cops-and-robbers-game` 와 `pnpm exec wrangler delete`. 지웠는지 두 주소로 확인하고, 결과를 담당자에게 보고해요.
