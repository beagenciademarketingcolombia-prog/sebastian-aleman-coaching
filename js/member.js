// Vistas del afiliado: bienvenida (anamnesis), hoy, semana, nutrición, progreso y coach
import {
  esc, $, $$, iso, fmtDate, fmtRest, fmtNum, WEEKDAYS, WEEKDAYS_SHORT, currentWeek, dayForDate, addDays, parseISO,
  computeStreak, weekAdherence, sessionTonnage, personalBests, calcTargets, mealTotals, firstName, scheduledWeekdays,
} from "./util.js";
import { toast, modal, ICONS, lineChart, videoLink, copyText } from "./ui.js";

const TABS = [["hoy", "Hoy", "today"], ["semana", "Mi rutina", "week"], ["nutricion", "Nutrición", "food"], ["progreso", "Progreso", "progress"], ["coach", "Mi coach", "coach"]];
let timer = null; // temporizador de descanso (persiste entre renders)
let draft = null; // sesión en curso

export async function renderMember(app, ctx, parts) {
  const { api } = ctx;
  const tab = parts[0] || "hoy";
  const me = await api.myMember();
  if (!me) { await api.logout(); location.hash = "#/ingresar"; return; }
  if (!me.anamnesis && tab !== "bienvenida") { location.hash = "#/app/bienvenida"; return; }

  const [sessions, checkins, library] = await Promise.all([api.listSessions(me.id), api.listCheckins(me.id), api.listExercises()]);
  const absences = checkins.filter((c) => c.kind === "absence");
  const streak = computeStreak(me.program, sessions, absences);
  const data = { me, sessions, checkins, absences, library, streak };

  const nav = (bottom) => TABS.map(([k, label, icon]) =>
    `<a href="#/app/${k}" ${k === tab ? 'aria-current="page"' : ""}>${bottom ? ICONS[icon] : ""}<span>${label}</span></a>`).join("");

  app.innerHTML = `${ctx.demoBand()}
  <header class="topbar"><div class="wrap">
    <a class="brand" href="#/app/hoy">${ctx.brandMark()}</a>
    ${tab !== "bienvenida" ? `<nav class="topnav member-nav" aria-label="Secciones">${nav(false)}</nav>` : ""}
    <button class="btn-quiet btn-sm" id="logout">Salir</button>
  </div></header>
  <main class="wrap page member" id="view"></main>
  ${tab !== "bienvenida" ? `<div class="bottomnav"><nav aria-label="Secciones">${nav(true)}</nav></div>` : ""}`;
  ctx.bindDemoBand();
  $("#logout").onclick = () => { draft = null; stopTimer(); ctx.logout(); };

  const view = $("#view");
  const views = { bienvenida: welcome, hoy: today, semana: week, nutricion: nutrition, progreso: progress, coach: coachTab };
  await (views[tab] || today)(view, ctx, data, parts.slice(1));
  renderTimer();
}

// ------------------------------------------------------------ Encabezado
function head(data, title, sub = "") {
  const { me, streak, sessions } = data;
  const wk = currentWeek(me.program);
  const adh = weekAdherence(me.program, sessions);
  return `<div class="member-head">
    <div class="stack" style="gap:8px">
      <div class="eyebrow">${esc(sub || (me.program?.name ? `${me.program.name} · Semana ${wk} de ${me.program.weeks || "—"}` : "Tu plan"))}</div>
      <h1>${title}</h1>
    </div>
    <div class="row" style="gap:18px">
      <div class="stat"><b>${adh.done}/${adh.planned}</b><span>Sesiones esta semana</span></div>
      <div class="streak" title="Días de entrenamiento seguidos que has cumplido"><b>${streak}</b><span>días de<br>racha</span></div>
    </div>
  </div>`;
}

function weekStrip(data, selectedDate) {
  const { me, sessions, absences } = data;
  const t = iso(), d0 = parseISO(t);
  const monday = addDays(t, -((d0.getDay() + 6) % 7));
  const done = new Set(sessions.filter((s) => s.completed).map((s) => s.date));
  const exc = new Set(absences.map((a) => a.date));
  return `<div class="week-strip" role="list">${Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i), wd = parseISO(d).getDay();
    const di = dayForDate(me.program, d);
    const cls = [di < 0 ? "rest" : "", done.has(d) ? "done" : "", d === t ? "today" : "", exc.has(d) ? "excused" : ""].join(" ");
    return `<div class="wday ${cls}" role="listitem" ${d === selectedDate ? 'aria-current="date"' : ""}>
      <span class="d">${WEEKDAYS_SHORT[wd]} ${parseISO(d).getDate()}</span>
      <span class="g">${di < 0 ? "Descanso" : esc(me.program.days[di].group || `Día ${di + 1}`)}</span>
      <span class="d">${done.has(d) ? "✓ hecho" : exc.has(d) ? "justificado" : d < t && di >= 0 ? "—" : "&nbsp;"}</span>
    </div>`;
  }).join("")}</div>`;
}

