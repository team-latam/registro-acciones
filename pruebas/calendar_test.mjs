import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html","utf8");
function grab(name){
  const m = new RegExp(`\\n(?:function|async function|const|let) ${name}\\s*[=(]`).exec(src);
  if(!m) throw new Error("no se encontró " + name);
  const desde = m.index + m[0].length - 1;
  const finLinea = src.indexOf("\n", desde);
  const linea = src.slice(m.index + 1, finLinea + 1);
  const cuenta = (t, c) => (t.split(c).length - 1);
  if(/;\s*$/.test(linea) && cuenta(linea,"{")===cuenta(linea,"}") && cuenta(linea,"[")===cuenta(linea,"]")) return linea;
  // El bloque arranca en la primera llave que NO esté adentro de los
  // paréntesis de los argumentos: `function f(opts={})` tiene una llave
  // ahí que no abre nada, y tomarla cortaba la función por la mitad.
  let paren = 0, primero = -1;
  for(let j = desde; j < src.length; j++){
    const c = src[j];
    if(c === "(") paren++;
    else if(c === ")") paren--;
    else if(paren === 0 && (c === "{" || c === "[")){ primero = j; break; }
    else if(paren === 0 && c === "\n" && primero < 0 && j > finLinea) break;
  }
  if(primero < 0) return linea;
  let depth = 0, inStr = null;
  const abre = src[primero], cierra = abre === "[" ? "]" : "}";
  for(let j = primero; j < src.length; j++){
    const c = src[j];
    if(inStr){ if(c === "\\"){ j++; continue; } if(c === inStr) inStr = null; continue; }
    if(c === '"' || c === "'" || c === "`"){ inStr = c; continue; }
    if(c === "/" && src[j+1] === "/"){ j = src.indexOf("\n", j); continue; }
    if(c === abre) depth++;
    else if(c === cierra){ depth--; if(depth === 0) return src.slice(m.index + 1, j + 1); }
  }
  throw new Error("no cerró " + name);
}
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

function armar(ctx){
  return new Function("ctx", `
    const state = ctx.state; const window = ctx.window; const console = ctx.console;
    const GOOGLE_OAUTH_CLIENT_ID = "cliente-de-prueba";
    const SILENT_TOKEN_TIMEOUT_MS = 20;
    const sessionStorage = { setItem(){}, getItem(){ return null; } };
    let calendarAccessToken = null, calendarTokenExpiry = 0, calendarAclScopeGranted = false;
    const Date_ = Date;
    function isAdmin(){ return ctx.esAdmin === true; }
    async function loadGis(){ return !!(window.google && window.google.accounts); }
    ${grab("requestSilentCalendarToken")}
    ${grab("requestCalendarTokenPopup")}
    ${grab("storeGisToken")}
    ${grab("ensureCalendarToken")}
    ${grab("ensureCalendarAclToken")}
    return { ensureCalendarToken, ensureCalendarAclToken, verToken: ()=> calendarAccessToken };
  `)(ctx);
}

// Un Google Identity Services de mentira.
function gis({ silencioso, conVentana }){
  const reg = { pedidos: [] };
  return { reg, google: { accounts: { oauth2: { initTokenClient(cfg){
    return { requestAccessToken(o){
      const conPrompt = !!(o && o.prompt === "");
      reg.pedidos.push({ silencioso: conPrompt, scope: cfg.scope, hint: cfg.hint });
      const r = conPrompt ? silencioso : conVentana;
      setTimeout(()=> r ? cfg.callback(r) : cfg.error_callback({ type:"no" }), 0);
    } };
  } } } } };
}
const base = g => ({
  state: { auth: { user: { email:"benny@team-latam.com" }, status:"admin" }, roster: [] },
  window: g.google ? g : {}, console: { warn(){}, error(){} }, esAdmin: false,
});

