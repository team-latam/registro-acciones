import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
// IMPORTAR, como INDEX: para comprobar que una prueba nueva falla contra
// una copia rota (ver LEEME.md).
const src = fs.readFileSync(process.env.IMPORTAR || RAIZ + "supabase/importar.html","utf8");
const modulo = /<script type="module">([\s\S]*?)<\/script>/.exec(src)[1];
// Se traen las piezas de transformación tal cual están en la página: si
// mañana cambian ahí, esta prueba mira las nuevas.
function trozo(desde, hasta){
  const i = modulo.indexOf(desde), j = modulo.indexOf(hasta, i);
  if(i < 0 || j < 0) throw new Error("no encontré " + desde);
  return modulo.slice(i, j);
}
const piezas = trozo("const A_SNAKE", "/* ---------- Adjuntos");

let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

const { filasDe, camposDeMas, PLAN, valor } =
  new Function(`${piezas}\nreturn { filasDe, camposDeMas, PLAN, valor, COLUMNAS };`)();

/* Un respaldo con la forma EXACTA que baja la app, incluidas las rarezas
   que tienen los datos viejos de verdad. */
const fecha = ms => ({ __tipo:"fecha", ms });
const respaldo = {
  formato:1, origen:"firestore", conAdjuntos:true, generado:"2026-09-17T00:00:00.000Z",
  posts: [
    { id:"p1", title:"Evento", content:"C", date:"2026-09-10", startDate:"2026-09-10",
      endDate:"2026-09-10", activityType:"evento", authorName:"Ana", authorEmail:"ana@x.com",
      createdAt: fecha(Date.UTC(2019,2,5,10)), lastEditedAt: fecha(Date.UTC(2019,3,1,10)),
      isProject:true, calendarEventId:"cal1",
      milestones:[{ text:"Hito", dueDate:"2026-09-20", done:false }],
      scopes:[{ pais:"AR" }], likedBy:["juan@x.com"],
      images:["data:image/png;base64,iVBORw0KGgo="] },
    // Uno viejo, sin la mitad de los campos: es lo normal en Firestore.
    { id:"p2", title:"Rutina vieja", content:"C", date:"2018-01-01", startDate:"2018-01-01",
      endDate:"2018-01-01", activityType:"rutina", authorName:"Alguien",
      createdAt: fecha(Date.UTC(2018,0,1)) },
  ],
  replies: [
    { id:"r1", postId:"p1", content:"hola", authorName:"Juan", authorEmail:"juan@x.com",
      createdAt: fecha(Date.UTC(2026,8,11)), occ:"2026-09-10", replyToId:null },
  ],
  allowlist: [
    { id:"benny@team-latam.com", email:"benny@team-latam.com", name:"Benny", nickname:"benny",
      photoURL:"http://foto", role:"admin", approvedAt: fecha(Date.UTC(2024,0,1)),
      approvedBy:"benny@team-latam.com", calendarShared:true,
      calendarInviteSentAt: fecha(Date.UTC(2025,5,1)), tourSeenAt: fecha(Date.UTC(2025,5,2)) },
    // Sin `email` adentro: el id ES el correo. Pasa en los accesos viejos.
    { id:"ana@x.com", name:"Ana", nickname:"ana" },
  ],
  formerMembers: [{ id:"vieja@x.com", email:"vieja@x.com", name:"Vieja", nickname:"vieja",
    approvedAt: fecha(Date.UTC(2020,0,1)), revokedAt: fecha(Date.UTC(2023,0,1)) }],
  accessRequests: [{ id:"nuevo@x.com", email:"nuevo@x.com", name:"Nuevo", status:"pending",
    photoURL:null, requestedAt: fecha(Date.UTC(2026,8,1)) }],
  auditLog: [{ id:"a1", type:"login", actorEmail:"ana@x.com", actorName:"Ana",
    createdAt: fecha(Date.UTC(2026,8,16)), device:"Chrome / Windows", ip:"1.2.3.4" }],
  meta: { territoryConfig:{ zones:{ sur:{ label:"Sur" } }, countryZones:{ AR:"sur" } },
          preferences:{ activityTypes:[{ key:"evento", label:"Evento" }], maxImages:6 },
          calendarSync:null },
  userPrefs: { "benny@team-latam.com": { weekStart:1, dimPast:true } },
};

const analisis = PLAN.map(p => ({ ...p, filas: filasDe(p, respaldo) }));
const de = t => analisis.find(a => a.tabla === t).filas;

