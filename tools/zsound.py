# 좀비 모드 효과음을 숫자로 직접 만든다(docs/sound.md "좀비 모드 소리").
# 남의 소리 파일을 쓰지 않아 공개 저장소에 그대로 둘 수 있다. 다시 만들려면: python tools/zsound.py
# 폰 스피커는 200Hz 아래가 거의 안 나와서, 낮은 쿵 소리에도 배음과 중간 대역 소리를 꼭 섞는다.
import os, subprocess, sys
import numpy as np
import scipy.signal as ss

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "client", "brand", "sound")
rng = np.random.default_rng(613)


def T(d):
    return np.arange(int(d * SR)) / SR


def N(d):
    return rng.standard_normal(int(d * SR))


def filt(x, kind, f, order=2):
    sos = ss.butter(order, f, kind, fs=SR, output="sos")
    return ss.sosfilt(sos, x)


lp = lambda x, f, o=2: filt(x, "lowpass", f, o)
hp = lambda x, f, o=2: filt(x, "highpass", f, o)
bp = lambda x, lo, hi, o=2: filt(x, "bandpass", [lo, hi], o)


def svf(x, fc, q):
    """시간에 따라 중심이 움직이는 공명 필터(대역 통과). fc 는 표본마다의 배열"""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    y = np.zeros_like(x)
    low = band = 0.0
    damp = 1.0 / q
    for i in range(len(x)):
        f = 2 * np.sin(np.pi * min(fc[i], SR / 6) / SR)
        high = x[i] - low - damp * band
        band += f * high
        low += f * band
        y[i] = band
    return y


def env(n, a=0.005, r=0.05, shape=1.0):
    """앞은 a 초에 걸쳐 올리고, 끝 r 초에 걸쳐 내린다"""
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na) ** shape
    e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e


def decay(d, tau):
    return np.exp(-T(d) / tau)


def place(dst, src, at, g=1.0):
    i = int(at * SR)
    if i >= len(dst):
        return dst
    m = min(len(src), len(dst) - i)
    dst[i:i + m] += src[:m] * g
    return dst


def blank(d):
    return np.zeros(int(d * SR))


def saw(phase):
    return 2 * ((phase / (2 * np.pi)) % 1) - 1


def osc(freq, d=None, kind="sin"):
    f = np.asarray(freq, float)
    if f.ndim == 0:
        f = np.full(int(d * SR), float(f))
    ph = np.cumsum(2 * np.pi * f / SR)
    if kind == "sin":
        return np.sin(ph)
    if kind == "saw":
        return saw(ph)
    if kind == "sq":
        return np.tanh(np.sin(ph) * 4)
    raise ValueError(kind)


def glide(f0, f1, d, curve=1.0):
    k = np.linspace(0, 1, int(d * SR)) ** curve
    return f0 * (f1 / f0) ** k


