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

// De qué fecha de la serie es esta excepción. Google le da a cada una un
// id "<idDelMolde>_<fechaOriginalUTC>"; originalStartTime dice lo mismo y
// queda como respaldo por si el id no viene con esa forma.
export function fechaOriginalDeLaExcepcion(ev){
  if(!ev || !ev.recurringEventId) return null;
  return fechaDeRrule(String(ev.id || "").slice(String(ev.recurringEventId).length + 1)) ||
    (ev.originalStartTime && fechaDeRrule(String(ev.originalStartTime.date || ev.originalStartTime.dateTime || "").replace(/-/g, ""))) ||
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
// De un evento a (tipo, título), de lo más confiable a lo menos:
//   1. extendedProperties.raActivityType, que la app le pega a cada evento
//      que crea: es la clave del tipo, no cambia con el idioma.
//   2. El prefijo del texto: quien titula "Curso: Kashrut" está diciendo
//      el tipo, así que entra como Curso y no como "Otro".
export function tipoYTituloImportados(ev, tipos){
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
  // "Actividad: X" sí se limpia, pero sin tipo: es el fallback de un tipo
  // que el admin borró, no dice cuál era.
  if(summary.startsWith("Actividad: ")) return { activityType:"otro", title: summary.slice(11) };
  return { activityType:"otro", title: summary };
}
export function elSummaryEsDe(summary, post, tipos){
  if(post.title === summary) return true;
  return nombresDelTipo(post.activityType, tipos).some(l => `${l}: ${post.title}` === summary);
}

// El id del posteo importado se deriva del id del evento: el poll corre en
// TODOS los navegadores abiertos, y dos que vieran el mismo evento nuevo
// con un segundo de diferencia lo crearían dos veces.
export function idDePosteoImportado(idDeEvento){
  return "cal_" + String(idDeEvento).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 59);
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
  const huerfano = posts.find(p => !p.calendarEventId && !p.cancelled && (
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
  const { activityType, title } = tipoYTituloImportados(ev, tipos);
  acciones.push({ tipo:"crear", id: idDePosteoImportado(ev.id), datos: {
    title: (title || t("(Sin título)")).slice(0, 140),
    content: String(ev.description || t("Creado automáticamente desde Google Calendar.")).slice(0, 5000),
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