eq("se traen las ocho tablas", analisis.map(a=>a.tabla),
   ["members","former_members","access_requests","posts","replies","audit_log","app_config","user_prefs"]);
eq("y los comentarios DESPUÉS de los posteos (dependen de ellos)",
   analisis.findIndex(a=>a.tabla==="replies") > analisis.findIndex(a=>a.tabla==="posts"), true);

const p1 = de("posts")[0];
eq("camelCase se vuelve snake_case", [p1.start_date, p1.activity_type, p1.author_email, p1.is_project],
   ["2026-09-10","evento","ana@x.com",true]);
eq("y el id de Calendar también", p1.calendar_event_id, "cal1");
eq("las fechas de Firestore se vuelven fechas de verdad",
   p1.created_at, "2019-03-05T10:00:00.000Z");
eq("incluida la de edición", p1.last_edited_at, "2019-04-01T10:00:00.000Z");
eq("lo de adentro de una lista NO se traduce: son datos, no columnas",
   Object.keys(p1.milestones[0]).sort(), ["done","dueDate","text"]);
eq("un posteo viejo sin la mitad de los campos pasa igual",
   [de("posts")[1].id, de("posts")[1].images], ["p2", undefined]);

eq("el comentario sabe de qué posteo es", de("replies")[0].post_id, "p1");
eq("y a qué fecha de la serie pertenece", de("replies")[0].occ, "2026-09-10");

eq("en el roster el id suelto se descarta: la clave es el correo",
   Object.keys(de("members")[0]).includes("id"), false);
eq("photoURL es la excepción de la traducción", de("members")[0].photo_url, "http://foto");
eq("y si el documento no traía `email`, se usa el id",
   de("members")[1].email, "ana@x.com");

eq("los tres documentos de configuración se vuelven filas",
   de("app_config").map(c=>c.key), ["territoryConfig","preferences"]);
eq("el que estaba vacío no se trae", de("app_config").length, 2);
eq("y su contenido viaja tal cual",
   de("app_config")[0].value.countryZones, { AR:"sur" });
eq("las preferencias de cada uno, con el correo como clave",
   de("user_prefs"), [{ email:"benny@team-latam.com", prefs:{ weekStart:1, dimPast:true } }]);

const sobran = analisis.flatMap(a => camposDeMas(a.tabla, a.filas).map(c=>`${a.tabla}.${c}`));
eq("no sobra ningún campo con datos de forma normal", sobran, []);

// Y si sobrara, tiene que avisar ANTES y no perderlo en silencio.
eq("un campo que la base nueva no tiene se detecta",
   camposDeMas("posts", [{ id:"x", inventado:1 }]), ["inventado"]);

/* ================================================================
   La importación final

   Lo que la primera importación hacía mal (punto 4 de REVISION.md): cada
   adjunto perdía su ranura, su tipo y su fecha; un Word o un audio subían
   como .bin; volver a correrla fallaba en cada adjunto que ya estaba (el
   bucket no deja reemplazar), y lo editado en Firebase después no llegaba.
================================================================ */
import crypto from "node:crypto";
import { hacerGrab } from "./grab.mjs";
const todo = trozo("const A_SNAKE", "/* ---------- Pantalla");
const armar = sbFalso => new Function("sb", `${todo}
  return { filasDe, PLAN, claveDe, sinRepetidas, comparar, loQueSeSaca, sospechosa, describir, SE_QUITA,
           TIPO_A_EXT, aBytes, md5, rutaMiniatura, LADO_MINIATURA, CALIDAD_MINIATURA,
           subirAdjuntos, leerTodas, traerFilas, quitar };`)(sbFalso);
