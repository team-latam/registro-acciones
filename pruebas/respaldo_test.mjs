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
  const iLl = src.indexOf("{", desde), iCor = src.indexOf("[", desde);
  const primero = iCor >= 0 && (iLl < 0 || iCor < iLl) ? iCor : iLl;
  if(primero < 0 || primero > finLinea) return src.slice(m.index + 1, finLinea + 1);
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
const code = ["respaldoValor","respaldoSinAdjuntos","leerColeccion","leerDocMeta","armarRespaldo","pesoLegible"].map(grab).join("\n");

// Firestore de mentira, con la forma exacta que usa el código real.
function ts(ms){ return { toMillis: ()=>ms, seconds: Math.floor(ms/1000) }; }
const datosFalsos = {
  posts: [
    { id:"p1", title:"Curso", createdAt:ts(1700000000000), images:["data:image/png;base64,AAAA","data:image/png;base64,BBBB"],
      files:[{ name:"a.pdf", dataUrl:"data:application/pdf;base64,CCC" }],
      milestones:[{ id:"m1", label:"Hito", date:"2026-01-01", doneAt:ts(1700000001000) }],
      scopes:[{ type:"country", country:"Argentina" }] },
    { id:"p2", title:"Rutina", createdAt:ts(1700000002000) },
  ],
  allowlist: [{ id:"benny@x.com", nickname:"benny", approvedAt:ts(1600000000000) }],
  formerMembers: [{ id:"julia@x.com", nickname:"julia", revokedAt:ts(1650000000000) }],
  accessRequests: [{ id:"nuevo@x.com", status:"pending", requestedAt:ts(1690000000000) }],
  auditLog: [{ id:"a1", type:"login", actorEmail:"benny@x.com", createdAt:ts(1700000003000) }],
};
const replies = [
  { id:"r1", postId:"p1", content:"buenísimo", createdAt:ts(1700000004000), images:["data:image/png;base64,DDD"] },
  { id:"r2", postId:"p2", content:"ok", createdAt:ts(1700000005000) },
];
const metaDocs = { territoryConfig:{ zones:{ sur:{} } }, preferences:{ maxImages:6 }, calendarSync:{ syncToken:"abc", lastSyncedAt:ts(1700000006000) } };

let colecciones = 0, gruposLeidos = 0;
const ctx = {
  state:{ auth:{ user:{ email:"benny@x.com" } } },
  __fallaEn: null,
  fb: {
    collection: (db, nombre)=>({ nombre }),
    collectionGroup: (db, nombre)=>({ grupo:nombre }),
    doc: (db, col, id)=>({ col, id }),
    getDocs: async ref=>{
      if(ref.grupo){
        gruposLeidos++;
        return { docs: replies.map(r=>({ id:r.id, ref:{ parent:{ parent:{ id:r.postId } } },
          data: ()=>{ const { id, postId, ...resto } = r; return resto; } })) };
      }
      colecciones++;
      if(ctx.__fallaEn === ref.nombre) throw new Error("permiso denegado en " + ref.nombre);
      return { docs: (datosFalsos[ref.nombre]||[]).map(d=>({ id:d.id, data: ()=>{ const { id, ...resto } = d; return resto; } })) };
    },
    getDoc: async ref=>{
      if(ref.col === "meta") return { exists: ()=>!!metaDocs[ref.id], data: ()=>metaDocs[ref.id] };
      if(ref.col === "userPrefs") return { exists: ()=>true, data: ()=>({ weekStart:1 }) };
      return { exists: ()=>false, data: ()=>null };
    },
  },
};
const api = new Function("ctx", `
  const state = ctx.state; const fb = ctx.fb; const db = {};
  ${code}
  return { respaldoValor, respaldoSinAdjuntos, armarRespaldo, pesoLegible };
`)(ctx);

let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

// ---- las fechas sobreviven, y se sabe que eran fechas ----
eq("una fecha se marca", api.respaldoValor(ts(1234)), { __tipo:"fecha", ms:1234 });
eq("adentro de un objeto", api.respaldoValor({ a:ts(5) }), { a:{ __tipo:"fecha", ms:5 } });
eq("adentro de una lista", api.respaldoValor([ts(5)]), [{ __tipo:"fecha", ms:5 }]);
eq("anidada en una lista de objetos (los hitos)",
   api.respaldoValor({ milestones:[{ doneAt:ts(7) }] }), { milestones:[{ doneAt:{ __tipo:"fecha", ms:7 } }] });
