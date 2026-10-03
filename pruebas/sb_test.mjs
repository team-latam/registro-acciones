import fs from "node:fs";
import { hacerGrab } from "./grab.mjs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(process.env.INDEX || RAIZ + "index.html","utf8");
const grab = hacerGrab(src);
// Las consultas del banco contestan con un rodeo (como las de verdad):
// esperar un solo tick alcanzaba antes, ahora que la carga es async no.
const esperar = () => new Promise(r => setTimeout(r, 5));
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
// Una promesa rota que nadie atrapa es EL síntoma del cuelgue mudo: en el
// navegador no se ve nada, la lista no llega nunca y la pantalla se queda
// en "Cargando…". Acá se cuenta como falla en vez de matar el proceso, así
// la prueba alcanza a decir qué pasó en vez de dejar un volcado de pila.
process.on("unhandledRejection", e => {
  fail++; console.log(`✗ quedó una promesa rota sin atrapar: ${e && e.message}`);
});

/* ---------------------------------------------------------------
   Un Supabase de mentira: anota qué se le pidió y contesta lo que
   le digamos. No tiene NADA de Postgres adentro.
   --------------------------------------------------------------- */
function supabaseDeMentira(){
  // maxFilas: como Supabase de verdad (Settings → API → Max rows), nunca
  // devuelve más de 1.000 filas por pedido, se le pida lo que se le pida.
  const reg = { pedidos: [], canales: [], rpc: [], escrituras: [], maxFilas: 1000 };
  let filas = [];
  const clavesDe = { members:"email", former_members:"email", access_requests:"email",
                     user_prefs:"email", app_config:"key" };
  const claveDe = tabla => clavesDe[tabla] || "id";
  // Escribir también deja la fila guardada: releer lo escrito tiene que
  // encontrarlo, como en una base de verdad.
  const guardar = (tabla, f) => {
    const k = claveDe(tabla), i = filas.findIndex(x => x.__tabla === tabla && String(x[k]) === String(f[k]));
    if(i >= 0) filas[i] = { ...filas[i], ...f }; else filas.push({ ...f, __tabla: tabla });
  };
  const consulta = tabla => {
    const q = { tabla, filtros: [], orden: [], tope: null, rango: null, contar: false };
    const api = {
      select(cols, op){ q.cols = cols; q.contar = !!(op && op.count); return api; },
      eq(c, v){ q.filtros.push([c, v]); return api; },
      order(c, o){ q.orden.push([c, o || {}]); return api; },
      limit(n){ q.tope = n; return api; },
      range(desde, hasta){ q.rango = [desde, hasta]; return api; },
      maybeSingle(){ q.uno = true; return api.then(); },
      single(){ q.uno = true; return api.then(); },
      then(ok){
        reg.pedidos.push(q);
        let r = filas.filter(f => f.__tabla === tabla)
          .filter(f => q.filtros.every(([c, v]) => String(f[c]) === String(v)));
        if(q.orden.length) r = [...r].sort((a, b) => {
          for(const [c, o] of q.orden){
            // Comparación simple y no localeCompare: el primer localeCompare
            // de Node inicializa la intercalación (~10 ms) y desfasaba las
            // esperas cortas de estas pruebas.
            const x = String(a[c] ?? ""), y = String(b[c] ?? "");
            const d = x < y ? -1 : x > y ? 1 : 0;
            if(d) return (o.ascending === false ? -1 : 1) * d;
          }
          return 0;
        });
        const total = r.length;
        if(q.rango) r = r.slice(q.rango[0], q.rango[1] + 1);
        if(q.tope) r = r.slice(0, q.tope);
        r = r.slice(0, reg.maxFilas);
        const limpia = f => { const { __tabla, ...resto } = f; return resto; };
        r = r.map(limpia);
        const data = q.uno ? (r[0] || null) : r;
        const res = { data, error: reg.errorProximo || null, count: q.contar ? total : null };
        reg.errorProximo = null;
        return new Promise(r2 => setTimeout(()=> r2(ok ? ok(res) : res), 0));
      },
    };
    return api;
  };
  return {
    reg,
    ponerFilas(tabla, lista){ filas = filas.filter(f=>f.__tabla!==tabla)
      .concat(lista.map(f=>({ ...f, __tabla:tabla }))); },
    from(tabla){
      return {
        ...consulta(tabla),
        insert(f){ reg.escrituras.push(["insert", tabla, f]); guardar(tabla, f); return Promise.resolve({ error:null }); },
        update(f){ reg.escrituras.push(["update", tabla, f]);
          return { eq(c,v){ reg.escrituras[reg.escrituras.length-1].push([c,v]); guardar(tabla, { ...f, [c]: v }); return Promise.resolve({ error:null }); } }; },
        upsert(f, o){ reg.escrituras.push(["upsert", tabla, f, o]); guardar(tabla, f); return Promise.resolve({ error:null }); },
        delete(){ return { eq(c,v){ reg.escrituras.push(["delete", tabla, [c,v]]);
          filas = filas.filter(x => !(x.__tabla === tabla && String(x[c]) === String(v)));
          return Promise.resolve({ error:null }); } }; },
      };
    },
    rpc(nombre, args){ reg.rpc.push([nombre, args]); return Promise.resolve({ error:null }); },
    storage: { from(bucket){ return {
      createSignedUrls: async (rutas, seg)=>{ reg.firmadas = (reg.firmadas||[]).concat([[bucket, rutas, seg]]);
        // Una excepción, no un {error}: así se corta la red de verdad.
        if(reg.explotarFirma) throw new Error("se cortó la red firmando adjuntos");
        return { data: rutas.map(r=>({ path:r, signedUrl:`https://x.supabase.co/storage/v1/object/sign/${r}?token=t` })), error:null }; },
      upload: async (ruta, blob)=>{ reg.subidas = (reg.subidas||[]).concat([[bucket, ruta, blob.type]]); return { error:null }; },
    }; } },
    // El canal: guarda a quién avisarle cuando cambia su estado, para poder
    // simular que la conexión se corta y vuelve.
    channel(nombre){
      const c = { nombre, escuchas: [], estado: null };
      reg.canales.push(c);
      return { on(ev, cfg, fn){ c.escuchas.push({ cfg, fn }); return this; },
               subscribe(fn){ c.estado = fn || null; return c; } };
    },
    removeChannel(c){ reg.cortados = (reg.cortados||[]).concat([c && c.nombre]); },
  };
}

