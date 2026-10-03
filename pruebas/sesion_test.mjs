import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html","utf8");
import { hacerGrab } from "./grab.mjs";
const grab = hacerGrab(src);

let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

/* ---------- El perfil, traducido ---------- */
function supabaseDeMentira(){
  const reg = { pedidos:[] };
  let alCambiar = null, sesionActual = null;
  return { reg,
    auth: {
      getSession: async ()=>({ data:{ session: sesionActual } }),
      onAuthStateChange(f){ alCambiar = f; },
      signInWithOAuth: async o=>{ reg.pedidos.push(o); return { error: reg.errorLogin || null }; },
      signOut: async ()=>{ reg.cerro = true; alCambiar && alCambiar("x", null); },
    },
    entrar(u){ sesionActual = { user:u }; alCambiar && alCambiar("SIGNED_IN", sesionActual); },
    // Lo que Supabase emite SOLO: volver a la pestaña dispara SIGNED_IN de
    // nuevo con la MISMA sesión, y cada hora llega un TOKEN_REFRESHED.
    reemitir(evento){ alCambiar && alCambiar(evento || "SIGNED_IN", sesionActual); },
  };
}

const crearSesion = new Function("ctx", `
  const location = ctx.location;
  ${grab("crearSupabaseSesion")}
  return crearSupabaseSesion;
`)({ location:{ href:"https://x.io/app/?base=supabase#algo" } });

const sbm = supabaseDeMentira();
const ses = crearSesion(sbm);
let visto = [];
ses.alCambiar(p => visto.push(p));
await new Promise(r => setTimeout(r, 0));
eq("al arrancar avisa aunque no haya nadie (la app cuenta con ese primer aviso)", visto, [null]);

visto = [];
sbm.entrar({ id:"uuid-1", email:"benny@team-latam.com",
             user_metadata:{ full_name:"Benny Baires", avatar_url:"http://foto" } });
eq("el perfil llega con los nombres que usa la app",
   Object.keys(visto[0]).sort(), ["displayName","email","photoURL","uid"]);
eq("el identificador de Supabase va en uid", visto[0].uid, "uuid-1");
eq("el nombre sale de donde Supabase lo guarda", visto[0].displayName, "Benny Baires");
eq("y la foto también", visto[0].photoURL, "http://foto");

visto = [];
sbm.entrar({ id:"uuid-2", email:"sin.nombre@x.com", user_metadata:{} });
eq("si no hay nombre, se usa el correo",
   visto[0].displayName, "sin.nombre@x.com");
eq("y si no hay foto, queda vacío y no undefined", visto[0].photoURL, "");

await ses.iniciar();
eq("entrar pide Google", sbm.reg.pedidos[0].provider, "google");
eq("y vuelve a ESTA misma dirección, con lo que tenga después del ?",
   sbm.reg.pedidos[0].options.redirectTo, "https://x.io/app/?base=supabase");
eq("sin arrastrar lo que venga después del #",
   sbm.reg.pedidos[0].options.redirectTo.includes("#"), false);

await ses.cerrar();
eq("salir cierra la sesión", sbm.reg.cerro, true);

/* ---------- La sesión ofrece justo lo que la app usa ---------- */
const firma = o => Object.keys(o).sort().map(k => `${k}(${o[k].length})`).join(" | ");
eq("quién está adentro, entrar y salir: nada más",
   firma(crearSesion(supabaseDeMentira())), "alCambiar(1) | cerrar(0) | iniciar(0)");

/* ---------- El arranque ---------- */
eq("arrancar() arma las DOS cosas: los datos y la sesión",
   /store = crearSupabaseStore\(sb\b[^;]*\);\s*\n\s*sesion = crearSupabaseSesion\(sb\);/.test(src), true);
// Sin esto el adaptador no tiene con qué armar las miniaturas, y cada foto
// se sube sola: las tarjetas vuelven a bajar la foto entera, sin que
// ninguna otra prueba lo note (sb_test le pasa una de mentira).
eq("y la capa de datos recibe con qué armar la miniatura de cada foto",
   /store = crearSupabaseStore\(sb, \{ achicar: achicarDataUrl \}\);/.test(src), true);
