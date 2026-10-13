"""Herramientas para componer con numpy: osciladores sin aliasing, baterías, cuerdas pulsadas, reverb y mezcla."""
import numpy as np, wave
SR = 44100
rng = np.random.default_rng(11)
def mf(m): return 440.0 * 2 ** ((np.asarray(m, dtype=float) - 69) / 12)
def tt(dur): return np.arange(int(dur * SR)) / SR

# --- tablas de onda diente de sierra, una por octava, con los armónicos justos para que no haya aliasing
_TW = 2048
_tablas = []
for o in range(10):
    ftop = 16.35 * 2 ** (o + 1); K = int(max(2, min(220, 0.42 * SR / ftop)))
    x = np.arange(_TW) / _TW; k = np.arange(1, K + 1)[:, None]
    _tablas.append((np.sin(2 * np.pi * k * x[None, :]) / k).sum(0) * (2 / np.pi))
def osc(f, n, phase=0.0, kind="saw"):
    f = np.asarray(f, dtype=float)
    ph = phase + (f * np.arange(n) / SR if f.ndim == 0 else np.cumsum(f) / SR)
    fm = float(f.max()) if f.ndim else float(f)
    tab = _tablas[int(np.clip(np.log2(max(fm, 16.35) / 16.35), 0, 9))]
    def leer(p):
        idx = (p % 1.0) * _TW; i0 = idx.astype(int) % _TW; fr = idx - np.floor(idx)
        return tab[i0] * (1 - fr) + tab[(i0 + 1) % _TW] * fr
    y = leer(ph)
    if kind == "square": y = y - leer(ph + 0.5)
    return y
def sine(f, n, phase=0.0):
    f = np.asarray(f, dtype=float)
    return np.sin(2 * np.pi * (phase + (f * np.arange(n) / SR if f.ndim == 0 else np.cumsum(f) / SR)))
def supersaw(f, n, voices=6, cents=15):
    L = np.zeros(n); R = np.zeros(n)
    for v in range(voices):
        c = (v / (voices - 1) * 2 - 1) * cents if voices > 1 else 0.0
        y = osc(f * 2 ** (c / 1200), n, phase=rng.random()); pan = v / (voices - 1) if voices > 1 else 0.5
        L += y * np.cos(pan * np.pi / 2); R += y * np.sin(pan * np.pi / 2)
    return np.stack([L, R], 1) / voices * 1.7
def caja(x, n):                          # filtro pasa-bajos de promedio móvil (n muestras), para suavizar
    k = np.ones(n) / n
    if x.ndim == 1: return np.convolve(x, k, "same")
    return np.stack([np.convolve(x[:, c], k, "same") for c in range(x.shape[1])], 1)
def hp(x, fc=300):                       # pasa-altos de un polo
    a = np.exp(-2 * np.pi * fc / SR); y = x - a * np.concatenate([[0], x[:-1]]); return y
def env(n, a=0.005, tau=None, sus=1.0, rel=0.05, dur=None):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4))
    if tau: e = e * (sus + (1 - sus) * np.exp(-t / tau))
    d = (n / SR) if dur is None else dur
    return e * np.clip((d - t) / max(rel, 1e-4), 0, 1)

# --- batería
def kick(punch=1.0):
    n = int(0.42 * SR); t = np.arange(n) / SR
    f = 46 + 130 * np.exp(-t * 38); ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t * 8.5); y[:int(0.004 * SR)] += np.hanning(int(0.008 * SR))[:int(0.004 * SR)] * 0.5 * punch
    return y
def snare(tono=185):
    n = int(0.3 * SR); t = np.arange(n) / SR
    r = hp(rng.standard_normal(n), 1200) * np.exp(-t * 17) * 0.55
    return np.sin(2 * np.pi * tono * t * (1 + 0.25 * np.exp(-t * 30))) * np.exp(-t * 26) * 0.55 + r