const ctx = { crypto: { getRandomValues: a => { a.forEach((_, i)=> a[i] = i * 7 % 256); return a; } } };
const crear = new Function("ctx", `
  const crypto = ctx.crypto;
  ${grab("tsToMillis")}
  ${grab("LIMITES_SUPABASE")}
  ${grab("crearSupabaseStore")}
  return crearSupabaseStore;
`)(ctx);

/* ---------------------------------------------------------------
   PARTE 1 — la traducción de nombres
   --------------------------------------------------------------- */
const sb = supabaseDeMentira();
const st = crear(sb);

await st.posts.create({ authorEmail:"juan@x.com", startDate:"2026-09-10", isProject:true,
                        calendarEventId:"abc", title:"T" });
const fila = sb.reg.escrituras[0][2];
eq("camelCase se vuelve snake_case al escribir",
   Object.keys(fila).filter(k=>k!=="id").sort(),
   ["author_email","calendar_event_id","is_project","start_date","title"]);
eq("y el id nuevo tiene 20 caracteres, como los de Firestore", fila.id.length, 20);

sb.reg.escrituras.length = 0;
await st.roster.setNickname("juan@x.com", "juancito");
eq("actualizar toca solo lo que se le pasó", sb.reg.escrituras[0][2], { nickname:"juancito" });

sb.ponerFilas("members", [{ email:"juan@x.com", photo_url:"http://foto", calendar_shared:true,
                            tour_seen_at:"2026-01-01", approved_at:"2025-01-01" }]);
const yo = await st.roster.get("juan@x.com");
eq("y al leer vuelve a camelCase", Object.keys(yo).sort(),
   ["approvedAt","calendarShared","email","photoURL","tourSeenAt"]);
eq("photoURL es la excepción: no sale de la regla mecánica", yo.photoURL, "http://foto");

sb.reg.escrituras.length = 0;
await st.roster.ensure("x@x.com", { photoURL:"http://f", nickname:"x" });
eq("y al escribir, photoURL vuelve a ser photo_url",
   Object.keys(sb.reg.escrituras[0][2]).sort(), ["approved_at","email","nickname","photo_url"]);

/* ---------------------------------------------------------------
   PARTE 2 — LO QUE MÁS CUESTA: la lista entera, a partir de cambios sueltos
   --------------------------------------------------------------- */
const sb2 = supabaseDeMentira();
const st2 = crear(sb2);
sb2.ponerFilas("posts", [
  { id:"p1", title:"Uno", author_email:"a@x.com" },
  { id:"p2", title:"Dos", author_email:"b@x.com" }]);

let entregas = [];
const cortar = st2.posts.subscribe(l => entregas.push(l));
eq("el canal se abre PRIMERO, en el mismo instante de suscribirse",
   [sb2.reg.canales.length, sb2.reg.pedidos.length], [1, 0]);

// El cambio que llega mientras todavía está cargando. Se dispara ACÁ, sin
// esperar nada: es justo el hueco que hay que cubrir.
const avisar = c => sb2.reg.canales[0].escuchas[0].fn(c);
avisar({ eventType:"INSERT", new:{ id:"p3", title:"Llegó durante la carga" } });
eq("un cambio que llega durante la carga no se entrega todavía", entregas.length, 0);

await esperar();
eq("recién después sale el pedido de la lista", sb2.reg.pedidos.length, 1);
eq("al terminar de cargar entrega la lista ENTERA, no el cambio suelto", entregas.length, 1);
eq("y ese cambio que había quedado esperando está adentro",
   entregas[0].map(p=>p.id).sort(), ["p1","p2","p3"]);
eq("traducida a camelCase", entregas[0].find(p=>p.id==="p1").authorEmail, "a@x.com");

/* ---------------------------------------------------------------
   Las horas: Postgres las devuelve con segundos, la app las quiere sin
   --------------------------------------------------------------- */
const sbH = supabaseDeMentira();
const stH = crear(sbH);
sbH.ponerFilas("posts", [
  { id:"h1", title:"Con hora", start_time:"15:00:00", end_time:"16:30:00" },
  { id:"h2", title:"Todo el día", start_time:null, end_time:null }]);
let conHora = null;
stH.posts.subscribe(l => { conHora = l; });
await esperar();
const h1 = conHora.find(p=>p.id==="h1");
eq("15:00:00 llega como 15:00, que es lo que la app entiende", h1.startTime, "15:00");
eq("y la de fin también", h1.endTime, "16:30");
eq("un evento de todo el día sigue sin hora, no queda en blanco raro",
   [conHora.find(p=>p.id==="h2").startTime, conHora.find(p=>p.id==="h2").endTime], [null, null]);
