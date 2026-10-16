// Panel del coach: tablero, afiliados (perfil, rutina, nutrición, progreso, mensaje), biblioteca y ajustes
import {
  esc, $, $$, iso, fmtDate, fmtRest, fmtNum, WEEKDAYS, SET_TYPES, GROUPS, REST_OPTIONS, MEAL_NAMES, ACTIVITY, GOALS, FOODS,
  currentWeek, computeStreak, weekAdherence, sessionTonnage, calcTargets, mealTotals, foodMacros, firstName, addDays, daysBetween, personalBests,
} from "./util.js";
import { toast, modal, confirmDialog, copyText, lineChart } from "./ui.js";

export async function renderCoach(app, ctx, parts) {
  const section = parts[0] || "";
  const nav = [["", "Afiliados"], ["ejercicios", "Ejercicios"], ["ajustes", "Ajustes"]];
  const current = section === "afiliado" ? "" : section;
  app.innerHTML = `${ctx.demoBand()}
  <header class="topbar"><div class="wrap">
    <a class="brand" href="#/coach">${ctx.brandMark()}</a>
    <nav class="topnav" aria-label="Panel">${nav.map(([k, l]) => `<a href="#/coach${k ? "/" + k : ""}" ${k === current ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
    <button class="btn-quiet btn-sm" id="logout">Salir</button>
  </div></header>
  <main class="wrap page" id="view"><div class="loading">Cargando</div></main>`;
  ctx.bindDemoBand();
  $("#logout").onclick = ctx.logout;
  const view = $("#view");
  if (section === "afiliado") return memberDetail(view, ctx, parts[1], parts[2] || "resumen");
  if (section === "ejercicios") return library(view, ctx);
  if (section === "ajustes") return settingsView(view, ctx);
  return dashboard(view, ctx);
}

const accessLink = () => `${location.origin}${location.pathname}#/ingresar`;
const waMessage = (m) =>
  `Hola ${firstName(m.name)}, bienvenido al equipo. Ya tienes acceso a tu plan personalizado.\n\n1. Entra a: ${accessLink()}\n2. Escribe tu código: ${m.code}\n3. La primera vez creas tu contraseña.\n\nCualquier duda me escribes por aquí.`;

function memberStatus(m) {
  if (!m.active) return `<span class="pill">Pausado</span>`;
  if (!m.claimed) return `<span class="pill warn dot">Sin activar</span>`;
  if (!m.anamnesis) return `<span class="pill warn dot">Falta cuestionario</span>`;
  if (!m.program?.days?.length) return `<span class="pill bad dot">Sin rutina</span>`;
  return `<span class="pill ok dot">Activo</span>`;
}

// ------------------------------------------------------------ Tablero
async function dashboard(view, ctx) {
  const { api } = ctx;
  const [members, act] = await Promise.all([api.listMembers(), api.coachActivity(60)]);
  const t = iso();
  const rows = members.map((m) => {
    const ss = act.sessions.filter((s) => s.member_id === m.id);
    const ab = act.checkins.filter((c) => c.member_id === m.id && c.kind === "absence");
    const last = ss.filter((s) => s.completed).map((s) => s.date).sort().pop();
    return { m, streak: computeStreak(m.program, ss, ab), adh: weekAdherence(m.program, ss), last };
  });
  const active = rows.filter((r) => r.m.active);
  const weekDone = active.reduce((a, r) => a + r.adh.done, 0), weekPlan = active.reduce((a, r) => a + r.adh.planned, 0);

  const alerts = [];
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  for (const r of active) {
    const m = r.m, link = `#/coach/afiliado/${m.id}`;
    if (m.anamnesis && !m.program?.days?.length) alerts.push(["bad", `<b>${esc(m.name)}</b> ya llenó el cuestionario y está esperando su rutina.`, `${link}/rutina`, "Armar rutina"]);
    else if (!m.claimed) alerts.push(["", `<b>${esc(m.name)}</b> todavía no activa su acceso.`, link, "Reenviar código"]);
    else if (m.program?.days?.length && (!r.last || daysBetween(r.last, t) >= 4)) alerts.push(["", `<b>${esc(m.name)}</b> no registra entrenamiento ${r.last ? `desde el ${fmtDate(r.last)}` : "todavía"}.`, `${link}/progreso`, "Ver progreso"]);
  }
  const recent = act.checkins.filter((c) => byId[c.member_id] && daysBetween(c.date, t) <= 7).sort((a, b) => b.date.localeCompare(a.date));
  for (const c of recent) {
    const m = byId[c.member_id], link = `#/coach/afiliado/${m.id}/progreso`;
    if (c.kind === "absence") alerts.push(["info", `<b>${esc(m.name)}</b> no pudo entrenar el ${fmtDate(c.date, true)}: ${esc(c.data?.reason || "")}${c.data?.note ? ` · “${esc(c.data.note)}”` : ""}`, link, "Ver"]);
    if (c.kind === "offplan") alerts.push(["info", `<b>${esc(m.name)}</b> se salió del plan: ${esc(c.data?.what || "")} (${esc(c.data?.feeling || "")}).`, link, "Ver"]);
    if (c.kind === "weekly" && (+c.data?.energy <= 2 || +c.data?.stress >= 4)) alerts.push(["", `<b>${esc(m.name)}</b> reportó ${+c.data?.energy <= 2 ? "energía baja" : "estrés alto"} en su check-in${c.data?.note ? `: “${esc(c.data.note)}”` : "."}`, link, "Ver"]);
  }
  for (const s of act.sessions.filter((s) => s.completed && daysBetween(s.date, t) <= 5 && (s.note || (s.feeling && s.feeling <= 2))))
    if (byId[s.member_id]) alerts.push([s.feeling <= 2 ? "" : "info", `<b>${esc(byId[s.member_id].name)}</b> · ${fmtDate(s.date)}: ${s.note ? `“${esc(s.note)}”` : "se sintió mal en la sesión"}${s.feeling ? ` (${s.feeling}/5)` : ""}`, `#/coach/afiliado/${s.member_id}/progreso`, "Ver"]);

  view.innerHTML = `<div class="stack-lg">
    <div class="row between"><div class="stack" style="gap:6px"><div class="eyebrow">${fmtDate(t, true)}</div><h1>Tu equipo</h1></div>
      <button class="btn-accent" id="new">+ Nuevo afiliado</button></div>
    <div class="kpis">
      <div class="kpi"><b>${active.length}</b><span>Afiliados activos</span></div>
      <div class="kpi"><b>${weekDone}<span class="muted" style="font-size:20px"> / ${weekPlan}</span></b><span>Sesiones esta semana</span></div>
      <div class="kpi"><b>${weekPlan ? Math.round((weekDone / weekPlan) * 100) : 0}%</b><span>Cumplimiento de la semana</span></div>
      <div class="kpi"><b>${alerts.length}</b><span>Cosas por revisar</span></div>
    </div>
    <section class="stack"><h2>Por revisar</h2>
      ${alerts.length ? `<div class="stack" style="gap:8px">${alerts.slice(0, 14).map(([k, html, href, cta]) => `<div class="alert ${k}"><span class="small">${html}</span><a class="btn btn-ghost btn-sm" href="${href}">${cta}</a></div>`).join("")}</div>`
        : `<div class="empty">Todo al día. Nadie necesita atención en este momento.</div>`}
    </section>
    <section class="stack"><div class="row between"><h2>Afiliados</h2><input id="q" type="search" placeholder="Buscar por nombre" style="max-width:260px" aria-label="Buscar afiliado"></div>
      ${members.length ? `<div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Estado</th><th>Objetivo</th><th class="num">Racha</th><th class="num">Semana</th><th>Última sesión</th><th>Código</th></tr></thead><tbody id="mrows">
        ${rows.sort((a, b) => a.m.name.localeCompare(b.m.name, "es")).map(({ m, streak, adh, last }) => `<tr class="clickable" data-go="${m.id}" data-name="${esc(m.name.toLowerCase())}">
          <td><b>${esc(m.name)}</b></td><td>${memberStatus(m)}</td><td class="small">${esc(m.profile?.goal || "—")}</td>
          <td class="num">${streak}</td><td class="num">${adh.planned ? `${adh.done}/${adh.planned}` : "—"}</td>
          <td class="small">${last ? fmtDate(last) : "—"}</td><td class="mono small">${esc(m.code)}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">Crea tu primer afiliado con “+ Nuevo afiliado”. Recibirá un código para entrar.</div>`}
    </section></div>`;

  $$("[data-go]", view).forEach((tr) => (tr.onclick = () => (location.hash = `#/coach/afiliado/${tr.dataset.go}`)));
  $("#q")?.addEventListener("input", (e) => { const q = e.target.value.toLowerCase(); $$("#mrows tr").forEach((tr) => (tr.hidden = !tr.dataset.name.includes(q))); });
  $("#new").onclick = () => newMember(ctx);
}

async function newMember(ctx) {
  const m = await modal({
    title: "Nuevo afiliado", submitLabel: "Crear y generar código",
    body: `<label class="field" for="n-name">Nombre completo<input id="n-name" required autocomplete="off"></label>
      <div class="fields">
        <label class="field" for="n-goal">Objetivo<select id="n-goal">${["Pérdida de grasa", "Hipertrofia", "Recomposición", "Fuerza", "Salud y bienestar", "Rendimiento deportivo"].map((o) => `<option>${o}</option>`).join("")}</select></label>
        <label class="field" for="n-plan">Plan<select id="n-plan">${["Asesoría online", "Asesoría + seguimiento semanal", "Personalizado 1 a 1"].map((o) => `<option>${o}</option>`).join("")}</select></label>
      </div>
      <label class="field" for="n-phone">WhatsApp (opcional)<input id="n-phone" inputmode="tel"></label>`,
    onSubmit: async (f) => {
      const name = f.querySelector("#n-name").value.trim();
      if (!name) throw new Error("Escribe el nombre del afiliado.");
      return ctx.api.createMember({ name, profile: { goal: f.querySelector("#n-goal").value, plan: f.querySelector("#n-plan").value, phone: f.querySelector("#n-phone").value.trim() } });
    },
  });
  if (m) { toast(`Afiliado creado con código ${m.code}`, "ok"); location.hash = `#/coach/afiliado/${m.id}`; }
}

// ------------------------------------------------------------ Detalle de afiliado
async function memberDetail(view, ctx, id, tab) {
  const { api } = ctx;
  const m = await api.getMember(id);
  if (!m) { view.innerHTML = `<div class="empty">Este afiliado no existe. <a href="#/coach">Volver</a></div>`; return; }
  const tabs = [["resumen", "Resumen"], ["rutina", "Rutina"], ["nutricion", "Nutrición"], ["progreso", "Progreso"], ["mensaje", "Mensaje"]];
  view.innerHTML = `<div class="stack-lg">
    <div class="stack" style="gap:14px">
      <a href="#/coach" class="small muted">← Todos los afiliados</a>
      <div class="row between" style="align-items:flex-end">
        <div class="stack" style="gap:6px"><div class="row">${memberStatus(m)}<span class="eyebrow">${esc(m.profile?.plan || "")}</span></div><h1>${esc(m.name)}</h1></div>
        <div class="row">
          <button class="btn-ghost btn-sm" id="toggle">${m.active ? "Pausar acceso" : "Reactivar acceso"}</button>
          <button class="btn-danger btn-sm" id="del">Eliminar</button>
        </div>
      </div>
      <div class="access-box">
        <div class="stack" style="gap:4px"><span class="eyebrow">Código de acceso</span><code>${esc(m.code)}</code></div>
        <div class="stack" style="gap:4px;flex:1;min-width:200px"><span class="small muted">${m.claimed ? "Ya activó su acceso con contraseña." : "Aún no lo activa. Envíale el mensaje por WhatsApp."}</span></div>
        <div class="row"><button class="btn-accent btn-sm" id="wa">Copiar mensaje de bienvenida</button>
          ${m.profile?.phone ? `<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/57${esc(String(m.profile.phone).replace(/\D/g, "").replace(/^57(?=\d{10}$)/, ""))}?text=${encodeURIComponent(waMessage(m))}">Abrir WhatsApp</a>` : ""}
          <button class="btn-ghost btn-sm" id="regen">Generar código nuevo</button></div>
      </div>
    </div>
    <nav class="tabs" aria-label="Secciones del afiliado">${tabs.map(([k, l]) => `<a href="#/coach/afiliado/${m.id}/${k}" ${k === tab ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
    <div id="tab"></div></div>`;

  $("#wa").onclick = () => copyText(waMessage(m));
  $("#regen").onclick = async () => {
    if (!(await confirmDialog("Generar código nuevo", `El código ${m.code} dejará de funcionar y ${firstName(m.name)} tendrá que activar el nuevo creando otra contraseña. Úsalo si perdió el acceso o si quieres cortar una sesión.`, "Generar código"))) return;
    const r = await api.regenCode(m.id); toast(`Código nuevo: ${r.code}`, "ok"); ctx.rerender();
  };
  $("#toggle").onclick = async () => { await api.updateMember(m.id, { active: !m.active }); toast(m.active ? "Acceso pausado" : "Acceso reactivado", "ok"); ctx.rerender(); };
  $("#del").onclick = async () => {
    if (!(await confirmDialog("Eliminar afiliado", `Se borrarán ${m.name}, su rutina, su nutrición y todo su historial. No se puede deshacer.`, "Eliminar"))) return;
    await api.deleteMember(m.id); toast("Afiliado eliminado"); location.hash = "#/coach";
  };
  const el = $("#tab");
  const fns = { resumen: summaryTab, rutina: routineTab, nutricion: nutritionTab, progreso: progressTab, mensaje: messageTab };
  await (fns[tab] || summaryTab)(el, ctx, m);
}

// ----- Resumen
async function summaryTab(el, ctx, m) {
  const p = m.profile || {}, a = m.anamnesis;
  const f = (id, label, val, type = "text") => `<label class="field" for="${id}">${label}<input id="${id}" type="${type}" ${type === "number" ? 'step="0.1"' : ""} value="${esc(val ?? "")}"></label>`;
  const qa = (q, v) => v ? `<div class="stack" style="gap:2px"><span class="eyebrow">${q}</span><p>${esc(v)}</p></div>` : "";
  el.innerHTML = `<div class="grid-2" style="align-items:start">
    <form class="card stack" id="f-prof"><h2>Datos</h2>
      ${f("p-name", "Nombre", m.name)}
      <div class="fields">${f("p-goal", "Objetivo", p.goal)}${f("p-plan", "Plan", p.plan)}</div>
      <div class="fields">${f("p-phone", "WhatsApp", p.phone)}${f("p-gym", "Gimnasio", p.gym)}</div>
      <div class="fields">${f("p-sw", "Peso inicial (kg)", p.startWeight, "number")}${f("p-tw", "Peso meta (kg)", p.targetWeight, "number")}${f("p-h", "Estatura (cm)", p.height, "number")}</div>
      <div><button type="submit">Guardar datos</button></div>
    </form>
    <section class="card stack"><div class="row between"><h2>Cuestionario inicial</h2>${a?.date ? `<span class="small muted">${fmtDate(a.date)}</span>` : ""}</div>
      ${a ? `${qa("Objetivo", a.goal)}${qa("Por qué ahora", a.why)}${qa("Lesiones o molestias", a.injuries)}${qa("Condiciones médicas", a.conditions)}
        <div class="fields">${qa("Experiencia", a.experience)}${qa("Días por semana", a.daysAvailable)}${qa("Minutos por sesión", a.minutes)}</div>
        ${qa("Gimnasio", a.gym)}${qa("Equipo", a.equipment)}${qa("Preferencias en el gimnasio", a.zonePref)}
        <div class="fields">${qa("Sueño", a.sleep ? a.sleep + " h" : "")}${qa("Estrés", a.stress ? a.stress + " / 5" : "")}</div>${qa("Alimentación", a.food)}`
        : `<div class="empty">${m.claimed ? "Activó su acceso pero aún no llena el cuestionario." : "Lo llenará la primera vez que entre."}</div>`}
    </section></div>`;
  $("#f-prof").onsubmit = async (e) => {
    e.preventDefault();
    const n = (id) => { const v = parseFloat($(id).value); return isNaN(v) ? "" : v; };
    await ctx.api.updateMember(m.id, { name: $("#p-name").value.trim() || m.name, profile: { ...p, goal: $("#p-goal").value.trim(), plan: $("#p-plan").value.trim(), phone: $("#p-phone").value.trim(), gym: $("#p-gym").value.trim(), startWeight: n("#p-sw"), targetWeight: n("#p-tw"), height: n("#p-h") } });
    toast("Datos guardados", "ok"); ctx.rerender();
  };
}

// ----- Rutina
async function routineTab(el, ctx, m) {
  const lib = await ctx.api.listExercises();
  const prog = JSON.parse(JSON.stringify(m.program || {}));
  prog.days ||= []; prog.weekNotes ||= {}; prog.weeks ||= 8; prog.startDate ||= iso();
  let dirty = false;

  const libByName = (n) => lib.find((x) => x.name.toLowerCase() === String(n).toLowerCase().trim());
  const blankEx = () => ({ name: "", sets: 3, type: "Serie tradicional", reps: "10", kg: "", rir: "2", rest: 90, notes: "", alt: "" });

  function collect() {
    if (!$("#r-name")) return;
    prog.name = $("#r-name").value.trim();
    prog.weeks = Math.max(1, +$("#r-weeks").value || 1);
    prog.startDate = $("#r-start").value || iso();
    $$("[data-wn]", el).forEach((i) => { if (i.value.trim()) prog.weekNotes[i.dataset.wn] = i.value.trim(); else delete prog.weekNotes[i.dataset.wn]; });
    $$(".day-editor", el).forEach((de) => {
      const d = prog.days[+de.dataset.day];
      d.weekday = +de.querySelector("[data-k=weekday]").value;
      d.group = de.querySelector("[data-k=group]").value.trim();
      $$(".ex-edit[data-ex]", de).forEach((row) => {
        const ex = d.exercises[+row.dataset.ex];
        $$("[data-f]", row).forEach((inp) => { ex[inp.dataset.f] = inp.dataset.f === "rest" || inp.dataset.f === "sets" ? +inp.value || 0 : inp.value.trim(); });
      });
    });
  }

  function draw() {
    const wk = currentWeek(prog);
    el.innerHTML = `<div class="stack-lg">
      <section class="card stack"><div class="row between"><h2>Mesociclo</h2>
        <div class="row"><button class="btn-ghost btn-sm" id="copy-from">Copiar rutina de otro afiliado</button></div></div>
        <div class="fields">
          <label class="field" for="r-name">Nombre<input id="r-name" value="${esc(prog.name)}" placeholder="Ej: Mesociclo 1 · Hipertrofia"></label>
          <label class="field" for="r-start">Fecha de inicio<input id="r-start" type="date" value="${esc(prog.startDate)}"></label>
          <label class="field" for="r-weeks">Semanas<input id="r-weeks" type="number" min="1" max="52" value="${prog.weeks}"></label>
        </div>
        <p class="small muted">Hoy está en la semana <b>${wk}</b> de ${prog.weeks}.</p>
        <details><summary class="small" style="cursor:pointer">Notas por semana (descargas, progresiones)</summary>
          <div class="fields" style="margin-top:12px">${Array.from({ length: prog.weeks }, (_, i) => `<label class="field" for="wn${i + 1}">Semana ${i + 1}<input id="wn${i + 1}" data-wn="${i + 1}" value="${esc(prog.weekNotes[i + 1] || "")}" placeholder="Opcional"></label>`).join("")}</div>
        </details>
      </section>
      <datalist id="ex-list">${lib.map((x) => `<option value="${esc(x.name)}">`).join("")}</datalist>
      ${prog.days.map((d, di) => `<section class="day-editor" data-day="${di}">
        <header>
          <label class="field" for="d${di}-wd">Día<select id="d${di}-wd" data-k="weekday">${WEEKDAYS.map((w, i) => `<option value="${i}" ${+d.weekday === i ? "selected" : ""}>${w}</option>`).join("")}</select></label>
          <label class="field" for="d${di}-g">Grupo muscular<input id="d${di}-g" data-k="group" list="groups" value="${esc(d.group)}"></label>
          <div class="row day-actions"><button type="button" class="btn-ghost btn-sm" data-dup="${di}">Duplicar</button><button type="button" class="btn-danger btn-sm" data-rmday="${di}">Quitar día</button></div>
        </header>
        <div class="ex-edit head"><span></span><span>Ejercicio</span><span>Series</span><span>Tipo</span><span>Reps</span><span>Kg</span><span>RIR</span><span>Descanso</span><span></span></div>
        ${d.exercises.map((ex, ei) => `<div class="ex-edit" data-ex="${ei}">
          <div class="handle"><button type="button" data-up="${di}-${ei}" aria-label="Subir">▲</button><button type="button" data-down="${di}-${ei}" aria-label="Bajar">▼</button></div>
          <input class="name" id="x${di}-${ei}-n" data-f="name" list="ex-list" value="${esc(ex.name)}" placeholder="Ejercicio" aria-label="Ejercicio">
          <input id="x${di}-${ei}-s" data-f="sets" type="number" min="1" max="10" value="${esc(ex.sets)}" aria-label="Series">
          <select id="x${di}-${ei}-t" data-f="type" aria-label="Tipo de serie">${SET_TYPES.map((s) => `<option ${ex.type === s ? "selected" : ""}>${s}</option>`).join("")}</select>
          <input id="x${di}-${ei}-r" data-f="reps" value="${esc(ex.reps)}" placeholder="8/12" aria-label="Repeticiones">
          <input id="x${di}-${ei}-k" data-f="kg" value="${esc(ex.kg)}" placeholder="—" aria-label="Kilos">
          <input id="x${di}-${ei}-i" data-f="rir" value="${esc(ex.rir)}" placeholder="2" aria-label="RIR">
          <select id="x${di}-${ei}-d" data-f="rest" aria-label="Descanso"><option value="0">—</option>${REST_OPTIONS.map((s) => `<option value="${s}" ${+ex.rest === s ? "selected" : ""}>${fmtRest(s)}</option>`).join("")}</select>
          <button type="button" class="btn-quiet btn-sm" data-rmex="${di}-${ei}" aria-label="Quitar ejercicio">✕</button>
          <input class="notes" id="x${di}-${ei}-o" data-f="notes" value="${esc(ex.notes)}" placeholder="Indicación para el afiliado (técnica, progresión)" aria-label="Indicación">
          <input class="notes" id="x${di}-${ei}-a" data-f="alt" value="${esc(ex.alt)}" placeholder="Alternativas si la máquina está ocupada${libByName(ex.name)?.alternatives ? ` (biblioteca: ${esc(libByName(ex.name).alternatives)})` : ""}" aria-label="Alternativas">
        </div>`).join("")}
        <div style="padding:12px 14px"><button type="button" class="btn-ghost btn-sm" data-addex="${di}">+ Ejercicio</button></div>
      </section>`).join("")}
      <datalist id="groups">${GROUPS.map((g) => `<option value="${g}">`).join("")}</datalist>
      <div><button type="button" class="btn-ghost" id="addday">+ Agregar día de entrenamiento</button></div>
      <div class="card row between" style="position:sticky;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:5;box-shadow:var(--shadow)">
        <span class="small muted" id="dirty">${dirty ? "Tienes cambios sin guardar" : "Todo guardado"}</span>
        <button class="btn-accent" id="save">Guardar rutina</button>
      </div>
    </div>`;
    bind();
  }
  const mark = () => { dirty = true; const d = $("#dirty"); if (d) d.textContent = "Tienes cambios sin guardar"; };
  const act = (fn) => () => { collect(); fn(); dirty = true; draw(); };

  function bind() {
    el.querySelectorAll("input,select").forEach((i) => i.addEventListener("input", mark));
    $$("[data-f=name]", el).forEach((inp) => inp.addEventListener("change", () => {
      const l = libByName(inp.value); if (!l) return;
      const row = inp.closest(".ex-edit"), alt = row.querySelector("[data-f=alt]");
      if (alt && !alt.value) alt.placeholder = `Alternativas (biblioteca: ${l.alternatives || "—"})`;
    }));
    $("#addday").onclick = act(() => {
      const used = new Set(prog.days.map((d) => +d.weekday));
      const wd = [1, 2, 3, 4, 5, 6, 0].find((x) => !used.has(x)) ?? 1;
      prog.days.push({ weekday: wd, group: "", exercises: [blankEx()] });
    });
    $$("[data-addex]", el).forEach((b) => (b.onclick = act(() => prog.days[+b.dataset.addex].exercises.push(blankEx()))));
    $$("[data-rmday]", el).forEach((b) => (b.onclick = act(() => prog.days.splice(+b.dataset.rmday, 1))));
    $$("[data-dup]", el).forEach((b) => (b.onclick = act(() => { const d = JSON.parse(JSON.stringify(prog.days[+b.dataset.dup])); prog.days.splice(+b.dataset.dup + 1, 0, d); })));
    $$("[data-rmex]", el).forEach((b) => (b.onclick = act(() => { const [d, e] = b.dataset.rmex.split("-").map(Number); prog.days[d].exercises.splice(e, 1); })));
    $$("[data-up]", el).forEach((b) => (b.onclick = act(() => { const [d, e] = b.dataset.up.split("-").map(Number); if (e > 0) { const a = prog.days[d].exercises; [a[e - 1], a[e]] = [a[e], a[e - 1]]; } })));
    $$("[data-down]", el).forEach((b) => (b.onclick = act(() => { const [d, e] = b.dataset.down.split("-").map(Number); const a = prog.days[d].exercises; if (e < a.length - 1) [a[e + 1], a[e]] = [a[e], a[e + 1]]; })));
    $("#r-weeks").addEventListener("change", act(() => {}));
    $("#save").onclick = async () => {
      collect();
      for (const d of prog.days) d.exercises = d.exercises.filter((x) => x.name);
      const dupDays = prog.days.map((d) => +d.weekday).filter((w, i, a) => a.indexOf(w) !== i);
      if (dupDays.length) { toast(`Hay dos días asignados al ${WEEKDAYS[dupDays[0]].toLowerCase()}. Cambia uno.`, "err"); draw(); return; }
      await ctx.api.updateMember(m.id, { program: prog });
      dirty = false; toast("Rutina guardada. El afiliado ya la ve.", "ok"); draw();
    };
    $("#copy-from").onclick = async () => {
      const all = (await ctx.api.listMembers()).filter((x) => x.id !== m.id && x.program?.days?.length);
      if (!all.length) return toast("Ningún otro afiliado tiene rutina todavía.");
      const src = await modal({
        title: "Copiar rutina", submitLabel: "Copiar",
        body: `<p class="muted">Se reemplaza la rutina actual de ${esc(firstName(m.name))} por una copia. Luego puedes ajustarla.</p>
          <label class="field" for="cf">Copiar de<select id="cf">${all.map((x) => `<option value="${x.id}">${esc(x.name)} · ${esc(x.program.name || "")} (${x.program.days.length} días)</option>`).join("")}</select></label>`,
        onSubmit: (f) => all.find((x) => x.id === f.querySelector("#cf").value),
      });
      if (!src) return;
      const copy = JSON.parse(JSON.stringify(src.program)); copy.startDate = iso();
      Object.assign(prog, copy); dirty = true; draw(); toast("Rutina copiada. Revísala y guarda.");
    };
  }
  draw();
}

// ----- Nutrición
async function nutritionTab(el, ctx, m) {
  const n = JSON.parse(JSON.stringify(m.nutrition || {}));
  n.basics ||= {}; n.split ||= { p: 30, f: 25, c: 45 }; n.meals ||= []; n.recs ||= [];
  const b = n.basics, p = m.profile || {};
  b.weight ||= p.startWeight || ""; b.height ||= p.height || "";
  let dirty = false;

  function collect() {
    if (!$("#nb-w")) return;
    Object.assign(b, { sex: $("#nb-s").value, age: +$("#nb-a").value || "", height: +$("#nb-h").value || "", weight: +$("#nb-w").value || "", activity: $("#nb-act").value, goal: $("#nb-g").value });
    n.kcalOverride = +$("#n-k").value || 0;
    n.split = { p: +$("#sp-p").value || 0, f: +$("#sp-f").value || 0, c: +$("#sp-c").value || 0 };
    n.water = $("#n-water").value.trim();
    n.recs = $("#n-recs").value.split("\n").map((x) => x.trim()).filter(Boolean);
    $$(".meal-ed", el).forEach((me) => {
      const meal = n.meals[+me.dataset.meal];
      meal.name = me.querySelector("[data-k=name]").value.trim(); meal.time = me.querySelector("[data-k=time]").value.trim(); meal.note = me.querySelector("[data-k=note]").value.trim();
      $$(".food-row[data-it]", me).forEach((row) => {
        const it = meal.items[+row.dataset.it];
        it.food = row.querySelector("[data-f=food]").value.trim();
        it.qty = parseFloat(String(row.querySelector("[data-f=qty]").value).replace(",", ".")) || 0;
        ["kcal", "p", "f", "c"].forEach((k) => (it[k] = parseFloat(row.querySelector(`[data-f=${k}]`).value) || 0));
        it.unit = row.querySelector("[data-f=unit]").value || it.unit || "g";
      });
    });
  }

  function summary() {
    const tg = calcTargets(n);
    const tot = n.meals.reduce((t, x) => { const s = mealTotals(x.items); return { kcal: t.kcal + s.kcal, p: t.p + s.p, f: t.f + s.f, c: t.c + s.c }; }, { kcal: 0, p: 0, f: 0, c: 0 });
    const diff = (a, b) => { const d = Math.round(a - b); return `<span class="${Math.abs(d) <= b * 0.07 ? "" : "accent"}">${d > 0 ? "+" : ""}${d}</span>`; };
    return `<div class="table-wrap"><table><thead><tr><th></th><th class="num">Kcal</th><th class="num">Proteína</th><th class="num">Carbos</th><th class="num">Grasas</th></tr></thead><tbody>
      <tr><td>Objetivo</td><td class="num">${fmtNum(tg.kcal)}</td><td class="num">${tg.p} g</td><td class="num">${tg.c} g</td><td class="num">${tg.f} g</td></tr>
      <tr><td>Menú armado</td><td class="num">${fmtNum(tot.kcal)}</td><td class="num">${fmtNum(tot.p)} g</td><td class="num">${fmtNum(tot.c)} g</td><td class="num">${fmtNum(tot.f)} g</td></tr>
      <tr><td>Diferencia</td><td class="num">${diff(tot.kcal, tg.kcal)}</td><td class="num">${diff(tot.p, tg.p)}</td><td class="num">${diff(tot.c, tg.c)}</td><td class="num">${diff(tot.f, tg.f)}</td></tr>
    </tbody></table></div>`;
  }
  function calcBox() {
    const tg = calcTargets(n);
    return tg.bmr ? `<div class="kpis">
      <div class="kpi"><b>${fmtNum(tg.bmr)}</b><span>Tasa metabólica basal</span></div>
      <div class="kpi"><b>${fmtNum(tg.tdee)}</b><span>Calorías de mantenimiento</span></div>
      <div class="kpi"><b class="accent">${fmtNum(tg.kcal)}</b><span>Calorías a consumir${n.kcalOverride ? " (manual)" : ""}</span></div>
      <div class="kpi"><b>${tg.p}·${tg.c}·${tg.f}</b><span>Gramos de P · C · G</span></div></div>` : `<p class="muted small">Completa sexo, edad, estatura y peso para calcular.</p>`;
  }

  function draw() {
    const anaFood = m.anamnesis?.food;
    el.innerHTML = `<div class="stack-lg">
      <section class="card stack"><div class="row between"><h2>Cálculo de calorías</h2><button class="btn-ghost btn-sm" id="copy-n">Copiar plan de otro afiliado</button></div>
        ${anaFood ? `<p class="small"><span class="eyebrow">Del cuestionario</span><br>${esc(anaFood)}</p>` : ""}
        <div class="fields">
          <label class="field" for="nb-s">Sexo<select id="nb-s"><option value="F" ${b.sex === "F" ? "selected" : ""}>Femenino</option><option value="M" ${b.sex === "M" ? "selected" : ""}>Masculino</option></select></label>
          <label class="field" for="nb-a">Edad<input id="nb-a" type="number" value="${esc(b.age)}"></label>
          <label class="field" for="nb-h">Estatura (cm)<input id="nb-h" type="number" value="${esc(b.height)}"></label>
          <label class="field" for="nb-w">Peso (kg)<input id="nb-w" type="number" step="0.1" value="${esc(b.weight)}"></label>
          <label class="field" for="nb-act">Actividad<select id="nb-act">${ACTIVITY.map(([k, l]) => `<option value="${k}" ${b.activity === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label class="field" for="nb-g">Objetivo<select id="nb-g">${GOALS.map(([k, l, a]) => `<option value="${k}" ${(b.goal || "maint") === k ? "selected" : ""}>${l} (${a > 0 ? "+" : ""}${Math.round(a * 100)}%)</option>`).join("")}</select></label>
        </div>
        <div id="calc">${calcBox()}</div>
        <div class="fields">
          <label class="field" for="n-k">Calorías manuales (opcional)<input id="n-k" type="number" value="${n.kcalOverride || ""}" placeholder="Usa el cálculo"></label>
          <label class="field" for="sp-p">% Proteína<input id="sp-p" type="number" value="${n.split.p}"></label>
          <label class="field" for="sp-c">% Carbohidratos<input id="sp-c" type="number" value="${n.split.c}"></label>
          <label class="field" for="sp-f">% Grasas<input id="sp-f" type="number" value="${n.split.f}"></label>
          <label class="field" for="n-water">Agua al día<input id="n-water" value="${esc(n.water || "")}" placeholder="Ej: 3 L"></label>
        </div>
        <p class="small muted">Cálculo con la fórmula de Mifflin-St Jeor. Los porcentajes deben sumar 100 (ahora: <span id="sp-sum" class="mono">${n.split.p + n.split.c + n.split.f}</span>).</p>
      </section>
      <datalist id="foods">${FOODS.map((f) => `<option value="${esc(f[0])}">`).join("")}</datalist>
      <section class="stack"><div class="row between"><h2>Menú base</h2><button type="button" class="btn-ghost btn-sm" id="add-meal">+ Comida</button></div>
        <div id="sum">${summary()}</div>
        ${n.meals.map((meal, mi) => { const t = mealTotals(meal.items); return `<div class="card stack meal-ed" data-meal="${mi}">
          <div class="fields" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))">
            <label class="field" for="ml${mi}">Comida<input id="ml${mi}" data-k="name" list="meal-names" value="${esc(meal.name)}"></label>
            <label class="field" for="mt${mi}">Hora<input id="mt${mi}" data-k="time" value="${esc(meal.time || "")}" placeholder="7:00"></label>
            <div class="row" style="align-self:end;justify-content:flex-end"><span class="mono small muted">${fmtNum(t.kcal)} kcal · ${fmtNum(t.p)} P</span><button type="button" class="btn-danger btn-sm" data-rmmeal="${mi}">Quitar</button></div>
          </div>
          <div class="food-row head"><span>Alimento</span><span>Cantidad</span><span>Unidad</span><span class="num">Kcal</span><span class="num">P</span><span class="num">C</span><span class="num">G</span><span></span></div>
          ${meal.items.map((it, ii) => `<div class="food-row" data-it="${ii}">
            <input id="f${mi}-${ii}" data-f="food" list="foods" value="${esc(it.food)}" placeholder="Alimento" aria-label="Alimento">
            <input id="q${mi}-${ii}" data-f="qty" inputmode="decimal" value="${esc(it.qty)}" aria-label="Cantidad">
            <input class="num" id="u${mi}-${ii}" data-f="unit" value="${esc(it.unit || "g")}" aria-label="Unidad">
            ${["kcal", "p", "c", "f"].map((k) => `<input class="num" id="${k}${mi}-${ii}" data-f="${k}" inputmode="decimal" value="${esc(it[k])}" aria-label="${k}">`).join("")}
            <button type="button" class="btn-quiet btn-sm" data-rmit="${mi}-${ii}" aria-label="Quitar alimento">✕</button>
          </div>`).join("")}
          <div class="row"><button type="button" class="btn-ghost btn-sm" data-addit="${mi}">+ Alimento</button></div>
          <label class="field" for="mn${mi}">Nota de la comida (opcional)<input id="mn${mi}" data-k="note" value="${esc(meal.note || "")}" placeholder="Ej: si entrenas en la mañana, cambia el orden con el pre entreno"></label>
        </div>`; }).join("")}
        ${!n.meals.length ? `<div class="empty">Agrega las comidas del día. Escribe el alimento y la cantidad: las calorías y macros se calculan solas para los alimentos de la lista.</div>` : ""}
        <datalist id="meal-names">${MEAL_NAMES.map((x) => `<option value="${x}">`).join("")}</datalist>
      </section>
      <section class="card stack"><h2>Recomendaciones</h2>
        <label class="field" for="n-recs">Una por línea. El afiliado las ve como lista.<textarea id="n-recs" rows="6">${esc(n.recs.join("\n"))}</textarea></label></section>
      <div class="card row between" style="position:sticky;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:5;box-shadow:var(--shadow)">
        <span class="small muted" id="dirty">${dirty ? "Tienes cambios sin guardar" : "Todo guardado"}</span><button class="btn-accent" id="save">Guardar nutrición</button></div>
    </div>`;
    bind();
  }
  const act = (fn) => () => { collect(); fn(); dirty = true; draw(); };
  function bind() {
    const live = () => { collect(); dirty = true; $("#calc").innerHTML = calcBox(); $("#sum").innerHTML = summary(); $("#sp-sum").textContent = n.split.p + n.split.c + n.split.f; $("#dirty").textContent = "Tienes cambios sin guardar"; };
    el.querySelectorAll("input,select,textarea").forEach((i) => i.addEventListener("input", live));
    $$(".food-row[data-it]", el).forEach((row) => {
      const upd = () => {
        const mac = foodMacros(row.querySelector("[data-f=food]").value, parseFloat(String(row.querySelector("[data-f=qty]").value).replace(",", ".")) || 0);
        if (!mac) return;
        row.querySelector("[data-f=unit]").value = mac.unit;
        ["kcal", "p", "c", "f"].forEach((k) => (row.querySelector(`[data-f=${k}]`).value = mac[k]));
        live();
      };
      row.querySelector("[data-f=food]").addEventListener("change", () => {
        const q = row.querySelector("[data-f=qty]");
        const f = FOODS.find((x) => x[0].toLowerCase() === row.querySelector("[data-f=food]").value.toLowerCase().trim());
        if (f && !q.value) q.value = f[1] === "unidad" ? 1 : 100;
        upd();
      });
      row.querySelector("[data-f=qty]").addEventListener("input", upd);
    });
    $("#add-meal").onclick = act(() => n.meals.push({ name: MEAL_NAMES[Math.min(n.meals.length, MEAL_NAMES.length - 1)], time: "", items: [{ food: "", qty: "", unit: "g", kcal: 0, p: 0, f: 0, c: 0 }] }));
    $$("[data-rmmeal]", el).forEach((x) => (x.onclick = act(() => n.meals.splice(+x.dataset.rmmeal, 1))));
    $$("[data-addit]", el).forEach((x) => (x.onclick = act(() => n.meals[+x.dataset.addit].items.push({ food: "", qty: "", unit: "g", kcal: 0, p: 0, f: 0, c: 0 }))));
    $$("[data-rmit]", el).forEach((x) => (x.onclick = act(() => { const [a, c] = x.dataset.rmit.split("-").map(Number); n.meals[a].items.splice(c, 1); })));
    $("#save").onclick = async () => {
      collect();
      if (n.split.p + n.split.c + n.split.f !== 100) return toast("Los porcentajes de macros deben sumar 100.", "err");
      n.meals.forEach((x) => (x.items = x.items.filter((i) => i.food)));
      await ctx.api.updateMember(m.id, { nutrition: n });
      dirty = false; toast("Nutrición guardada. El afiliado ya la ve.", "ok"); draw();
    };
    $("#copy-n").onclick = async () => {
      const all = (await ctx.api.listMembers()).filter((x) => x.id !== m.id && x.nutrition?.meals?.length);
      if (!all.length) return toast("Ningún otro afiliado tiene menú todavía.");
      const src = await modal({
        title: "Copiar menú", submitLabel: "Copiar",
        body: `<p class="muted">Se copian las comidas, los porcentajes de macros y las recomendaciones. Los datos de cálculo de ${esc(firstName(m.name))} se mantienen.</p>
          <label class="field" for="cn">Copiar de<select id="cn">${all.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label>`,
        onSubmit: (f) => all.find((x) => x.id === f.querySelector("#cn").value),
      });
      if (!src) return;
      collect();
      const c = JSON.parse(JSON.stringify(src.nutrition));
      n.meals = c.meals; n.split = c.split; n.recs = c.recs; n.water = c.water;
      dirty = true; draw(); toast("Menú copiado. Ajusta las cantidades y guarda.");
    };
  }
  draw();
}

// ----- Progreso
async function progressTab(el, ctx, m) {
  const [sessions, checkins, ms] = await Promise.all([ctx.api.listSessions(m.id), ctx.api.listCheckins(m.id), ctx.api.listMeasurements(m.id)]);
  const absences = checkins.filter((c) => c.kind === "absence");
  const done = sessions.filter((s) => s.completed);
  const weights = ms.filter((x) => +x.data?.weight).map((x) => ({ x: x.date, y: +x.data.weight }));
  const adh = weekAdherence(m.program, sessions);
  const pbs = Object.values(personalBests(sessions)).sort((a, b) => b.kg - a.kg).slice(0, 6);
  const cols = [["weight", "Peso"], ["waist", "Cintura"], ["hip", "Cadera"], ["chest", "Pecho"], ["arm", "Brazo"], ["thigh", "Muslo"], ["fat", "% grasa"]];
  const kindLabel = { weekly: "Check-in semanal", absence: "No pudo entrenar", offplan: "Se salió del plan" };
  const ckText = (c) => c.kind === "weekly" ? `Energía ${c.data.energy}/5 · Sueño ${c.data.sleep}/5 · Estrés ${c.data.stress}/5 · Hambre ${c.data.hunger}/5${c.data.note ? ` · “${esc(c.data.note)}”` : ""}`
    : c.kind === "absence" ? `${esc(c.data.reason || "")}${c.data.note ? ` · “${esc(c.data.note)}”` : ""}` : `${esc(c.data.what || "")} · ${esc(c.data.feeling || "")}`;

  el.innerHTML = `<div class="stack-lg">
    <div class="kpis">
      <div class="kpi"><b>${computeStreak(m.program, sessions, absences)}</b><span>Días de racha</span></div>
      <div class="kpi"><b>${adh.done}/${adh.planned}</b><span>Sesiones esta semana</span></div>
      <div class="kpi"><b>${done.length}</b><span>Sesiones totales</span></div>
      <div class="kpi"><b>${weights.length ? fmtNum(weights[weights.length - 1].y, 1) : "—"}</b><span>Último peso (kg)${weights.length > 1 ? ` · ${(weights[weights.length - 1].y - weights[0].y > 0 ? "+" : "") + fmtNum(weights[weights.length - 1].y - weights[0].y, 1)}` : ""}</span></div>
    </div>
    <section class="card stack"><h2>Peso</h2>${lineChart(weights, { unit: "kg" })}</section>
    <section class="stack"><h2>Sesiones</h2>
      ${done.length ? `<div class="stack" style="gap:8px">${done.slice(0, 20).map((s) => `<details class="card card-tight"><summary class="row between" style="cursor:pointer;list-style:none">
          <span><b>${fmtDate(s.date, true)}</b> · ${esc(m.program?.days?.[s.day_index]?.group || "—")} · semana ${s.week}</span>
          <span class="row"><span class="mono small">${fmtNum(sessionTonnage(s))} kg</span>${s.feeling ? `<span class="pill ${s.feeling <= 2 ? "bad" : s.feeling >= 4 ? "ok" : ""}">${s.feeling}/5</span>` : ""}${s.note ? `<span class="pill warn">nota</span>` : ""}</span></summary>
          <div class="stack" style="margin-top:12px">${s.note ? `<p class="card card-tight">“${esc(s.note)}”</p>` : ""}
          <div class="table-wrap"><table><thead><tr><th>Ejercicio</th><th>Series hechas (reps × kg @RIR)</th></tr></thead><tbody>
          ${s.logs.map((l) => `<tr><td>${esc(l.name)}${l.orig && l.orig !== l.name ? `<div class="small muted">en lugar de ${esc(l.orig)}</div>` : ""}</td><td class="mono small">${l.sets.filter((x) => x.done).map((x) => `${x.reps || "?"}×${x.kg || 0}${x.rir !== "" && x.rir != null ? ` @${x.rir}` : ""}`).join(" · ") || "—"}</td></tr>`).join("")}
          </tbody></table></div></div></details>`).join("")}</div>` : `<div class="empty">Todavía no hay sesiones registradas.</div>`}
    </section>
    ${pbs.length ? `<section class="stack"><h2>Mejores marcas</h2><div class="grid-3">${pbs.map((p) => `<div class="card card-tight"><span class="small muted">${esc(p.name)}</span><br><b class="mono">${fmtNum(p.kg, 1)} kg × ${p.reps}</b> <span class="small muted">· ${fmtDate(p.date)}</span></div>`).join("")}</div></section>` : ""}
    <section class="stack"><div class="row between"><h2>Medidas</h2><button class="btn-ghost btn-sm" id="add-m">Agregar medidas</button></div>
      ${ms.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th>${cols.map(([, l]) => `<th class="num">${l}</th>`).join("")}<th></th></tr></thead><tbody>
      ${[...ms].reverse().map((x) => `<tr><td>${fmtDate(x.date)}</td>${cols.map(([k]) => `<td class="num">${x.data?.[k] !== "" && x.data?.[k] != null ? fmtNum(x.data[k], 1) : "—"}</td>`).join("")}<td><button class="btn-quiet btn-sm" data-delm="${x.id}" aria-label="Borrar">✕</button></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">Sin medidas registradas.</div>`}
    </section>
    <section class="stack"><h2>Check-ins y avisos</h2>
      ${checkins.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th></tr></thead><tbody>
      ${checkins.slice(0, 30).map((c) => `<tr><td class="small">${fmtDate(c.date)}</td><td><span class="pill ${c.kind === "offplan" ? "warn" : c.kind === "absence" ? "" : "ok"}">${kindLabel[c.kind]}</span></td><td class="small">${ckText(c)}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">Sin check-ins todavía.</div>`}
    </section></div>`;

  $$("[data-delm]", el).forEach((b) => (b.onclick = async () => { await ctx.api.deleteMeasurement(b.dataset.delm); ctx.rerender(); }));
  $("#add-m").onclick = async () => {
    const ok = await modal({
      title: "Agregar medidas", submitLabel: "Guardar",
      body: `<label class="field" for="md">Fecha<input type="date" id="md" value="${iso()}"></label>
        <div class="fields">${cols.map(([k, l]) => `<label class="field" for="mm-${k}">${l}<input id="mm-${k}" inputmode="decimal"></label>`).join("")}</div>`,
      onSubmit: async (f) => {
        const d = {}; cols.forEach(([k]) => { const v = parseFloat(String(f.querySelector("#mm-" + k).value).replace(",", ".")); d[k] = isNaN(v) ? "" : v; });
        await ctx.api.addMeasurement({ member_id: m.id, date: f.querySelector("#md").value || iso(), data: d });
      },
    });
    if (ok) { toast("Medidas guardadas", "ok"); ctx.rerender(); }
  };
}

// ----- Mensaje
async function messageTab(el, ctx, m) {
  const templates = [
    ["Bienvenida", `${firstName(m.name)}, bienvenido al equipo. Tu rutina y tu alimentación ya están cargadas. Registra cada serie con el peso real que levantes: con eso ajusto tu progresión cada semana.`],
    ["Subir carga", `${firstName(m.name)}, vas muy bien. Esta semana, si completas todas las series con el RIR indicado, sube 2,5 kg en los ejercicios principales.`],
    ["Retomar", `${firstName(m.name)}, vi que llevas unos días sin registrar. No pasa nada, lo importante es volver. ¿Qué te ha impedido entrenar? Escríbeme y ajustamos el plan a tu semana.`],
    ["Descarga", `${firstName(m.name)}, esta es semana de descarga: mismos ejercicios con una serie menos y la carga un 10 % más baja. Es parte del plan, no es retroceder.`],
  ];
  el.innerHTML = `<div class="grid-2" style="align-items:start">
    <form class="card stack" id="f-note"><h2>Mensaje en el perfil</h2>
      <p class="small muted">${esc(firstName(m.name))} lo ve en "Mi coach". Úsalo para el enfoque de la semana, ajustes o motivación.</p>
      <label class="field" for="note">Mensaje<textarea id="note" rows="10">${esc(m.coach_note || "")}</textarea></label>
      <div><button type="submit" class="btn-accent">Publicar mensaje</button></div></form>
    <section class="stack"><h3>Plantillas</h3>${templates.map(([t, x], i) => `<div class="card card-tight stack" style="gap:8px"><b>${t}</b><p class="small muted">${esc(x)}</p><div><button type="button" class="btn-ghost btn-sm" data-tpl="${i}">Usar</button></div></div>`).join("")}</section>
  </div>`;
  $$("[data-tpl]", el).forEach((b) => (b.onclick = () => { $("#note").value = templates[+b.dataset.tpl][1]; $("#note").focus(); }));
  $("#f-note").onsubmit = async (e) => { e.preventDefault(); await ctx.api.updateMember(m.id, { coach_note: $("#note").value.trim() }); toast("Mensaje publicado", "ok"); };
}

// ------------------------------------------------------------ Biblioteca de ejercicios
async function library(view, ctx) {
  const list = await ctx.api.listExercises();
  view.innerHTML = `<div class="stack-lg">
    <div class="row between"><div class="stack" style="gap:6px"><div class="eyebrow">${list.length} ejercicios</div><h1>Biblioteca</h1></div><button class="btn-accent" id="add">+ Ejercicio</button></div>
    <p class="muted prose">Aquí van tus videos y tus puntos clave de técnica. Cuando un ejercicio de la rutina tiene el mismo nombre, el afiliado ve el video, las indicaciones y las alternativas por si la máquina está ocupada.</p>
    <input id="q" type="search" placeholder="Buscar ejercicio o músculo" aria-label="Buscar" style="max-width:340px">
    <div class="table-wrap"><table><thead><tr><th>Ejercicio</th><th>Músculo</th><th>Video</th><th>Alternativas</th><th></th></tr></thead><tbody id="rows">
      ${list.map((x) => `<tr data-s="${esc((x.name + " " + x.muscle).toLowerCase())}"><td><b>${esc(x.name)}</b>${x.cues ? `<div class="small muted">${esc(x.cues)}</div>` : ""}</td><td class="small">${esc(x.muscle)}</td>
        <td>${x.video_url ? `<a href="${esc(x.video_url)}" target="_blank" rel="noopener" class="small">Ver</a>` : `<span class="pill warn">Falta video</span>`}</td>
        <td class="small">${esc(x.alternatives || "—")}</td><td><div class="row" style="flex-wrap:nowrap"><button class="btn-ghost btn-sm" data-edit="${x.id}">Editar</button><button class="btn-quiet btn-sm" data-del="${x.id}" aria-label="Borrar">✕</button></div></td></tr>`).join("")}
    </tbody></table></div></div>`;
  const edit = async (ex = {}) => {
    const ok = await modal({
      title: ex.id ? "Editar ejercicio" : "Nuevo ejercicio",
      body: `<label class="field" for="e-n">Nombre<input id="e-n" value="${esc(ex.name)}" required></label>
        <label class="field" for="e-m">Grupo muscular<input id="e-m" list="glist" value="${esc(ex.muscle)}"></label><datalist id="glist">${GROUPS.map((g) => `<option value="${g}">`).join("")}</datalist>
        <label class="field" for="e-v">Enlace del video (YouTube, Instagram, Drive)<input id="e-v" type="url" value="${esc(ex.video_url)}" placeholder="https://"></label>
        <label class="field" for="e-c">Puntos clave de técnica<textarea id="e-c" rows="3">${esc(ex.cues)}</textarea></label>
        <label class="field" for="e-a">Alternativas (separadas por coma)<input id="e-a" value="${esc(ex.alternatives)}"></label>`,
      onSubmit: async (f) => {
        const name = f.querySelector("#e-n").value.trim(); if (!name) throw new Error("Escribe el nombre.");
        await ctx.api.saveExercise({ id: ex.id, name, muscle: f.querySelector("#e-m").value.trim(), video_url: f.querySelector("#e-v").value.trim(), cues: f.querySelector("#e-c").value.trim(), alternatives: f.querySelector("#e-a").value.trim() });
      },
    });
    if (ok) { toast("Ejercicio guardado", "ok"); ctx.rerender(); }
  };
  $("#add").onclick = () => edit();
  $$("[data-edit]", view).forEach((b) => (b.onclick = () => edit(list.find((x) => x.id === b.dataset.edit))));
  $$("[data-del]", view).forEach((b) => (b.onclick = async () => {
    const x = list.find((y) => y.id === b.dataset.del);
    if (await confirmDialog("Borrar ejercicio", `Se borra "${x.name}" de la biblioteca. Las rutinas que lo usan no cambian, pero ya no mostrarán su video.`, "Borrar")) { await ctx.api.deleteExercise(x.id); ctx.rerender(); }
  }));
  $("#q").oninput = (e) => { const q = e.target.value.toLowerCase(); $$("#rows tr").forEach((tr) => (tr.hidden = !tr.dataset.s.includes(q))); };
}

// ------------------------------------------------------------ Ajustes
async function settingsView(view, ctx) {
  const s = await ctx.api.getSettings();
  view.innerHTML = `<div class="stack-lg"><div class="stack" style="gap:6px"><div class="eyebrow">Ajustes</div><h1>Tu marca</h1></div>
    <form class="card stack" id="f-set">
      <div class="fields"><label class="field" for="s-b">Nombre<input id="s-b" value="${esc(s.brand)}"></label>
        <label class="field" for="s-w">WhatsApp con indicativo (ej: 573001234567)<input id="s-w" inputmode="tel" value="${esc(s.whatsapp)}"></label></div>
      <label class="field" for="s-t">Frase de la portada<input id="s-t" value="${esc(s.tagline)}"></label>
      <label class="field" for="s-wel">Mensaje de bienvenida (lo ve el afiliado antes del cuestionario)<textarea id="s-wel" rows="3">${esc(s.welcome)}</textarea></label>
      <label class="field" for="s-op">Qué hacer si alguien se sale del plan (una idea por línea)<textarea id="s-op" rows="5">${esc(s.offplanTips)}</textarea></label>
      <div><button type="submit" class="btn-accent">Guardar ajustes</button></div>
    </form>
    <section class="card stack"><h2>Estado de la plataforma</h2>
      <p>${ctx.api.mode === "demo" ? `<span class="pill warn dot">Modo demostración</span> Los datos viven solo en este navegador. Para usarla con afiliados reales conecta Supabase siguiendo el README del repositorio.` : `<span class="pill ok dot">Conectada a la base de datos</span> Los cambios se guardan en Supabase y los ven los afiliados al instante.`}</p>
      <p class="small muted">Enlace para afiliados: <span class="mono">${esc(accessLink())}</span></p>
    </section></div>`;
  $("#f-set").onsubmit = async (e) => {
    e.preventDefault();
    const next = { ...s, brand: $("#s-b").value.trim(), whatsapp: $("#s-w").value.replace(/\D/g, ""), tagline: $("#s-t").value.trim(), welcome: $("#s-wel").value.trim(), offplanTips: $("#s-op").value.trim() };
    await ctx.api.saveSettings(next); ctx.settings = next; toast("Ajustes guardados", "ok"); ctx.rerender();
  };
}
