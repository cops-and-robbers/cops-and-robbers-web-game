# 배경 음악 파일을 만든다(docs/sound.md "배경 음악").
# 원곡(Flow Music 에서 받은 wav/m4a)은 크기가 커서 저장소에 두지 않는다. 받은 폴더를 넘긴다.
#   python tools/bgm.py <원곡 폴더>
# 곡 종류(client/brand/bgm.json 의 kind)
#   loop   첫 화면, 대기실. 반복 끝 앞 0.35초를 반복 시작 앞부분과 겹쳐 이음매를 없애고 반복 끝에서 자른다
#   jingle MVP. 터지는 초(hit) 뒤 축하 구간(loopStart~loopEnd)을 loop 처럼 잇는다
#   round  판 전체 한 곡. 반복하지 않는다. 판 시계에 맞춰 트니 자르지 않고 끝 무음만 정리한다
# 모두 귀에 들리는 크기를 -16 LUFS 로 맞춰 96kbps 모노 mp3 로 gateway/public/bgm/<이름>.mp3 에 낸다.
# 모노인 까닭: 폰 메모리. 풀어 둔 소리는 초당 크기가 커서 스테레오 3분이면 폰에서 60MB 를 넘는다
import sys, json, pathlib, subprocess, tempfile
import numpy as np
from scipy.io import wavfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "gateway/public/bgm"
TRACKS = json.loads((ROOT / "client/brand/bgm.json").read_text(encoding="utf-8"))
XF = 0.35
TARGET = -16.0

def run(*a):
    return subprocess.run(a, check=True, capture_output=True, text=True, encoding="utf-8", errors="replace")

def lufs(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    lines = [l for l in r.stderr.splitlines() if l.strip().startswith("I:")]
    return float(lines[-1].split()[1])

src = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob("*.mp3"):
    if old.stem not in TRACKS: old.unlink()  # 쓰지 않게 된 곡은 지운다
with tempfile.TemporaryDirectory() as tmp:
    tmp = pathlib.Path(tmp)
    for key, t in TRACKS.items():
        wav = tmp / f"{key}.wav"
        run("ffmpeg", "-v", "error", "-y", "-i", str(src / t["source"]), "-ac", "1", "-ar", "44100", str(wav))
        sr, x = wavfile.read(wav)
        x = x.astype(np.float64) / 32768
        if t["kind"] == "round":
            # 끝의 긴 무음만 걷어 낸다(곡이 일찍 끝나도 판 시계 자리는 그대로라 앞은 건드리지 않는다)
            loud = np.where(np.abs(x) > 1e-3)[0]
            y = x[: (loud[-1] + int(0.5 * sr)) if len(loud) else len(x)]
        else:
            s, e, n = int(t["loopStart"] * sr), int(t["loopEnd"] * sr), int(XF * sr)
            y = x[:e].copy()
            w = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, n))
            # 반복 끝에 닿을 때 소리가 반복 시작 바로 앞과 같아지게 겹친다. 그래서 끝에서 처음으로 넘어가도 이어 들린다
            y[e - n: e] = (1 - w) * x[e - n: e] + w * x[s - n: s]
        mid = tmp / f"{key}-cut.wav"
        wavfile.write(mid, sr, (np.clip(y, -1, 1) * 32767).astype(np.int16))
        gain = TARGET - lufs(mid)
        out = OUT / f"{key}.mp3"
        run("ffmpeg", "-v", "error", "-y", "-i", str(mid), "-af", f"volume={gain:.2f}dB,alimiter=limit=0.95:level=disabled", "-c:a", "libmp3lame", "-b:a", "96k", str(out))
        print(f"{key:7s} {t['kind']:6s} {len(y) / sr:6.1f}s  {gain:+5.1f}dB  {out.stat().st_size // 1024}KB")
