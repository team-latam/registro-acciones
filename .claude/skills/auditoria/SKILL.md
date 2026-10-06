---
name: auditoria
description: Auditoría del Registro de Acciones (bugs, código muerto, seguridad, diseño en escritorio y celular, sobrecarga, estética, idiomas y RTL, ventanas, datos variados, rendimiento, almacenamiento, copias, integraciones, privacidad, accesibilidad, uso y crítica del uso). Usar SIEMPRE que el usuario pida una auditoría, una revisión general, «revisá todo», «qué hay que mejorar», o revisar un área entera de la app; también antes de cerrar una tanda grande de cambios.
---

# Auditoría del Registro

El método completo vive en el repo, no acá: **leer primero
`auditoria/METODO.md`**, después `auditoria/RECURRENTES.md` y la última
`docs/AUDITORIA.md`. Esta skill solo es la entrada.

## En corto

1. `git pull` de `main`. Leer METODO.md, RECURRENTES.md, la última
   docs/AUDITORIA.md (lo que el usuario ya decidió no se vuelve a
   proponer) y `auditoria/conocidos.json`.
2. `./auditoria/correr.sh` (o `RAPIDO=1 ./auditoria/correr.sh` si el
   usuario quiere algo rápido). Leer `auditoria/salida/<fecha>/informe.md`.
3. Verificar cada hallazgo antes de contarlo. Falso positivo → mejorar la
   herramienta o anotarlo en `conocidos.json` con el porqué.
4. Revisar a mano lo que dice «Lo que se revisa a mano» en METODO.md, con
   capturas (escritorio, celular, claro, oscuro, hebreo) armadas con
   `pruebas/app_de_mentira.mjs`.
5. Escribir `docs/AUDITORIA.md` (la anterior a
   `docs/auditoria/historial/`), el detalle en `docs/auditoria/`, y una
   página (Artifact) para el usuario con capturas y en palabras simples.
6. Decisiones del usuario: opciones + recomendación; con el celular, como
   preguntas para tocar (AskUserQuestion), de a cuatro.
7. Al arreglar: prueba que falle sin el arreglo, `./pruebas/correr.sh` en
   verde, push a `main`, tachar en el documento y en la página.
8. Al terminar: sumar lo nuevo a RECURRENTES.md y a las herramientas.

## Reglas que no cambian

- Nunca contra la base ni el proyecto de verdad; ningún dato real sale.
- Las reglas fijas del usuario (CLAUDE.md): español simple, paso a paso,
  nunca pedirle llaves o contraseñas en el chat, nunca borrar el proyecto
  de Google Cloud `40280679854`.
- Nada se reporta sin verificar. Nada se arregla sin su prueba.
