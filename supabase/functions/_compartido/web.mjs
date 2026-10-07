// Lo que comparten las funciones de Supabase que llama la app: desde qué
// páginas se las puede llamar (CORS) y con qué encabezados contestan.
// La de verdad y una copia local; ninguna otra página, ni otra de github.io.
const ORIGENES = [/^https:\/\/team-latam\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
export function encabezados(origen){
  const h = { "Content-Type": "application/json", "Vary": "Origin" };
  if(origen && ORIGENES.some(r => r.test(origen))){
    h["Access-Control-Allow-Origin"] = origen;
    h["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info";
    h["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    h["Access-Control-Max-Age"] = "3600";
  }
  return h;
}
