import fs from "node:fs";
import { fileURLToPath as __aRuta } from "node:url";
process.chdir(__aRuta(new URL(".", import.meta.url)));
const RAIZ = __aRuta(new URL("..", import.meta.url));
const src = fs.readFileSync(RAIZ + "supabase/importar.html","utf8");
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

// Lo que sale de acá es lo que se le manda a la base. Se guarda para
// probarlo contra Postgres de verdad — pero solo donde hay un Postgres de
// prueba armado (/pglab, el laboratorio local). En CI no existe, y
// escribir ahí tiraba la prueba DESPUÉS de haber pasado todo.
if(fs.existsSync("/pglab")) fs.writeFileSync("/pglab/filas.json", JSON.stringify(
  Object.fromEntries(analisis.map(a => [a.tabla, a.filas]))));
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