/* --- 1. Si Google lo da en silencio, ni se molesta a nadie --- */
let g = gis({ silencioso:{ access_token:"TOKEN_SILENCIOSO", expires_in:3600 } });
let ctx = base(g);
eq("con el permiso ya dado, el token sale solo, sin ventanas",
   await armar(ctx).ensureCalendarToken(), "TOKEN_SILENCIOSO");
eq("y se pidió UNA sola vez, en silencio", g.reg.pedidos.map(p=>p.silencioso), [true]);

/* --- 2. Si no, la ventana de Google --- */
g = gis({ silencioso:null, conVentana:{ access_token:"TOKEN_CON_VENTANA", expires_in:3600 } });
ctx = base(g);
eq("si no sale en silencio, la ventana de Google consigue el permiso",
   await armar(ctx).ensureCalendarToken(), "TOKEN_CON_VENTANA");
eq("primero se intenta en silencio y recién después con ventana",
   g.reg.pedidos.map(p=>p.silencioso), [true, false]);
eq("y se pide el permiso de eventos", g.reg.pedidos[1].scope.includes("calendar.events"), true);
eq("con la cuenta ya elegida, para no hacerla buscar",
   g.reg.pedidos[1].hint, "benny@team-latam.com");

/* --- 3. El admin pide los dos permisos en la MISMA ventana --- */
g = gis({ silencioso:null, conVentana:{ access_token:"T", expires_in:3600 } });
ctx = base(g); ctx.esAdmin = true;
await armar(ctx).ensureCalendarToken();
eq("el admin pide eventos Y compartir de una vez (una sola ventana por sesión)",
   [g.reg.pedidos[1].scope.includes("calendar.events"), g.reg.pedidos[1].scope.includes("calendar.acls")],
   [true, true]);

/* --- 4. Si Google no lo da, no rompe: devuelve nada --- */
g = gis({ silencioso:null, conVentana:null });
ctx = base(g);
eq("si Google no da el permiso, no rompe la app: se queda sin Calendar",
   await armar(ctx).ensureCalendarToken(), null);
eq("y no lo vuelve a intentar por otro lado", g.reg.pedidos.map(p=>p.silencioso), [true, false]);

/* --- 5. Lo mismo para compartir el Calendar --- */
g = gis({ silencioso:null, conVentana:{ access_token:"TOKEN_ACL", expires_in:3600 } });
ctx = base(g);
eq("compartir el Calendar va por el mismo camino",
   await armar(ctx).ensureCalendarAclToken(), "TOKEN_ACL");
eq("y pide los dos permisos", g.reg.pedidos[1].scope.includes("calendar.acls"), true);

g = gis({ silencioso:null, conVentana:{ access_token:"NO_DEBERIA", expires_in:3600 } });
ctx = base(g);
eq("pero el modo callado sigue callado: no abre ninguna ventana",
   await armar(ctx).ensureCalendarAclToken({ silentOnly:true }), null);
eq("y solo intentó en silencio", g.reg.pedidos.map(p=>p.silencioso), [true]);

/* --- 6. El permiso es de Google, y se le pide a Google --- */
eq("ninguna de las dos pasa por otro lado que no sea Google",
   [grab("ensureCalendarToken"), grab("ensureCalendarAclToken")].some(f => /authMod|signInWithPopup|firebase/i.test(f)), false);