def reverb(x, size=1.4, mix=0.3, dark=3500, pre=0.012):
    ir = N(size) * np.exp(-T(size) * 6.9 / size)
    ir = lp(ir, dark)
    ir[: int(pre * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
    wet = ss.fftconvolve(x, ir)
    out = np.zeros(len(wet))
    out[: len(x)] += x
    return out * (1 - mix * 0.4) + wet * mix * 0.6


def smooth_noise(d, rate, seed_scale=1.0):
    """느리게 흔들리는 값(-1..1)"""
    n = int(d * SR)
    k = max(2, int(d * rate) + 2)
    pts = rng.uniform(-1, 1, k) * seed_scale
    return np.interp(np.linspace(0, k - 1, n), np.arange(k), pts)


# ───── 재료 ─────

def growl(d, f0=88, f1=64, vowels=((650, 1080, 2500), (520, 880, 2300)), rasp=0.85, breath=0.35, drive=2.2, a=0.07, r=0.25):
    """목 긁는 좀비 소리: 톱니 성대 + 반 옥타브 아래 떨림 + 덜컥거림, 모음 공명으로 "으어어" """
    n = int(d * SR)
    wob = smooth_noise(d, 9) * 0.10 + smooth_noise(d, 2.5) * 0.06
    f = glide(f0, f1, d, 0.8) * (1 + wob)
    ph = np.cumsum(2 * np.pi * f / SR)
    src = saw(ph) + 0.55 * saw(ph / 2 + 0.3) + 0.25 * np.sin(ph * 3)
    # 덜컥거림: 25~38Hz 로 끊기는 진폭(성대 튀김)
    fry = glide(26, 38, d) * (1 + smooth_noise(d, 6) * 0.2)
    rat = 0.5 + 0.5 * np.sin(np.cumsum(2 * np.pi * fry / SR))
    src = src * (1 - rasp + rasp * rat ** 3)
    src += hp(N(d), 400) * breath * (0.6 + 0.4 * rat)
    k = np.linspace(0, 1, n) ** 1.2
    y = np.zeros(n)
    for i, g in enumerate((1.0, 0.75, 0.32)):
        fc = vowels[0][i] * (1 - k) + vowels[1][i] * k
        y += svf(src, fc, 5 + i * 2) * g
    y = np.tanh(y * drive)
    y = hp(y, 90)
    return y * env(n, a, r, 0.7)


def thump(d=0.35, f0=110, f1=42, tau=0.09, body=0.6):
    """쿵: 낮은 사인 + 폰에서도 들리게 중간 대역 둔탁함"""
    s = osc(glide(f0, f1, d, 0.5), kind="sin") * decay(d, tau)
    s = np.tanh(s * 2.2) * 0.8
    b = lp(N(d), 520) * decay(d, tau * 0.5) * body * 3
    return s + b


def clank(d=0.5, base=520, tau=0.12, parts=(1, 2.37, 4.1, 6.3)):
    out = np.zeros(int(d * SR))
    for i, p in enumerate(parts):
        out += np.sin(2 * np.pi * base * p * T(d) + rng.uniform(0, 6)) * decay(d, tau / (1 + i * 0.6)) / (1 + i * 0.5)
    out += hp(N(d), 2500) * decay(d, 0.006) * 0.8
    return out


def bell(f, d=2.0, tau=0.7, parts=(1, 2.76, 5.40, 8.93), detune=0.0):
    out = np.zeros(int(d * SR))
    for i, p in enumerate(parts):
        out += np.sin(2 * np.pi * f * p * (1 + detune * (i % 2)) * T(d)) * decay(d, tau / (1 + i * 0.9)) / (1 + i * 0.8)
    return out * env(len(out), 0.002, 0.05)


def crunch(d=0.32, n=7, start=0.0):
    out = blank(d)
    at = start
    for k in range(n):
        g = (1 - k / (n + 2)) * rng.uniform(0.6, 1.0)
        L = rng.uniform(0.012, 0.03)
        piece = bp(N(L), rng.uniform(1200, 2200), rng.uniform(4500, 8000)) * decay(L, rng.uniform(0.003, 0.007))
        place(out, piece, at, g)
        at += rng.uniform(0.014, 0.032)
    return out


def squelch(d=0.22, f0=1900, f1=380):
    s = svf(N(d), glide(f0, f1, d, 0.7), 9) * env(int(d * SR), 0.01, 0.08)
    return s * 0.9


def clack(d=0.08, f=3300):
    return (np.sin(2 * np.pi * f * T(d)) * decay(d, 0.010) + hp(N(d), 3000) * decay(d, 0.0025) * 1.2 + np.sin(2 * np.pi * f * 0.47 * T(d)) * decay(d, 0.02) * 0.6)


def whoosh(d=0.24, f0=380, f1=1600):
    n = int(d * SR)
    e = np.sin(np.linspace(0, np.pi, n)) ** 1.6
    return svf(N(d), glide(f0, f1, d), 1.6) * e * 0.9


def heartbeat(gain2=0.62):
    d = 0.62
    out = blank(d)
    for at, g, f0 in ((0.0, 1.0, 92), (0.21, gain2, 80)):
        L = 0.24
        s = osc(glide(f0, 44, L, 0.4)) * decay(L, 0.055)
        s = np.tanh(s * 3.2)  # 배음이 생겨 폰에서도 들린다
        th = bp(N(L), 120, 420) * decay(L, 0.03) * 0.9
        place(out, (s + th) * env(int(L * SR), 0.004, 0.04), at, g)
    return lp(out, 900)


def strings(freqs, d, a=0.01, r=0.4, trem=9.0, bright=5000, vib=0.004):
    n = int(d * SR)
    out = np.zeros(n)
    for f in freqs:
        for det in (-0.006, 0.0, 0.007):
            ff = np.asarray(f, float)
            base = ff if ff.ndim else np.full(n, float(ff))
            v = base * (1 + det + vib * np.sin(2 * np.pi * 5.5 * T(d) + rng.uniform(0, 6)))
            out += saw(np.cumsum(2 * np.pi * v / SR))
    out *= 1 - 0.35 * (0.5 + 0.5 * np.sin(2 * np.pi * trem * T(d)))
    out = lp(out, bright)
    return out * env(n, a, r) / (len(freqs) * 3)


def horn(freqs, d, a=0.015, r=0.06):
    n = int(d * SR)
    out = sum(saw(np.cumsum(2 * np.pi * np.full(n, f) * (1 + 0.003 * np.sin(2 * np.pi * 7 * T(d))) / SR)) for f in freqs)
    out = np.tanh(lp(out, 2600) * 1.6)
    out = bp(out, 250, 4000)
    return out * env(n, a, r)


def engine(d, r0=24, r1=70, curve=1.3):
    """피스톤이 터지는 박동(초당 r0→r1)을 저역 필터에 통과시켜 엔진을 만든다"""
    n = int(d * SR)
    rate = glide(r0, r1, d, curve)
    ph = np.cumsum(rate / SR)
    idx = np.where(np.diff(np.floor(ph)) > 0)[0]
    out = np.zeros(n)
    pulse = lp(N(0.03), 700) * decay(0.03, 0.006)
    for i in idx:
        m = min(len(pulse), n - i)
        out[i:i + m] += pulse[:m] * rng.uniform(0.7, 1.0)
    out = np.tanh(bp(out, 55, 1800) * 3)
    hum = saw(np.cumsum(2 * np.pi * rate * 2 / SR)) * 0.25
    return (out + lp(hum, 900)) * 0.8


def radio_static(d, density=0.5):
    s = bp(N(d), 900, 4200) * 0.6
    cr = (rng.random(int(d * SR)) < 0.002 * density) * rng.uniform(1, 3, int(d * SR))
    s += hp(cr, 1500)
    return s


def electric_hum(d, f=60):
    x = osc(np.full(int(d * SR), f), kind="sq") + 0.4 * osc(np.full(int(d * SR), f * 3))
    return bp(x, 120, 2400) * 0.6


def norm(x, peak_db=-3.0):
    x = x - np.mean(x)
    pk = np.max(np.abs(x)) + 1e-9
    return x / pk * 10 ** (peak_db / 20)


def trim_tail(x, thr=10 ** (-46 / 20)):
    idx = np.where(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    x = x[: idx[-1] + 1]
    f = int(0.006 * SR)
    x[-f:] *= np.linspace(1, 0, f)
    return x


# ───── 순간마다 ─────

def s_heart():
    return heartbeat()


def s_spotted():
    # 생존자가 좀비를 처음 본 순간: 낮은 쿵과 날카로운 현의 긁힘
    d = 1.3
    out = blank(d)
    place(out, thump(0.5, 120, 40, 0.12, 0.8), 0, 0.9)
    sc = strings([1480, 1568, 1661, 2093], 0.9, a=0.006, r=0.6, trem=17, bright=7000, vib=0.012)
    sc *= decay(0.9, 0.35) * 0.9 + 0.1
    place(out, sc * 2.2, 0.0)
    place(out, hp(N(0.25), 3000) * decay(0.25, 0.05) * 0.5, 0)
    return reverb(out, 1.3, 0.35)


def s_found():
    # 좀비가 생존자를 찾은 순간: 짧게 킁 하고 낮게 으르렁
    d = 0.7
    out = blank(d)
    sniff = bp(N(0.12), 1500, 5000) * np.sin(np.linspace(0, np.pi, int(0.12 * SR))) ** 2 * 0.45
    place(out, sniff, 0.0)
    place(out, growl(0.5, 92, 112, ((560, 900, 2300), (700, 1150, 2600)), a=0.04, r=0.18), 0.12, 0.8)
    return reverb(out, 0.6, 0.18)


def s_bite():
    # 내가 물었다: 이빨 딱 + 아삭 + 만족스러운 으르렁
    d = 1.0
    out = blank(d)
    place(out, clack(0.08, 2900), 0.0, 0.9)
    place(out, thump(0.3, 140, 55, 0.05, 0.9), 0.0, 0.7)
    place(out, crunch(0.3, 7), 0.02, 0.9)
    place(out, squelch(0.2), 0.08, 0.55)
    place(out, growl(0.6, 96, 74, a=0.05, r=0.3), 0.22, 0.75)
    return reverb(out, 0.7, 0.2)


def s_bitten():
    # 내가 물렸다: 같은 아삭 + 심장이 한 번 크게 뛰고 낮게 가라앉는 울림
    d = 1.9
    out = blank(d)
    place(out, clack(0.08, 2700), 0.0, 0.9)
    place(out, crunch(0.32, 8), 0.015, 1.0)
    place(out, squelch(0.25, 1600, 300), 0.06, 0.6)
    place(out, heartbeat(0.5), 0.36, 0.9)
    dr = strings([220, 233], 1.2, a=0.05, r=0.7, trem=4, bright=1800)
    dr *= np.linspace(1, 0.3, len(dr))
    place(out, dr * 2.0, 0.4)
    place(out, thump(0.9, 90, 30, 0.3, 0.4), 0.36, 0.6)
    return reverb(out, 1.6, 0.35, 2400)


def s_miss():
    # 헛물기: 휙 + 턱이 허공에서 딱
    d = 0.42
    out = blank(d)
    place(out, whoosh(0.22, 420, 1500), 0, 0.8)
    place(out, clack(0.08, 3100), 0.17, 1.0)
    place(out, clack(0.06, 2600), 0.19, 0.35)
    return out


def s_reveal():
    # 위치 공개: 거꾸로 빨려드는 쉭 소리 끝에 낮고 서늘한 종
    d = 2.2
    out = blank(d)
    sw = hp(N(0.55), 2200) * (np.linspace(0, 1, int(0.55 * SR)) ** 3) * 0.7
    place(out, sw, 0)
    b = bell(196, 1.6, 0.9, detune=0.0) + bell(207.6, 1.6, 0.8) * 0.6
    place(out, b, 0.55, 0.9)
    place(out, thump(0.4, 100, 45, 0.1, 0.4), 0.55, 0.5)
    return reverb(out, 2.0, 0.4, 3000)


def s_radio():
    # 구조 무전: 칙 하고 열리는 잡음, 삐삐 두 번, 짧은 잡음, 닫히는 딸깍
    d = 0.95
    out = blank(d)
    sq = radio_static(0.14, 2) * env(int(0.14 * SR), 0.002, 0.03) * 1.1
    place(out, sq, 0)
    for at, f, L in ((0.17, 1050, 0.07), (0.27, 1400, 0.11)):
        b = osc(np.full(int(L * SR), f), kind="sq") * env(int(L * SR), 0.003, 0.01) * 0.5
        place(out, bp(b, 500, 3800), at)
    tail = radio_static(0.3, 1) * np.linspace(0.6, 0, int(0.3 * SR)) * 0.6
    place(out, tail, 0.4)
    place(out, hp(N(0.01), 2000) * decay(0.01, 0.002), 0.71, 0.9)
    return bp(out, 300, 5000)


def s_van():
    # 구조차가 정류장에 섰다: 멀리서 빵빵 두 번, 엔진이 낮게 돈다
    d = 1.6
    out = blank(d)
    place(out, horn([392, 494], 0.18), 0.0, 0.8)
    place(out, horn([392, 494], 0.42, r=0.2), 0.28, 0.85)
    eng = engine(1.4, 22, 26) * np.linspace(0.5, 0, int(1.4 * SR)) * 0.5
    place(out, eng, 0.1)
    return reverb(out, 1.4, 0.38, 3000)


def s_escape():
    # 탈출: 문 쾅, 엔진이 부릉 올라가며 멀어지고 밝은 두 음
    d = 2.2
    out = blank(d)
    place(out, thump(0.3, 130, 50, 0.06, 1.0), 0, 0.9)
    place(out, clank(0.4, 410, 0.09), 0.0, 0.45)
    e = engine(1.5, 22, 78, 1.6)
    n = len(e)
    away = np.concatenate([np.ones(int(n * 0.55)), np.linspace(1, 0, n - int(n * 0.55)) ** 1.5])
    e = lp(e, 2400) * away
    place(out, e * 0.9, 0.18)
    place(out, bell(784, 1.0, 0.5, parts=(1, 2, 3)) * 0.35, 1.05)
    place(out, bell(988, 1.0, 0.5, parts=(1, 2, 3)) * 0.35, 1.2)
    return reverb(out, 1.2, 0.25)


def s_go():
    # 좀비가 풀려난다: 땅이 울리는 쿵과 길게 끄는 포효
    d = 2.4
    out = blank(d)
    place(out, thump(1.4, 130, 34, 0.35, 0.7), 0, 1.0)
    place(out, growl(1.5, 78, 58, ((520, 860, 2300), (720, 1150, 2600)), rasp=0.9, drive=2.6, a=0.12, r=0.55), 0.05, 0.95)
    place(out, growl(1.3, 104, 70, ((600, 1000, 2500), (680, 1100, 2700)), rasp=0.7, a=0.15, r=0.5), 0.15, 0.45)
    return reverb(out, 2.0, 0.42, 2800)


def s_alert():
    # 구역이 줄어든다(좀비 판): 낮게 부풀어 오르는 경적
    d = 1.6
    n = int(d * SR)
    x = sum(saw(np.cumsum(2 * np.pi * np.full(n, f) / SR)) for f in (98, 103.8, 196, 207.6))
    cut = 280 + 1500 * np.sin(np.linspace(0, np.pi, n)) ** 1.5
    y = svf(x * 0.4, cut, 1.4)
    y = np.tanh(y * 1.5) * env(n, 0.25, 0.45, 1.4)
    return reverb(y, 1.4, 0.3)


def s_tick():
    # 마지막 초읽기: 낮고 메마른 똑
    d = 0.3
    x = np.sin(2 * np.pi * 820 * T(d)) * decay(d, 0.018) + np.sin(2 * np.pi * 410 * T(d)) * decay(d, 0.035) * 0.7
    x += bp(N(d), 1500, 5000) * decay(d, 0.003) * 0.8
    return reverb(x, 0.6, 0.2, 2500)


def s_win_s():
    # 생존자 편이 이겼다: 밤이 걷히듯 맑은 종이 오르고 넓은 화음이 깔린다
    d = 3.0
    out = blank(d)
    for i, f in enumerate((523.25, 659.25, 783.99, 1046.5, 1318.5)):
        place(out, bell(f, 2.0, 0.8, parts=(1, 2, 3.01, 4.2)) * 0.45, i * 0.11)
    pad = strings([261.6, 329.6, 392.0, 523.3], 2.6, a=0.35, r=1.2, trem=3, bright=2600, vib=0.003)
    place(out, pad * 1.6, 0.1)
    return reverb(out, 2.4, 0.4, 5000)


def s_win_z():
    # 좀비 편이 이겼다: 낮은 금관 한 방과 여러 목소리의 포효
    d = 2.8
    out = blank(d)
    n = int(1.6 * SR)
    br = sum(saw(np.cumsum(2 * np.pi * np.full(n, f) * (1 + 0.002 * i) / SR)) for i, f in enumerate((110, 130.8, 164.8, 220)))
    cut = 400 + 2600 * np.exp(-T(1.6) / 0.35)
    br = np.tanh(svf(br * 0.35, cut, 1.2) * 2) * env(n, 0.012, 0.7)
    place(out, br, 0.0, 0.9)
    place(out, thump(1.0, 120, 36, 0.3, 0.8), 0.0, 0.8)
    for at, f0, f1, g in ((0.08, 82, 62, 0.75), (0.18, 104, 78, 0.5), (0.3, 70, 52, 0.55)):
        place(out, growl(1.5, f0, f1, ((540, 880, 2300), (700, 1100, 2600)), rasp=0.85, a=0.1, r=0.6), at, g)
    return reverb(out, 2.2, 0.4, 2800)


def s_lose():
    # 졌다: 반음 어긋난 현이 천천히 미끄러져 내려가고 심장 한 번
    d = 2.8
    out = blank(d)
    L = 2.0
    s = strings([glide(440, 196, L, 0.8), glide(466.2, 207.7, L, 0.8)], L, a=0.08, r=0.9, trem=5, bright=2400)
    place(out, s * 2.2, 0)
    place(out, heartbeat(0.0) * 0.8, 1.9)
    return reverb(out, 2.0, 0.38, 2600)


def s_sweep():
    # 대기실 조명이 사람 사이를 옮겨 갈 때: 기계가 딸깍 돌고 전기가 지직
    d = 0.16
    out = blank(d)
    place(out, hp(N(0.006), 2500) * decay(0.006, 0.0015), 0, 1.0)
    hum = electric_hum(0.1, 120) * decay(0.1, 0.03)
    place(out, hum, 0.004, 0.7)
    place(out, clack(0.05, 1800) * 0.4, 0.0)
    return out


def s_dark():
    # 불이 꺼진다: 전기가 낮게 꺼져 내리고 차단기가 툭
    d = 1.0
    out = blank(d)
    place(out, thump(0.3, 160, 60, 0.05, 1.0) + clank(0.3, 700, 0.04) * 0.4, 0, 0.8)
    n = int(0.75 * SR)
    f = glide(120, 28, 0.75, 0.7)
    h = osc(f, kind="sq") + 0.5 * osc(f * 3)
    h = svf(h * 0.5, glide(1800, 160, 0.75), 1.2) * np.linspace(1, 0, n) ** 1.3
    place(out, h, 0.03, 0.9)
    return reverb(out, 1.0, 0.25)


def s_spot():
    # 조명이 좀비에게 멈춘다: 커다란 조명이 쾅 켜지고, 전기가 웅 차오르고, 좀비가 으르렁
    d = 2.2
    out = blank(d)
    place(out, thump(0.6, 150, 38, 0.16, 1.0), 0, 1.0)
    place(out, clank(0.5, 360, 0.12, (1, 2.71, 4.6)), 0.0, 0.5)
    n = int(1.1 * SR)
    hum = electric_hum(1.1, 60) * env(n, 0.05, 0.6) * 0.45
    place(out, hum, 0.02)
    place(out, growl(0.95, 100, 66, ((620, 1000, 2500), (500, 820, 2200)), rasp=0.9, drive=2.8, a=0.03, r=0.4), 0.22, 0.95)
    return reverb(out, 1.8, 0.38, 3000)


def s_amb():
    # 좀비 판과 좀비 대기실의 밤 공기: 바람, 낮은 울림, 아주 멀리서 한 번 으르렁. 끝과 처음이 이어진다
    L, X = 16.0, 2.0
    d = L + X
    n = int(d * SR)
    pink = lp(N(d), 1200, 1) + lp(N(d), 400, 1) * 1.5
    center = 420 + 260 * np.sin(2 * np.pi * T(d) / 7.3) + 120 * smooth_noise(d, 0.6)
    wind = svf(pink, center, 1.8) * (0.55 + 0.45 * (0.5 + 0.5 * np.sin(2 * np.pi * T(d) / 5.1 + 1)))
    drone = sum(np.sin(2 * np.pi * f * T(d) + rng.uniform(0, 6)) * g for f, g in ((55, 0.5), (57.6, 0.4), (110.4, 0.25), (165, 0.12)))
    drone = np.tanh(drone * 1.3) * (0.6 + 0.4 * np.sin(2 * np.pi * T(d) / 9.0)) * 0.35
    far = lp(growl(1.6, 74, 60, a=0.4, r=0.8), 900) * 0.25
    out = wind * 1.0 + drone
    place(out, far, 8.5)
    out = reverb(out, 2.5, 0.3, 1600)[:n]
    # 이어 붙이기: 끝 X 초를 처음 X 초에 겹쳐 넣고 잘라낸다
    nx = int(X * SR)
    fade = np.linspace(0, 1, nx)
    loop = out[: int(L * SR)].copy()
    loop[:nx] = loop[:nx] * fade + out[int(L * SR):int(L * SR) + nx] * (1 - fade)
    return loop


SOUNDS = {
    "z-heart": s_heart, "z-spotted": s_spotted, "z-found": s_found, "z-bite": s_bite, "z-bitten": s_bitten,
    "z-miss": s_miss, "z-reveal": s_reveal, "z-radio": s_radio, "z-van": s_van, "z-escape": s_escape,
    "z-go": s_go, "z-alert": s_alert, "z-tick": s_tick, "z-win-s": s_win_s, "z-win-z": s_win_z, "z-lose": s_lose,
    "z-sweep": s_sweep, "z-dark": s_dark, "z-spot": s_spot, "z-amb": s_amb,
}


def write_mp3(name, x):
    loop = name == "z-amb"
    x = norm(x, -6.0 if loop else -3.0)
    if not loop:
        x = trim_tail(x)
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2").tobytes()
    path = os.path.join(OUT, name + ".mp3")
    br = "32k" if loop else "64k"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-", "-b:a", br, path], input=pcm, check=True)
    return path, x


if __name__ == "__main__":
    only = set(sys.argv[1:])
    os.makedirs(OUT, exist_ok=True)
    for k, fn in SOUNDS.items():
        if only and k not in only:
            continue
        path, x = write_mp3(k, fn())
        np.save(os.path.join(os.environ.get("ZS_DUMP", "."), k + ".npy"), x) if os.environ.get("ZS_DUMP") else None
        print(f"{k:10s} {len(x) / SR:5.2f}s {os.path.getsize(path) / 1024:6.1f}KB")
