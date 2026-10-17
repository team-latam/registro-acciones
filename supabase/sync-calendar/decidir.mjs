/* ======================================================================
   Qué hacer con un evento de Calendar — del lado del servidor

   ATENCIÓN, LO MÁS IMPORTANTE DE ESTE ARCHIVO:

   esta es una SEGUNDA implementación de applyCalendarEventToPosts(), que
   vive en index.html. Son dos copias de la misma decisión, en dos lugares,
   y eso es exactamente lo que se advirtió antes de escribirlo: cada cambio
   futuro hay que hacerlo en los dos lados.

   Lo que evita que se separen en silencio es la prueba diferencial
   (pruebas/calendario_diff): corre LAS DOS contra los mismos eventos y
   compara las escrituras que pide cada una. Si alguien toca una sola, esa
   prueba se cae. No la saltees: es lo único que hace que esta duplicación
   sea sostenible.

   Por qué acá no se escribe nada: `decidir()` es pura — recibe un evento y
   los posteos, y devuelve la LISTA DE ESCRITURAS que haría. Así se la
   puede comparar con la de la app sin tocar ninguna base, y quien ejecuta
   (sincronizar.mjs) no tiene ninguna decisión adentro.
   ====================================================================== */

export const TIPOS_QUE_SINCRONIZAN = new Set(["visita","curso","seminario","congreso","virtual","otro"]);
export const MAX_MUDANZAS = 60;          // = MAX_OCC_MOVES en index.html
const MAX_SALTEADAS = 200;               // = el .slice(-200) de recurrenceSkip