def clap():
    n = int(0.28 * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for d in (0, 0.011, 0.022):
        i = int(d * SR); m = n - i; y[i:] += hp(rng.standard_normal(m), 900) * np.exp(-np.arange(m) / SR * 55)
    return caja(y, 3) * 0.5 + caja(hp(rng.standard_normal(n), 700), 2) * np.exp(-t * 14) * 0.25
def hat(abierto=False):
    n = int((0.34 if abierto else 0.07) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 6500) * np.exp(-t * (13 if abierto else 70)) * 0.5
def shaker():
    n = int(0.1 * SR); t = np.arange(n) / SR
    return caja(hp(rng.standard_normal(n), 4500), 2) * np.minimum(1, t / 0.012) * np.exp(-t * 38)
def tom(f=110, dur=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(f * (1 + 0.5 * np.exp(-t * 18))) / SR) * np.exp(-t * 7)
def crash(dur=3.0):
    n = int(dur * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 3000) * np.exp(-t * 1.5) * np.minimum(1, t / 0.01) * 0.5
def riser(dur):
    n = int(dur * SR); t = np.arange(n) / SR; k = t / dur
    ruido = hp(rng.standard_normal(n), 1500)
    return (ruido * k ** 2.2 * 0.5 + sine(300 + 2200 * k ** 2, n) * k ** 2 * 0.12) * np.minimum(1, (dur - t) / 0.03)
def impacto(dur=3.2):
    n = int(dur * SR); t = np.arange(n) / SR
    return sine(52 * (1 + 0.6 * np.exp(-t * 9)), n) * np.exp(-t * 1.9) * 0.9 + caja(rng.standard_normal(n), 14) * np.exp(-t * 1.6) * 0.5

# --- cuerdas pulsadas (Karplus-Strong, afinadas por remuestreo)
def pulsada(f, dur, caida=0.9965, brillo=0.5):
    n = int(dur * SR); P = max(2, int(round(SR / f))); fa = SR / P; largo = int(n * f / fa) + 2 * P + 4
    y = np.zeros(largo + P + 2)
    ini = rng.uniform(-1, 1, P + 1); ini -= ini.mean()
    for _ in range(int(3 * (1 - brillo))): ini = np.convolve(ini, [.25, .5, .25], "same")
    y[:P + 1] = ini
    i = P + 1
    while i + P <= len(y):
        y[i:i + P] = caida * 0.5 * (y[i - P:i] + y[i - P - 1:i - 1]); i += P
    pos = np.arange(n) * (f / fa)
    return np.interp(pos, np.arange(len(y)), y) * np.minimum(1, np.arange(n) / (SR * 0.002))
def campana(m, dur=1.6, vel=1.0, indice=1.4):
    n = int(dur * SR); t = np.arange(n) / SR; f = float(mf(m))
    idx = indice * np.exp(-t * 5) + 0.15
    return (np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 2 * t)) * 0.8 + np.sin(2 * np.pi * f * 2 * t) * 0.1 * np.exp(-t * 6)) * np.minimum(1, t / 0.004) * np.exp(-t * 2.6) * vel
def pluck_synth(m, dur=0.5, vel=1.0, brillo=4):
    n = int(dur * SR); f = float(mf(m)); y = caja(osc(f, n), brillo)
    return y * np.minimum(1, np.arange(n) / (SR * 0.002)) * np.exp(-np.arange(n) / SR * 7) * vel
def bajo_saw(m, dur, vel=1.0, corte=6):
    n = int(dur * SR); f = float(mf(m)); y = caja(osc(f, n), corte) * 0.8 + sine(f, n) * 0.6
    return y * env(n, 0.006, 0.35, 0.55, 0.05) * vel

# --- mezcla
def poner(bus, x, t0, gain=1.0, pan=0.5):
    i0 = int(t0 * SR)
    if i0 >= len(bus) or i0 + len(x) <= 0: return
    if x.ndim == 1: x = np.stack([x * np.cos(pan * np.pi / 2), x * np.sin(pan * np.pi / 2)], 1) * 1.414
    a = max(0, -i0); n = min(len(x) - a, len(bus) - max(i0, 0))
    bus[max(i0, 0):max(i0, 0) + n] += x[a:a + n] * gain
def pisar(bus, tiempos, prof=0.6, tau=0.11):
    e = np.ones(len(bus)); m = int(0.6 * SR); t = np.arange(m) / SR
    for tk in tiempos:
        i = int(tk * SR)
        if i >= len(bus): continue
        n = min(m, len(bus) - i); e[i:i + n] *= 1 - prof * np.exp(-t[:n] / tau)
    return bus * e[:, None]
def reverb(bus, wet=0.25, rt=1.8, pre=0.015):
    n_ir = int(rt * 1.2 * SR); ti = np.arange(n_ir) / SR
    out = np.zeros_like(bus)
    for c in range(2):
        ir = rng.standard_normal(n_ir) * np.exp(-6.9 * ti / rt); ir = caja(ir, 7); ir[:int(pre * SR)] = 0; ir /= np.sqrt((ir ** 2).sum())
        n = 1 << int(np.ceil(np.log2(len(bus) + n_ir)))
        out[:, c] = np.fft.irfft(np.fft.rfft(bus[:, c], n) * np.fft.rfft(ir, n), n)[:len(bus)]
    return bus * (1 - wet) + out * wet * 3.0
def maestro(m, dur, entrada=1.2, salida=2.2, techo=0.89, saturar=1.3):
    m = np.tanh(m * saturar) / np.tanh(saturar)
    t = np.arange(len(m)) / SR
    m = m * (np.minimum(1, t / entrada) * np.clip((dur - t) / salida, 0, 1))[:, None]
    m = m[:int(dur * SR)]; m = m / max(1e-9, np.abs(m).max()) * techo
    return m
def guardar(m, ruta):
    pcm = (np.clip(m, -1, 1) * 32767).astype("<i2")
    with wave.open(ruta, "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
