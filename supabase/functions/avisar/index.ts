// La función `avisar` de Supabase: le manda un correo al administrador
// cuando alguien pide entrar. La lógica está en ../_compartido/avisos.mjs,
// con sus pruebas; esto solo la conecta. Ver supabase/functions/LEEME.md.
import { atenderAviso } from "../_compartido/avisos.mjs";

Deno.serve(req => atenderAviso(req, { env: k => Deno.env.get(k) }));
