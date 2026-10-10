-- La lista blanca de funciones de `public` que anon y authenticated pueden ejecutar
-- (docs/AUDITORIA.md, R27). La comparten DOS lugares, para que no se desfasen:
--   * supabase/pruebas/75-funciones-ejecutables.sql, contra el laboratorio;
--   * supabase/verificar/permisos.sql, contra la base de verdad.
-- Crea la tabla temporal `esperadas`. NO empieza con dos dígitos a propósito: el corredor
-- de supabase/pruebas/ corre solo los archivos NN-*.sql, y este no es una prueba.
-- ---------- La lista ----------
-- (firma, ¿la ejecuta anon?, ¿la ejecuta authenticated?)
--
-- Quedan afuera las funciones de disparador (devuelven `trigger`): Postgres
-- no deja llamarlas a mano ("trigger functions can only be called as
-- triggers"), y más abajo se comprueba.
create temp table esperadas (firma text primary key, anon boolean not null, authenticated boolean not null);
insert into esperadas values
  -- Ayudantes que dicen algo de QUIEN LLAMA, nada de los demás. anon las
  -- ejecuta porque las políticas las usan; sin sesión devuelven "no".
  ('admin_fijo()',                          true, true),   -- una constante
  ('mi_correo()',                           true, true),   -- el correo de su propia credencial
  ('mi_rol()',                              true, true),   -- security definer: su rol, 'member' si no está
  ('esta_aprobado()',                       true, true),   -- security definer: ¿está en el equipo?
  ('es_admin_fijo()',                       true, true),
  ('es_admin_rol()',                        true, true),
  ('puede_escribir()',                      true, true),
  ('sesion_valida()',                       true, true),
  ('correo_de_su_google()',                 true, true),   -- security definer: solo mira SU identidad
  ('sin_sesion_de_persona()',               true, true),
  ('puede_editar_posteo(text, text, text[])', true, true), -- puro: compara los argumentos con su correo
  ('datos_del_pedido()',                    true, true),   -- navegador e IP de SU propio pedido
  -- Puras: solo miran lo que se les pasa (validaciones y comparaciones).
  ('archivos_ok(jsonb)',                    true, true),
  ('campos_cambiados(jsonb, jsonb)',        true, true),
  ('ciudades_ok(jsonb)',                    true, true),
  ('entero_de_pref(jsonb, integer, integer, integer)', true, true),
  ('es_importado(posts)',                   true, true),
  ('es_participante(jsonb, text)',          true, true),
  ('fecha_de_papelera(text)',               true, true),
  ('fechas_ok(text[], integer)',            true, true),
  ('links_ok(jsonb)',                       true, true),
  ('lista_ok(jsonb, integer)',              true, true),
  ('mudanzas_ok(jsonb)',                    true, true),
  ('participantes_ok(jsonb)',               true, true),
  ('rutas_ok(text[], integer)',             true, true),
  ('sin_tildes(text)',                      true, true),
  ('sincronizacion_ok(jsonb)',              true, true),
  ('telefonos_ok(jsonb)',                   true, true),
  ('territorio_ok(jsonb)',                  true, true),
  ('textos_ok(text[], integer, integer)',   true, true),
  ('tipo_ok(jsonb)',                        true, true),
  ('tipos_ok(jsonb)',                       true, true),
  -- security invoker: pasan por las políticas de quien llama. anon las
  -- ejecuta pero no tiene permiso sobre ninguna tabla, así que no logra nada.
  ('guardar_config(text, jsonb)',           true, true),
  ('guardar_preferencias(jsonb)',           true, true),
  ('me_gusta_comentario(text, boolean)',    true, true),
  ('me_gusta_posteo(text, boolean)',        true, true),
  ('resumen_de_posteo(jsonb)',              true, true),   -- lee app_config con los permisos de quien llama
  -- Solo con sesión (anon no las ejecuta): las de administración cortan
  -- adentro si no sos admin; las de avisos, si no es tu pedido.
  ('agenda_traer(text, jsonb)',             false, true),  -- admin
  ('aviso_al_admin_enviado()',              false, true),  -- solo sobre SU pedido de acceso
  ('clasificar_importados(jsonb)',          false, true),  -- admin (security invoker)
  ('devolver_al_registro(text[])',          false, true),  -- admin
  ('olvidar_preferencias(text)',            false, true),  -- admin; las del admin fijo, solo él
  ('pedir_aviso_al_admin()',                false, true),  -- solo sobre SU pedido de acceso; devuelve un turno, no destinatarios
  ('preparar_aviso(text, text)',            false, true),  -- solo sobre lo que escribió quien llama; devuelve un turno
  ('preparar_prueba()',                     false, true),  -- solo a su propio correo; devuelve un turno
  ('reemplazar_correo(text[], text, text)', false, true),  -- pura
  ('sacar_del_registro(text[])',            false, true),  -- admin
  ('tamano_del_bucket()',                   false, true),  -- admin
  ('unificar_cuentas(text, text)',          false, true),  -- admin
  ('unir_personas(text, text)',             false, true),  -- admin
  ('vincular_persona(text, text)',          false, true);  -- admin