// Las firmas de los adjuntos quedan guardadas en el navegador y abren los
// archivos sin sesión. Se borran en CUALQUIER salida —el botón, otra
// pestaña, la sesión que vence—, que es cuando onAuthChanged recibe nadie.
eq("al quedar sin sesión, por donde sea, se olvidan las firmas guardadas",
   /async function onAuthChanged\(user\)\{[\s\S]*?if\(!user\)\{[\s\S]{0,400}?store\.olvidarFirmas\(\);[\s\S]{0,120}?status:"signedOut"/.test(src), true);
eq("entrar y salir van por la sesión",
   /await sesion\.iniciar\(\);/.test(src) && /await sesion\.cerrar\(\);/.test(src), true);
eq("y el arranque escucha por ella",
   /sesion\.alCambiar\(onAuthChanged\);/.test(src), true);
eq("la página arranca por arrancar(), una sola vez", (src.match(/^arrancar\(\);$/mg) || []).length, 1);

// Firebase se cerró el 3 de octubre de 2026 y su código se fue con él. Lo
// que no puede volver: que la app lo cargue, o que algo lo llame.
const codigo = src.slice(src.indexOf('<script type="module">'));
eq("la app no carga nada de Firebase",
   /gstatic\.com\/firebasejs|firebaseapp\.com|FIREBASE_CONFIG/.test(codigo), false);
eq("ni queda nada que lo use",
   ["firebaseStore","firebaseSesion","initFirebase","arrancarSupabase","authMod","baseElegida",
    "mostrarAvisoDeBase","armarRespaldo","LIMITES_FIREBASE","CONFIG_IS_PLACEHOLDER"]
     .filter(n => new RegExp("\\b" + n + "\\b").test(codigo)), []);

/* ================================================================
   Volver a la pestaña NO es iniciar sesión

   Supabase emite SIGNED_IN cada vez que la ventana recupera el foco, y
   TOKEN_REFRESHED cada hora. La app trata cada aviso como un cambio de
   sesión: corta las suscripciones, vacía el estado y arranca de cero. El
   síntoma era volver de otra ventana y encontrarse con "Cargando registro
   compartido…" otra vez — a veces para siempre.

   La app espera un aviso solo cuando la sesión CAMBIA: filtrar el resto es
   justamente el trabajo del adaptador.
================================================================ */
{
  const sb2 = supabaseDeMentira();
  const s2 = crearSesion(sb2);
  const avisos = [];
  s2.alCambiar(p => avisos.push(p ? p.uid : null));
  await new Promise(r => setTimeout(r, 0));
  eq("arranca avisando que no hay nadie", avisos, [null]);

  sb2.entrar({ id:"uuid-1", email:"benny@team-latam.com", user_metadata:{} });
  eq("iniciar sesión sí avisa", avisos, [null, "uuid-1"]);

  sb2.reemitir("SIGNED_IN");
  eq("volver a la pestaña NO avisa de nuevo", avisos, [null, "uuid-1"]);

  sb2.reemitir("TOKEN_REFRESHED");
  eq("renovar el token tampoco", avisos, [null, "uuid-1"]);

  sb2.reemitir("INITIAL_SESSION");
  eq("ni el aviso de sesión inicial repetido", avisos, [null, "uuid-1"]);

  for(let i=0; i<20; i++) sb2.reemitir("SIGNED_IN");
  eq("ni veinte idas y vueltas entre ventanas", avisos, [null, "uuid-1"]);

  // Lo que SÍ tiene que seguir pasando
  sb2.entrar({ id:"uuid-2", email:"otra@x.com", user_metadata:{} });
  eq("cambiar de cuenta sí avisa", avisos, [null, "uuid-1", "uuid-2"]);

  await sb2.auth.signOut();
  eq("cerrar sesión sí avisa", avisos, [null, "uuid-1", "uuid-2", null]);

  sb2.auth.signOut();
  await new Promise(r => setTimeout(r, 0));
  eq("pero cerrarla dos veces no avisa dos veces", avisos, [null, "uuid-1", "uuid-2", null]);

  sb2.entrar({ id:"uuid-1", email:"benny@team-latam.com", user_metadata:{} });
  eq("y volver a entrar después de salir, sí", avisos, [null, "uuid-1", "uuid-2", null, "uuid-1"]);
}

{
  // El orden entre getSession() y onAuthStateChange no está garantizado:
  // el que llegue primero avisa, el otro se calla. Sin el filtro, el mismo
  // usuario entraba dos veces al arrancar.
  const sb3 = supabaseDeMentira();
  sb3.entrar({ id:"uuid-9", email:"ya@adentro.com", user_metadata:{} });  // ya había sesión
  const s3 = crearSesion(sb3);
  const avisos3 = [];
  s3.alCambiar(p => avisos3.push(p ? p.uid : null));
  await new Promise(r => setTimeout(r, 0));
  sb3.reemitir("INITIAL_SESSION");
  eq("con sesión previa, se avisa una sola vez", avisos3, ["uuid-9"]);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
