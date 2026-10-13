/* ======================================================================
   Singular y plural en los textos con cantidad (13/10/2026)

   Después de «hace 1 días» (dias_singular_test.mjs) un barrido encontró
   otros textos que con 1 salían mal: «1 pedidos de acceso», «0 de 1 hitos»,
   «1 planificadas», «1 países con actividad», «1 posteos en total»… Esta
   prueba arma, en los cuatro idiomas, lugares con exactamente un integrante,
   un hito, un país, una actividad planificada, y mira que cada texto salga
   en singular; y con varios, que siga saliendo en plural. En el código es
   siempre la misma forma: `n === 1 ? t(singular…) : t(plural…)`.
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, BASE, PERS, post, ciudad, dia, hace, tab, irAdmin, admin } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w); if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, extra) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${extra ? "\n   " + extra : ""}`); } };

const anio = dia(0).slice(0, 4);
const manana = dia(-1);
const finDeAnio = manana.slice(0, 4) !== anio;   // el 31/12 «mañana» ya es de otro año: esa parte no se mide ese día

// Una instalación mínima: solo la administradora, con un único posteo de hoy.
const minima = () => {
  const b = BASE();
  b.members = [{ ...PERS[0], approved_at: "2025-01-10T12:00:00Z", calendar_shared: true, last_seen_at: hace(0) }];
  b.access_requests = [{ email: "nueva@gmail.com", name: "Nueva Persona", status: "pending", requested_at: hace(1) }];
  b.audit_log = [{ id: "a3", type: "login", actor_email: ADMIN, actor_name: PERS[0].name, created_at: hace(0.01) }];
  b.posts = [post({ id: "uno", title: "Visita a Rosario", d: 0, a: 0, type: "visita", scopes: [ciudad("Argentina", "Rosario")], content: "" })];
  // Cargada hace rato (el mes pasado), para que «cargadas este mes» siga valiendo 1.
  if(!finDeAnio) b.posts.push(post({ id: "luego", title: "Visita planificada", start: manana, end: manana, created: hace(40), a: 0, type: "visita", scopes: [ciudad("Argentina", "Rosario")], content: "" }));
  b.replies = [];
  return b;
};
// Con una segunda persona que nunca entró: «1 no entra hace más de 30 días».
const conAusente = () => {
  const b = minima();
  b.members.push({ ...PERS[1], approved_at: "2025-01-10T12:00:00Z", calendar_shared: false, last_seen_at: hace(60) });
  return b;
};
// Un único posteo en toda la base.
const unPosteo = () => { const b = minima(); b.posts = b.posts.slice(0, 1); return b; };
// Un proyecto con un único hito sin tildar.
const conProyecto = () => {
  const b = minima();
  b.posts.push(post({ id: "pr1", title: "Plan de cámaras", d: 3, created: hace(40), a: 0, type: "visita", scopes: [ciudad("Argentina", "Rosario")], content: "",
    extra: { is_project: true, project_status: "open", milestones: [{ id: "h1", label: "Presupuesto", date: dia(-2), done: false, owners: [] }] } }));
  return b;
};

const E = {
  en: { integrante: /\b1\s*member\b/i, entraron: /\b1\s*signed in this month/i, cargadas: /\b1\s*activity logged this month/i, ausente: /\b1\s*hasn't signed in for 30\+ days/i,
        pedido: "1 access request waiting", hito: /0 of 1 milestone(?!s)/, pais: /\b1\s*country with activity/i, ciudad: /\b1\s*different city/i, persona: /\b1\s*person who logged/i,
        plan: /\+ 1 planned/, posteo: "1 post in total.", plural: /\b5\s*members\b/i },
  es: { integrante: /\b1\s*integrante(?!s)/i, entraron: /\b1\s*entró este mes/i, cargadas: /\b1\s*actividad cargada este mes/i, ausente: /\b1\s*no entra hace más de 30 días/i,
        pedido: "1 pedido de acceso esperando", hito: /0 de 1 hito(?!s)/, pais: /\b1\s*país con actividad/i, ciudad: /\b1\s*ciudad distinta/i, persona: /\b1\s*persona que cargó/i,
        plan: /\+ 1 planificada(?!s)/, posteo: "1 posteo en total.", plural: /\b5\s*integrantes\b/i },
  pt: { integrante: /\b1\s*integrante(?!s)/i, entraron: /\b1\s*entrou este mês/i, cargadas: /\b1\s*atividade carregada este mês/i, ausente: /\b1\s*não entra há mais de 30 dias/i,
        pedido: "1 pedido de acesso esperando", hito: /0 de 1 marco(?!s)/, pais: /\b1\s*país com atividade/i, ciudad: /\b1\s*cidade diferente/i, persona: /\b1\s*pessoa que carregou/i,
        plan: /\+ 1 planejada(?!s)/, posteo: "1 postagem no total.", plural: /\b5\s*integrantes\b/i },
  he: { integrante: /1\s*חבר\/ת צוות/, entraron: /1\s*נכנס\/ה החודש/, cargadas: /1\s*פעילות אחת נרשמה החודש/, ausente: /1\s*לא נכנס\/ה יותר מ-30 יום/,
        pedido: "בקשת גישה אחת ממתינה", hito: /0 מתוך אבן דרך אחת/, pais: /1\s*מדינה עם פעילות/, ciudad: /1\s*עיר שונה/, persona: /1\s*אדם שרשם/,
        plan: /\+ 1 מתוכננת/, posteo: "פוסט אחד בסך הכול.", plural: /5\s*חברי צוות/ },
};
// Lo que nunca tiene que aparecer: un 1 pegado a un plural.
const MALOS = /\b1 (members|activities|milestones|hitos|marcos|planificadas|planejadas|países|countries|ciudades|cities|personas|people|pedidos|requests|posteos|posts|postagens|integrantes|entraron|entraram|guardados)\b|\b1 (מדינות|ערים|מתוכננות|אנשים|בקשות)|\{n\}|\(s\)|NaN|undefined/;

const b = await abrirNavegador();
const abrir = async (lang, base) => entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1280, height: 900 }, lang, base });
const texto = (p, sel) => p.evaluate(s => (document.querySelector(s)?.innerText || "").replace(/\s+/g, " "), sel);
const pagina = p => p.evaluate(() => document.body.innerText.replace(/\s+/g, " "));

for(const lang of ["en", "es", "pt", "he"]){
  const X = E[lang];

  // Administración → Resumen, con un solo integrante.
  {
    const { p, errores } = await abrir(lang, minima());
    const badge = await p.evaluate(() => document.querySelector(".avatar-pending")?.title || "");
    eq(`${lang}: el globito de pedidos de acceso dice «${X.pedido}»`, badge, X.pedido);
    await irAdmin(p);
    const cifras = await texto(p, ".admin-cifras");
    ok(`${lang}: «1 integrante» en singular`, X.integrante.test(cifras), cifras);
    ok(`${lang}: «1 entró este mes» en singular`, X.entraron.test(cifras), cifras);
    ok(`${lang}: «1 actividad cargada este mes» en singular`, X.cargadas.test(cifras), cifras);
    ok(`${lang}: Resumen sin un 1 pegado a un plural`, !MALOS.test(await pagina(p)), (await pagina(p)).match(MALOS)?.[0]);
    eq(`${lang}: sin errores de página (Resumen)`, errores, []);
    await p.close();
  }
  // Tipos de actividad: la nota al pie con un único posteo.
  {
    const { p } = await abrir(lang, unPosteo());
    await irAdmin(p); await admin(p, "preferencias", "tipos");
    ok(`${lang}: «${X.posteo}» en la nota de Tipos de actividad`, (await pagina(p)).includes(X.posteo));
    await p.close();
  }
  // Una persona que no entra hace más de 30 días.
  {
    const { p } = await abrir(lang, conAusente());
    await irAdmin(p);
    const cifras = await texto(p, ".admin-cifras");
    ok(`${lang}: «1 no entra hace más de 30 días» en singular`, X.ausente.test(cifras), cifras);
    await p.close();
  }
  // Con varios integrantes (los 5 de siempre) sigue el plural.
  {
    const { p } = await abrir(lang, BASE());
    await irAdmin(p);
    ok(`${lang}: con cinco integrantes sigue en plural`, X.plural.test(await texto(p, ".admin-cifras")), await texto(p, ".admin-cifras"));
    await p.close();
  }
  // Proyectos: un único hito.
  {
    const { p, errores } = await abrir(lang, conProyecto());
    await tab(p, "proyectos"); await p.waitForTimeout(400);
    const t1 = await pagina(p);
    ok(`${lang}: Proyectos dice «${X.hito}» con un solo hito`, X.hito.test(t1), t1.slice(0, 400));
    eq(`${lang}: sin errores de página (Proyectos)`, errores, []);
    await p.close();
  }
  // Reportes: un solo país, una sola ciudad, una sola persona y una planificada.
  {
    const { p, errores } = await abrir(lang, minima());
    await tab(p, "reportes"); await p.waitForTimeout(400);
    await p.selectOption("#repAnio", anio).catch(() => {}); await p.waitForTimeout(300);
    const kpis = await texto(p, ".rep-kpis, .rep-tira, #viewRoot");
    ok(`${lang}: Reportes dice «1 país con actividad»`, X.pais.test(kpis), kpis.slice(0, 500));
    ok(`${lang}: Reportes dice «1 ciudad distinta»`, X.ciudad.test(kpis), kpis.slice(0, 500));
    ok(`${lang}: Reportes dice «1 persona que cargó»`, X.persona.test(kpis), kpis.slice(0, 500));
    if(!finDeAnio) ok(`${lang}: Reportes dice «+ 1 planificada»`, X.plan.test(kpis), kpis.slice(0, 500));
    ok(`${lang}: Reportes sin un 1 pegado a un plural`, !MALOS.test(await pagina(p)), (await pagina(p)).match(MALOS)?.[0]);
    eq(`${lang}: sin errores de página (Reportes)`, errores, []);
    await p.close();
  }
}
await b.close();
console.log(`${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
