/* ======================================================================
   Dos personas editando el mismo evento no se pisan (auditoría del 20/11/2026, Y2; D20-A)

   Antes, el formulario de «Editar» guardaba TODOS los campos con lo que tenían al abrirse: si
   otra persona cambiaba la fecha, anotaba el lugar y subía un archivo mientras tanto, al guardar
   (aunque fuera una letra del título) se le perdía todo, y el hilo decía solo «título».
   Ahora:
   - se guarda solo lo que esta persona cambió; lo de la otra queda;
   - el resumen del hilo cuenta solo lo suyo;
   - si la otra persona cambió justo lo MISMO, se pregunta antes de pisarlo («Guardar lo mío» /
     «Cancelar», y al cancelar el formulario sigue abierto con lo escrito).
   La otra persona se simula con el aviso de tiempo real (window.__sb.emitir): la app se entera
   como se enteraría en la vida real.

   Con la app de verdad y el Supabase de mentira (app_de_mentira.mjs).
   INDEX=/ruta/a/index-roto.html corre esto contra otra copia (para ver que falla).
   ====================================================================== */
import { abrirNavegador, entrar, ADMIN, click, dia } from "./app_de_mentira.mjs";

let pass = 0, fail = 0;
const eq = (n, g, w) => { const a = JSON.stringify(g), x = JSON.stringify(w);
  if(a === x) pass++; else { fail++; console.log(`✗ ${n}\n   esperado: ${x}\n   obtenido: ${a}`); } };
const ok = (n, c, d) => { if(c) pass++; else { fail++; console.log(`✗ ${n}${d ? "\n   " + d : ""}`); } };

const b = await abrirNavegador();
const fila = p => p.evaluate(() => { const r = window.__sb.tablas.posts.find(x => x.id === "p6"); return { title: r.title, start: r.start_date, lugar: r.location || null, archivos: (r.files || []).map(f => f.name) }; });
const abrirEditar = async p => { await click(p, '.post[data-post-id="p6"] [data-action="toggle-post-menu"]'); await click(p, '.post[data-post-id="p6"] [data-action="edit-post"]'); await p.waitForTimeout(600); };
// La otra persona guarda algo y la app de esta se entera (tiempo real).
const otraPersona = (p, cambios) => p.evaluate(c => { const r = window.__sb.tablas.posts.find(x => x.id === "p6"); Object.assign(r, c); window.__sb.emitir("posts", "UPDATE", JSON.parse(JSON.stringify(r))); }, cambios);
const hilo = p => p.evaluate(() => window.__sb.tablas.replies.filter(r => r.post_id === "p6" && r.system).map(r => r.content));
const FECHA_DE_B = dia(-25);

// 1) Lo de la otra persona se conserva.
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 } });
  await p.waitForTimeout(600);
  const antes = await fila(p);
  await abrirEditar(p);
  await otraPersona(p, { start_date: FECHA_DE_B, end_date: FECHA_DE_B, date: FECHA_DE_B, location: "Hotel Ibis, Av. Paulista 100",
    files: [{ path: "posts/p6/plan.docx", name: "Plan de viaje SP.docx", doc: "plan", uploaded_at: new Date().toISOString() }, { path: "posts/p6/reporte-b.docx", name: "Reporte de B.docx", doc: "reporte", uploaded_at: new Date().toISOString() }] });
  await p.waitForTimeout(300);
  await p.fill("#cTitle", "Visita a San Pablo (corregido)"); await p.click('#postForm button[type="submit"]'); await p.waitForTimeout(1500);
  const f = await fila(p);
  eq("el título nuevo se guardó", f.title, "Visita a San Pablo (corregido)");
  eq("la fecha que cambió la otra persona se conserva", f.start, FECHA_DE_B);
  eq("el lugar que anotó la otra persona se conserva", f.lugar, "Hotel Ibis, Av. Paulista 100");
  eq("el archivo que subió la otra persona se conserva", f.archivos, ["Plan de viaje SP.docx", "Reporte de B.docx"]);
  const h = await hilo(p);
  ok("el hilo cuenta solo el título", h.length === 1 && /título/.test(h[0]) && !/fecha|lugar/i.test(h[0]), JSON.stringify(h));
  ok("no preguntó nada (no se pisó nada)", await p.evaluate(() => { const o = document.getElementById("confirmOk"); return !o || !o.offsetParent; }));
  void antes; await p.close(); }

// 2) Si la otra persona cambió lo MISMO: pregunta; «Cancelar» no pisa nada y deja el formulario abierto.
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 } });
  await p.waitForTimeout(600);
  await abrirEditar(p);
  await otraPersona(p, { title: "Visita a San Pablo y Campinas" });
  await p.waitForTimeout(300);
  await p.fill("#cTitle", "Visita a San Pablo (mi título)"); await p.click('#postForm button[type="submit"]'); await p.waitForTimeout(600);
  const texto = await p.evaluate(() => (document.querySelector("#confirmOk") && document.querySelector("#confirmOk").closest("[role=dialog], .modal, .confirm") ? document.querySelector("#confirmOk").closest("[role=dialog], .modal, .confirm").innerText : document.body.innerText).replace(/\s+/g, " "));
  ok("pregunta si se pisa lo mismo, y nombra el título", /Mientras editabas, otra persona cambió el título/.test(texto), texto.slice(0, 200));
  eq("el botón dice «Guardar lo mío»", await p.$eval("#confirmOk", e => e.textContent.trim()), "Guardar lo mío");
  await p.click("#confirmCancel"); await p.waitForTimeout(500);
  eq("al cancelar, la base queda con lo de la otra persona", (await fila(p)).title, "Visita a San Pablo y Campinas");
  ok("y el formulario sigue abierto con lo que se había escrito", await p.evaluate(() => { const f = document.querySelector("#postForm"); return !!f.offsetParent && document.getElementById("cTitle").value === "Visita a San Pablo (mi título)"; }));
  await p.click('#postForm button[type="submit"]'); await p.waitForTimeout(600);
  await p.click("#confirmOk"); await p.waitForTimeout(1500);
  eq("al guardar igual, queda lo mío", (await fila(p)).title, "Visita a San Pablo (mi título)");
  await p.close(); }

// 3) Sin que nadie más toque nada, todo anda como siempre (un solo cambio, sin preguntas).
{ const { p } = await entrar(b, ADMIN, "Benny Rosenthal", { viewport: { width: 1440, height: 900 } });
  await p.waitForTimeout(600);
  await abrirEditar(p);
  await p.fill("#cTitle", "Visita a San Pablo (v2)"); await p.click('#postForm button[type="submit"]'); await p.waitForTimeout(1500);
  const f = await fila(p);
  eq("una edición sin nadie más se guarda directo", f.title, "Visita a San Pablo (v2)");
  eq("y sin tocar lo demás", [f.lugar, f.archivos], [null, ["Plan de viaje SP.docx"]]);
  await p.close(); }
await b.close();
console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail ? 1 : 0);
