#!/bin/bash
# Pule la pista cruda: filtro de graves, un poco de brillo y volumen parejo (-16 LUFS, la norma para video en redes).
# Uso: bash pulir.sh   (en la carpeta donde quedó musica_cruda.wav)  →  musica.wav
ffmpeg -hide_banner -loglevel error -y -i musica_cruda.wav -af "highpass=f=34,equalizer=f=70:t=q:w=1:g=-5,equalizer=f=300:t=q:w=0.8:g=2,equalizer=f=1400:t=q:w=0.8:g=4,equalizer=f=3500:t=q:w=0.8:g=6,equalizer=f=6500:t=q:w=0.8:g=3,loudnorm=I=-16:TP=-1.5:LRA=9" -ar 44100 musica.wav
