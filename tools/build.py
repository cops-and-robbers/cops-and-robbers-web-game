# 파일 하나로 묶는다. 캐릭터 엔진과 SVG 는 playground.html 에서 그대로 가져온다.
import re, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
pg = (ROOT / "client/playground.html").read_text(encoding="utf-8")
scripts = re.findall(r"<script>(.*?)</script>", pg, re.S)
engine = next(s for s in scripts if "window.CharRig" in s)
svgs = re.search(r"const SVGS = \{.*?\};\n", pg, re.S).group(0)
shell = (ROOT / "client/shell.html").read_text(encoding="utf-8")
logic = (ROOT / "shared/logic.js").read_text(encoding="utf-8")
game = (ROOT / "client/game.js").read_text(encoding="utf-8")
net = (ROOT / "client/tutorial.js").read_text(encoding="utf-8") + (ROOT / "client/guide.js").read_text(encoding="utf-8") + (ROOT / "client/solo.js").read_text(encoding="utf-8") + (ROOT / "client/lobby.js").read_text(encoding="utf-8") + (ROOT / "client/net.js").read_text(encoding="utf-8")
css = (ROOT / "client/lobby.css").read_text(encoding="utf-8")
i18n = (ROOT / "client/i18n.js").read_text(encoding="utf-8")
out = shell.replace("</head>", "<style>" + css + "</style>\n</head>", 1).replace("/*ENGINE*/", engine).replace("/*SVGS*/", svgs).replace("/*LOGIC*/", logic).replace("/*GAME*/", game).replace("/*NET*/", net).replace("/*I18N*/", i18n)
# 앱과 같은 그림(로고, 캐릭터, 배경, 경찰차)은 client/brand 에 두고 파일 하나에 묶어 넣는다.
# 작은 그림은 base64 로, 큰 배경은 압축이 잘 되게 SVG 그대로 넣는다
import base64
brand = lambda name: (ROOT / "client/brand" / name).read_bytes()
out = re.sub(r"/\*B64:([\w./-]+)\*/", lambda m: base64.b64encode(brand(m.group(1))).decode(), out)
out = re.sub(r"/\*SVG:([\w.-]+)\*/", lambda m: brand(m.group(1)).decode("utf-8"), out)
import xml.etree.ElementTree as ET, json
def map_art(p):
    root = ET.parse(p).getroot(); vb = [float(v) for v in root.get("viewBox").split()]
    fx, fy = [float(v) for v in (root.get("data-foot") or f"{vb[2] / 2},{vb[3]}").split(",")]
    shapes = []
    for el in root.iter():
        tag, g = el.tag.split("}")[-1], el.get
        if tag == "path": d = g("d")
        elif tag in ("circle", "ellipse"):
            cx, cy = float(g("cx")), float(g("cy")); rx = float(g("r") or g("rx")); ry = float(g("r") or g("ry"))
            d = f"M{cx - rx},{cy}a{rx},{ry} 0 1,0 {2 * rx},0a{rx},{ry} 0 1,0 {-2 * rx},0"
        else: continue
        shapes.append([d, g("fill"), g("stroke"), float(g("stroke-width") or 0), float(g("opacity") or 1)])
    return {"w": vb[2], "h": vb[3], "fx": fx, "fy": fy, "shapes": shapes}
art = {p.stem: map_art(p) for p in sorted((ROOT / "client/brand/map").glob("*.svg"))}
out = out.replace("/*MAPART*/{}", json.dumps(art, ensure_ascii=False, separators=(",", ":")))
(ROOT / "dist").mkdir(exist_ok=True)
(ROOT / "dist/game.html").write_text(out, encoding="utf-8", newline="\n")
# pages.dev 입구가 같은 주소에서 내려준다. 생성물이라 커밋하지 않는다
(ROOT / "gateway/public/play.html").write_text(out, encoding="utf-8", newline="\n")
# 메신저 공유 카드는 스크립트를 돌리지 않고 문서 머리를 그대로 읽는다. 영어, 일본어 주소는 머리만 그 언어로 바꾼 같은 화면이다.
# 문구는 client/i18n.js 의 title, desc, ogAlt, brand 와 같게 둔다. 화면 언어는 주소(/en/play)를 보고 i18n.js 가 정한다
SITE = "https://cops-and-robbers-game.pages.dev"
HEAD = {
    "en": {"lang": "en", "locale": "en_US", "site": "Cops and Robbers", "title": "Cops and Robbers Online", "desc": "Play with friends, no install. Up to 8 players, 3 minutes a round.", "alt": "Cops and Robbers logo with the cop and robber characters"},
    "ja": {"lang": "ja", "locale": "ja_JP", "site": "ケイドロ", "title": "ケイドロ オンライン", "desc": "インストールなしで友だちと遊べる。最大8人、1回3分。", "alt": "ケイドロのロゴと警察、泥棒のキャラクター"},
}
KO = {"title": "경찰과 도둑 온라인 게임", "desc": "설치 없이 친구랑 같이 해요. 최대 8명, 한 판 3분이에요.", "alt": "경찰과 도둑 로고와 경찰, 도둑 캐릭터", "site": "경찰과 도둑"}
cut = out.index("<script>")
for code, h in HEAD.items():
    head = out[:cut]
    pairs = [
        ('<html lang="ko"', f'<html lang="{h["lang"]}"'),
        (f'<link rel="canonical" href="{SITE}/play">', f'<link rel="canonical" href="{SITE}/{code}/play">'),
        (f'<meta property="og:url" content="{SITE}/play">', f'<meta property="og:url" content="{SITE}/{code}/play">'),
        ('content="ko_KR"', f'content="{h["locale"]}"'),
        (f'{SITE}/og.png', f'{SITE}/og-{code}.png'),
        (f'<title>{KO["title"]}</title>', f'<title>{h["title"]}</title>'),
        (f'content="{KO["title"]}"', f'content="{h["title"]}"'),
        (f'content="{KO["desc"]}"', f'content="{h["desc"]}"'),
        (f'content="{KO["alt"]}"', f'content="{h["alt"]}"'),
        (f'content="{KO["site"]}"', f'content="{h["site"]}"'),
    ]
    for a, b in pairs:
        if a not in head: raise SystemExit(f"머리에서 못 찾음: {a}")
        head = head.replace(a, b)
    (ROOT / f"gateway/public/{code}").mkdir(exist_ok=True)
    (ROOT / f"gateway/public/{code}/play.html").write_text(head + out[cut:], encoding="utf-8", newline="\n")
print("game.html", len(out) // 1024, "KB")
