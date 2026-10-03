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

/* ---------- Qué base elige la pestaña ---------- */
const elegir = busqueda => new Function("ctx", `
  const location = ctx.location; const URLSearchParams = ctx.URLSearchParams;
  ${grab("baseElegida")}
  return baseElegida();
`)({ location:{ search: busqueda }, URLSearchParams });

eq("sin nada en la dirección, va a Firebase (la del equipo)", elegir(""), "firebase");
eq("con ?base=supabase, a Supabase", elegir("?base=supabase"), "supabase");
eq("y acompañada de otras cosas, también", elegir("?vista=feed&base=supabase"), "supabase");
eq("cualquier otro valor NO cambia de base", elegir("?base=otra"), "firebase");
eq("ni escrito a medias", elegir("?base=supa"), "firebase");
eq("si el navegador no sabe leer la dirección, se queda en la del equipo",
   new Function("ctx", `const location = ctx.location;
     const URLSearchParams = function(){ throw new Error("no existe"); };
     ${grab("baseElegida")} return baseElegida();`)({ location:{ search:"?base=supabase" } }), "firebase");

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
eq("al arrancar avisa aunque no haya nadie (Firebase hace lo mismo)", visto, [null]);

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
eq("si no hay nombre, se usa el correo (igual que con Firebase)",
   visto[0].displayName, "sin.nombre@x.com");
eq("y si no hay foto, queda vacío y no undefined", visto[0].photoURL, "");

await ses.iniciar();
eq("entrar pide Google", sbm.reg.pedidos[0].provider, "google");
eq("y vuelve a ESTA pestaña, sin perder el ?base=supabase",
   sbm.reg.pedidos[0].options.redirectTo, "https://x.io/app/?base=supabase");
eq("sin arrastrar lo que venga después del #",
   sbm.reg.pedidos[0].options.redirectTo.includes("#"), false);

await ses.cerrar();
eq("salir cierra la sesión", sbm.reg.cerro, true);

/* ---------- Las dos sesiones ofrecen lo mismo ---------- */
const fbSes = new Function("ctx", `const authMod = ctx.authMod; const auth = {};
  ${grab("firebaseSesion")};
  return firebaseSesion;`)({ authMod: new Proxy({}, { get: ()=> ()=>({}) }) });
const firma = o => Object.keys(o).sort().map(k => `${k}(${o[k].length})`).join(" | ");
eq("las dos formas de entrar ofrecen exactamente lo mismo",
   firma(crearSesion(supabaseDeMentira())), firma(fbSes));

/* ---------- El cartel ---------- */
const doc = { creado:null, puesto:null,
  createElement: ()=>({ style:{}, set textContent(v){ this._t = v; }, get textContent(){ return this._t; } }),
  body: { prepend(d){ doc.puesto = d; } } };
// t() de mentira: devuelve el español y anota que se la llamó con los
// cuatro idiomas (el cartel estaba escrito solo en español, fuera de t()).
const llamadasT = [];
new Function("ctx", `const document = ctx.document;
  const t = (...idiomas) => { ctx.llamadasT.push(idiomas); return idiomas[0]; };
  ${grab("mostrarAvisoDeBase")} mostrarAvisoDeBase();`)({ document: doc, llamadasT });
eq("el cartel pasa por t(), en los cuatro idiomas",
   llamadasT.length === 1 && llamadasT[0].filter(x => typeof x === "string" && x.includes("SUPABASE")).length, 4);
eq("el cartel dice claramente qué base está mirando",
   doc.puesto.textContent.includes("SUPABASE"), true);
eq("y que lo que se haga ahí no lo ve el equipo",
   doc.puesto.textContent.includes("no lo ve nadie más"), true);
eq("se queda pegado arriba aunque se baje",
   /position:\s*sticky/.test(doc.puesto.style.cssText || ""), true);
eq("y por encima de todo lo demás",
   /z-index:\s*9{3,}/.test(doc.puesto.style.cssText || ""), true);

/* ---------- Que el interruptor esté cableado ---------- */
eq("en modo Supabase se cambian las DOS cosas: los datos y la sesión",
   /store = crearSupabaseStore\(sb\);\s*\n\s*sesion = crearSupabaseSesion\(sb\);/.test(src), true);
eq("el cartel se muestra ANTES de descargar nada: si algo falla, igual se ve qué base es",
   /async function arrancarSupabase\(\)\{[\s\S]{0,400}?mostrarAvisoDeBase\(\);[\s\S]*?await import/.test(src), true);
eq("y el modo Supabase NO cuelga del arranque de Firebase",
   /if\(BASE === "supabase"\) return arrancarSupabase\(\);/.test(src), true);
eq("que Firebase no cargue en ese modo es un aviso, no un error fatal",
   /console\.warn\("Sin Firebase/.test(src), true);
eq("entrar y salir ya no nombran a Firebase",
   /await sesion\.iniciar\(\);/.test(src) && /await sesion\.cerrar\(\);/.test(src), true);
eq("y el arranque escucha por el adaptador, no por Firebase directo",
   /sesion\.alCambiar\(onAuthChanged\);/.test(src), true);

/* ================================================================
   Volver a la pestaña NO es iniciar sesión

   Supabase emite SIGNED_IN cada vez que la ventana recupera el foco, y
   TOKEN_REFRESHED cada hora. La app trata cada aviso como un cambio de
   sesión: corta las suscripciones, vacía el estado y arranca de cero. El
   síntoma era volver de otra ventana y encontrarse con "Cargando registro
   compartido…" otra vez — a veces para siempre.

   Firebase no hace nada de esto: avisa cuando la sesión CAMBIA. Que el
   adaptador se parezca a Firebase es justamente su trabajo.
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
