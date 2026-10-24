# Herramientas

Todo lo que **no es la app** pero sirve para cuidarla o mostrarla. Cada carpeta
tiene su propio `README.md` con los detalles.

| Carpeta | Para qué sirve | Cómo se usa |
|---|---|---|
| [`pruebas/`](./pruebas/) | Las pruebas automáticas de la app (más de 3.700 comprobaciones). Tienen que dar verde antes de cada cambio. | `./herramientas/pruebas/correr.sh` |
| [`auditoria/`](./auditoria/) | La auditoría completa: busca problemas (bugs, seguridad, diseño, idiomas…) y deja un informe. No falla: anota. | `./herramientas/auditoria/correr.sh` |
| [`publicar/`](./publicar/) | Lo único que se le hace a `index.html` al publicarlo: la CSP con las huellas de sus scripts. Lo usa «Publicar el sitio». | (solo) |
| [`video/`](./video/) | Todo lo necesario para rehacer el video de presentación (datos de demostración, grabación, música). | `bash herramientas/video/hacer_video.sh` |

La app en sí es `index.html` (en la raíz); la base de datos y los procesos
automáticos están en [`supabase/`](../supabase/) y [`.github/workflows/`](../.github/workflows/);
los documentos, en [`docs/`](../docs/).