/* ---------- Fechas ---------- */
export function sumarDias(iso, dias){
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
export function esFechaISO(v){ return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")); }
function fechaDeRrule(v){
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(String(v || "").trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// Las fechas del posteo a partir del evento. Los eventos de "todo el día"
// que arma la app tienen el fin EXCLUSIVO (+1 día), así que acá se
// deshace.
export function fechasDelEvento(ev){
  if(ev.start?.date) return {
    startDate: ev.start.date, endDate: sumarDias(ev.end?.date || ev.start.date, -1),
    startTime: null, endTime: null,
  };
  if(ev.start?.dateTime) return {
    startDate: ev.start.dateTime.slice(0,10),
    endDate: (ev.end?.dateTime || ev.start.dateTime).slice(0,10),
    startTime: ev.start.dateTime.slice(11,16),
    endTime: (ev.end?.dateTime || ev.start.dateTime).slice(11,16),
  };
  return { startDate:null, endDate:null, startTime:null, endTime:null };
}

// De qué fecha de la serie es esta excepción. originalStartTime trae la
// hora original en la zona del calendario, que es la fecha con que la app
// arma la serie: va primero. El id ("<idDelMolde>_<fechaOriginalUTC>") va
// de respaldo, porque está en UTC: una rutina de las 22:00 en Buenos Aires
// del 12/1 tiene id "…_20260113T010000Z", y tomándolo primero se salteaba
// o se movía el 13 en vez del 12 (docs/AUDITORIA.md, I5).
export function fechaOriginalDeLaExcepcion(ev){
  if(!ev || !ev.recurringEventId) return null;
  const orig = ev.originalStartTime && (ev.originalStartTime.date || String(ev.originalStartTime.dateTime || "").slice(0, 10));
  return (orig && fechaDeRrule(String(orig).replace(/-/g, ""))) ||
    fechaDeRrule(String(ev.id || "").slice(String(ev.recurringEventId).length + 1)) ||
    null;
}

// Una fecha corrida a otro día. La CLAVE es siempre la fecha original de
// la serie: esa es la identidad de la repetición, la que llevan pegada los
// comentarios.
export function mudanzasDe(post){
  const crudo = post && post.recurrenceMoves;
  if(!crudo || typeof crudo !== "object") return {};
  const out = {};
  Object.keys(crudo).forEach(k=>{
    if(esFechaISO(k) && esFechaISO(crudo[k])) out[k] = crudo[k];
  });
  return out;
}

/* ---------- Tipos y títulos ---------- */
// Todos los nombres con los que ese tipo pudo haber salido a Calendar: el
// que tiene puesto hoy, y los de fábrica en los cuatro idiomas. Sin esto,
// un evento escrito con la app en inglés no matcheaba y el título del
// posteo se quedaba con el prefijo pegado.
export function nombresDelTipo(clave, tipos){
  const out = new Set(["Actividad"]);
  const actual = (tipos.porClave && tipos.porClave[clave] || {}).label;
  if(actual) out.add(actual);
  const deFabrica = tipos.deFabrica && tipos.deFabrica[clave];
  if(deFabrica) Object.values(deFabrica).forEach(l=>{ if(l) out.add(l); });
  return [...out];
}
export function tituloSinPrefijo(summary, clave, tipos){
  const s = summary || "";
  for(const nombre of nombresDelTipo(clave, tipos)){
    const prefijo = `${nombre}: `;
    if(s.startsWith(prefijo)) return s.slice(prefijo.length);
  }
  return s;
}

/* ---------- Qué tipo es un evento escrito directo en Calendar ---------- */
// Un evento que se escribe en Calendar no trae tipo (la app le pega
// raActivityType solo a los que crea ella), y entraba siempre como «Otro».
// Ahora se lo deduce del título, de lo más seguro a lo menos; ante la
// duda queda en «Otro», que es lo de siempre:
//   1. Un título igual al de posteos que ya están (3 de cada 4 con el
//      mismo tipo, mirando los que nombra igual) → ese tipo.
//   2. Palabras de la vida de cada día (cena, vacaciones, deadline) → Otro.
//   3. Palabras de reunión → el tipo que el equipo les puso a sus
//      reuniones (el de la mayoría de los posteos que las nombran; en
//      2026 fue «Virtual»), o «Otro» si todavía no hay de dónde saberlo.
//   4. Palabras que dicen el tipo (curso, seminario, congreso, visita,
//      online…) en los cuatro idiomas.
//   5. Palabras que, en los posteos ya cargados, casi siempre van con un
//      mismo tipo (una sigla que siempre fue de Curso vuelve a serlo).
//   6. Un enlace de videollamada (Zoom, Meet, Teams, Webex) en el lugar o
//      en la descripción → Virtual.
//   7. Un título que es solo un lugar —y a lo sumo personas— → Visita.
// Lo que va entre paréntesis no cuenta (son las personas). Es la MISMA
// lógica que guessCalendarType() de index.html: la prueba diferencial las
// compara, con las mismas palabras y los mismos umbrales.
export const PRIORIDAD_DE_TIPOS = ["congreso","seminario","curso","visita","virtual"];
export const PALABRAS_DE_TIPO = {
  suelto: "deadline deadlines llamar llamada llamadas llamado llamados cena almuerzo almocinho lunch dinner cumpleanos casamiento boda vacaciones vacation holiday feriado vs",
  reunion: "reunion reuniones reuniao reunioes meeting meetings junta juntas kickoff kick feedback sync call פגישה פגישות שיחה שיחות ישיבה",
  congreso: "congreso congresos congress congresso congressos convencion convention כנס כנסים",
  seminario: "seminario seminarios seminar seminars charla charlas סמינר סמינרים",
  curso: "curso cursos course courses capacitacion capacitaciones capacitacao training workshop taller talleres certificacion certification קורס קורסים הכשרה",
  visita: "visita visitas visit visits visitar viaje viajes viagem viagens trip gira giras tour ביקור",
  virtual: "virtual online webinar webex zoom וובקס ווביניר אונליין וירטואלי",
};
const VIDEOLLAMADA = /zoom\.(us|com)\/|meet\.google\.com\/|teams\.(microsoft|live)\.com\/|webex\.com\/|whereby\.com\//i;
const CONJUNTOS = Object.fromEntries(Object.entries(PALABRAS_DE_TIPO).map(([k, v]) => [k, new Set(v.split(" "))]));
const CONECTORES = new Set("de del la el los las en in a e y o u and con with por para the of da do dos das no na nos nas al".split(" "));
export function palabrasDelTitulo(s){
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}
export function sinParentesis(s){
  return String(s || "").replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
}
// En hebreo la ו, ה, ב, ל, מ y ש se pegan a la palabra («בסמינר» = en el
// seminario): se prueba también sin esa primera letra.
export function esPalabraDe(clase, w){
  const set = CONJUNTOS[clase];
  return set.has(w) || (w.length > 2 && /^[\u0590-\u05ff]/.test(w) && "והבלמש".includes(w[0]) && set.has(w.slice(1)));
}
// Lo que enseñan los posteos que ya están: qué títulos se repiten, qué
// palabras casi siempre van con un tipo, qué tipo se les puso a las
// reuniones, y qué palabras son lugares o personas. Se arma una vez por
// lista de posteos y se vuelve a armar si la lista cambió de largo (el
// trabajo de la madrugada va sumando los posteos que crea).
const SABER_EN_MEMORIA = new WeakMap();
export function loQueEnsenan(posts){
  const hit = SABER_EN_MEMORIA.get(posts);
  if(hit && hit.n === posts.length) return hit.k;
  const lugares = new Set(), personas = new Set(), cuentas = new Map(), iguales = new Map(), reun = {};
  const suma = (mapa, clave, tipo) => { const c = mapa.get(clave) || {}; c[tipo] = (c[tipo] || 0) + 1; mapa.set(clave, c); };
  for(const p of posts){
    for(const sc of p.scopes || []){
      if(sc) [sc.country, sc.city].forEach(n => palabrasDelTitulo(n).forEach(w => lugares.add(w)));
    }
    for(const q of p.participants || []){
      if(q) palabrasDelTitulo(q.name).forEach(w => personas.add(w));
    }
    const tipo = p.activityType;
    if(tipo !== "otro" && !PRIORIDAD_DE_TIPOS.includes(tipo)) continue; // «Rutina» y los tipos que creó el admin no cuentan
    const todas = palabrasDelTitulo(sinParentesis(p.title));
    if(!todas.length) continue;
    suma(iguales, todas.join(" "), tipo);
    // Un título de reunión es del tipo que es por la palabra, no dice nada
    // de las demás: no entra a las palabras que se aprenden.
    if(todas.some(w => esPalabraDe("reunion", w))){ reun[tipo] = (reun[tipo] || 0) + 1; continue; }
    if(todas.some(w => esPalabraDe("suelto", w))) continue;
    for(const w of new Set(todas)){
      if(w.length < 2 || /^\d+$/.test(w) || CONECTORES.has(w)) continue;
      suma(cuentas, w, tipo);
    }
  }
  const fuertes = new Map();
  for(const [w, c] of cuentas){
    let total = 0, mejor = "", n = 0;
    for(const [tipo, v] of Object.entries(c)){ total += v; if(v > n){ n = v; mejor = tipo; } }
    if(mejor !== "otro" && total >= 3 && n / total >= 0.85) fuertes.set(w, { tipo: mejor, total });
  }
  let nReun = 0, tReun = "otro", cReun = 0;
  for(const [tipo, v] of Object.entries(reun)){ nReun += v; if(v > cReun){ cReun = v; tReun = tipo; } }
  const k = { lugares, personas, fuertes, iguales, reuniones: nReun >= 5 && cReun / nReun > 0.5 ? tReun : "otro" };
  SABER_EN_MEMORIA.set(posts, { n: posts.length, k });
  return k;
}
// `disponible(tipo)`: si el tipo existe y no lo archivó el admin. Uno
// que ya no se puede elegir no se asigna: queda «Otro».
export function tipoSegunElTitulo(titulo, k, disponible, conEnlace){
  const ok = tipo => (tipo === "otro" || disponible(tipo)) ? tipo : "otro";
  const ws = palabrasDelTitulo(sinParentesis(titulo));
  const igual = k.iguales.get(ws.join(" "));
  if(igual){
    let total = 0, mejor = "", n = 0;
    for(const [tipo, v] of Object.entries(igual)){ total += v; if(v > n){ n = v; mejor = tipo; } }
    if(n / total >= 0.75) return ok(mejor);
  }
  if(ws.some(w => esPalabraDe("suelto", w))) return "otro";
  if(ws.some(w => esPalabraDe("reunion", w))) return ok(k.reuniones);
  for(const tipo of PRIORIDAD_DE_TIPOS){
    if(ws.some(w => esPalabraDe(tipo, w))) return ok(tipo);
  }
  const votos = {};
  for(const w of ws){
    const f = k.fuertes.get(w);
    if(f) votos[f.tipo] = Math.max(votos[f.tipo] || 0, f.total);
  }
  const ordenados = Object.entries(votos).sort((a, b) => b[1] - a[1]);
  // Dos tipos que empatan (o casi) no se arriesgan.
  if(ordenados.length && (ordenados.length === 1 || ordenados[0][1] >= ordenados[1][1] * 2)) return ok(ordenados[0][0]);
  if(conEnlace) return ok("virtual");
  const claves = ws.filter(w => !CONECTORES.has(w) && !/^\d+$/.test(w));
  if(claves.length && claves.length <= 6 && claves.some(w => k.lugares.has(w)) &&
     claves.every(w => k.lugares.has(w) || k.personas.has(w))) return ok("visita");
  return "otro";
}
export function tipoInferidoDeCalendario(titulo, posts, tipos, ev){
  const conEnlace = !!ev && VIDEOLLAMADA.test(`${ev.location || ""} ${ev.description || ""}`);
  return tipoSegunElTitulo(titulo, loQueEnsenan(posts),
    tipo => !!(tipos.porClave && tipos.porClave[tipo]) && !tipos.porClave[tipo].archived, conEnlace);
}

// De un evento a (tipo, título), de lo más confiable a lo menos:
//   1. extendedProperties.raActivityType, que la app le pega a cada evento
//      que crea: es la clave del tipo, no cambia con el idioma.
//   2. El prefijo del texto: quien titula "Curso: Kashrut" está diciendo
//      el tipo, así que entra como Curso y no como "Otro".
//   3. Sin ninguna de las dos, se deduce del título y de los posteos que
//      ya están (tipoInferidoDeCalendario, arriba); si no hay de dónde,
//      "otro".
export function tipoYTituloImportados(ev, tipos, posts){
  const summary = String(ev.summary || "");
  const raType = ev.extendedProperties?.private?.raActivityType;
  if(raType && TIPOS_QUE_SINCRONIZAN.has(raType)){
    return { activityType: raType, title: tituloSinPrefijo(summary, raType, tipos) };
  }
  for(const clave of Object.keys(tipos.porClave || {})){
    if(!TIPOS_QUE_SINCRONIZAN.has(clave) || clave === "otro") continue;
    for(const nombre of nombresDelTipo(clave, tipos)){
      if(nombre === "Actividad") continue; // el genérico no dice el tipo
      if(summary.startsWith(`${nombre}: `)) return { activityType: clave, title: summary.slice(nombre.length + 2) };
    }
  }
  // "Actividad: X" sí se limpia, pero el prefijo no dice el tipo: es el
  // fallback de un tipo que el admin borró. Se deduce del resto.
  if(summary.startsWith("Actividad: ")){
    const title = summary.slice(11);
    return { activityType: tipoInferidoDeCalendario(title, posts || [], tipos, ev), title };
  }
  return { activityType: tipoInferidoDeCalendario(summary, posts || [], tipos, ev), title: summary };
}
export function elSummaryEsDe(summary, post, tipos){
  if(post.title === summary) return true;
  return nombresDelTipo(post.activityType, tipos).some(l => `${l}: ${post.title}` === summary);
}

// El id del posteo importado se deriva del id del evento: el poll corre en
// TODOS los navegadores abiertos, y dos que vieran el mismo evento nuevo
// con un segundo de diferencia lo crearían dos veces.
// Una huella corta y estable de un texto (FNV-1a, dos vueltas): la misma
// entrada da siempre la misma salida, en el navegador y en el servidor.
export function huellaDeId(s){
  let a = 0x811c9dc5, b = 0x9e3779b9;
  for(let i = 0; i < s.length; i++){
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 16777619) >>> 0;
    b = Math.imul(b ^ c, 2246822507) >>> 0;
  }
  return (a.toString(36).padStart(7, "0") + b.toString(36).padStart(7, "0")).slice(0, 12);
}
// Un id largo se cortaba a 59 y dos eventos con el mismo comienzo
// chocaban: el segundo no entraba nunca. Ver importedPostDocId en la app.
export function idDePosteoImportado(idDeEvento){
  const limpio = String(idDeEvento).replace(/[^A-Za-z0-9_-]/g, "");
  return "cal_" + (limpio.length <= 59 ? limpio : limpio.slice(0, 46) + "_" + huellaDeId(limpio));
}

/* ======================================================================
   La decisión
   ======================================================================
   Devuelve una lista de escrituras. Cada una es una de tres:
     { tipo:"actualizar", id, patch }
     { tipo:"comentar",   postId, datos }
     { tipo:"crear",      id, datos }
   Lista vacía = el evento se revisó y no hacía falta tocar nada (es el
   `return false` de applyCalendarEventToPosts).

   ctx: { tipos, t, fmtDate, hora, etiquetaDeRepeticion }
   Todo lo que depende de idioma, de reloj o de configuración entra por
   acá, para que la prueba diferencial pueda darle exactamente lo mismo a
   las dos implementaciones.
   ====================================================================== */
export function decidir(ev, posts, ctx){
  const { tipos, t, fmtDate, hora, etiquetaDeRepeticion } = ctx;
  const existente = posts.find(p => p.calendarEventId === ev.id);
  const acciones = [];
  const comentario = (postId, contenido, extra) => acciones.push({
    tipo:"comentar", postId,
    datos: { authorName:"Google Calendar", content:contenido, system:true, icon:"📅",
             scopes:[], images:[], links:[], ...(extra || {}) },
  });

  /* ---------- Se canceló o se borró en Calendar ---------- */
  if(ev.status === "cancelled"){
    // Una repetición suelta que se canceló (el resto de la serie sigue
    // viva): no hay posteo propio que cancelar — se anota la fecha en el
    // molde para que el Calendario no la dibuje.
    if(!existente && ev.recurringEventId){
      const molde = posts.find(p => p.calendarEventId === ev.recurringEventId);
      const saltearISO = fechaOriginalDeLaExcepcion(ev);
      if(molde && saltearISO && !(molde.recurrenceSkip || []).includes(saltearISO)){
        acciones.push({ tipo:"actualizar", id: molde.id,
          patch: { recurrenceSkip: (molde.recurrenceSkip || []).concat([saltearISO]).slice(-MAX_SALTEADAS) } });
      }
      return acciones;
    }
    if(existente && !existente.cancelled){
      acciones.push({ tipo:"actualizar", id: existente.id,
        patch: { cancelled:true, lastEditedAt: hora(), lastEditedBy:"Google Calendar" } });
      comentario(existente.id, t("Este evento se canceló o se borró directamente en Google Calendar."));
    }
    return acciones;
  }

  const { startDate, endDate, startTime, endTime } = fechasDelEvento(ev);
  if(!startDate) return acciones;
  // Los mismos topes que exige la base: lo que viene de Calendar no pasa
  // por el formulario, así que se recorta acá o la escritura se rechaza.
  const location = String(ev.location || "").slice(0, 200);
  const repeticionNueva = Array.isArray(ev.recurrence)
    ? ev.recurrence.slice(0, 10).map(r => String(r).slice(0, 500))
    : null;

  /* ---------- Un posteo que ya está vinculado: se actualiza ---------- */
  if(existente){
    const tituloNuevo = tituloSinPrefijo(ev.summary, existente.activityType, tipos).trim().slice(0, 140);
    const cambioTitulo = !!tituloNuevo && tituloNuevo !== existente.title;
    const cambioHora = (existente.startTime || "") !== (startTime || "") ||
                       (existente.endTime || "") !== (endTime || "");
    const cambioRepeticion = JSON.stringify(existente.recurrence || null) !== JSON.stringify(repeticionNueva);
    const cambio = existente.startDate !== startDate || existente.endDate !== endDate || cambioHora ||
                   (existente.location || "") !== location || cambioTitulo || cambioRepeticion;
    if(!cambio) return acciones;

    const partes = [];
    if(cambioTitulo) partes.push(t(`título ("{old}" → "{new}")`, { old: existente.title, new: tituloNuevo }));
    if(existente.startDate !== startDate || existente.endDate !== endDate || cambioHora){
      const antes = (existente.endDate || existente.startDate) !== existente.startDate
        ? `${fmtDate(existente.startDate)}–${fmtDate(existente.endDate)}` : fmtDate(existente.startDate);
      const ahora = endDate !== startDate ? `${fmtDate(startDate)}–${fmtDate(endDate)}` : fmtDate(startDate);
      partes.push(t("fecha ({old} → {new})", { old: antes, new: ahora }));
    }
    if((existente.location || "") !== location){
      partes.push(location ? t("lugar (ahora: {loc})", { loc: location }) : t("lugar (se quitó)"));
    }
    const patch = {
      startDate, endDate, date: startDate, startTime, endTime, location,
      lastEditedAt: hora(), lastEditedBy: "Google Calendar",
    };
    if(cambioTitulo) patch.title = tituloNuevo;
    if(cambioRepeticion){
      patch.recurrence = repeticionNueva;
      // Las fechas salteadas eran de la regla vieja: con otra regla dejan
      // de tener sentido y esconderían días que ahora sí existen.
      if(existente.recurrenceSkip && existente.recurrenceSkip.length) patch.recurrenceSkip = [];
      partes.push(repeticionNueva
        ? t("repetición ({r})", { r: etiquetaDeRepeticion({ recurrence: repeticionNueva }) || t("cambió") })
        : t("dejó de repetirse"));
    }
    acciones.push({ tipo:"actualizar", id: existente.id, patch });
    comentario(existente.id, t("Se actualizó desde Google Calendar: {changes}.", { changes: partes.join(", ") }));
    return acciones;
  }

  /* ---------- Una repetición suelta que se corrió de día ---------- */
  // Se anota en el molde y NO nace como posteo aparte: así los comentarios
  // de ese día siguen colgando de la serie, igual que cuando se corre
  // desde la app.
  if(ev.recurringEventId){
    const molde = posts.find(p => p.calendarEventId === ev.recurringEventId);
    const origISO = fechaOriginalDeLaExcepcion(ev);
    if(molde && origISO){
      const mudanzas = mudanzasDe(molde);
      const actual = mudanzas[origISO] || origISO;
      if(actual === startDate) return acciones; // ya está donde dice Calendar
      const nuevas = { ...mudanzas };
      if(startDate === origISO) delete nuevas[origISO];
      else nuevas[origISO] = startDate;
      if(Object.keys(nuevas).length > MAX_MUDANZAS) return acciones;
      acciones.push({ tipo:"actualizar", id: molde.id,
        patch: { recurrenceMoves: nuevas, lastEditedAt: hora(), lastEditedBy:"Google Calendar" } });
      comentario(molde.id, startDate === origISO
        ? t("Vuelve a su día de siempre: {d}.", { d: fmtDate(origISO) })
        : t("Esta vez no se hace el {a}: pasa al {b}.", { a: fmtDate(origISO), b: fmtDate(startDate) }),
        { occ: origISO });
      return acciones;
    }
  }

  /* ---------- ¿Es un posteo de la app que perdió su vínculo? ---------- */
  // Antes de importar como nuevo: se busca por el id que la app le pega al
  // evento, o por título+fecha+tipo. Si aparece, se vincula en vez de
  // duplicar — los posteos no se pueden borrar después.
  const raPostId = ev.extendedProperties?.private?.raPostId;
  const summary = String(ev.summary || "");
  // Uno cargado "sin pasar a Google Calendar" no se vincula: no tiene
  // evento a propósito, aunque haya otro con el mismo título y fecha.
  const huerfano = posts.find(p => !p.calendarEventId && !p.cancelled && !p.sinCalendar && (
    (raPostId && p.id === raPostId) ||
    (p.startDate === startDate && TIPOS_QUE_SINCRONIZAN.has(p.activityType) &&
      elSummaryEsDe(summary, p, tipos))
  ));
  if(huerfano){
    acciones.push({ tipo:"actualizar", id: huerfano.id, patch: { calendarEventId: ev.id } });
    return acciones;
  }

  /* ---------- Un evento nuevo, escrito directo en Calendar ---------- */
  // Entra como posteo simple y SIN alcance — no "Toda LatAm", que sumaría
  // a los 43 países en los conteos antes de que alguien lo revise. Queda
  // "sin definir" hasta que alguien le ponga el lugar real.
  const { activityType, title } = tipoYTituloImportados(ev, tipos, posts);
  acciones.push({ tipo:"crear", id: idDePosteoImportado(ev.id), datos: {
    title: (title || t("(Sin título)")).slice(0, 140),
    // Sin relleno, igual que en index.html (ver la prueba diferencial):
    // un evento sin descripción no tiene contenido, y está bien.
    content: String(ev.description || "").slice(0, 5000),
    startDate, endDate, date: startDate, startTime, endTime,
    organizer: String(ev.organizer?.displayName || ev.organizer?.email || "").slice(0, 140),
    location,
    activityType,
    scopes: [], images: [], links: [],
    authorName: "Google Calendar", authorEmail: "",
    calendarEventId: ev.id,
    // La regla tal cual la manda Google, para expandirla al dibujar el
    // Calendario. Un solo posteo por serie.
    ...(repeticionNueva && repeticionNueva.length ? { recurrence: repeticionNueva } : {}),
  }});
  return acciones;
}