eq("y el resto del posteo no se toca", h1.title, "Con hora");

entregas = [];
avisar({ eventType:"UPDATE", new:{ id:"p1", title:"Uno editado" } });
eq("un cambio posterior vuelve a entregar la lista entera", entregas.length, 1);
eq("con el posteo ya editado adentro",
   entregas[0].find(p=>p.id==="p1").title, "Uno editado");
eq("y sin duplicarlo", entregas[0].filter(p=>p.id==="p1").length, 1);

entregas = [];
avisar({ eventType:"DELETE", old:{ id:"p2" } });
eq("un borrado lo saca de la lista", entregas[0].map(p=>p.id).sort(), ["p1","p3"]);

entregas = [];
cortar();
avisar({ eventType:"INSERT", new:{ id:"p9", title:"Después de cortar" } });
eq("después de cortar no entrega nada más", entregas.length, 0);
eq("y cierra el canal", sb2.reg.cortados.length, 1);

/* ---------------------------------------------------------------
   PARTE 2b — escribir algo tiene que VERSE, sin esperar al aviso
   Con Firestore el SDK mostraba el cambio al instante. Acá, si se
   depende solo del aviso en vivo, escribir se siente como que no pasó
   nada — y si el aviso no está habilitado, directamente no pasa.
   --------------------------------------------------------------- */
const sbW = supabaseDeMentira();
const stW = crear(sbW);
sbW.ponerFilas("posts", [{ id:"p1", title:"El que ya estaba" }]);
let listas = [];
const cortarW = stW.posts.subscribe(l => listas.push(l));
await esperar();
eq("arranca con lo que hay", listas.length, 1);

listas = [];
sbW.reg.pedidos.length = 0;
const idNuevo = await stW.posts.create({ title:"El nuevo" });
await esperar();
eq("después de escribir, la lista se actualiza sola", listas.length >= 1, true);
eq("y trae lo recién escrito, sin depender del aviso en vivo",
   listas[listas.length-1].map(p=>p.title).sort(), ["El nuevo","El que ya estaba"]);
// Antes se volvía a pedir la tabla ENTERA después de cada escritura.
eq("releyendo SOLO esa fila, no la tabla entera",
   sbW.reg.pedidos.map(q => [q.filtros, !!q.uno]), [[[["id", idNuevo]], true]]);

listas = [];
await stW.posts.update("p1", { title:"Editado" });
eq("editar también se ve", listas[listas.length-1].find(p=>p.id==="p1").title, "Editado");

listas = [];
await stW.posts.remove("p1");
eq("y borrar, también", listas[listas.length-1].map(p=>p.id), [idNuevo]);
eq("al releer no quedan restos de lo que ya no está",
   listas[listas.length-1].length, 1);

listas = [];
sbW.reg.pedidos.length = 0;
await stW.posts.setLike(idNuevo, "juan@x.com", true);
eq("un me gusta también vuelve a mirar", listas.length >= 1, true);
eq("pero solo ese posteo: antes un me gusta bajaba todos", sbW.reg.pedidos.length, 1);

// Y cuando se corta, deja de escuchar: si no, cada escritura seguiría
// recargando listas que ya no mira nadie.
cortarW();
listas = [];
await stW.posts.create({ title:"Otro" });
eq("después de cortar, escribir ya no refresca esa lista", listas.length, 0);

// Cada tabla refresca la SUYA, no todas.
const sbT = supabaseDeMentira();
const stT = crear(sbT);
let vecesPosts = 0, vecesReps = 0;
stT.posts.subscribe(()=> vecesPosts++);
stT.replies.subscribeAll(()=> vecesReps++);
await esperar();
const p0 = vecesPosts, r0 = vecesReps;
await stT.replies.create("p1", { content:"hola" });
await esperar();
eq("escribir un comentario refresca los comentarios", vecesReps > r0, true);
eq("y NO vuelve a pedir los posteos al pedo", vecesPosts, p0);

/* ---------------------------------------------------------------
   PARTE 2c — los adjuntos: en el bucket, no adentro de la fila
   --------------------------------------------------------------- */
const sbA = supabaseDeMentira();
const stA = crear(sbA);
sbA.ponerFilas("posts", [
  { id:"a1", title:"Con foto", images:["posts/a1/img0.png"],
    files:[{ name:"informe.pdf", path:"posts/a1/arch0.pdf" }] },
  { id:"a2", title:"Sin nada", images:[], files:[] }]);
let conFotos = null;
stA.posts.subscribe(l => { conFotos = l; });
await esperar();

const a1 = conFotos.find(p=>p.id==="a1");
eq("una ruta del bucket llega como dirección que se puede mostrar",
   a1.images[0].startsWith("https://x.supabase.co/storage/v1/object/sign/"), true);
eq("y el adjunto llega con la forma que la app ya entiende (name + dataUrl)",
   Object.keys(a1.files[0]).sort(), ["dataUrl","name","path"]);
eq("conservando su nombre", a1.files[0].name, "informe.pdf");
eq("se firman TODAS de una sola vez, no de a una",
   sbA.reg.firmadas.length, 1);
eq("y las dos rutas van en el mismo pedido",
   sbA.reg.firmadas[0][1].sort(), ["posts/a1/arch0.pdf","posts/a1/img0.png"]);
eq("las firmas duran horas, no minutos: una imagen que se rompe sola es peor",
   sbA.reg.firmadas[0][2] >= 3600, true);
