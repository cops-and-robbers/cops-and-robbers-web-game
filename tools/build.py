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
out = shell.replace("/*ENGINE*/", engine).replace("/*SVGS*/", svgs).replace("/*LOGIC*/", logic).replace("/*GAME*/", game)
(ROOT / "dist").mkdir(exist_ok=True)
(ROOT / "dist/game.html").write_text(out, encoding="utf-8", newline="\n")
print("game.html", len(out) // 1024, "KB")
