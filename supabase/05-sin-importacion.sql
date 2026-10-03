-- ============================================================
-- Registro de Acciones — Paso 5: la importación, cerrada
-- ============================================================
-- Acá estuvo la puerta por la que entraron los datos de Firebase:
-- importar(), importar_quitar() y cuantas_filas(). importar() existía para
-- escribir lo que ningún navegador puede —la fecha real de cada posteo y
-- de quién era— y para eso prendía una marca (es_importacion()) que hacía
-- a un lado los controles de la base.
--
-- Firebase se cerró el 3 de octubre de 2026 y lo que faltaba ya se trajo.
-- Una puerta así, abierta sin motivo, es una puerta de más: se saca, con
-- la marca. Los disparadores ya no la miran (02, 03 y 04), y este archivo
-- corre después que ellos: cuando la función desaparece, nadie la llama.
--
-- Si alguna vez hiciera falta traer algo de nuevo, está en el historial
-- del repo, con sus pruebas.
-- ============================================================

drop function if exists public.importar(text, jsonb);
drop function if exists public.importar(text, jsonb, boolean);
drop function if exists public.importar_quitar(text, jsonb);
drop function if exists public.cuantas_filas();
drop function if exists public.es_importacion();
