"""La música del video: una pista original (no es de nadie), en Sol menor, ~114 BPM, bajo pulsante sobre una nota fija,
acordes largos que se van abriendo, un cambio fuerte hacia el segundo 44 y un cierre (cadencia) que cae justo cuando
entra la tarjeta final. Se sintetiza con numpy (dsp.py), sin muestras de nadie.

Uso:  FIN=70.6 DUR=74 python3 pista.py     →  musica_cruda.wav
  DUR = duración total del video (s)         (armar.mjs la escribe en grab_celu/fin.txt como «total»)
  FIN = segundo en que entra la tarjeta final (armar.mjs la escribe como «fin»)
"""
import sys, os, numpy as np
from dsp import *
DUR = float(os.environ.get("DUR", 59.6)); FIN = float(os.environ.get("FIN", 54.6))
def E(*a): return env(*a)[:, None]
def buses(): return {k: np.zeros((int((DUR + 4) * SR), 2)) for k in ("pad", "stab", "arp", "lead", "bajo", "bat", "fx")}
def mezclar(B, wet=0.24, rt=1.8, kicks=(), prof=0.55, tau=0.12, g=None):
    g = g or {}
    mus = sum(B[k] * g.get(k, 1.0) for k in ("pad", "stab", "arp", "lead"))
    if len(kicks): mus = pisar(mus, kicks, prof, tau); B["bajo"] = pisar(B["bajo"], kicks, prof * 0.7, tau)
    mus = reverb(mus, wet, rt)
    sec = B["bajo"] * g.get("bajo", 1.0) + B["bat"] * g.get("bat", 1.0)
    return mus + sec + reverb(B["fx"], 0.3, 2.4) * g.get("fx", 1.0)

NB = int(round(FIN / 2.1)); B4 = 20; BAR = FIN / NB; BEAT = BAR / 4; E8 = BEAT / 2; S16 = BEAT / 4          # compás de 2,1 s = 114,3 BPM
GM = ([55, 58, 62, 67], 43); CM = ([55, 60, 63, 67], 48); F_ = ([57, 60, 65, 69], 41); EB = ([55, 58, 63, 67], 39); BB = ([58, 62, 65, 70], 46)
D_ = ([57, 62, 66, 69], 38)
INTRO = [GM, GM, EB, F_]; SEC1 = [CM, GM, BB, F_]; SEC2 = [GM, GM, F_, EB]
def acorde(b):
    if b >= NB - 3: return [EB, F_, D_][b - (NB - 3)]      # Mi bemol, Fa y Re: el cierre «cae» en Sol menor (cadencia)
    if b < 8: return INTRO[b % 4]
    if b < B4: return SEC1[b % 4]
    return SEC2[(b - B4) % 4]
HOOK = {0: [(0, 74, 3), (3, 70, 1), (4, 74, 2), (6, 77, 2)], 1: [(0, 79, 3), (3, 77, 1), (4, 74, 2), (6, 70, 2)],
        2: [(0, 72, 3), (3, 69, 1), (4, 72, 2), (6, 77, 2)], 3: [(0, 75, 3), (3, 72, 1), (4, 70, 2), (6, 67, 2)]}
