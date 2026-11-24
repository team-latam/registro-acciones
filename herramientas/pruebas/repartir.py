#!/usr/bin/env python3
"""Reparte las pruebas en partes parejas, para que GitHub las corra en paralelo (SHARD=i/n en correr.sh).

Uso:  python3 repartir.py i/n archivo1_test.mjs archivo2_test.mjs ...
Imprime, uno por línea, los archivos que le tocan a la parte i (de 1 a n).

El reparto mira cuánto tarda cada prueba (pesos.txt: «archivo segundos») y va poniendo la más pesada que queda en la
parte que menos lleva (así ninguna parte se lleva todo lo lento). Una prueba nueva, que todavía no está en pesos.txt, pesa
lo de una mediana (PESO_NUEVO). Es determinista: con la misma lista y los mismos pesos, siempre el mismo reparto.
Los pesos se renuevan de vez en cuando con medir_tiempos.sh.
"""
import os, sys

PESO_NUEVO = 10.0

def leer_pesos(ruta):
    pesos = {}
    try:
        for linea in open(ruta, encoding="utf-8"):
            p = linea.split()
            if len(p) == 2 and not linea.startswith("#"):
                try: pesos[p[0]] = float(p[1])
                except ValueError: pass
    except FileNotFoundError:
        pass
    return pesos

def repartir(archivos, n, pesos):
    """Devuelve n listas de archivos, repartidas por peso."""
    partes = [[] for _ in range(n)]
    carga = [0.0] * n
    # Más pesadas primero; a igual peso, por nombre (determinista).
    orden = sorted(archivos, key=lambda f: (-pesos.get(f, PESO_NUEVO), f))
    for f in orden:
        k = min(range(n), key=lambda i: (carga[i], i))
        partes[k].append(f)
        carga[k] += pesos.get(f, PESO_NUEVO)
    return [sorted(p) for p in partes]

def main(argv):
    if len(argv) < 3 or "/" not in argv[1]:
        print("Uso: repartir.py i/n archivo...", file=sys.stderr); return 2
    try:
        i, n = (int(x) for x in argv[1].split("/", 1))
    except ValueError:
        print("«%s» no es una parte válida (se escribe i/n, por ejemplo 2/4)." % argv[1], file=sys.stderr); return 2
    if n < 1 or not (1 <= i <= n):
        print("«%s» no es una parte válida: i va de 1 a n." % argv[1], file=sys.stderr); return 2
    pesos = leer_pesos(os.path.join(os.path.dirname(os.path.abspath(__file__)), "pesos.txt"))
    for f in repartir(argv[2:], n, pesos)[i - 1]:
        print(f)
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
