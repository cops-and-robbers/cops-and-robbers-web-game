# 운영: 공개 전, 점검, 어드민

## 상태 세 가지

| 상태 | 누가 들어오나 | 열쇠 없이 온 사람이 보는 화면 |
| --- | --- | --- |
| `soon` 공개 전 (처음 값) | 열쇠가 있는 팀만 | "경찰과 도둑 온라인 게임을 만들고 있어요" 와 앱 소개 버튼 |
| `open` 누구나 | 누구나. 열쇠 없이는 허용한 사이트에서 연 접속만 | 첫 화면 |
| `pause` 점검 중 | 아무도 새로 못 들어와요. 열쇠가 있어도 막혀요 | 점검 안내(어드민이 적은 말, 다시 여는 시각) |

- 이미 돌아가는 판은 점검으로 바꿔도 끝까지 가요(한 판 최대 3분 남짓). 그 판에서 끊겼다가 다시 들어오는 건 막혀요
- 바꾸면 늦어도 4초 안에 모든 입구에 닿아요
- 다시 여는 시각은 보여 주기만 해요. 시간이 돼도 저절로 열리지 않아요
- 팀 시험은 공개 전 상태에서 열쇠가 든 주소(`play#key=...`)로 해요. 열쇠 주소는 팀 밖에 보내지 않아요

## 어드민 API

웹사이트(`dongsim-web`) 서버만 불러요. 비밀값을 브라우저로 내려보내지 않아요.

```
GET  https://cops-and-robbers-game.pages.dev/admin/control
PUT  https://cops-and-robbers-game.pages.dev/admin/control
     Authorization: Bearer <ADMIN_KEY>
     { "mode": "pause", "message": "접속이 몰려서 잠깐 막았어요", "until": "2026-11-06T13:00:00+09:00", "by": "찬빈" }
```

- `mode` 는 필수. `message` 80자까지(비우면 기본 문장), `until` 은 날짜와 시각(없으면 `null`), `by` 는 바꾼 사람(20자, 밖으로 내보내지 않아요)
- 비밀값이 틀리면 403, 값이 틀리면 400 과 `{ error }`, 성공하면 저장한 상태를 돌려줘요
- 누구나 읽는 `GET /status` 는 `{ mode, message, until }` 만 줘요. 웹사이트 입구 페이지도 이걸 읽어 버튼을 바꿀 수 있어요(다른 사이트에서 읽어도 돼요)

### 판 결과 (밸런스 보기)

```
GET  https://cops-and-robbers-game.pages.dev/admin/results
     Authorization: Bearer <ADMIN_KEY>
```

최근 판 200개를 최신 것부터 돌려줘요(500개까지 남기고 오래된 것은 지워요). 한 줄에 `at`, `winner`(`police`/`robber`, 사람이 다 나가면 `null`), `reason`, `police`, `robbers`, `humans` 사람 수, `scale` 지도 크기, `theme`, `sec` 출동 뒤 걸린 초, `catches`, `rescues`, `reveals`, `outReveals`, `net` 사람별 네트워크(`team`, 왕복 시간 `p50` `p95` `max` ms, `samples` 잰 횟수, `rejoins` 다시 연결한 횟수), `tick` 서버 계산 간격(`maxGapMs` 가장 긴 간격, `lateTicks` 0.1초를 넘긴 횟수, `ticks`). 이름과 캐릭터 번호는 남기지 않아요.

- 왕복 시간은 폰이 2초마다 재서 핑에 실어 보내요. 메시지가 늘지 않아요
- 서버 계산은 0.05초마다 돌아요. Workers 안에서는 계산하는 동안 시계가 멈춰 계산 시간을 직접 잴 수 없어서, 계산 사이 간격으로 서버가 밀렸는지 봐요 판이 끝날 때 방 서버가 운영 상태 서버(`Control`)의 표에 한 줄 써요.

### 도는 판 수

`GET /live` 는 누구나 읽어요. `{ playing, until }`. 자동 배포가 이 값으로 판이 끝날 때까지 기다려요(`docs/deploy.md`). 팀 시험 중에 머지해도 판이 끝난 뒤에 올라가요.

### 비밀값 넣기 (처음 한 번)

```bash
pnpm exec wrangler secret put ADMIN_KEY
cd gateway && pnpm exec wrangler pages secret put ADMIN_KEY --project-name cops-and-robbers-game
```

같은 값을 웹사이트 서버 환경 변수(예: `GAME_ADMIN_KEY`)에 넣어요. 파일, 커밋, 채팅에 남기지 않아요.

## 웹사이트 쪽 제안 (오늘 저녁 팀 논의용)

### 입구 페이지

- 주소: 새 페이지 하나(예: `/online`). `/game` 은 규칙 소개, `/play` 는 부스 미니게임이라 겹치지 않게
- 내용: 한 줄 소개, 짧은 플레이 영상이나 화면, 버튼 하나. 버튼은 `/status` 를 읽어서
  - `soon`: 버튼 대신 "만들고 있어요" 표시와 앱 소개 링크
  - `open`: "친구랑 바로 하기" → 게임 주소
  - `pause`: "점검하고 있어요"
- 들어오는 길: `/game` 페이지 아래 카드, 홈 섹션 하나. 공개 전에는 사이트에 버튼을 걸지 않거나 "만들고 있어요" 로만
- 게임 주소에 `utm_source=site` 를 붙여 어디서 왔는지 남겨요
- 게임 주소는 지금 `pages.dev` 예요. `play.copsandrobbers.app` 도 같은 입구에 붙여 두었고(2026-11-06), 한국 통신사 지연을 `pages.dev` 와 견준 뒤 어느 쪽을 쓸지 정해요(`docs/architecture.md`)

### 어드민 화면

- 기존 "앱 설정"의 점검 스위치 옆에 "웹게임" 칸을 두거나 페이지 하나(`/admin/webgame`)
- 고를 것: 상태 세 개(확인창 거쳐서), 안내 문장, 다시 여는 시각, 마지막으로 바꾼 사람과 시각
- 웹사이트 서버 경로 하나가 어드민 권한을 확인한 뒤 위 API 를 불러요(`app/api/admin/app-config` 와 같은 방식)

### 어드민에서 더 다룰 만한 값 (아직 서버는 환경 변수로 고정)

| 값 | 지금 | 어드민으로 옮기면 |
| --- | --- | --- |
| 판 길이 | 180초 | 사람 시험 뒤 조정 |
| 대기 시간 | 15초 | |
| 방 인원 상한 | 8명 | 사용량이 걱정될 때 줄임 |
| 공개 방 목록 | 켜짐 | 이상한 방 이름이 보이면 끔 |
| 혼자 해 보기 | 켜짐 | |
| 결과 창 앱 카드 | 켜짐 | 캠페인 주소 바꾸기 |

옮기려면 서버가 이 값을 운영 상태와 함께 읽게 바꿔야 해요. 무엇을 옮길지 정하면 이슈로 만들어요.
