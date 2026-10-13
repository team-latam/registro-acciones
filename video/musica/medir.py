import numpy as np, wave, sys
def leer(r):
    w=wave.open(r); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),dtype="<i2").reshape(-1,2)/32768; w.close(); return sr,x.mean(1)
def bandas(r):
    sr,m=leer(r); f=np.fft.rfftfreq(len(m),1/sr); S=np.abs(np.fft.rfft(m))**2; t=S.sum()
    return [round(float(10*np.log10(S[(f>=a)&(f<b)].sum()/t)),1) for a,b in [(30,120),(120,500),(500,2000),(2000,4000),(4000,8000),(8000,16000)]]
names="C C# D D# E F F# G G# A A# B".split()
def croma(r):
    sr,m=leer(r); f=np.fft.rfftfreq(len(m),1/sr); S=np.abs(np.fft.rfft(m*np.hanning(len(m))))**2; sel=(f>60)&(f<2000)
    c=np.zeros(12); np.add.at(c,(np.round(12*np.log2(f[sel]/440)+9).astype(int))%12,S[sel]); c/=c.sum()
    return {names[i]:round(float(c[i]),3) for i in np.argsort(c)[::-1][:7]}
def nivel(r,seg=4):
    sr,m=leer(r); k=int(seg*sr); return " ".join(f"{20*np.log10(max(1e-6,np.sqrt(np.mean(m[i*k:(i+1)*k]**2)))):.0f}" for i in range(len(m)//k))
for r in sys.argv[1:]:
    print(r); print("  bandas (30-120,120-500,500-2k,2-4k,4-8k,8-16k):", bandas(r)); print("  croma:", croma(r)); print("  nivel/4s:", nivel(r))