BAJO = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0]        # 16 pasos: golpes de bajo, sincopados
def pista():
    B = buses(); kicks = []; print("compases hasta el cierre:", NB, "· compás de %.3f s = %.1f BPM" % (BAR, 240 / BAR))
    for b in range(NB):
        t0 = b * BAR; ch, raiz = acorde(b); prog = min(1, b / (NB - 2))
        # acordes largos que se van abriendo
        nota = int((BAR + 0.5) * SR); lp = max(5, int(30 - 25 * min(1, prog * 1.15)))
        for m in ch: poner(B["pad"], caja(supersaw(float(mf(m - 12 if b < 4 else m)), nota, 5, 12), lp) * E(nota, 0.4, None, 1, 0.5, BAR + 0.2), t0, 0.075 if b >= 4 else 0.06)
        if b >= 4:    # bajo pulsante sobre la nota de cada compás
            for j in range(16):
                if BAJO[j]: poner(B["bajo"], bajo_saw(raiz + (12 if j in (6, 14) else 0), S16 * 1.5, 1.0, 7), t0 + j * S16, 0.46)
        if b >= 4:    # latido: bombo en los cuatro tiempos, un tic en cada uno, con más peso en el 1 y el 3
            for q in range(4):
                poner(B["bat"], kick(), t0 + q * BEAT, 0.62 if q in (0, 2) else 0.5); kicks.append(t0 + q * BEAT)
                poner(B["bat"], hat(), t0 + q * BEAT, 0.16 if q in (0, 2) else 0.09)
            for q in range(16): poner(B["bat"], shaker(), t0 + q * S16, 0.035 + 0.05 * prog)
        if b >= 8:    # acordes de sintetizador en el medio, cada vez más presentes
            for pos in (0, 3, 4, 6):
                for m in ch: poner(B["stab"], supersaw(float(mf(m)), int(0.3 * SR), 4, 10) * E(int(0.3 * SR), 0.004, 0.08, 0.3, 0.08, 0.3), t0 + pos * E8, 0.04 + 0.05 * min(1, (b - 8) / 14))
            for q in (2,): poner(B["bat"], clap(), t0 + q * BEAT, 0.34)
        if b >= 12:   # arpegio de notas cortas que se va aclarando
            brillo = max(2, 10 - int((b - 12) * 0.6))
            for j in range(0, 16, 1 if b >= B4 else 2):
                m = (ch + [ch[0] + 12])[[0, 1, 2, 3, 2, 1, 2, 3][j % 8] % 4] + 12
                poner(B["arp"], pluck_synth(m, 0.32, 1.0 if j % 4 == 0 else 0.62, brillo), t0 + j * S16, 0.10, 0.25 + 0.5 * ((j // 2) % 2))
        if B4 <= b < NB - 3:   # la melodía (se calla antes de la cadencia final)
            for (s, m, ln) in HOOK[(b - B4) % 4]:
                n = int(ln * E8 * SR) + int(0.3 * SR); t = np.arange(n) / SR; vib = np.minimum(1, np.maximum(0, t - 0.2) / 0.3) * 0.003 * np.sin(2 * np.pi * 5.4 * t)
                y = caja(osc(float(mf(m)) * (1 + vib), n), 3) * 0.55 + sine(float(mf(m)) * (1 + vib), n) * 0.45
                poner(B["lead"], y * env(n, 0.03, None, 1, 0.25, ln * E8 + 0.1), t0 + s * E8, 0.2, 0.55)
        if b in (4, B4): poner(B["fx"], crash(2.6), t0, 0.32)
        if b in (3, B4 - 1, NB - 1): poner(B["fx"], riser(BAR), t0, 0.40)
    LF = DUR - FIN          # el acorde final dura justo hasta el final del video y se apaga solo, sin cortarse
    for m in (31, 43, 55, 58, 62, 67, 70): poner(B["pad"], supersaw(float(mf(m)), int((LF + 0.5) * SR), 6, 13) * E(int((LF + 0.5) * SR), 0.03, 1.2, 0.5, 2.2, LF), FIN, 0.11)
    poner(B["fx"], crash(3.6), FIN, 0.55); poner(B["fx"], impacto(), FIN, 0.45); poner(B["bat"], kick(1.3), FIN, 0.8); poner(B["bajo"], bajo_saw(31, 3.6), FIN, 0.55)
    for j, m in enumerate((67, 70, 74, 79)): poner(B["arp"], campana(m, 3.0, 1.0), FIN + 0.14 * j, 0.14, 0.3 + 0.13 * j)
    return mezclar(B, 0.2, 1.6, kicks, 0.5, 0.12, {"stab": 2.6, "arp": 2.4, "lead": 1.6, "pad": 1.1, "bajo": 0.45, "bat": 0.75})
if __name__ == "__main__":
    m = maestro(pista(), DUR, 1.0, 0.45); guardar(m, "musica_cruda.wav"); print("musica_cruda.wav lista")
