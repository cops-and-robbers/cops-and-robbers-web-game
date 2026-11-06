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
net = (ROOT / "client/lobby.js").read_text(encoding="utf-8") + (ROOT / "client/net.js").read_text(encoding="utf-8")
css = (ROOT / "client/lobby.css").read_text(encoding="utf-8")
out = shell.replace("</head>", "<style>" + css + "</style>\n</head>", 1).replace("/*ENGINE*/", engine).replace("/*SVGS*/", svgs).replace("/*LOGIC*/", logic).replace("/*GAME*/", game).replace("/*NET*/", net)
# 앱과 같은 그림(로고, 캐릭터, 배경, 경찰차)은 client/brand 에 두고 파일 하나에 묶어 넣는다.
# 작은 그림은 base64 로, 큰 배경은 압축이 잘 되게 SVG 그대로 넣는다
import base64
brand = lambda name: (ROOT / "client/brand" / name).read_bytes()
out = re.sub(r"/\*B64:([\w.-]+)\*/", lambda m: base64.b64encode(brand(m.group(1))).decode(), out)
out = re.sub(r"/\*SVG:([\w.-]+)\*/", lambda m: brand(m.group(1)).decode("utf-8"), out)
(ROOT / "dist").mkdir(exist_ok=True)
(ROOT / "dist/game.html").write_text(out, encoding="utf-8", newline="\n")
# pages.dev 입구가 같은 주소에서 내려준다. 생성물이라 커밋하지 않는다
(ROOT / "gateway/public/play.html").write_text(out, encoding="utf-8", newline="\n")
print("game.html", len(out) // 1024, "KB")
