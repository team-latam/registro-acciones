// La función `calendario` de Supabase: la app lee por acá el Google
// Calendar del equipo, con la cuenta de servicio, sin que el calendario
// tenga que ser público. Toda la lógica está en ../_compartido/google.mjs
// (la usa también el trabajo nocturno, y ahí tiene sus pruebas); esto solo
// la conecta. Ver supabase/functions/LEEME.md.
import { atender } from "../_compartido/google.mjs";

Deno.serve(req => atender(req, { env: k => Deno.env.get(k) }));
