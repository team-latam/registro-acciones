# La auditoría del Registro

Así como `pruebas/` cuida que lo que anda siga andando, esta carpeta sale
a buscar lo que está mal o se puede mejorar. Es la base de cada auditoría:
cuando el usuario pide una, se arranca de acá (ver `METODO.md`).

| Archivo | Qué es |
|---|---|
| `METODO.md` | Los pasos, cada área a revisar y con qué, los niveles (urgente a opcional), lo que se revisa a mano y cómo sumar algo nuevo |
| `RECURRENTES.md` | Lo que ya falló más de una vez, por qué y la regla que lo evita |
| `conocidos.json` | Hallazgos ya revisados y aceptados, con el porqué (no se vuelven a contar) |
| `correr.sh` | Corre todo y arma el informe en `salida/<fecha>/informe.md` |
| `herramientas/` | Una por tema: `textos`, `codigo`, `seguridad`, `pantallas`, `datos`, e `informe` que junta todo |

```
./auditoria/correr.sh            # todo, unos 15 minutos
RAPIDO=1 ./auditoria/correr.sh   # unos 5 minutos
node auditoria/herramientas/datos.mjs        # una sola, con el resultado en pantalla
AUDITORIA_SEMILLA=777 node auditoria/herramientas/datos.mjs   # repetir los mismos datos al azar
```

## Pruebas y auditoría: la diferencia

- **Pruebas** (`pruebas/`): cuidan lo conocido. Tienen que dar verde antes
  de cada commit; si fallan, algo se rompió.
- **Auditoría** (esta carpeta): busca lo desconocido. No falla: anota
  hallazgos para verificar y decidir. Lo que se arregla pasa a ser una
  prueba.

Las dos usan la misma app de mentira (`pruebas/app_de_mentira.mjs`): el
`index.html` de verdad contra un Supabase de mentira, nunca la base real.

## Lo que la auditoría ya encontró al armarse (6/10/2026)

Corriendo estas herramientas por primera vez aparecieron, y se arreglaron:
una palabra larga que estiraba la página en cinco lugares (chips de lugar
y de proyecto, participantes, «Lugares», el nombre en la ficha), dos
selects que se estiraban hasta su opción más larga, una clase de CSS
muerta, y una prueba («sin un solo error») que no recibía los errores.
Con HTML metido en cada campo, no se ejecutó ni se coló nada.