eq("un posteo sin adjuntos no pide firmar nada de más",
   conFotos.find(p=>p.id==="a2").images, []);

// Y al escribir, al revés.
sbA.reg.subidas = [];
await stA.posts.create({ title:"Nueva foto",
  images:["data:image/png;base64,iVBORw0KGgo="],
  files:[{ name:"a.pdf", dataUrl:"data:application/pdf;base64,JVBERi0=" }] });
eq("subir una foto nueva la manda al bucket", sbA.reg.subidas.length, 2);
eq("al bucket de adjuntos", sbA.reg.subidas[0][0], "adjuntos");
eq("con la extensión que corresponde", sbA.reg.subidas[0][1].endsWith(".png"), true);
eq("y el adjunto, con la suya", sbA.reg.subidas[1][1].endsWith(".pdf"), true);

const escrito = sbA.reg.escrituras[sbA.reg.escrituras.length-1][2];
eq("lo que se guarda en la fila es la RUTA, no el archivo",
   escrito.images[0].startsWith("data:"), false);
eq("y para el adjunto, lo mismo", escrito.files[0].path.startsWith("data:"), false);
eq("sin perder el nombre del archivo", escrito.files[0].name, "a.pdf");
eq("el archivo embebido NO queda en la fila",
   JSON.stringify(escrito).includes("base64"), false);

// Una imagen que ya era una ruta (una edición que no cambió la foto) no se
// vuelve a subir.
sbA.reg.subidas = [];
await stA.posts.update("a1", { images:["posts/a1/img0.png"], title:"Editado" });
eq("editar sin cambiar la foto no la sube de nuevo", sbA.reg.subidas.length, 0);

/* ---------------------------------------------------------------
   PARTE 2d — aprobar a alguien que YA tiene ficha
   Pasa seguido: se le revocó el acceso y vuelve, o su solicitud quedó
   dando vueltas. En Firestore el alta crea O REEMPLAZA sin quejarse.
   --------------------------------------------------------------- */
const sbR = supabaseDeMentira();
const stR = crear(sbR);
await stR.roster.add("vuelve@x.com", { name:"Vuelve", nickname:"vuelve", role:"member" });
const alta = sbR.reg.escrituras[sbR.reg.escrituras.length-1];
eq("el alta crea O REEMPLAZA, no se cae si esa persona ya estaba",
   [alta[0], alta[3].onConflict], ["upsert", "email"]);
eq("con el correo como clave", alta[2].email, "vuelve@x.com");
eq("y la fecha de alta la pone la base", alta[2].approved_at, "1970-01-01T00:00:00.000Z");

// Ninguna otra escritura puede tener el mismo problema: las que van por
// una clave que ya puede existir tienen que crear-o-reemplazar.
const fuente = fs.readFileSync(process.env.INDEX || RAIZ + "index.html","utf8");
const capa = fuente.slice(fuente.indexOf("function crearSupabaseStore"),
                          fuente.indexOf("// Qué implementación está en uso."));
