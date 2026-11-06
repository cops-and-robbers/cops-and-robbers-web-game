# 주고받는 내용

`/room/<코드>?key=<열쇠>` 로 WebSocket 을 열어요. 코드는 대문자와 숫자 4~8자예요. 측정할 때만 `&hint=apac-ne` 로 방이 처음 생길 위치를 지정해요. 메시지는 지금 JSON 이고, 동작을 확인한 뒤 숫자만 담는 형식으로 줄일 수 있어요.

## 화면이 보내는 것

| `t` | 내용 |
| --- | --- |
| `join` | `name` 처음 입장, `token` 끊겼다 돌아올 때 |
| `start` | 방장만 보낼 수 있어요. 3초 뒤 시작해요 |
| `side` | `side` `cop`, `any`, `rob`. 칸이 바뀔 때만 보내요 |
| `seats` | 방장만. `cops`, `robs`, `bots`, `open` 공개 방. 합쳐서 8명까지. `open` 을 빼면 그대로 둬요 |
| `say` | `i` 정해진 말 번호 |
| `input` | `x`, `y` -1~1 이동, `s` 달리기, `c` 잡기. 초당 20번을 넘으면 버려요 |
| `ping` | `n` 지연 측정 |
| `where` | 들어온 곳과 방 서버 위치 묻기 |

200자를 넘는 메시지는 버려요.

## 서버가 보내는 것

| `t` | 내용 |
| --- | --- |
| `joined` | `token` 돌아올 때 쓰는 값 |
| `lobby` | `players` 명단(`id`, `name`, `side`), `you`, `host` 내가 방장인지, `cops`, `robs`, `bots`, `open`, `max` |
| `count` | `ms` 시작까지 남은 시간 |
| `say` | `id` 말한 사람, `i` 정해진 말 번호 |
| `start` | `seed` 같은 지도를 만드는 값, `scale` 지도 크기(인원 4명까지 1, 8명이면 1.2), `theme`, `you` 내 캐릭터 번호, `team`, `wait`, `duration`, `police`, `robbers` 판의 인원, `rescue`, `autoEscape`, `catchRange`, `reveal` 이 판의 규칙 값 |
| `s` | 갱신. `time`, `phase`, `me`(도둑은 `out` 구역 밖에 있은 초), `others`, `pings`, `rescue`, `nextReveal`, `freeRobbers`, 경찰은 `intel` |
| `e` | 사건 목록. 위치는 싣지 않아요. 구역 밖 공개가 시작되면 `outReveal`(`r` 그 도둑) 한 번 |
| `over` | `winner`, `reason`, `stats`, `mine` 내 기록 |
| `pong` | `n` |
| `where` | `entry` 들어온 Cloudflare 위치, `room` 방 서버 위치 |
| `error` | `code`: `notHost`, `playing`, `full`, `sideFull`(`side` 내 칸), `cantStart` |

## 열린 방 목록

`GET /rooms?key=<열쇠>` 는 공개 방 목록을 JSON 으로 돌려줘요. `rooms` 안에 `code`, `host` 방장 이름, `n` 들어온 사람, `max` 자리, `state` `open`/`full`/`playing`. 모집 중인 방이 먼저 오고 30개까지예요.

- 방은 처음에 비밀 방이에요. 방장이 공개로 바꾼 방만 목록 서버(`Directory`)에 알려요. 비밀 방은 아무것도 보내지 않아 목록에 나오지 않아요
- 방은 사람이 들고 날 때, 판이 시작하고 끝날 때, 공개를 바꿀 때만 알리고, 바뀐 게 없으면 보내지 않아요. 그 사이에는 2분마다 살아 있다고만 알려요
- 목록 서버는 5분 동안 소식이 없는 방을 지워요. 서버가 다시 떠서 방이 알리지 못한 경우를 위한 거예요
- 입구는 같은 서버 안에서 4초 동안 같은 목록을 나눠 써요. 화면은 목록을 보는 동안 5초마다 받아 와요

## 운영 상태

`GET /status` 는 누구나 읽어요. `{ mode, message, until }`. `mode` 는 `open`(누구나), `soon`(공개 전, 열쇠가 있는 사람만), `pause`(점검 중, 아무도 새로 못 들어옴). 첫 화면이 이 값으로 공개 전 화면, 점검 화면, 첫 화면을 골라요. 바꾸는 법은 `docs/ops.md`.

## 누구에게 무엇을 보내나

| 정보 | 받는 사람 |
| --- | --- |
| 내 시야 안의 상대 | 그 사람만 |
| 같은 팀 | 같은 팀 |
| 위치 공개 표시(35초마다, 구역 밖 5초 넘으면 1초마다) | 경찰 전체, 도둑은 자기 표시만 |
| 잡기 시도와 실패 | 그 장면이 보이는 사람 |
| 체포, 탈옥, 구조, 남은 시간, 승패 | 전체 |