// ------------------------------------------------------------ Bienvenida / anamnesis
async function welcome(view, ctx, data) {
  const { me } = data;
  const a = me.anamnesis || {};
  const p = me.profile || {};
  const scale = (name, val) => `<div class="scale" role="radiogroup">${[1, 2, 3, 4, 5].map((n) =>
    `<input type="radio" name="${name}" id="${name}${n}" value="${n}" ${+val === n ? "checked" : ""}><label for="${name}${n}">${n}</label>`).join("")}</div>`;
  view.innerHTML = `<div class="stack-lg">
    <div class="stack" style="gap:10px"><div class="eyebrow">Paso 1 de 1 · Antes de empezar</div>
      <h1>Hola, ${esc(firstName(me.name))}</h1>
      <p class="prose muted" style="font-size:17px">${esc(ctx.settings.welcome || "")}</p>
      <p class="prose muted">Con estas respuestas armo tu rutina y tu alimentación. Toma unos 5 minutos. Puedes cambiarlas después desde "Mi coach".</p></div>
    <form id="f-an" class="stack-lg">
      <section class="card stack"><h2>Tu objetivo</h2>
        <label class="field" for="a-goal">¿Qué quieres lograr en los próximos 3 meses?<textarea id="a-goal" rows="2" required>${esc(a.goal)}</textarea></label>
        <label class="field" for="a-why">¿Por qué es importante para ti empezar ahora?<textarea id="a-why" rows="2">${esc(a.why)}</textarea></label>
      </section>
      <section class="card stack"><h2>Salud y lesiones</h2>
        <label class="field" for="a-inj">Lesiones, dolores o molestias actuales o pasadas<textarea id="a-inj" rows="2" placeholder="Ej: dolor en hombro derecho al hacer press, cirugía de rodilla en 2020">${esc(a.injuries)}</textarea></label>
        <label class="field" for="a-cond">Condiciones médicas o indicaciones de tu médico que deba conocer<textarea id="a-cond" rows="2" placeholder="Si no tienes, escribe: ninguna">${esc(a.conditions)}</textarea></label>
      </section>
      <section class="card stack"><h2>Tu entrenamiento</h2>
        <div class="fields">
          <label class="field" for="a-exp">Tiempo entrenando<select id="a-exp">${["Nunca he entrenado", "Menos de 6 meses", "6 meses", "1 año", "2 años", "3 años o más", "4 años"].map((o) => `<option ${a.experience === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>
          <label class="field" for="a-days">Días por semana que puedes entrenar<select id="a-days">${[2, 3, 4, 5, 6].map((o) => `<option ${+a.daysAvailable === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>
          <label class="field" for="a-min">Minutos por sesión<select id="a-min">${[30, 45, 60, 75, 90].map((o) => `<option ${+a.minutes === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>
        </div>
        <div class="fields">
          <label class="field" for="a-gym">Gimnasio y sede donde entrenas<input id="a-gym" value="${esc(a.gym || p.gym)}" placeholder="Ej: Smart Fit Ciudad Jardín"></label>
          <label class="field" for="a-eq">Equipo disponible<select id="a-eq">${["Gimnasio completo", "Gimnasio básico (pocas máquinas)", "En casa con mancuernas", "En casa sin equipo"].map((o) => `<option ${a.equipment === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>
        </div>
        <label class="field" for="a-zone">Preferencias en el gimnasio<textarea id="a-zone" rows="2" placeholder="Ej: prefiero quedarme en una sola zona, no me gusta hacer fila para máquinas, a qué hora vas">${esc(a.zonePref)}</textarea></label>
      </section>
      <section class="card stack"><h2>Tu día a día</h2>
        <div class="fields">
          <label class="field" for="a-sleep">Horas de sueño<select id="a-sleep">${["Menos de 5", "5-6", "6-7", "7-8", "Más de 8"].map((o) => `<option ${a.sleep === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>
        </div>
        <div class="field">Nivel de estrés (1 bajo, 5 muy alto)${scale("a-stress", a.stress || 3)}</div>
        <label class="field" for="a-food">Alimentación: lo que no comes, horarios, dónde almuerzas<textarea id="a-food" rows="2">${esc(a.food)}</textarea></label>
      </section>
      <section class="card stack"><h2>Medidas iniciales</h2>
        <p class="muted small prose">Tómalas en casa con una cinta métrica de costura, en la mañana y antes de comer. Cintura: a la altura del ombligo. Cadera: en la parte más ancha del glúteo. Brazo y muslo: en la parte más ancha, lado derecho. No aprietes la cinta. Si no quieres tomar alguna, déjala vacía.</p>
        <div class="fields">
          ${[["m-weight", "Peso (kg)", p.startWeight], ["m-height", "Estatura (cm)", p.height], ["m-waist", "Cintura (cm)"], ["m-hip", "Cadera (cm)"], ["m-chest", "Pecho (cm)"], ["m-arm", "Brazo (cm)"], ["m-thigh", "Muslo (cm)"]]
            .map(([id, l, v]) => `<label class="field" for="${id}">${l}<input id="${id}" inputmode="decimal" value="${esc(v ?? "")}"></label>`).join("")}
        </div>
      </section>
      <label class="row small" for="a-ok" style="align-items:flex-start;gap:10px;flex-wrap:nowrap"><input type="checkbox" id="a-ok" ${a.date ? "checked" : ""} required>
        <span class="muted">Autorizo a ${esc(ctx.settings.brand || "mi coach")} a usar estos datos solo para diseñar y hacer seguimiento a mi plan, según la Ley 1581 de 2012 de protección de datos personales. Puedo pedir que los borre cuando quiera.</span></label>
      <p class="err" id="err"></p>
      <div><button class="btn-accent" type="submit">Guardar y ver mi plan</button></div>
    </form></div>`;

  $("#f-an").onsubmit = async (e) => {
    e.preventDefault();
    if (!$("#a-goal").value.trim()) return ($("#err").textContent = "Cuéntanos tu objetivo para poder armar tu plan.");
    if (!$("#a-ok").checked) return ($("#err").textContent = "Necesitamos tu autorización para guardar estos datos.");
    const an = {
      goal: $("#a-goal").value.trim(), why: $("#a-why").value.trim(), injuries: $("#a-inj").value.trim(), conditions: $("#a-cond").value.trim(),
      experience: $("#a-exp").value, daysAvailable: $("#a-days").value, minutes: $("#a-min").value, gym: $("#a-gym").value.trim(),
      equipment: $("#a-eq").value, zonePref: $("#a-zone").value.trim(), sleep: $("#a-sleep").value,
      stress: (view.querySelector('input[name="a-stress"]:checked') || {}).value || "", food: $("#a-food").value.trim(), date: iso(),
    };
    const num = (id) => { const v = parseFloat(String($(id).value).replace(",", ".")); return isNaN(v) ? "" : v; };
    const m = { weight: num("#m-weight"), height: num("#m-height"), waist: num("#m-waist"), hip: num("#m-hip"), chest: num("#m-chest"), arm: num("#m-arm"), thigh: num("#m-thigh") };
    try {
      const first = !data.me.anamnesis;
      await ctx.api.saveAnamnesis(an);
      if (first && Object.values(m).some((v) => v !== "")) await ctx.api.addMeasurement({ member_id: data.me.id, date: iso(), data: m });
      toast("Listo. Tu coach ya tiene tus respuestas.", "ok");
      location.hash = "#/app/hoy";
    } catch (ex) { $("#err").textContent = ex.message; }
  };
}

// ------------------------------------------------------------ Hoy
async function today(view, ctx, data, rest) {
  const { me, sessions, absences } = data;
  const t = iso();
  const prog = me.program || {};
  if (!prog.days?.length) {
    view.innerHTML = `<div class="stack-lg">${head(data, `Hola, ${esc(firstName(me.name))}`)}
      <div class="empty"><h3 style="margin-bottom:6px">Tu rutina está en preparación</h3><p>Sebastián está revisando tus respuestas para armarla. Te avisará por WhatsApp cuando esté lista.</p></div></div>`;
    return;
  }
  const forced = rest[0] !== undefined ? +rest[0] : null;
  const todayIdx = dayForDate(prog, t);
  const idx = forced ?? todayIdx;
  const absentToday = absences.find((a) => a.date === t);

  let body = "";
  if (idx < 0 || !prog.days[idx]) {
    const sched = scheduledWeekdays(prog);
    let next = null; for (let i = 1; i <= 7; i++) { const d = addDays(t, i); if (sched.has(parseISO(d).getDay())) { next = d; break; } }
    const nd = next ? prog.days[dayForDate(prog, next)] : null;
    body = `<div class="card card-ink stack"><div class="eyebrow">Hoy</div><h2>Día de descanso</h2>
      <p class="muted">Descansar también es parte del plan: el músculo crece cuando te recuperas. Camina, hidrátate y duerme bien.</p>
      ${nd ? `<p>Próxima sesión: <b>${fmtDate(next, true)} · ${esc(nd.group)}</b></p>` : ""}</div>
      <div class="stack"><h3>¿Quieres entrenar otro día de tu rutina hoy?</h3>
      <div class="row">${prog.days.map((d, i) => `<a class="btn btn-ghost btn-sm" href="#/app/hoy/${i}">${WEEKDAYS[d.weekday]} · ${esc(d.group)}</a>`).join("")}</div></div>`;
  } else {
    body = sessionView(ctx, data, idx, t, absentToday);
  }
  view.innerHTML = `<div class="stack-lg">${head(data, `Hola, ${esc(firstName(me.name))}`)}${weekStrip(data, t)}
    ${prog.weekNotes?.[currentWeek(prog)] ? `<div class="card card-tight row" style="gap:10px;flex-wrap:nowrap"><span class="pill bad">Semana ${currentWeek(prog)}</span><span>${esc(prog.weekNotes[currentWeek(prog)])}</span></div>` : ""}
    ${body}</div>`;
  if (idx >= 0 && prog.days[idx]) bindSession(view, ctx, data, idx, t);
}

function lastPerformance(sessions, name, excludeDate) {
  const key = name.toLowerCase().trim();
  for (const s of sessions) {
    if (!s.completed || s.date === excludeDate) continue;
    const l = (s.logs || []).find((x) => (x.name || "").toLowerCase().trim() === key);
    if (l) { const done = l.sets.filter((x) => x.done); if (done.length) return { date: s.date, sets: done }; }
  }
  return null;
}
const findLib = (library, name) => library.find((x) => x.name.toLowerCase().trim() === String(name).toLowerCase().trim());

function buildDraft(data, idx, date) {
  const { me, sessions } = data;
  const existing = sessions.find((s) => s.date === date && s.day_index === idx);
  const day = me.program.days[idx];
  if (draft && draft.member_id === me.id && draft.date === date && draft.day_index === idx) return draft;
  draft = {
    member_id: me.id, date, day_index: idx, week: currentWeek(me.program, date), completed: existing?.completed || false,
    feeling: existing?.feeling ?? null, note: existing?.note || "",
    logs: day.exercises.map((ex, i) => {
      const prev = existing?.logs?.[i];
      if (prev && (prev.orig || prev.name) === (ex.name)) return { ...prev, orig: prev.orig || ex.name };
      if (prev && prev.orig === ex.name) return prev;
      return { name: ex.name, orig: ex.name, sets: Array.from({ length: Math.max(1, +ex.sets || 1) }, () => ({ reps: "", kg: "", rir: "", done: false })) };
    }),
  };
  return draft;
}

function sessionView(ctx, data, idx, date, absent) {
  const { me, sessions, library } = data;
  const day = me.program.days[idx];
  const d = buildDraft(data, idx, date);
  const doneSets = d.logs.reduce((a, l) => a + l.sets.filter((s) => s.done).length, 0);
  const totalSets = d.logs.reduce((a, l) => a + l.sets.length, 0);
  return `<section class="stack">
    <div class="row between">
      <div class="stack" style="gap:4px"><div class="eyebrow">${date === iso() ? "Sesión de hoy" : fmtDate(date, true)} · ${WEEKDAYS[day.weekday]}</div><h2>${esc(day.group || `Día ${idx + 1}`)}</h2></div>
      <div class="row"><span class="pill ${d.completed ? "ok" : ""} dot" id="progress-pill">${d.completed ? "Sesión completada" : `${doneSets} de ${totalSets} series`}</span></div>
    </div>
    ${absent ? `<div class="card card-tight">Reportaste que hoy no podías entrenar (${esc(absent.data?.reason || "")}). Si al final sí entrenas, registra tus series normalmente.</div>` : ""}
    ${day.exercises.map((ex, i) => exerciseCard(ex, i, d.logs[i], sessions, library, date)).join("")}
    <div class="card stack">
      ${d.completed ? `<p><b>¡Sesión registrada!</b> Puedes seguir ajustando tus series si te equivocaste.</p>` : `<p class="muted">Cuando termines, cierra la sesión para que cuente en tu racha y Sebastián vea cómo te fue.</p>`}
      <div class="row">
        <button class="btn-accent" id="finish">${d.completed ? "Actualizar sesión" : "Terminar sesión"}</button>
        ${!d.completed && date === iso() && !absent ? `<button class="btn-ghost" id="absent">Hoy no puedo entrenar</button>` : ""}
      </div>
    </div>
  </section>`;
}

function exerciseCard(ex, i, log, sessions, library, date) {
  const lib = findLib(library, log.name) || findLib(library, ex.name);
  const swapped = log.name !== ex.name;
  const prev = lastPerformance(sessions, log.name, date);
  const allDone = log.sets.every((s) => s.done);
  const reps = parseInt(ex.reps) || "";
  const alts = [ex.alt, lib?.alternatives].filter(Boolean).join(", ");
  return `<article class="exercise ${allDone ? "complete" : ""}" data-ex="${i}">
    <div class="ex-head">
      <div class="ex-title"><div class="stack" style="gap:4px"><span class="ex-num">Ejercicio ${i + 1}${swapped ? " · cambiado" : ""}</span>
        <h3>${esc(log.name)}</h3>${swapped ? `<span class="small muted">En lugar de ${esc(ex.name)}</span>` : ""}</div>
        ${allDone ? '<span class="pill ok">✓</span>' : ""}</div>
      <div class="ex-meta">
        <span><b>Series</b>${esc(ex.sets)}</span><span><b>Reps</b>${esc(ex.reps)}</span>
        ${ex.kg ? `<span><b>Carga</b>${esc(ex.kg)} kg</span>` : ""}
        ${ex.rir !== "" && ex.rir != null ? `<span><b>RIR</b>${esc(ex.rir)}</span>` : ""}
        ${+ex.rest ? `<span><b>Descanso</b>${fmtRest(ex.rest)}</span>` : ""}
        ${ex.type && ex.type !== "Serie tradicional" ? `<span class="accent">${esc(ex.type)}</span>` : ""}
      </div>
      ${ex.notes ? `<p class="ex-cues"><b style="color:var(--ink)">Indicación:</b> ${esc(ex.notes)}</p>` : ""}
      ${lib?.cues ? `<p class="ex-cues">${esc(lib.cues)}</p>` : ""}
      <div class="ex-tools">${videoLink(lib?.video_url)}
        ${alts ? `<button type="button" class="btn-ghost btn-sm" data-swap="${i}">Máquina ocupada</button>` : ""}
        ${swapped ? `<button type="button" class="btn-quiet btn-sm" data-unswap="${i}">Volver al original</button>` : ""}</div>
    </div>
    ${prev ? `<p class="prev">Última vez (${fmtDate(prev.date)}): ${prev.sets.map((s) => `${s.reps || "?"}×${s.kg || 0} kg`).join(" · ")}</p>` : ""}
    <div class="sets">
      <div class="set-row head"><span>Serie</span><span>Reps</span><span>Kg</span><span>RIR</span><span></span></div>
      ${log.sets.map((s, j) => `<div class="set-row ${s.done ? "done" : ""}" data-set="${j}">
        <span class="n">${j + 1}</span>
        <input type="text" inputmode="numeric" aria-label="Repeticiones serie ${j + 1}" data-f="reps" value="${esc(s.reps)}" placeholder="${esc(reps)}">
        <input type="text" inputmode="decimal" aria-label="Kilos serie ${j + 1}" data-f="kg" value="${esc(s.kg)}" placeholder="${esc(prev?.sets?.[j]?.kg || ex.kg || "")}">
        <input type="text" inputmode="numeric" aria-label="RIR serie ${j + 1}" data-f="rir" value="${esc(s.rir)}" placeholder="${esc(ex.rir ?? "")}">
        <button type="button" class="set-check" aria-pressed="${s.done}" aria-label="Marcar serie ${j + 1} como hecha">✓</button>
      </div>`).join("")}
    </div>
  </article>`;
}

let saveTimer;
function autosave(ctx) {
  clearTimeout(saveTimer);
  const snap = JSON.parse(JSON.stringify(draft));
  saveTimer = setTimeout(() => ctx.api.upsertSession(snap).catch(() => {}), 900);
}

function bindSession(view, ctx, data, idx, date) {
  const day = data.me.program.days[idx];
  const refreshPill = () => {
    const done = draft.logs.reduce((a, l) => a + l.sets.filter((s) => s.done).length, 0);
    const total = draft.logs.reduce((a, l) => a + l.sets.length, 0);
    const p = $("#progress-pill"); if (p && !draft.completed) p.textContent = `${done} de ${total} series`;
  };
  $$(".exercise", view).forEach((card) => {
    const i = +card.dataset.ex;
    $$(".set-row[data-set]", card).forEach((row) => {
      const j = +row.dataset.set;
      const set = draft.logs[i].sets[j];
      $$("input", row).forEach((inp) => inp.addEventListener("input", () => { set[inp.dataset.f] = inp.value.trim(); autosave(ctx); }));
      row.querySelector(".set-check").onclick = () => {
        set.done = !set.done;
        if (set.done) {
          $$("input", row).forEach((inp) => { if (!inp.value && inp.placeholder) { inp.value = inp.placeholder; set[inp.dataset.f] = inp.placeholder; } });
          const isLast = j === draft.logs[i].sets.length - 1;
          const nextLabel = isLast ? (day.exercises[i + 1] ? `Sigue: ${draft.logs[i + 1]?.name}` : "Último ejercicio") : `Serie ${j + 2} de ${draft.logs[i].name}`;
          if (+day.exercises[i].rest) startTimer(+day.exercises[i].rest, nextLabel);
        }
        row.classList.toggle("done", set.done);
        row.querySelector(".set-check").setAttribute("aria-pressed", set.done);
        card.classList.toggle("complete", draft.logs[i].sets.every((s) => s.done));
        refreshPill(); autosave(ctx);
      };
    });
  });
  $$("[data-swap]", view).forEach((b) => (b.onclick = async () => {
    const i = +b.dataset.swap, ex = day.exercises[i];
    const lib = findLib(data.library, ex.name);
    const opts = [...new Set([ex.alt, lib?.alternatives].filter(Boolean).join(",").split(",").map((x) => x.trim()).filter(Boolean))];
    const choice = await modal({
      title: "Cambiar ejercicio", submitLabel: "Usar este",
      body: `<p class="muted">Si la máquina está ocupada o no existe en tu gimnasio, haz uno de estos. Trabajan el mismo músculo.</p>
        <div class="stack" style="gap:8px">${opts.map((o, k) => `<label class="row card card-tight" style="flex-wrap:nowrap;cursor:pointer" for="alt${k}"><input type="radio" name="alt" id="alt${k}" value="${esc(o)}" ${k === 0 ? "checked" : ""}> <span>${esc(o)}</span></label>`).join("")}</div>`,
      onSubmit: (f) => (f.querySelector('input[name="alt"]:checked') || {}).value,
    });
    if (!choice) return;
    draft.logs[i].name = choice; autosave(ctx); ctx.rerender();
  }));
  $$("[data-unswap]", view).forEach((b) => (b.onclick = () => { const i = +b.dataset.unswap; draft.logs[i].name = draft.logs[i].orig; autosave(ctx); ctx.rerender(); }));

  $("#absent")?.addEventListener("click", async () => {
    const r = await modal({
      title: "Hoy no puedo entrenar", submitLabel: "Avisar a mi coach",
      body: `<p class="muted">Está bien. Lo importante es que lo sepamos. Si lo reportas, tu racha no se rompe.</p>
        <label class="field" for="ab-r">Motivo<select id="ab-r">${["Trabajo", "Enfermedad", "Lesión o dolor", "Viaje", "Cansancio", "Otro"].map((o) => `<option>${o}</option>`).join("")}</select></label>
        <label class="field" for="ab-n">¿Quieres contarle algo a Sebastián?<textarea id="ab-n" rows="3"></textarea></label>`,
      onSubmit: (f) => ctx.api.addCheckin({ member_id: data.me.id, kind: "absence", date, data: { reason: f.querySelector("#ab-r").value, note: f.querySelector("#ab-n").value.trim() } }),
    });
    if (r) { toast("Listo, tu coach ya sabe. Nos vemos en la próxima.", "ok"); ctx.rerender(); }
  });

  $("#finish").onclick = async () => {
    const anyDone = draft.logs.some((l) => l.sets.some((s) => s.done));
    if (!anyDone) { toast("Marca al menos una serie como hecha.", "err"); return; }
    const res = await modal({
      title: "¿Cómo te sentiste?", submitLabel: "Guardar sesión",
      body: `<div class="scale" role="radiogroup" aria-label="Sensación">${[["1", "Muy mal"], ["2", "Mal"], ["3", "Normal"], ["4", "Bien"], ["5", "Excelente"]].map(([v, l]) =>
          `<input type="radio" name="fe" id="fe${v}" value="${v}" ${+(draft.feeling || 3) === +v ? "checked" : ""}><label for="fe${v}" title="${l}">${v}</label>`).join("")}</div>
        <p class="hint">1 muy mal · 3 normal · 5 excelente</p>
        <label class="field" for="fe-note">Nota para tu coach (opcional)<textarea id="fe-note" rows="3" placeholder="Ej: me dolió un poco la rodilla en la sentadilla">${esc(draft.note)}</textarea></label>`,
      onSubmit: async (f) => {
        draft.feeling = +(f.querySelector('input[name="fe"]:checked') || {}).value || 3;
        draft.note = f.querySelector("#fe-note").value.trim();
        draft.completed = true;
        clearTimeout(saveTimer);
        await ctx.api.upsertSession(draft);
        return true;
      },
    });
    if (!res) return;
    stopTimer();
    const before = personalBests(data.sessions.filter((s) => !(s.date === date && s.day_index === idx)));
    const after = personalBests([draft]);
    const prs = Object.entries(after).filter(([k, v]) => before[k] && v.kg > before[k].kg).map(([, v]) => v);
    await modal({
      title: "Sesión completada", submitLabel: "Seguir", cancelLabel: "",
      body: `<div class="pr-banner"><span class="eyebrow" style="color:inherit;opacity:.7">Racha</span><div style="font:800 54px/1 var(--display)">${computeStreak(data.me.program, [...data.sessions.filter((s) => s.date !== date), { date, completed: true }], data.absences)} días</div>
        <span>Un día más de disciplina. Eso es lo que construye el resultado.</span></div>
        ${prs.length ? `<div class="card stack" style="gap:6px"><h3>Nuevas marcas personales</h3>${prs.map((p) => `<p>${esc(p.name)}: <b class="accent mono">${fmtNum(p.kg, 1)} kg</b></p>`).join("")}</div>` : ""}
        <p class="muted small">Tonelaje de hoy: <span class="mono">${fmtNum(sessionTonnage(draft))} kg</span></p>`,
    });
    draft = null;
    ctx.rerender();
  };
}

// ------------------------------------------------------------ Temporizador de descanso
let audioCtx;
function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
    g.gain.setValueAtTime(0.25, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    o.start(); o.stop(audioCtx.currentTime + 0.6);
  } catch {}
  try { navigator.vibrate?.([200, 100, 200]); } catch {}
}
function startTimer(sec, label) {
  stopTimer();
  try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch {}
  timer = { end: Date.now() + sec * 1000, total: sec, label, beeped: false };
  timer.int = setInterval(renderTimer, 250);
  renderTimer();
}
function stopTimer() { if (timer?.int) clearInterval(timer.int); timer = null; $("#timer")?.remove(); }
function renderTimer() {
  if (!timer) { $("#timer")?.remove(); return; }
  let el = $("#timer");
  if (!el) {
    el = document.createElement("div"); el.id = "timer"; el.className = "timer"; el.setAttribute("role", "timer");
    el.innerHTML = `<div class="info"><span class="t"></span><span class="lbl"></span></div><button type="button" data-t="-15">−15</button><button type="button" data-t="15">+15</button><button type="button" data-t="x" aria-label="Cerrar temporizador">✕</button><i class="bar"></i>`;
    el.querySelectorAll("button").forEach((b) => (b.onclick = () => {
      if (b.dataset.t === "x") return stopTimer();
      timer.end += +b.dataset.t * 1000; timer.total = Math.max(timer.total + +b.dataset.t, 1); renderTimer();
    }));
    document.body.appendChild(el);
  }
  const left = Math.round((timer.end - Date.now()) / 1000);
  const over = left <= 0;
  if (over && !timer.beeped) { timer.beeped = true; beep(); }
  const a = Math.abs(left);
  el.querySelector(".t").textContent = `${over ? "+" : ""}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
  el.querySelector(".lbl").textContent = over ? `¡A la siguiente! ${timer.label}` : timer.label;
  el.querySelector(".bar").style.width = `${Math.max(0, Math.min(100, (left / timer.total) * 100))}%`;
  el.classList.toggle("over", over);
  if (left < -90) stopTimer();
}

// ------------------------------------------------------------ Mi rutina (semana completa)
async function week(view, ctx, data) {
  const { me, library } = data;
  const p = me.program || {};
  const wk = currentWeek(p);
  view.innerHTML = `<div class="stack-lg">${head(data, "Mi rutina")}
    ${!p.days?.length ? `<div class="empty">Tu rutina está en preparación.</div>` : `
    <div class="card card-tight row between"><span><b>${esc(p.name || "Mesociclo")}</b> · ${p.weeks || "—"} semanas${p.startDate ? ` · desde el ${fmtDate(p.startDate)}` : ""}</span><span class="pill bad">Semana ${wk}</span></div>
    ${Object.entries(p.weekNotes || {}).filter(([, v]) => v).length ? `<div class="card stack"><h3>Notas por semana</h3>${Object.entries(p.weekNotes).filter(([, v]) => v).sort((a, b) => a[0] - b[0]).map(([k, v]) => `<p><span class="pill ${+k === wk ? "bad" : ""}">Semana ${k}</span> ${esc(v)}</p>`).join("")}</div>` : ""}
    ${[...p.days].map((d, i) => ({ d, i })).sort((a, b) => ((a.d.weekday + 6) % 7) - ((b.d.weekday + 6) % 7)).map(({ d, i }) => `
      <section class="stack" style="gap:10px">
        <div class="row between"><div><div class="eyebrow">${WEEKDAYS[d.weekday]}</div><h2>${esc(d.group || `Día ${i + 1}`)}</h2></div>
          <a class="btn btn-ghost btn-sm" href="#/app/hoy/${i}">Entrenar este día</a></div>
        <div class="table-wrap"><table><thead><tr><th>Ejercicio</th><th class="num">Series</th><th class="num">Reps</th><th class="num">Kg</th><th class="num">RIR</th><th class="num">Descanso</th><th></th></tr></thead><tbody>
        ${d.exercises.map((ex) => { const lib = findLib(library, ex.name); return `<tr><td><b>${esc(ex.name)}</b>${ex.type && ex.type !== "Serie tradicional" ? ` <span class="pill">${esc(ex.type)}</span>` : ""}${ex.notes ? `<div class="small muted">${esc(ex.notes)}</div>` : ""}</td>
          <td class="num">${esc(ex.sets)}</td><td class="num">${esc(ex.reps)}</td><td class="num">${esc(ex.kg || "—")}</td><td class="num">${esc(ex.rir ?? "—")}</td><td class="num">${+ex.rest ? fmtRest(ex.rest) : "—"}</td>
          <td>${lib?.video_url ? `<a href="${esc(lib.video_url)}" target="_blank" rel="noopener" class="small">Video</a>` : ""}</td></tr>`; }).join("")}
        </tbody></table></div>
      </section>`).join("")}`}
  </div>`;
}

// ------------------------------------------------------------ Nutrición
async function nutrition(view, ctx, data) {
  const { me } = data;
  const n = me.nutrition || {};
  const tg = calcTargets(n);
  const meals = n.meals || [];
  const day = meals.reduce((t, m) => { const x = mealTotals(m.items); return { kcal: t.kcal + x.kcal, p: t.p + x.p, f: t.f + x.f, c: t.c + x.c }; }, { kcal: 0, p: 0, f: 0, c: 0 });
  const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
  const has = tg.kcal > 0 && (meals.length || n.basics?.weight);
  view.innerHTML = `<div class="stack-lg">${head(data, "Nutrición", "Tu plan de alimentación")}
    ${!has ? `<div class="empty">Tu plan de alimentación está en preparación.</div>` : `
    <div class="macros">
      <div class="macro"><small>Calorías al día</small><b>${fmtNum(tg.kcal)}</b><small>kcal</small><div class="meter"><i style="width:100%"></i></div></div>
      <div class="macro"><small>Proteína</small><b>${tg.p}</b><small>g · ${tg.split.p}%</small><div class="meter"><i style="width:${tg.split.p}%"></i></div></div>
      <div class="macro"><small>Carbohidratos</small><b>${tg.c}</b><small>g · ${tg.split.c}%</small><div class="meter"><i style="width:${tg.split.c}%"></i></div></div>
      <div class="macro"><small>Grasas</small><b>${tg.f}</b><small>g · ${tg.split.f}%</small><div class="meter"><i style="width:${tg.split.f}%"></i></div></div>
    </div>
    ${n.water ? `<p class="card card-tight">Agua: <b>${esc(n.water)}</b> al día. Lleva tu termo al gimnasio y a la oficina.</p>` : ""}
    ${meals.length ? `<section class="card stack"><div class="row between"><h2>Tu menú base</h2><span class="small muted mono">${fmtNum(day.kcal)} kcal · P ${fmtNum(day.p)} · C ${fmtNum(day.c)} · G ${fmtNum(day.f)}</span></div>
      <div>${meals.map((m) => { const t = mealTotals(m.items); return `<div class="meal">
        <div class="meal-head"><h3>${esc(m.name)}${m.time ? ` <span class="mono small muted" style="text-transform:none">· ${esc(m.time)}</span>` : ""}</h3><span class="mono small muted">${fmtNum(t.kcal)} kcal · ${fmtNum(t.p)} g proteína</span></div>
        <ul class="food-list">${(m.items || []).map((it) => `<li><span>${esc(it.food)}</span><span>${esc(fmtNum(it.qty, 1))} ${esc(it.unit === "unidad" ? (+it.qty === 1 ? "unidad" : "unidades") : it.unit)}</span></li>`).join("")}</ul>
        ${m.note ? `<p class="small muted">${esc(m.note)}</p>` : ""}</div>`; }).join("")}</div>
      <p class="small muted">Puedes cambiar un alimento por otro del mismo grupo y cantidad parecida: pollo por pescado, arroz por papa, arepa por pan integral.</p></section>` : ""}
    ${(n.recs || []).length ? `<section class="stack"><h2>Recomendaciones de tu coach</h2><ul class="recs">${n.recs.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></section>` : ""}
    `}
    <section class="card stack"><h3>¿Te saliste del plan?</h3><p class="muted">Pasa, y no te hace perder el proceso. Cuéntanos qué comiste y te decimos cómo seguir el resto del día.</p>
      <div><button class="btn-ghost" id="offplan">Me salí del plan</button></div></section>
  </div>`;
  $("#offplan").onclick = async () => {
    const ok = await modal({
      title: "Me salí del plan", submitLabel: "Enviar",
      body: `<label class="field" for="op-w">¿Qué comiste?<textarea id="op-w" rows="2" placeholder="Ej: hamburguesa con papas en el cumpleaños de un amigo" required></textarea></label>
        <label class="field" for="op-f">¿Cómo te sientes con eso?<select id="op-f">${["Tranquilo", "Un poco culpable", "Muy culpable", "Con hambre todavía"].map((o) => `<option>${o}</option>`).join("")}</select></label>`,
      onSubmit: async (f) => {
        const what = f.querySelector("#op-w").value.trim();
        if (!what) throw new Error("Cuéntanos qué comiste.");
        await ctx.api.addCheckin({ member_id: me.id, kind: "offplan", date: iso(), data: { what, feeling: f.querySelector("#op-f").value } });
        return true;
      },
    });
    if (!ok) return;
    const tips = String(ctx.settings.offplanTips || "").split("\n").filter(Boolean);
    await modal({
      title: "Todo bien, sigue", submitLabel: "Entendido", cancelLabel: "",
      body: `<p>Una comida no borra semanas de trabajo. Lo que define tu resultado es lo que haces la mayoría de los días.</p>
        <ul class="recs">${tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <p class="small muted">Sebastián ya lo sabe. Si se repite, lo ajustamos juntos en tu plan.</p>`,
    });
  };
}

// ------------------------------------------------------------ Progreso
async function progress(view, ctx, data) {
  const { me, sessions, checkins } = data;
  const ms = await ctx.api.listMeasurements(me.id);
  const weights = ms.filter((m) => +m.data?.weight).map((m) => ({ x: m.date, y: +m.data.weight }));
  const pbs = Object.values(personalBests(sessions)).sort((a, b) => b.kg - a.kg).slice(0, 8);
  const done = sessions.filter((s) => s.completed);
  const first = weights[0], last = weights[weights.length - 1];
  const delta = first && last ? last.y - first.y : 0;
  const t = iso(); const monday = addDays(t, -((parseISO(t).getDay() + 6) % 7));
  const weekly = checkins.find((c) => c.kind === "weekly" && c.date >= monday);
  const cols = [["weight", "Peso"], ["waist", "Cintura"], ["hip", "Cadera"], ["chest", "Pecho"], ["arm", "Brazo"], ["thigh", "Muslo"], ["fat", "% grasa"]];

  view.innerHTML = `<div class="stack-lg">${head(data, "Progreso", "Tu evolución")}
    <div class="kpis">
      <div class="kpi"><b>${done.length}</b><span>Sesiones completadas</span></div>
      <div class="kpi"><b>${data.streak}</b><span>Días de racha actual</span></div>
      <div class="kpi"><b>${last ? fmtNum(last.y, 1) : "—"}</b><span>Peso actual (kg)</span></div>
      <div class="kpi"><b>${first && last ? (delta > 0 ? "+" : "") + fmtNum(delta, 1) : "—"}</b><span>Cambio desde el inicio (kg)</span></div>
    </div>
    ${!weekly ? `<section class="card card-ink stack"><div class="eyebrow">Check-in semanal</div><h2>¿Cómo va tu semana?</h2><p class="muted">Un minuto. Sebastián lo usa para ajustar tu plan.</p><div><button class="btn-accent" id="weekly">Hacer check-in</button></div></section>` : ""}
    <section class="card stack"><div class="row between"><h2>Peso</h2><button class="btn-ghost btn-sm" id="add-m">Registrar medidas</button></div>
      ${lineChart(weights, { unit: "kg" })}</section>
    <section class="stack"><h2>Medidas</h2>
      ${ms.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th>${cols.map(([, l]) => `<th class="num">${l}</th>`).join("")}<th></th></tr></thead><tbody>
        ${[...ms].reverse().map((m) => `<tr><td>${fmtDate(m.date)}</td>${cols.map(([k]) => `<td class="num">${m.data?.[k] !== "" && m.data?.[k] != null ? fmtNum(m.data[k], 1) : "—"}</td>`).join("")}
          <td><button class="btn-quiet btn-sm" data-delm="${m.id}" aria-label="Borrar registro">✕</button></td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">Aún no tienes medidas registradas.</div>`}
    </section>
    <section class="stack"><h2>Mejores marcas</h2>
      ${pbs.length ? `<div class="grid-3">${pbs.map((p) => `<div class="card card-tight stack" style="gap:4px"><span class="small muted">${esc(p.name)}</span><b style="font:700 26px/1 var(--display)">${fmtNum(p.kg, 1)} kg <span class="mono small muted">× ${p.reps}</span></b><span class="small muted">${fmtDate(p.date)}</span></div>`).join("")}</div>`
        : `<div class="empty">Registra tus cargas en cada serie para ver tus marcas.</div>`}
    </section>
    <section class="stack"><h2>Historial de sesiones</h2>
      ${done.length ? `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Día</th><th class="num">Series</th><th class="num">Tonelaje</th><th class="num">Sensación</th></tr></thead><tbody>
        ${done.slice(0, 30).map((s) => `<tr><td>${fmtDate(s.date, true)}</td><td>${esc(me.program.days?.[s.day_index]?.group || "—")}</td>
          <td class="num">${s.logs.reduce((a, l) => a + l.sets.filter((x) => x.done).length, 0)}</td><td class="num">${fmtNum(sessionTonnage(s))} kg</td><td class="num">${s.feeling ? s.feeling + "/5" : "—"}</td></tr>`).join("")}
      </tbody></table></div>` : `<div class="empty">Tu primera sesión aparecerá aquí.</div>`}
    </section></div>`;

  $("#add-m").onclick = async () => {
    const ok = await modal({
      title: "Registrar medidas", submitLabel: "Guardar",
      body: `<p class="small muted">En la mañana, antes de comer, con cinta métrica de costura. Cintura a la altura del ombligo; cadera en la parte más ancha; brazo y muslo en la parte más ancha del lado derecho.</p>
        <label class="field" for="md">Fecha<input type="date" id="md" value="${iso()}" max="${iso()}"></label>
        <div class="fields">${cols.map(([k, l]) => `<label class="field" for="mm-${k}">${l}${k === "weight" ? " (kg)" : k === "fat" ? "" : " (cm)"}<input id="mm-${k}" inputmode="decimal"></label>`).join("")}</div>`,
      onSubmit: async (f) => {
        const d = {}; let any = false;
        cols.forEach(([k]) => { const v = parseFloat(String(f.querySelector("#mm-" + k).value).replace(",", ".")); d[k] = isNaN(v) ? "" : v; if (!isNaN(v)) any = true; });
        if (!any) throw new Error("Escribe al menos una medida.");
        await ctx.api.addMeasurement({ member_id: me.id, date: f.querySelector("#md").value || iso(), data: d });
      },
    });
    if (ok) { toast("Medidas guardadas", "ok"); ctx.rerender(); }
  };
  $$("[data-delm]", view).forEach((b) => (b.onclick = async () => { await ctx.api.deleteMeasurement(b.dataset.delm); ctx.rerender(); }));
  $("#weekly")?.addEventListener("click", async () => {
    const sc = (n, l) => `<div class="field">${l}<div class="scale">${[1, 2, 3, 4, 5].map((v) => `<input type="radio" name="${n}" id="${n}${v}" value="${v}" ${v === 3 ? "checked" : ""}><label for="${n}${v}">${v}</label>`).join("")}</div></div>`;
    const ok = await modal({
      title: "Check-in semanal", submitLabel: "Enviar",
      body: `${sc("w-energy", "Energía (1 muy baja, 5 muy alta)")}${sc("w-sleep", "Calidad del sueño")}${sc("w-stress", "Estrés (1 bajo, 5 muy alto)")}${sc("w-hunger", "Hambre (1 nada, 5 mucha)")}
        <label class="field" for="w-note">¿Algo que Sebastián deba saber?<textarea id="w-note" rows="3"></textarea></label>`,
      onSubmit: async (f) => {
        const g = (n) => +(f.querySelector(`input[name="${n}"]:checked`) || {}).value || 3;
        await ctx.api.addCheckin({ member_id: me.id, kind: "weekly", date: iso(), data: { energy: g("w-energy"), sleep: g("w-sleep"), stress: g("w-stress"), hunger: g("w-hunger"), note: f.querySelector("#w-note").value.trim() } });
      },
    });
    if (ok) { toast("Gracias. Tu coach lo revisará.", "ok"); ctx.rerender(); }
  });
}

// ------------------------------------------------------------ Mi coach
async function coachTab(view, ctx, data) {
  const { me } = data;
  const s = ctx.settings;
  const wa = String(s.whatsapp || "").replace(/\D/g, "");
  view.innerHTML = `<div class="stack-lg">${head(data, "Mi coach", s.brand || "")}
    <section class="card card-ink stack"><div class="eyebrow">Mensaje de Sebastián para ${esc(firstName(me.name))}</div>
      <p class="pre" style="font-size:17px">${esc(me.coach_note || "Por ahora no hay mensajes nuevos. Sigue tu plan y registra tus series.")}</p></section>
    <section class="grid-2">
      <div class="card stack"><h3>Hablar con mi coach</h3>
        ${wa ? `<p class="muted">Escríbele por WhatsApp para dudas, videos de técnica o cambios en tu plan.</p>
          <div class="row"><a class="btn btn-accent" href="https://wa.me/${wa}" target="_blank" rel="noopener">Abrir WhatsApp</a><span class="mono">+${esc(wa)}</span></div>`
          : `<p class="muted">Escríbele a Sebastián por el WhatsApp de siempre.</p>`}
      </div>
      <div class="card stack"><h3>Mis datos</h3>
        <p class="muted">Código de acceso: <span class="mono">${esc(me.code)}</span></p>
        <div class="row"><a class="btn btn-ghost btn-sm" href="#/app/bienvenida">Actualizar mi cuestionario</a><button class="btn-ghost btn-sm" id="copy-code">Copiar código</button></div>
      </div>
    </section>
    <section class="stack"><h2>Cómo trabajamos</h2><ul class="recs">
      <li>Registra cada serie con las repeticiones y el peso reales. Así sé cuándo subir la carga.</li>
      <li>RIR es cuántas repeticiones te quedaron en reserva. RIR 2 significa que pudiste hacer 2 más con buena técnica.</li>
      <li>Si una máquina está ocupada, usa "Máquina ocupada" y elige una alternativa. No pierdas el ritmo.</li>
      <li>Si un día no puedes entrenar, avísalo en la app. Tu racha no se rompe y yo sé qué pasó.</li>
      <li>El físico es la consecuencia. La disciplina es lo que controlas cada día.</li>
    </ul></section></div>`;
  $("#copy-code").onclick = () => copyText(me.code);
}
