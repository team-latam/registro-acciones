/* ======================================================================
   El trabajo entero, de punta a punta, contra un Supabase y un Google
   Calendar de mentira: qué pide, qué escribe, y qué hace cuando algo
   falla. Es el mismo archivo que va a correr GitHub cada madrugada.
   ====================================================================== */
let pass=0, fail=0;
const eq=(n,g,w)=>{ const a=JSON.stringify(g), x=JSON.stringify(w);
  if(a===x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };

process.env.SUPABASE_URL = "https://falso.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "llave-de-mentira";
process.env.CALENDAR_ID = "cal@group.calendar.google.com";
process.env.CALENDAR_API_KEY = "clave-de-mentira";

function baseDeMentira(guion){
  const reg = { pedidos:[], posts:[...(guion.posts || [])], replies:[], config:{ ...(guion.config || {}) } };
  const paginas = [...(guion.paginas || [])];
  globalThis.fetch = async (url, opciones = {}) => {
    const u = String(url);
    reg.pedidos.push({ url: u, metodo: opciones.method || "GET" });
    const cuerpo = opciones.body ? JSON.parse(opciones.body) : null;
    const ok = (datos, estado = 200) => ({ ok: estado < 400, status: estado,
      text: async ()=> datos === null ? "" : JSON.stringify(datos),
      json: async ()=> datos });

    /* ---- Google Calendar ---- */
    if(u.includes("googleapis.com")){
      if(guion.calendarFalla) return ok({ error:{ message: guion.calendarFalla } }, 500);
      if(guion.tokenVencido && u.includes("syncToken=")) return ok(null, 410);
      const pagina = paginas.shift() || { items:[], nextSyncToken:"tok-nuevo" };
      return ok(pagina);
    }

    /* ---- Supabase ---- */
    if(u.includes("/rest/v1/posts")){
      if(opciones.method === "PATCH"){
        if(guion.escrituraFalla) return ok({ message: guion.escrituraFalla }, 400);
        const id = decodeURIComponent((u.match(/id=eq\.([^&]+)/) || [])[1] || "");
        const p = reg.posts.find(x => x.id === id);
        if(p) Object.assign(p, cuerpo);
        return ok(null);
      }
      if(opciones.method === "POST"){
        if(guion.escrituraFalla) return ok({ message: guion.escrituraFalla }, 400);
        if(!reg.posts.some(x => x.id === cuerpo.id)) reg.posts.push(cuerpo);
        return ok(null);
      }
      return ok(reg.posts);
    }
    if(u.includes("/rest/v1/replies")){
      reg.replies.push(cuerpo);
      return ok(null);
    }
    if(u.includes("/rest/v1/app_config")){
      if(opciones.method === "POST"){ reg.config[cuerpo.key] = cuerpo.value; return ok(null); }
      const clave = decodeURIComponent((u.match(/key=eq\.([^&]+)/) || [])[1] || "");
      return ok(reg.config[clave] === undefined ? [] : [{ value: reg.config[clave] }]);
    }
    throw new Error("pedido inesperado: " + u);
  };
  return reg;
}

const { main } = await import("../sincronizar.mjs");
const callado = async fn => {
  const log = console.log, err = console.error;
  console.log = ()=>{}; console.error = ()=>{};
  try{ return await fn(); } finally { console.log = log; console.error = err; }
};

const diaEntero = (id, f, extra={}) => ({ id, status:"confirmed", summary:"Reunión",
  start:{ date:f }, end:{ date:(d=>{const x=new Date(d+"T00:00:00Z");x.setUTCDate(x.getUTCDate()+1);return x.toISOString().slice(0,10);})(f) }, ...extra });

/* ---------- Un evento nuevo ---------- */
{
  const reg = baseDeMentira({ paginas:[{ items:[diaEntero("evA","2026-09-01",{ summary:"Charla abierta" })], nextSyncToken:"tok1" }] });
  const r = await callado(()=> main());
  eq("aplica el único evento", [r.aplicados, r.fallados], [1, 0]);
  eq("y nace un posteo", reg.posts.length, 1);
  eq("con su título", reg.posts[0].title, "Charla abierta");
  eq("vinculado al evento", reg.posts[0].calendar_event_id, "evA");
  eq("con el id derivado del evento, no uno al azar", reg.posts[0].id, "cal_evA");
  eq("las columnas van en minúscula con guión bajo, como la base",
     Object.keys(reg.posts[0]).filter(k=>/[A-Z]/.test(k)), []);
  eq("la hora la pone la base, no este programa", reg.posts[0].created_at, "1970-01-01T00:00:00.000Z");
  eq("y el token nuevo queda guardado", reg.config.calendarSync.syncToken, "tok1");
  eq("con la fecha de la última corrida", typeof reg.config.calendarSync.lastSyncedAt, "string");
}

/* ---------- Un cambio sobre un posteo que ya existe ---------- */
{
  const reg = baseDeMentira({
    posts: [{ id:"p1", calendar_event_id:"evB", title:"Reunión", activity_type:"visita",
              start_date:"2026-05-10", end_date:"2026-05-10", date:"2026-05-10", location:"" }],
    paginas: [{ items:[diaEntero("evB","2026-05-20")], nextSyncToken:"tok2" }],
  });
  const r = await callado(()=> main());
  eq("aplica el cambio", r.aplicados, 1);
  eq("mueve la fecha", reg.posts[0].start_date, "2026-05-20");
  eq("y firma quién lo movió", reg.posts[0].last_edited_by, "Google Calendar");
  eq("deja un comentario del sistema", reg.replies.length, 1);
  eq("colgado del posteo", reg.replies[0].post_id, "p1");
  eq("marcado como del sistema", reg.replies[0].system, true);
  eq("en español, con las variables reemplazadas",
     /Se actualizó desde Google Calendar: fecha \(10\/05\/2026 → 20\/05\/2026\)\./.test(reg.replies[0].content), true);
  eq("y con un id propio de 20 caracteres", reg.replies[0].id.length, 20);
}

/* ---------- Nada que hacer ---------- */
{
  const reg = baseDeMentira({
    posts: [{ id:"p1", calendar_event_id:"evB", title:"Reunión", activity_type:"visita",
              start_date:"2026-05-10", end_date:"2026-05-10", date:"2026-05-10", location:"" }],
    paginas: [{ items:[diaEntero("evB","2026-05-10")], nextSyncToken:"tok3" }],
  });
  const r = await callado(()=> main());
  eq("revisa pero no aplica nada", [r.revisados, r.aplicados], [1, 0]);
  eq("no escribe ningún comentario", reg.replies.length, 0);
  eq("y guarda el token igual", reg.config.calendarSync.syncToken, "tok3");
}

/* ---------- Sin eventos ---------- */
{
  const reg = baseDeMentira({ paginas:[{ items:[], nextSyncToken:"tok4" }] });
  const r = await callado(()=> main());
  eq("sin cambios, no toca nada", [r.revisados, r.aplicados, reg.replies.length], [0, 0, 0]);
  eq("pero el token avanza", reg.config.calendarSync.syncToken, "tok4");
}

/* ---------- Dos eventos de la misma serie en una sola corrida ---------- */
{
  const reg = baseDeMentira({
    posts: [{ id:"p2", calendar_event_id:"serie", title:"Semanal", activity_type:"virtual",
              start_date:"2026-01-05", end_date:"2026-01-05", date:"2026-01-05",
              recurrence:["RRULE:FREQ=WEEKLY;BYDAY=MO"], recurrence_skip:[], recurrence_moves:{} }],
    paginas: [{ items:[
      diaEntero("serie_20260112T000000Z","2026-01-14",{ summary:"Semanal", recurringEventId:"serie" }),
      diaEntero("serie_20260119T000000Z","2026-01-21",{ summary:"Semanal", recurringEventId:"serie" }),
    ], nextSyncToken:"tok5" }],
  });
  const r = await callado(()=> main());
  eq("aplica los dos", r.aplicados, 2);
  eq("y el segundo ve lo que hizo el primero (no lo pisa)",
     reg.posts[0].recurrence_moves, { "2026-01-12":"2026-01-14", "2026-01-19":"2026-01-21" });
}

/* ---------- Varias páginas ---------- */
{
  const reg = baseDeMentira({ paginas:[
    { items:[diaEntero("ev1","2026-09-01",{ summary:"Uno" })], nextPageToken:"p2" },
    { items:[diaEntero("ev2","2026-09-02",{ summary:"Dos" })], nextSyncToken:"tokFinal" },
  ]});
  const r = await callado(()=> main());
  eq("junta las dos páginas", r.revisados, 2);
  eq("y crea los dos posteos", reg.posts.length, 2);
  eq("con el token de la última", reg.config.calendarSync.syncToken, "tokFinal");
}

/* ---------- El token vencido ---------- */
{
  const reg = baseDeMentira({ tokenVencido:true, config:{ calendarSync:{ syncToken:"viejo" } },
    paginas:[{ items:[diaEntero("evC","2026-09-01",{ summary:"Todo de nuevo" })], nextSyncToken:"tokFresco" }] });
  const r = await callado(()=> main());
  eq("relee el calendario entero", r.revisados, 1);
  eq("y arranca con un token nuevo", reg.config.calendarSync.syncToken, "tokFresco");
  const aGoogle = reg.pedidos.filter(p=>p.url.includes("googleapis.com"));
  eq("el primer pedido a Google llevaba el token viejo", /syncToken=viejo/.test(aGoogle[0].url), true);
  eq("y el segundo, ninguno", /syncToken=/.test(aGoogle[1].url), false);
}

/* ---------- Cuando una escritura falla ---------- */
{
  const reg = baseDeMentira({ escrituraFalla:"la base dijo que no",
    paginas:[{ items:[diaEntero("evD","2026-09-01",{ summary:"Falla" }),
                      diaEntero("evE","2026-09-02",{ summary:"Falla también" })], nextSyncToken:"tokIgual" }] });
  const r = await callado(()=> main());
  eq("cuenta los que fallaron", [r.aplicados, r.fallados], [0, 2]);
  eq("no escribió nada", reg.posts.length, 0);
  eq("pero el token avanza igual: si no, la próxima vuelve a traer todo y a fallar igual",
     reg.config.calendarSync.syncToken, "tokIgual");
}
{
  // Uno malo no puede llevarse puestos a los demás.
  let primera = true;
  const reg = baseDeMentira({ paginas:[{ items:[
    diaEntero("evMalo","2026-09-01",{ summary:"Malo" }),
    diaEntero("evBueno","2026-09-02",{ summary:"Bueno" })], nextSyncToken:"tokMixto" }] });
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (url, op={}) => {
    if(String(url).includes("/rest/v1/posts") && op.method === "POST" && primera){
      primera = false;
      return { ok:false, status:400, text: async ()=>'{"message":"no"}' };
    }
    return fetchOriginal(url, op);
  };
  const r = await callado(()=> main());
  eq("el que anda se aplica igual", [r.aplicados, r.fallados], [1, 1]);
  eq("y es el bueno el que quedó", reg.posts.map(p=>p.title), ["Bueno"]);
}

/* ---------- Cuando Calendar no contesta ---------- */
{
  baseDeMentira({ calendarFalla:"cuota excedida" });
  let exploto = null;
  await callado(async ()=>{ try{ await main(); }catch(e){ exploto = e.message; } });
  eq("se corta con el motivo de Google", exploto, "cuota excedida");
}

/* ---------- Sin configuración, no arranca ---------- */
{
  const guardado = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
  baseDeMentira({ paginas:[] });
  let exploto = null;
  await callado(async ()=>{ try{ await main(); }catch(e){ exploto = e.message; } });
  eq("avisa qué falta", exploto, "Falta SUPABASE_SERVICE_ROLE_KEY.");
  process.env.SUPABASE_SERVICE_ROLE_KEY = guardado;
}

/* ---------- La fecha desde la que importa ---------- */
{
  const reg = baseDeMentira({ config:{ preferences:{ calendarImportFrom:"2020-01-01" } },
    paginas:[{ items:[], nextSyncToken:"t" }] });
  await callado(()=> main());
  const pedidoCal = reg.pedidos.find(p=>p.url.includes("googleapis.com"));
  eq("sin token, pide desde la fecha configurada", /timeMin=2020-01-01/.test(pedidoCal.url), true);
}
{
  const reg = baseDeMentira({ paginas:[{ items:[], nextSyncToken:"t" }] });
  await callado(()=> main());
  const pedidoCal = reg.pedidos.find(p=>p.url.includes("googleapis.com"));
  eq("sin fecha configurada, pide todo el historial", /timeMin/.test(pedidoCal.url), false);
  eq("y siempre pide también los borrados", /showDeleted=true/.test(pedidoCal.url), true);
}

/* ---------- Los tipos que renombró el admin ---------- */
{
  const reg = baseDeMentira({
    config:{ preferences:{ activityTypes:[{ key:"curso", label:"Capacitación" }, { key:"otro", label:"Otro" }] } },
    paginas:[{ items:[diaEntero("evF","2026-09-01",{ summary:"Capacitación: Kashrut" })], nextSyncToken:"t" }],
  });
  await callado(()=> main());
  eq("un evento con el tipo renombrado entra con ese tipo", reg.posts[0].activity_type, "curso");
  eq("y sin el prefijo en el título", reg.posts[0].title, "Kashrut");
}

/* ---------- En seco: decide pero no escribe ---------- */
{
  process.env.EN_SECO = "1";
  const reg = baseDeMentira({ paginas:[{ items:[diaEntero("evG","2026-09-01",{ summary:"Prueba" })], nextSyncToken:"t" }] });
  const r = await callado(()=> main());
  eq("dice que lo aplicaría", r.aplicados, 1);
  eq("pero no escribe nada", [reg.posts.length, reg.replies.length], [0, 0]);
  eq("ni guarda el token", reg.config.calendarSync, undefined);
  process.env.EN_SECO = "";
}

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