eq("null no rompe", api.respaldoValor(null), null);
eq("undefined tampoco", api.respaldoValor(undefined), undefined);
eq("los textos y números quedan igual", api.respaldoValor({ a:"x", b:3, c:false }), { a:"x", b:3, c:false });

// ---- la versión liviana ----
const liviano = api.respaldoSinAdjuntos({ title:"x", images:["a","b"], files:[{}], content:"hola" });
eq("saca las imágenes pero deja la cuenta", liviano.images, { __quitado:"images", cantidad:2 });
eq("saca los archivos también", liviano.files, { __quitado:"files", cantidad:1 });
eq("y no toca el resto", [liviano.title, liviano.content], ["x","hola"]);
eq("un posteo sin adjuntos queda intacto", api.respaldoSinAdjuntos({ title:"y" }), { title:"y" });

// ---- el respaldo completo ----
const full = await api.armarRespaldo(true);
eq("trae los posteos", full.posts.length, 2);
eq("con su id", full.posts.map(p=>p.id), ["p1","p2"]);
eq("las imágenes vienen enteras", full.posts[0].images.length, 2);
eq("y las fechas marcadas", full.posts[0].createdAt, { __tipo:"fecha", ms:1700000000000 });
eq("la fecha de un hito también", full.posts[0].milestones[0].doneAt, { __tipo:"fecha", ms:1700000001000 });
eq("trae los comentarios", full.replies.length, 2);
eq("cada uno sabe de qué posteo es", full.replies.map(r=>r.postId), ["p1","p2"]);
eq("las respuestas se piden en UNA consulta de grupo, no una por posteo", gruposLeidos, 1);
eq("trae el roster", full.allowlist.length, 1);
eq("los ex integrantes", full.formerMembers.length, 1);
eq("las solicitudes", full.accessRequests.length, 1);
eq("la auditoría", full.auditLog.length, 1);
eq("la config de zonas", !!full.meta.territoryConfig, true);
eq("las preferencias del equipo", full.meta.preferences.maxImages, 6);
eq("y el estado del sync, con su fecha marcada", full.meta.calendarSync.lastSyncedAt.__tipo, "fecha");
eq("las preferencias propias, solo las propias", Object.keys(full.userPrefs), ["benny@x.com"]);
eq("queda anotado que es completo", full.conAdjuntos, true);
eq("y de dónde salió", full.origen, "firestore");
eq("con versión de formato, para poder leerlo en el futuro", full.formato, 1);

// ---- el liviano ----
const light = await api.armarRespaldo(false);
eq("el liviano no trae las imágenes", light.posts[0].images, { __quitado:"images", cantidad:2 });
eq("ni en los comentarios", light.replies[0].images, { __quitado:"images", cantidad:1 });
eq("pero sí todo lo demás", light.posts.length, 2);
eq("el roster va completo igual (no pesa)", light.allowlist.length, 1);
eq("y queda marcado como liviano", light.conAdjuntos, false);

// ---- todo lo que se baja es JSON válido ----
eq("el completo serializa", typeof JSON.stringify(full), "string");
eq("y se puede volver a leer", JSON.parse(JSON.stringify(full)).posts[0].createdAt.ms, 1700000000000);

// ---- si una colección falla, no se pierde el resto ----
ctx.__fallaEn = "auditLog";
const conFalla = await api.armarRespaldo(true);
eq("una colección que no se puede leer queda anotada", !!conFalla.auditLog.__error, true);
eq("con el motivo", conFalla.auditLog.__error.includes("permiso denegado"), true);
eq("y los posteos igual se bajaron", conFalla.posts.length, 2);
ctx.__fallaEn = null;

// ---- el peso legible ----
eq("bytes", api.pesoLegible(512), "512 B");
eq("kilobytes", api.pesoLegible(2048), "2 KB");
eq("megabytes", api.pesoLegible(3 * 1048576), "3.0 MB");

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
