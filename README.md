# 경찰과 도둑 웹 미니게임

[경찰과 도둑](https://copsandrobbers.app) 을 설치 없이 웹에서 친구들과 한 판 해 보는 게임이에요. 넓은 동네에서 숨고, 쫓고, 잡아요.

지금은 개발 초기예요. 봇과 혼자 하는 시제품과, 화면 없이 도는 방 서버까지 있어요. 사람끼리 하는 화면은 만드는 중이에요. 순서는 [docs/roadmap.md](docs/roadmap.md) 에 있어요.

## 시작하기

Node 22 와 pnpm 이 필요해요.

```bash
pnpm install
pnpm run check
pnpm run build
```

- `pnpm run check`: 타입, 지도, 방 섞임, 시야 검사와 가짜 접속으로 한 판 돌리기. 전부 내 컴퓨터에서 돌아 비용이 없어요
- `pnpm run build`: 혼자 하는 시제품을 `dist/game.html` 하나로 묶어요. 브라우저로 열면 돼요

구조는 [docs/architecture.md](docs/architecture.md), 기여 방식은 [docs/conventions.md](docs/conventions.md) 를 봐 주세요.

## 저작권

코드와 캐릭터 그림의 권리는 팀 동심지키미에게 있어요. 라이선스를 따로 붙이지 않았으니 허락 없이 다른 곳에 쓸 수 없어요.