// Con un importador viejo, que no tiene estas piezas, se dice qué falta
// en vez de reventar en la primera línea.
let I = null;
try{ I = armar(null); }
catch(e){ fail++; console.log(`✗ al importador le faltan las piezas de la importación final: ${e.message}`); }
const APP = fs.readFileSync(process.env.INDEX || RAIZ + "index.html", "utf8");
const md5Node = bytes => crypto.createHash("md5").update(bytes).digest("hex");
if(I){

/* ---------- MD5: es lo que el bucket guarda como eTag ---------- */
{
  let semilla = 7;
  const bytes = largo => Uint8Array.from({ length: largo }, () => (semilla = (semilla * 1103515245 + 12345) % 2147483648) >> 16 & 255);
  eq("MD5 de «abc», el ejemplo del RFC 1321", I.md5(new TextEncoder().encode("abc")), "900150983cd24fb0d6963f7d28e17f72");
  // Los largos donde se equivoca un MD5 a mano: alrededor de los 56 y 64
  // bytes cambia el relleno.
  const largos = [0, 1, 3, 55, 56, 57, 63, 64, 65, 119, 120, 1000, 250003];
  eq("y el de cualquier largo, igual que el de Node",
     largos.filter(l => { const b = bytes(l); return I.md5(b) !== md5Node(b); }), []);
}

/* ---------- Lo mismo que la app ---------- */
{
  const enApp = APP.slice(APP.indexOf("  const TIPO_A_EXT = {"));
  const tablaApp = new Function(`return ${enApp.slice(enApp.indexOf("{"), enApp.indexOf("};") + 1)};`)();
  eq("las extensiones son las mismas que usa la app", I.TIPO_A_EXT, tablaApp);
  const sql = fs.readFileSync(RAIZ + "supabase/01-tablas.sql", "utf8");
  const aceptados = [...sql.slice(sql.indexOf("allowed_mime_types)"), sql.indexOf("on conflict (id)")).matchAll(/'([a-z]+\/[^']+)'/g)].map(m => m[1]);
  eq("y cada tipo que acepta el bucket sube con su extensión, no como .bin",
     aceptados.length > 20 && aceptados.filter(t => !I.TIPO_A_EXT[t]), []);
  eq("la miniatura se arma con la misma función que la app",
     hacerGrab(modulo)("achicarDataUrl"), hacerGrab(APP)("achicarDataUrl"));
  const m = /const LADO_MINIATURA = (\d+), CALIDAD_MINIATURA = ([\d.]+);/.exec(APP) || [];
  eq("del mismo tamaño y calidad", [I.LADO_MINIATURA, I.CALIDAD_MINIATURA], [Number(m[1]), Number(m[2])]);
  eq("y con el mismo nombre: al lado de la foto, terminada en .min.jpg",
     I.rutaMiniatura("posts/p1/img0_0123456789ab.jpg"), "posts/p1/img0_0123456789ab.min.jpg");
}

/* ---------- Los adjuntos ---------- */
// Un bucket de mentira: guarda lo subido con su eTag (el MD5, como
// Supabase), y no deja subir dos veces el mismo nombre.
function bucketDeMentira(inicial = {}){
  const carpetas = JSON.parse(JSON.stringify(inicial));
  const reg = { subidas: [], listados: [], carpetas, rechazar: null };
  return { reg,
    async list(dir){ reg.listados.push(dir); return { data: (carpetas[dir] || []).map(o => ({ ...o })), error: null }; },
    async upload(ruta, blob, op){
      if(reg.rechazar && reg.rechazar.test(ruta)) return { error: { statusCode: "415", message: "mime type not supported" } };
      const corte = ruta.lastIndexOf("/"), dir = ruta.slice(0, corte), nombre = ruta.slice(corte + 1);
      if((carpetas[dir] || []).some(o => o.name === nombre)) return { error: { statusCode: "409", message: "The resource already exists" } };
      const bytes = new Uint8Array(await blob.arrayBuffer());
      (carpetas[dir] = carpetas[dir] || []).push({ name: nombre, metadata: { eTag: `"${md5Node(bytes)}"`, size: bytes.length } });
      reg.subidas.push({ ruta, tipo: blob.type, op });
      return { error: null };
    },
  };
}
const FOTO = "data:image/jpeg;base64," + Buffer.from("una foto de verdad").toString("base64");
const OTRA = "data:image/jpeg;base64," + Buffer.from("la foto, cambiada en Firebase").toString("base64");
const DOCX = "data:application/octet-stream;base64," + Buffer.from("PK un word").toString("base64");
const huella = dataUrl => md5Node(Buffer.from(dataUrl.split(",")[1], "base64"));
const achicar = async () => "data:image/jpeg;base64," + Buffer.from("chiquita").toString("base64");
const posteo = () => ({ id: "p1", title: "Con todo", images: [FOTO, "posts/p1/vieja.jpg"],
  files: [{ name: "Reporte de visita.docx", dataUrl: DOCX, doc: "reporte", kind: "doc",
            mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            subidoEl: "2026-10-01T12:00:00.000Z" }] });
{
  const b = bucketDeMentira();
  const r = await I.subirAdjuntos("posts", [posteo()], { bucket: b, achicar });
  const p = r.filas[0] || { images: [], files: [{}] };
  const h = huella(FOTO).slice(0, 12);
  eq("la foto sube con una huella de su contenido en el nombre", p.images[0], `posts/p1/img0_${h}.jpg`);
  eq("lo que ya era una ruta queda como está", p.images[1], "posts/p1/vieja.jpg");
  eq("y su miniatura sube al lado, en JPEG",
     b.reg.subidas.filter(s => s.ruta.endsWith(".min.jpg")).map(s => [s.ruta, s.tipo]), [[`posts/p1/img0_${h}.min.jpg`, "image/jpeg"]]);
  eq("el adjunto CONSERVA su ranura, su tipo y su fecha (lo que se perdía)",
     [p.files[0].doc, p.files[0].kind, p.files[0].mime.endsWith("wordprocessingml.document"), p.files[0].subidoEl, p.files[0].name],
     ["reporte", "doc", true, "2026-10-01T12:00:00.000Z", "Reporte de visita.docx"]);
  eq("en la fila va su ruta, no el contenido", [p.files[0].path, "dataUrl" in p.files[0]], [`posts/p1/arch0_${huella(DOCX).slice(0, 12)}.docx`, false]);
  eq("un Word que el navegador no reconoció sube como Word, no como .bin",
     (b.reg.subidas.find(s => s.ruta.endsWith(".docx")) || {}).tipo, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  eq("nada sube con upsert (el bucket no deja reemplazar), y todo se puede guardar un año",
     b.reg.subidas.map(s => [!!s.op.upsert, s.op.cacheControl]), [[false, "31536000"], [false, "31536000"], [false, "31536000"]]);
  eq("y la cuenta lo dice", [r.cuenta.subidos, r.cuenta.miniaturas, r.cuenta.reusados], [2, 1, 0]);

  // Volver a correrla: nada se sube de nuevo, y las rutas son las mismas.
  const otra = await I.subirAdjuntos("posts", [posteo()], { bucket: b, achicar });
  eq("volver a correrla no sube nada de nuevo", b.reg.subidas.length, 3);
  eq("reconoce lo que ya está", otra.cuenta.reusados, 2);
  eq("y deja las mismas rutas", [otra.filas[0].images[0], otra.filas[0].files[0].path], [p.images[0], p.files[0].path]);
  eq("sin ninguna falla", otra.fallidas, []);
}
{
  // Lo que subió la PRIMERA importación tiene otro nombre (img0.jpg, sin
  // huella), pero su eTag es el mismo MD5: se reusa, no se duplica.
  const b = bucketDeMentira({ "posts/p1": [{ name: "img0.jpg", metadata: { eTag: `"${huella(FOTO)}"` } }] });
  const r = await I.subirAdjuntos("posts", [{ id: "p1", images: [FOTO] }], { bucket: b, achicar });
  eq("una foto que ya subió la primera importación se reusa, con su nombre de entonces", r.filas[0].images, ["posts/p1/img0.jpg"]);
  eq("la foto no se vuelve a subir: solo su miniatura, que entonces no existía", b.reg.subidas.map(s => s.ruta), ["posts/p1/img0.min.jpg"]);

  // Si el eTag no fuera un MD5, lo de la primera importación se reconoce
  // igual: el nombre de ese lugar y el mismo tamaño exacto.
  const sinEtag = bucketDeMentira({ "posts/p1": [{ name: "img0.jpg", metadata: { eTag: '"no-es-un-md5-1"', size: Buffer.from(FOTO.split(",")[1], "base64").length } }] });
  const s = await I.subirAdjuntos("posts", [{ id: "p1", images: [FOTO] }], { bucket: sinEtag, achicar });
  eq("aunque el eTag no sea un MD5, lo de la primera importación se reusa por su nombre y su tamaño", s.filas[0].images, ["posts/p1/img0.jpg"]);
  const otroTam = bucketDeMentira({ "posts/p1": [{ name: "img0.jpg", metadata: { size: 3 } }] });
  const o = await I.subirAdjuntos("posts", [{ id: "p1", images: [FOTO] }], { bucket: otroTam, achicar });
  eq("pero si pesa distinto, es otra foto: sube aparte", o.filas[0].images[0] !== "posts/p1/img0.jpg", true);

  // Una foto que cambió en Firebase sube aparte: nada se pisa.
  const c = await I.subirAdjuntos("posts", [{ id: "p1", images: [OTRA] }], { bucket: b, achicar });
  eq("una foto que cambió en Firebase sube con otro nombre", c.filas[0].images[0], `posts/p1/img0_${huella(OTRA).slice(0, 12)}.jpg`);
  eq("y la de antes queda como estaba", b.reg.carpetas["posts/p1"].some(o => o.name === "img0.jpg"), true);
}
{
  // Un adjunto que el bucket rechaza: esa fila no se trae (la base no
  // acepta un archivo embebido) y queda en la lista; las demás siguen.
  const b = bucketDeMentira();
  b.reg.rechazar = /p2\/arch0/;
  const filas = [{ id: "p1", images: [FOTO] }, { id: "p2", files: [{ name: "x.docx", dataUrl: DOCX }] }, { id: "p3", title: "Sin adjuntos" }];
  const r = await I.subirAdjuntos("posts", filas, { bucket: b, achicar });
  eq("una fila con un adjunto que no se pudo subir no se trae", r.filas.map(f => f.id).sort(), ["p1", "p3"]);
  eq("y queda en la lista, con el motivo", r.fallidas.map(f => [f.clave, /mime type not supported/.test(f.error)]), [["p2", true]]);
  eq("una fila sin adjuntos ni siquiera mira el bucket", b.reg.listados.includes("posts/p3"), false);
}
{
  const b = bucketDeMentira();
  const r = await I.subirAdjuntos("posts", [{ id: "p1", images: [FOTO] }],
    { bucket: b, achicar: async () => { throw new Error("Imagen inválida"); } });
  eq("si la miniatura no se puede armar, la foto entra igual", r.filas[0].images.length, 1);
  eq("y queda anotado", r.cuenta.sinMiniatura.length, 1);
}

/* ---------- Los topes de adjuntos de Firebase no se traen ---------- */
{
  const [config] = [I.PLAN.find(p => p.tabla === "app_config")];
  const filas = I.filasDe(config, { meta: { preferences: { activityTypes: [{ key: "visita" }], calendarId: "c@g",
    maxImages: 6, maxAttachmentFiles: 2, maxAttachmentFileBytes: 153600 } } });
  eq("de las preferencias se traen todas menos los topes de adjuntos de Firebase",
     Object.keys(filas[0].value).sort(), ["activityTypes", "calendarId"]);
}

/* ---------- Comparar con lo que hay ---------- */
{
  const enArchivo = [{ id: "p1" }, { id: "p2" }, { id: "p2" }];
  const { filas, repetidas } = I.sinRepetidas("posts", enArchivo);
  eq("una clave repetida en el archivo se trae una vez", [filas.length, repetidas], [2, ["p2"]]);

  const c = I.comparar("posts", filas, [{ id: "p2", title: "Ya estaba" }, { id: "p9", title: "Borrado en Firebase", start_date: "2026-09-20" }]);
  eq("cuáles son nuevas, cuántas ya estaban, y cuáles están solo en Supabase",
     [[...c.nuevas], c.yaEstaban, c.soloEnSupabase.map(p => p.id)], [["p1"], 1, ["p9"]]);
  eq("de la configuración no se saca nada aunque sobre",
     I.comparar("app_config", [], [{ key: "calendarSync" }]).soloEnSupabase, []);
  eq("ni del registro de auditoría", I.SE_QUITA.has("audit_log"), false);

  const comparaciones = { posts: c, replies: I.comparar("replies", [], [
    { id: "r1", post_id: "p9", content: "del borrado" }, { id: "r2", post_id: "p2", content: "suelto", system: true }]) };
  const { quitar, comentariosDe } = I.loQueSeSaca(comparaciones, { replies: [{ id: "r1", post_id: "p9" }, { id: "r2", post_id: "p2" }] });
  eq("los comentarios de un posteo que se saca no se listan aparte: se van con él", quitar.replies.map(r => r.id), ["r2"]);
  eq("y el posteo dice cuántos se lleva",
     I.describir("posts", quitar.posts[0], { comentariosDe }), "Borrado en Firebase — 2026-09-20 · con 1 comentario");
  eq("un posteo de Calendar se reconoce en la lista",
     I.describir("posts", { id: "cal_abc", title: "Reunión", start_date: "2026-10-01" }), "Reunión — 2026-10-01 · de Google Calendar");

  eq("una copia que trae mucho menos de lo que hay se frena", I.sospechosa(40, 900), true);
  eq("una normal, no", I.sospechosa(890, 900), false);
  eq("ni una tabla chica", I.sospechosa(1, 5), false);
}

/* ---------- Escribir: de a tandas, y una fila rota no frena a las demás ---------- */
function sbDeMentira({ tablas = {}, maxFilas = 1000, contestar } = {}){
  const reg = { rpc: [], pedidos: [] };
  return { reg,
    async rpc(nombre, args){ reg.rpc.push([nombre, args]); return contestar ? contestar(nombre, args) : { data: (args.p_filas || args.p_claves || []).length, error: null }; },
    from(tabla){
      const q = { tabla };
      const api = {
        select(cols, op){ q.cols = cols; q.contar = !!(op && op.count); return api; },
        order(col){ q.orden = col; return api; },
        range(desde, hasta){
          reg.pedidos.push({ ...q, desde, hasta });
          const todas = tablas[tabla] || [];
          return Promise.resolve({ data: todas.slice(desde, hasta + 1).slice(0, maxFilas), error: null, count: q.contar ? todas.length : null });
        },
      };
      return api;
    },
  };
}
{
  const falso = sbDeMentira();
  const filas = Array.from({ length: 450 }, (_, i) => ({ id: "p" + i }));
  const r = await armar(falso).traerFilas("posts", filas, true);
  eq("450 filas van en tres tandas", falso.reg.rpc.map(([nombre, a]) => [nombre, a.p_filas.length]), [["importar", 200], ["importar", 200], ["importar", 50]]);
  eq("diciendo si se reemplaza", falso.reg.rpc.every(([, a]) => a.p_reemplazar === true), true);
  eq("y cuenta las que se escribieron", r.escritas, 450);
}
{
  // Una tanda con un comentario cuyo posteo ya no existe (23503): se
  // prueba fila por fila, y solo esa queda afuera.
  const falso = sbDeMentira({ contestar: (nombre, a) => a.p_filas.some(f => f.post_id === "no_existe")
    ? { data: null, error: { code: "23503", message: 'insert or update on table "replies" violates foreign key constraint' } }
    : { data: a.p_filas.length, error: null } });
  const filas = [{ id: "r1", post_id: "p1" }, { id: "r2", post_id: "no_existe" }, { id: "r3", post_id: "p1" }];
  const r = await armar(falso).traerFilas("replies", filas, false);
  eq("una fila rota no deja afuera a las otras", r.escritas, 2);
  eq("y queda en la lista, con el motivo", r.fallidas.map(f => [f.clave, /foreign key/.test(f.error)]), [["r2", true]]);
}
{
  // Pero si el problema no es de las filas (la sesión venció), se corta.
  const falso = sbDeMentira({ contestar: () => ({ data: null, error: { code: "PGRST301", message: "JWT expired" } }) });
  let error = null;
  try{ await armar(falso).traerFilas("posts", [{ id: "p1" }, { id: "p2" }], true); }catch(e){ error = e.message; }
  eq("un error que no es de las filas corta todo, sin probar fila por fila", [error, falso.reg.rpc.length], ["posts: JWT expired", 1]);
}
{
  const falso = sbDeMentira();
  const claves = Array.from({ length: 250 }, (_, i) => "p" + i);
  const sacadas = await armar(falso).quitar("posts", claves);
  eq("se saca exactamente lo de la lista, de a 200",
     falso.reg.rpc.map(([nombre, a]) => [nombre, a.p_tabla, a.p_claves.length]), [["importar_quitar", "posts", 200], ["importar_quitar", "posts", 50]]);
  eq("las mismas claves, ni una más", falso.reg.rpc.flatMap(([, a]) => a.p_claves), claves);
  eq("y dice cuántas sacó", sacadas, 250);
}
{
  // Leer lo que hay: de a páginas, aunque el panel tenga un tope más bajo.
  const falso = sbDeMentira({ maxFilas: 300, tablas: { posts: Array.from({ length: 700 }, (_, i) => ({ id: "p" + String(i).padStart(3, "0") })) } });
  const filas = await armar(falso).leerTodas("posts", "id,title,start_date");
  eq("para comparar, se leen TODAS las filas de Supabase, de a páginas", [filas.length, new Set(filas.map(f => f.id)).size], [700, 700]);
  eq("ordenadas por su clave", falso.reg.pedidos[0].orden, "id");
}

}

// Lo que sale de acá es lo que se le manda a la base. Se guarda para
// probarlo contra Postgres de verdad — pero solo donde hay un Postgres de
// prueba armado (/pglab, el laboratorio local). En CI no existe, y
// escribir ahí tiraba la prueba DESPUÉS de haber pasado todo.
if(fs.existsSync("/pglab")) fs.writeFileSync("/pglab/filas.json", JSON.stringify(
  Object.fromEntries(analisis.map(a => [a.tabla, a.filas]))));
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