const inserts = (capa.match(/\.from\("(\w+)"\)\.insert\(/g) || [])
  .map(m => m.match(/"(\w+)"/)[1]);
eq("solo se usa insert donde el id se inventa en el momento",
   [...new Set(inserts)].sort(), ["audit_log","posts","replies"]);

/* ---------------------------------------------------------------
   PARTE 3 — comentarios: agrupados y en orden
   --------------------------------------------------------------- */
const sb3 = supabaseDeMentira();
const st3 = crear(sb3);
sb3.ponerFilas("replies", [
  { id:"r2", post_id:"p1", content:"segunda", created_at:"2026-01-02" },
  { id:"r1", post_id:"p1", content:"primera", created_at:"2026-01-01" },
  { id:"r3", post_id:"p2", content:"de otro", created_at:"2026-01-03" }]);
let reps = null;
st3.replies.subscribeAll(x => { reps = x; });
await esperar();
eq("llegan agrupados por posteo", Object.keys(reps).sort(), ["p1","p2"]);
eq("y del más viejo al más nuevo, aunque la base los mande al revés",
   reps.p1.map(r=>r.id), ["r1","r2"]);
eq("cada uno sabe de qué posteo es", reps.p1[0].postId, "p1");

/* ---------------------------------------------------------------
   PARTE 4 — lo que NO viaja desde el navegador
   --------------------------------------------------------------- */
const sb4 = supabaseDeMentira();
const st4 = crear(sb4);
await st4.posts.setLike("p1", "juan@x.com", true);
eq("el me gusta lo hace la base, no el navegador", sb4.reg.rpc[0][0], "me_gusta_posteo");
eq("y el correo NO viaja: la base lo saca de la credencial",
   JSON.stringify(sb4.reg.rpc[0][1]).includes("juan@x.com"), false);
await st4.replies.setLike("p1", "r1", "juan@x.com", false);
eq("el de un comentario, igual", sb4.reg.rpc[1], ["me_gusta_comentario", { p_id:"r1", p_puesto:false }]);

await st4.userPrefs.merge("juan@x.com", { dimPast:true });
eq("guardar una preferencia también lo hace la base (dos controles rápidos se pisarían)",
   sb4.reg.rpc[2][0], "guardar_preferencias");
eq("y de quién son tampoco viaja",
   JSON.stringify(sb4.reg.rpc[2][1]), JSON.stringify({ p_parche:{ dimPast:true } }));
await st4.config.merge("preferences", { calendarId:"x" });
eq("y una sección de la configuración, igual",
   sb4.reg.rpc[3], ["guardar_config", { p_clave:"preferences", p_parche:{ calendarId:"x" } }]);

/* ---------------------------------------------------------------
   PARTE 5 — las dos formas de guardar la configuración
   --------------------------------------------------------------- */
const sb5 = supabaseDeMentira();
const st5 = crear(sb5);
await st5.config.replace("territoryConfig", { zones:{} });
eq("las zonas se REEMPLAZAN enteras (un país sacado tiene que desaparecer)",
   sb5.reg.escrituras[0].slice(0,3), ["upsert","app_config",{ key:"territoryConfig", value:{ zones:{} } }]);
eq("pero las preferencias van por partes", sb5.reg.rpc.length, 0);

sb5.ponerFilas("app_config", [{ key:"preferences", value:{ calendarId:"viejo", maxImages:3 } }]);
eq("leer una configuración devuelve su contenido pelado",
   await st5.config.get("preferences"), { calendarId:"viejo", maxImages:3 });

/* ---------------------------------------------------------------
   PARTE 6 — importar de Calendar sin duplicar, y la hora del servidor
   --------------------------------------------------------------- */
const sb6 = supabaseDeMentira();
const st6 = crear(sb6);
await st6.posts.createOnce("cal_evento1", { title:"Del Calendar" });
const [op, tabla, datos, opciones] = sb6.reg.escrituras[0];
eq("importar usa un insert que ignora el choque de id", [op, opciones.ignoreDuplicates], ["upsert", true]);
eq("con el id elegido, no uno nuevo", datos.id, "cal_evento1");

eq("la hora del servidor es una marca, no una fecha de verdad",
   st6.horaDelServidor(), "1970-01-01T00:00:00.000Z");
sb6.reg.escrituras.length = 0;
await st6.roster.markTourSeen("juan@x.com");
eq("y se manda tal cual: la base la reemplaza por su reloj",
   sb6.reg.escrituras[0][2], { tour_seen_at:"1970-01-01T00:00:00.000Z" });

eq("un error de permisos de Postgres se reconoce", st6.esErrorDePermiso({ code:"42501" }), true);
eq("uno cualquiera no", st6.esErrorDePermiso({ code:"23505" }), false);

/* ---------------------------------------------------------------
   PARTE 7 — las dos capas ofrecen EXACTAMENTE lo mismo
   Es lo que hace que cambiar de base sea una línea.
   --------------------------------------------------------------- */
const fbStore = new Function("ctx", `const fb = ctx.fb; const db = {};
  ${grab("tsToMillis")}
  ${grab("LIMITES_FIREBASE")}
  ${grab("firebaseStore")}
  return firebaseStore;`)({ fb:new Proxy({}, { get: ()=> ()=>({}) }) });

const firma = obj => Object.keys(obj).sort().map(k =>
  typeof obj[k] === "function" ? `${k}(${obj[k].length})`
  : `${k}{${Object.keys(obj[k]).sort().map(m=>`${m}(${obj[k][m].length})`).join(",")}}`).join(" | ");
eq("los dos ofrecen los mismos métodos, con la misma cantidad de argumentos",
   firma(crear(supabaseDeMentira())), firma(fbStore));

// `limites` es parte del contrato igual que los métodos: la app no sabe
// cuánto entra en un posteo, se lo pregunta a la base. Las mismas claves
// de los dos lados (si no, la app leería undefined y no lo notaría), y
// valores distintos: si fueran iguales, uno de los dos estaría mintiendo.
const limFb = fbStore.limites, limSb = crear(supabaseDeMentira()).limites;
eq("las dos bases declaran los mismos topes", Object.keys(limFb).sort(), Object.keys(limSb).sort());
eq("todos números de verdad", Object.values(limFb).concat(Object.values(limSb))
   .every(v => typeof v === "number" && v > 0), true);
eq("y Supabase aguanta más en todo, porque el archivo no va adentro del posteo",
   ["imagenes","archivos","bytesPorArchivo","bytesSugeridos","ladoMaximo","bytesPorPosteo"].filter(k => limSb[k] <= limFb[k]), []);
eq("el techo del posteo entero en Firebase es el de Firestore: 1 MiB, ni un byte más",
   limFb.bytesPorPosteo, 1024 * 1024);
eq("y en Supabase no hay (en el posteo quedan solo las rutas)", limSb.bytesPorPosteo, Infinity);
eq("un archivo al tope entra solo en un posteo de Firebase, aunque sea en base64",
   4 * Math.ceil(limFb.bytesPorArchivo / 3) < limFb.bytesPorPosteo, true);
eq("la calidad de compresión también sube (achicar fuerte era para que entrara)",
   limSb.calidadImagen > limFb.calidadImagen, true);
eq("el sugerido nunca puede pasar el techo", 
   [limFb.bytesSugeridos <= limFb.bytesPorArchivo, limSb.bytesSugeridos <= limSb.bytesPorArchivo], [true, true]);

/* ---------------------------------------------------------------
   PARTE 8 — lo que se deja entrar a un src=""
   Se amplió para aceptar las URL firmadas del bucket. Esa función decide
   qué termina adentro de un src="" de la página, así que se prueba
   sobre todo lo que tiene que RECHAZAR.
   --------------------------------------------------------------- */
const guardias = new Function("ctx", `
  const SUPABASE_URL = "https://benonmzlgdjkhzauamrz.supabase.co";
  ${grab("IMAGE_DATA_URL_RE")}
  ${grab("TIPOS_DE_ARCHIVO")}
  ${grab("FILE_DATA_URL_RE")}
  ${grab("esUrlDelBucket")}
  ${grab("safeImageSrc")}
  ${grab("safeFileDataUrl")}
  return { safeImageSrc, safeFileDataUrl };
`)({});
const img = guardias.safeImageSrc, arch = guardias.safeFileDataUrl;
const FIRMADA = "https://benonmzlgdjkhzauamrz.supabase.co/storage/v1/object/sign/adjuntos/posts/p1/img0.png?token=abc";

eq("una imagen embebida sigue entrando (lo de Firebase no se rompió)",
   img("data:image/png;base64,iVBORw0KGgo="), "data:image/png;base64,iVBORw0KGgo=");
eq("y una URL firmada del bucket propio, también", img(FIRMADA), FIRMADA);
eq("un adjunto firmado del bucket propio, igual", arch(FIRMADA), FIRMADA);

eq("pero una dirección de OTRO proyecto de Supabase, NO",
   img("https://otroproyecto.supabase.co/storage/v1/object/sign/x.png"), "");
eq("ni una que empiece parecido pero sea otro dominio",
   img("https://benonmzlgdjkhzauamrz.supabase.co.malo.com/storage/v1/object/sign/x.png"), "");
eq("ni una del proyecto propio por otro camino que no sea el bucket",
   img("https://benonmzlgdjkhzauamrz.supabase.co/rest/v1/posts"), "");
eq("ni una dirección cualquiera", img("https://cualquiera.com/foto.png"), "");
eq("ni javascript:", img("javascript:alert(1)"), "");
eq("ni un data: que no sea una imagen",
   img("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="), "");
eq("ni un SVG embebido, que puede traer código adentro",
   img("data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4="), "");
eq("ni la ruta pelada del bucket, sin firmar", img("posts/p1/img0.png"), "");
eq("ni nada que no sea texto", img({ toString: ()=> FIRMADA }), "");
eq("ni vacío", img(""), "");

/* ================================================================
   Una carga que falla no puede quedarse callada

   enVivo() entrega la lista recién cuando la carga termina. Si algo tira
   una excepción en el medio —firmar los adjuntos, la red que se corta—,
   `cargado` quedaba en false PARA SIEMPRE: la lista no se entregaba
   nunca, alFallar no se llamaba, y la pantalla se quedaba en "Cargando
   registro compartido…" hasta recargar a mano. Un error invisible es
   peor que uno visible.
================================================================ */
{
  const sbE = supabaseDeMentira();
  sbE.ponerFilas("posts", [{ id:"p1", title:"con adjunto", files:[{ path:"posts/p1/a.pdf" }] }]);
  const stE = crear(sbE);
  sbE.reg.explotarFirma = true;

  const entregadas = [], fallas = [];
  stE.posts.subscribe(l => entregadas.push(l), e => fallas.push(String(e && e.message)));
  await new Promise(r => setTimeout(r, 30));

  eq("si la carga explota, no se entrega una lista a medias", entregadas.length, 0);
  eq("pero SÍ se avisa del error", fallas.length, 1);
  eq("y el error dice qué pasó", fallas[0], "se cortó la red firmando adjuntos");
}
{
  // Y lo de siempre tiene que seguir andando igual.
  const sbOk = supabaseDeMentira();
  sbOk.ponerFilas("posts", [{ id:"p1", title:"sin problemas" }]);
  const stOk = crear(sbOk);
  const entregadas = [], fallas = [];
  stOk.posts.subscribe(l => entregadas.push(l), e => fallas.push(e));
  await new Promise(r => setTimeout(r, 30));
  eq("sin error, la lista llega", entregadas.length, 1);
  eq("con lo que había", entregadas[0].map(p=>p.title), ["sin problemas"]);
  eq("y nadie avisa de ninguna falla", fallas, []);
}
{
  // Un error de la consulta ya se avisaba; que siga siendo así.
  const sbQ = supabaseDeMentira();
  sbQ.ponerFilas("posts", [{ id:"p1", title:"x" }]);
  const stQ = crear(sbQ);
  sbQ.reg.errorProximo = { message:"permission denied for table posts" };
  const entregadas = [], fallas = [];
  stQ.posts.subscribe(l => entregadas.push(l), e => fallas.push(e && e.message));
  await new Promise(r => setTimeout(r, 30));
  eq("un error de la consulta también se avisa", fallas, ["permission denied for table posts"]);
  eq("y tampoco entrega nada", entregadas.length, 0);
}

/* ================================================================
   Subir a Supabase no puede perder la mitad del archivo

   Él subió un reporte desde su ranura y volvió como adjunto suelto, con
   la cuenta de la tarjeta en 0/2. La causa: al subir al bucket se armaba
   un objeto NUEVO con name y path nada más. Se perdían mime, kind, doc y
   subidoEl — y perder `doc` es perder la ranura que ocupa.

   Y al lado, una peor con las imágenes: en memoria una imagen ya subida
   es su URL FIRMADA, no su ruta. Al re-guardar se escribía la firma en la
   fila, pisando la ruta. Cuando la firma vencía —a las cuatro horas— la
   imagen quedaba rota y sin forma de recuperarla.
================================================================ */
{
  const sbF = supabaseDeMentira();
  sbF.ponerFilas("posts", []);
  const stF = crear(sbF);
  await stF.posts.create({
    files: [{ name:"Reporte de visita.docx", mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              kind:"doc", doc:"reporte", subidoEl:"2026-10-02T15:30:00.000Z",
              dataUrl:"data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,QQ==" }],
  });
  const guardado = sbF.reg.escrituras.find(e=>e[0]==="insert")[2].files[0];
  eq("el contenido se reemplaza por la ruta del bucket", typeof guardado.path === "string" && guardado.path.includes("arch0"), true);
  eq("y el dataUrl no se guarda", guardado.dataUrl, undefined);
  eq("el nombre se conserva", guardado.name, "Reporte de visita.docx");
  eq("LA RANURA se conserva: era lo que se perdía", guardado.doc, "reporte");
  eq("el tipo también, que es lo que da el ícono y el visor", guardado.kind, "doc");
  eq("y el mime", String(guardado.mime||"").endsWith("wordprocessingml.document"), true);
  eq("y cuándo se subió", guardado.subidoEl, "2026-10-02T15:30:00.000Z");
}
{
  // Re-guardar un posteo cuyos adjuntos YA están en el bucket.
  const sbR = supabaseDeMentira();
  sbR.ponerFilas("posts", [{ id:"p1", files:[{ name:"a.pdf", path:"posts/p1/arch0_1.pdf", kind:"pdf", doc:"plan" }] }]);
  const stR = crear(sbR);
  const vistos = [];
  stR.posts.subscribe(l => vistos.push(l));
  await new Promise(r => setTimeout(r, 30));
  const enMemoria = vistos[vistos.length-1][0];
  eq("al leer, el archivo trae su URL firmada", String(enMemoria.files[0].dataUrl||"").startsWith("https://"), true);
  eq("y sigue trayendo su ruta", enMemoria.files[0].path, "posts/p1/arch0_1.pdf");

  await stR.posts.update("p1", { files: enMemoria.files });
  const reguardado = sbR.reg.escrituras.find(e=>e[0]==="update")[2].files[0];
  eq("al re-guardar NO se escribe la firma en la fila", reguardado.dataUrl, undefined);
  eq("la ruta queda intacta", reguardado.path, "posts/p1/arch0_1.pdf");
  eq("y lo demás también", [reguardado.name, reguardado.kind, reguardado.doc], ["a.pdf","pdf","plan"]);
  eq("no se vuelve a subir nada", (sbR.reg.subidas||[]).length, 0);
}
{
  // Las imágenes: el caso destructivo.
  const sbI = supabaseDeMentira();
  sbI.ponerFilas("posts", [{ id:"p1", images:["posts/p1/img0_1.png"] }]);
  const stI = crear(sbI);
  const vistos = [];
  stI.posts.subscribe(l => vistos.push(l));
  await new Promise(r => setTimeout(r, 30));
  const enMemoria = vistos[vistos.length-1][0];
  eq("al leer, la imagen es su URL firmada", String(enMemoria.images[0]||"").startsWith("https://"), true);

  await stI.posts.update("p1", { images: enMemoria.images });
  const reguardado = sbI.reg.escrituras.find(e=>e[0]==="update")[2];
  eq("al re-guardar vuelve a ser la RUTA, no la firma", reguardado.images[0], "posts/p1/img0_1.png");
  eq("no se sube nada de nuevo", (sbI.reg.subidas||[]).length, 0);
}
{
  // Una imagen nueva sí se sube; una mezcla de nueva y vieja, cada una por su lado.
  const sbM = supabaseDeMentira();
  sbM.ponerFilas("posts", [{ id:"p1", images:["posts/p1/img0_1.png"] }]);
  const stM = crear(sbM);
  const vistos = [];
  stM.posts.subscribe(l => vistos.push(l));
  await new Promise(r => setTimeout(r, 30));
  const vieja = vistos[vistos.length-1][0].images[0];
  await stM.posts.update("p1", { images: [vieja, "data:image/png;base64,QQ=="] });
  const imgs = sbM.reg.escrituras.find(e=>e[0]==="update")[2].images;
  eq("la que ya estaba queda como ruta", imgs[0], "posts/p1/img0_1.png");
  eq("y la nueva se sube", typeof imgs[1] === "string" && imgs[1].includes("img1"), true);
  eq("se subió una sola", (sbM.reg.subidas||[]).length, 1);
}

/* ================================================================
   Más de mil filas

   La API de Supabase devuelve como máximo 1.000 filas por pedido. Sin
   paginar, pasado ese número el resto no llegaba y nadie se enteraba: ni
   error ni aviso. Los posteos se pedían sin orden, así que lo que faltaba
   no eran «los más viejos»: era cualquiera.
================================================================ */
{
  const sbP = supabaseDeMentira();
  sbP.ponerFilas("posts", Array.from({ length: 2500 }, (_, i) => ({ id: "p" + String(i).padStart(4, "0"), title: "Evento " + i })));
  const stP = crear(sbP);
  let lista = null;
  stP.posts.subscribe(l => { lista = l; });
  await new Promise(r => setTimeout(r, 40));
  eq("con 2.500 posteos llegan los 2.500", lista && lista.length, 2500);
  eq("sin repetir ninguno", lista && new Set(lista.map(p => p.id)).size, 2500);
  eq("de a páginas: tres pedidos", sbP.reg.pedidos.length, 3);
  eq("ordenadas por la clave, para no saltear ni repetir entre páginas",
     sbP.reg.pedidos[0].orden.map(o => o[0]), ["id"]);
}
{
  // Aunque alguien baje el tope en el panel, se siguen trayendo todas.
  const sbP = supabaseDeMentira();
  sbP.reg.maxFilas = 300;
  sbP.ponerFilas("replies", Array.from({ length: 700 }, (_, i) => ({ id: "r" + String(i).padStart(4, "0"), post_id: "p1", content: "c", created_at: "2026-01-01" })));
  const stP = crear(sbP);
  let porPosteo = null;
  stP.replies.subscribeAll(x => { porPosteo = x; });
  await new Promise(r => setTimeout(r, 40));
  eq("con el tope del panel en 300, llegan los 700 comentarios", porPosteo && porPosteo.p1.length, 700);
}
{
  const sbP = supabaseDeMentira();
  sbP.ponerFilas("posts", [{ id:"p1", title:"Uno" }]);
  const stP = crear(sbP);
  stP.posts.subscribe(()=>{});
  await new Promise(r => setTimeout(r, 20));
  eq("una tabla chica sigue siendo un solo pedido (la cuenta viene en el primero)", sbP.reg.pedidos.length, 1);
}

/* ================================================================
   Un aviso en vivo con una foto nueva

   Antes, un posteo nuevo con una foto sin firmar hacía recargar la tabla
   ENTERA, en cada navegador conectado. Ahora se firma esa foto y se
   aplica el cambio.
================================================================ */
{
  const sbV = supabaseDeMentira();
  sbV.ponerFilas("posts", [{ id:"p1", title:"Uno" }]);
  const stV = crear(sbV);
  let lista = null;
  stV.posts.subscribe(l => { lista = l; });
  await new Promise(r => setTimeout(r, 20));
  const pedidosAntes = sbV.reg.pedidos.length;
  sbV.reg.firmadas = [];
  sbV.reg.canales[0].escuchas[0].fn({ eventType:"INSERT", new:{ id:"p2", title:"Con foto", images:["posts/p2/img0_1.jpg"] } });
  await new Promise(r => setTimeout(r, 20));
  eq("un posteo nuevo con foto NO recarga la tabla", sbV.reg.pedidos.length, pedidosAntes);
  eq("se firma solo su foto", sbV.reg.firmadas.map(f => f[1]), [["posts/p2/img0_1.jpg"]]);
  eq("y aparece, con la foto lista para mostrar",
     String((lista.find(p => p.id === "p2") || { images:[""] }).images[0]).startsWith("https://"), true);
}

/* ================================================================
   La conexión que se corta y vuelve

   Los avisos en vivo no se repiten: lo que cambió mientras la notebook
   dormía se perdía, y la pantalla quedaba vieja hasta recargar. Ahora,
   cuando el canal vuelve a quedar suscripto, se vuelve a cargar.
================================================================ */
{
  const sbC = supabaseDeMentira();
  sbC.ponerFilas("posts", [{ id:"p1", title:"Uno" }]);
  const stC = crear(sbC);
  let lista = null; const fallas = [];
  stC.posts.subscribe(l => { lista = l; }, e => fallas.push(e));
  await new Promise(r => setTimeout(r, 20));
  const canal = sbC.reg.canales[0];
  // Si el código no escucha el estado del canal, no hay a quién avisarle:
  // las pruebas de abajo lo dicen fallando, en vez de reventar acá.
  const avisarEstado = e => { if(canal.estado) canal.estado(e); };
  eq("escucha el estado de la conexión", typeof canal.estado, "function");
  avisarEstado("SUBSCRIBED");
  await new Promise(r => setTimeout(r, 20));
  eq("la primera suscripción no carga dos veces", sbC.reg.pedidos.length, 1);

  // Se corta; mientras, alguien publica (y ese aviso no llega nunca).
  avisarEstado("CHANNEL_ERROR");
  sbC.ponerFilas("posts", [{ id:"p1", title:"Uno" }, { id:"p2", title:"Mientras estaba cortado" }]);
  avisarEstado("SUBSCRIBED");
  await new Promise(r => setTimeout(r, 20));
  eq("al volver, se vuelve a cargar", sbC.reg.pedidos.length, 2);
  eq("y aparece lo que pasó mientras estaba cortado", lista.map(p => p.id).sort(), ["p1", "p2"]);

  // Y si esa recarga falla (la red todavía inestable), NO es un error de
  // pantalla completa: ya hay una lista mostrándose.
  sbC.reg.errorProximo = { message: "network error" };
  avisarEstado("SUBSCRIBED");
  await new Promise(r => setTimeout(r, 20));
  eq("una recarga que falla no tira la pantalla de error", fallas, []);
  eq("y la lista que había se sigue viendo", lista.map(p => p.id).sort(), ["p1", "p2"]);
}

/* ================================================================
   Un Word que el navegador no reconoce

   Algunos navegadores leen un .docx como "application/octet-stream", y
   el bucket no acepta ese tipo: el archivo rebotaba. El nombre dice qué es.
================================================================ */
{
  const sbD = supabaseDeMentira();
  const stD = crear(sbD);
  await stD.posts.create({ title:"Reporte", files:[{ name:"Reporte de viaje.docx", mime:"", kind:"doc",
    dataUrl:"data:application/octet-stream;base64,UEsDBA==" }] });
  const subida = (sbD.reg.subidas || [])[0] || [];
  eq("se sube con el tipo que dice su extensión",
     subida[2], "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  eq("y con su extensión en el bucket", String(subida[1] || "").endsWith(".docx"), true);
}

eq("un token vencido (PGRST301) NO es falta de permiso", crear(supabaseDeMentira()).esErrorDePermiso({ code:"PGRST301" }), false);

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