/* ================================================================
   "Creado automáticamente desde Google Calendar."

   Era el relleno que se guardaba cuando el evento no traía descripción,
   porque la validación de entonces no dejaba guardar el contenido vacío.
   Terminaba repetido en media pantalla del Feed sin decir nada.

   Ya no se escribe (ni acá ni en decidir.mjs: lo exige la prueba
   diferencial), y los posteos que lo tienen guardado no lo muestran.
================================================================ */
{
  const api = new Function(`
    ${grab("RELLENO_CALENDAR")}
    ${grab("contenidoVisible")}
    return { RELLENO_CALENDAR, contenidoVisible };
  `)();

  // Buscando el texto a secas da igual: ahora figura en la lista que lo
  // OCULTA. Lo que no tiene que existir es la llamada a t() que lo
  // escribía, que es la de los cuatro idiomas.
  eq("ya no se escribe el relleno al traer un evento",
     /t\("Creado autom\u00e1ticamente desde Google Calendar\./.test(src), false);
  eq("un evento sin descripción entra con el contenido vacío",
     /content: String\(ev\.description \|\| ""\)\.slice\(0, 5000\)/.test(src), true);

  eq("se oculta en español", api.contenidoVisible("Creado automáticamente desde Google Calendar."), "");
  eq("en inglés", api.contenidoVisible("Automatically created from Google Calendar."), "");
  eq("en portugués", api.contenidoVisible("Criado automaticamente a partir do Google Calendar."), "");
  eq("en hebreo", api.contenidoVisible(".נוצר אוטומטית מ-Google Calendar"), "");
  eq("y con espacios alrededor", api.contenidoVisible("\n  Creado automáticamente desde Google Calendar.  \n"), "");

  // Lo que importa: que no le coma el texto a nadie.
  const conMas = "Creado automáticamente desde Google Calendar. Además fuimos al puerto.";
  eq("NO le come el texto a quien escribió algo más", api.contenidoVisible(conMas), conMas);
  const antes = "Nos juntamos. Creado automáticamente desde Google Calendar.";
  eq("ni cuando la frase está al final de un texto propio", api.contenidoVisible(antes), antes);
  eq("un contenido normal pasa igual", api.contenidoVisible("Reunión con el equipo."), "Reunión con el equipo.");
  eq("uno vacío sigue vacío", api.contenidoVisible(""), "");
  eq("sin contenido no rompe", api.contenidoVisible(undefined), undefined);
  eq("ni con null", api.contenidoVisible(null), null);
  eq("están los cuatro idiomas", api.RELLENO_CALENDAR.length, 4);

  // La tarjeta no dibuja un bloque de contenido vacío.
  eq("la tarjeta no dibuja el párrafo si no hay nada que decir",
     /\$\{tr\.displayContent \? `<div class="post-content"[^>]*>/.test(src), true);
}

/* ---------- Lo largo va aparte (separarLargos) ----------
   Lo que dura más de tres semanas se dibuja una sola vez en una línea
   arriba del Mes/Agenda/Semana, no barra por barra en cada semana. */
{
  const api = new Function(`
    function isoDate(iso){ return new Date(iso + "T00:00:00Z"); }
    ${grab("LARGO_DIAS")}
    ${grab("esLargo")}
    ${grab("separarLargos")}
    return { esLargo, separarLargos };
  `)();
  const corto = { id:"c", startDate:"2026-10-05", endDate:"2026-10-07" };
  const largo = { id:"l", startDate:"2026-09-23", endDate:"2026-11-12" };
  const hito = { id:"l#m:1", hito:true, startDate:"2026-09-01", endDate:"2026-12-01" };
  eq("tres días no es largo", api.esLargo(corto), false);
  eq("siete semanas sí", api.esLargo(largo), true);
  eq("un hito nunca es largo, aunque dure meses", api.esLargo(hito), false);
  const byDate = { "2026-10-05":[largo, corto], "2026-10-06":[largo, corto, hito], "2026-10-07":[largo] };
  const r = api.separarLargos(byDate, "2026-10-01", "2026-10-31");
  eq("el largo sale de todos los días, y un día que queda vacío desaparece",
     Object.keys(r.byDate).map(d => r.byDate[d].map(p=>p.id)), [["c"],["c","l#m:1"]]);
  eq("y queda una sola vez en la lista de largos", r.largos.map(p=>p.id), ["l"]);
  eq("el largo que no toca el rango no se lista",
     api.separarLargos({ "2026-10-05":[largo] }, "2026-12-01", "2026-12-31").largos.length, 0);
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
