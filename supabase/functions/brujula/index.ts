// La función `brujula` de Supabase: la pantalla Administración › Brújula lee por acá Google Drive y las
// planillas del equipo, con la cuenta de servicio de Brújula, y solo para un admin. Toda la lógica está en
// ../_compartido/brujula.mjs, con sus pruebas; esto solo la conecta. Ver docs/brujula/README.md.
import { atender } from "../_compartido/brujula.mjs";

Deno.serve(req => atender(req, { env: k => Deno.env.get(k) }));
