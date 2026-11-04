# 주고받는 내용

`/room/<코드>?key=<열쇠>` 로 WebSocket 을 열어요. 코드는 대문자와 숫자 4~8자예요. 측정할 때만 `&hint=apac-ne` 로 방이 처음 생길 위치를 지정해요. 메시지는 지금 JSON 이고, 동작을 확인한 뒤 숫자만 담는 형식으로 줄일 수 있어요.

## 화면이 보내는 것

| `t` | 내용 |
| --- | --- |
| `join` | `name` 처음 입장, `token` 끊겼다 돌아올 때 |
| `start` | 방장만 보낼 수 있어요 |
| `input` | `x`, `y` -1~1 이동, `s` 달리기, `c` 잡기. 초당 20번을 넘으면 버려요 |
| `ping` | `n` 지연 측정 |
| `where` | 들어온 곳과 방 서버 위치 묻기 |

200자를 넘는 메시지는 버려요.

## 서버가 보내는 것

| `t` | 내용 |
| --- | --- |
| `joined` | `token` 돌아올 때 쓰는 값 |
| `lobby` | `players` 명단, `host` 내가 방장인지, `max` |
| `start` | `seed`, `theme`, `you` 내 캐릭터 번호, `team`, `wait`, `duration` |
| `s` | 갱신. `time`, `phase`, `me`, `others`, `pings`, `rescue`, `freeRobbers`, 경찰은 `intel` |
| `e` | 사건 목록. 위치는 싣지 않아요 |
| `over` | `winner`, `reason`, `stats` |
| `pong` | `n` |
| `where` | `entry` 들어온 Cloudflare 위치, `room` 방 서버 위치 |
| `error` | `code`: `notHost`, `playing`, `full` |

## 누구에게 무엇을 보내나

| 정보 | 받는 사람 |
| --- | --- |
| 내 시야 안의 상대 | 그 사람만 |
| 같은 팀 | 같은 팀 |
| 위치 공개 표시 | 경찰 전체, 도둑은 자기 표시만 |
| 잡기 시도와 실패 | 그 장면이 보이는 사람 |
| 체포, 탈옥, 구조, 남은 시간, 승패 | 전체 |
