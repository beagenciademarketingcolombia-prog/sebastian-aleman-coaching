// Utilidades compartidas: formato, fechas, cálculos de entrenamiento y nutrición

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const SET_TYPES = [
  "Serie tradicional", "Serie por segundos", "Serie por minutos", "Drop set", "Rest pause",
  "Biserie", "Triserie", "Cluster", "Circuito HIIT", "Al fallo",
];
export const GROUPS = [
  "Pierna", "Pierna anterior", "Pierna posterior", "Torso", "Empuje", "Tirón", "Pecho", "Espalda",
  "Hombro", "Brazo", "Full body", "Cadena posterior", "Cadena anterior", "Glúteo", "Abdomen", "Cardio", "Movilidad",
];
export const REST_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 210, 240, 300];
export const MEAL_NAMES = ["Desayuno", "Media mañana", "Almuerzo", "Merienda", "Pre entreno", "Post entreno", "Cena", "Colación"];
export const ACTIVITY = [
  ["sedentario", "Sedentario", 1.2], ["ligero", "Ligeramente activo", 1.375],
  ["activo", "Activo", 1.55], ["muy", "Muy activo", 1.725],
];
export const GOALS = [
  ["cut_fast", "Perder peso rápido", -0.2], ["cut", "Perder peso lento", -0.15], ["cut_slow", "Perder peso muy lento", -0.1],
  ["maint", "Mantenimiento", 0], ["bulk_slow", "Ganar peso lentamente", 0.1], ["bulk", "Ganar peso rápido", 0.15],
];

export const fmtRest = (s) => {
  s = +s || 0;
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r ? `${m}:${String(r).padStart(2, "0")} min` : `${m} min`;
};
export const fmtNum = (n, d = 0) =>
  (Number(n) || 0).toLocaleString("es-CO", { maximumFractionDigits: d, minimumFractionDigits: 0 });

// ----- Fechas (siempre en hora local, formato YYYY-MM-DD) -----
export const iso = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const parseISO = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
export const fmtDate = (s, withDay = false) => {
  const d = parseISO(s);
  return `${withDay ? WEEKDAYS[d.getDay()] + " " : ""}${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

// ----- Programa -----
export function currentWeek(program, today = iso()) {
  if (!program?.startDate) return 1;
  const w = Math.floor(daysBetween(program.startDate, today) / 7) + 1;
  return Math.max(1, Math.min(w, program.weeks || 99));
}
export function dayForDate(program, date = iso()) {
  if (!program?.days?.length) return -1;
  const wd = parseISO(date).getDay();
  return program.days.findIndex((d) => +d.weekday === wd);
}
export const scheduledWeekdays = (program) => new Set((program?.days || []).map((d) => +d.weekday));

// Racha: días programados seguidos con sesión completada.
// Un día de hoy pendiente no la rompe; una ausencia justificada tampoco (pero no suma).
export function computeStreak(program, sessions, absences, today = iso()) {
  const sched = scheduledWeekdays(program);
  if (!sched.size) return 0;
  const done = new Set(sessions.filter((s) => s.completed).map((s) => s.date));
  const excused = new Set(absences.map((a) => a.date));
  const start = program.startDate || sessions.map((s) => s.date).sort()[0] || today;
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = addDays(today, -i);
    if (d < start) break;
    if (!sched.has(parseISO(d).getDay())) { if (done.has(d)) streak++; continue; }
    if (done.has(d)) { streak++; continue; }
    if (i === 0 || excused.has(d)) continue;
    break;
  }
  return streak;
}

export function weekAdherence(program, sessions, today = iso()) {
  const sched = scheduledWeekdays(program);
  const d = parseISO(today);
  const monday = addDays(today, -((d.getDay() + 6) % 7));
  let planned = 0, done = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i);
    if (sched.has(parseISO(day).getDay())) planned++;
  }
  done = new Set(sessions.filter((s) => s.completed && s.date >= monday && s.date <= addDays(monday, 6)).map((s) => s.date)).size;
  return { planned, done };
}

export const sessionTonnage = (s) =>
  (s.logs || []).reduce((t, l) => t + (l.sets || []).reduce((a, x) => a + (x.done ? (+x.reps || 0) * (+x.kg || 0) : 0), 0), 0);

// Mejores marcas por ejercicio (kg máximos en una serie hecha)
export function personalBests(sessions) {
  const pb = {};
  for (const s of sessions) for (const l of s.logs || []) for (const x of l.sets || []) {
    if (!x.done || !+x.kg) continue;
    const k = (l.name || "").toLowerCase().trim();
    if (!pb[k] || +x.kg > pb[k].kg) pb[k] = { name: l.name, kg: +x.kg, reps: +x.reps || 0, date: s.date };
  }
  return pb;
}

// ----- Nutrición -----
export function calcTargets(n) {
  const b = n?.basics || {};
  const w = +b.weight, h = +b.height, a = +b.age;
  let bmr = 0;
  if (w && h && a) bmr = Math.round(10 * w + 6.25 * h - 5 * a + (b.sex === "F" ? -161 : 5));
  const act = (ACTIVITY.find((x) => x[0] === b.activity) || ACTIVITY[2])[2];
  const tdee = Math.round(bmr * act);
  const adj = (GOALS.find((x) => x[0] === b.goal) || GOALS[3])[2];
  const auto = Math.round(tdee * (1 + adj) / 10) * 10;
  const kcal = +n?.kcalOverride || auto;
  const sp = n?.split || { p: 30, f: 25, c: 45 };
  return {
    bmr, tdee, auto, kcal,
    p: Math.round((kcal * sp.p) / 100 / 4),
    f: Math.round((kcal * sp.f) / 100 / 9),
    c: Math.round((kcal * sp.c) / 100 / 4),
    split: sp,
  };
}
export const mealTotals = (items = []) =>
  items.reduce((t, i) => ({ kcal: t.kcal + (+i.kcal || 0), p: t.p + (+i.p || 0), f: t.f + (+i.f || 0), c: t.c + (+i.c || 0) }), { kcal: 0, p: 0, f: 0, c: 0 });

// Base de alimentos frecuentes en Colombia. Valores por 100 g (o por unidad cuando unit = "unidad").
// [nombre, unidad, base, kcal, proteína, grasa, carbohidrato]
export const FOODS = [
  ["Pechuga de pollo (cocida)", "g", 100, 165, 31, 3.6, 0],
  ["Muslo de pollo sin piel (cocido)", "g", 100, 209, 26, 10.9, 0],
  ["Carne de res magra (cocida)", "g", 100, 217, 26, 11.8, 0],
  ["Lomo de cerdo (cocido)", "g", 100, 196, 27, 9, 0],
  ["Tilapia (cocida)", "g", 100, 128, 26, 2.7, 0],
  ["Salmón (cocido)", "g", 100, 206, 22, 12, 0],
  ["Atún en agua (escurrido)", "g", 100, 116, 26, 1, 0],
  ["Huevo entero", "unidad", 1, 72, 6.3, 4.8, 0.4],
  ["Clara de huevo", "unidad", 1, 17, 3.6, 0.1, 0.2],
  ["Proteína whey", "g", 30, 120, 24, 1.5, 3],
  ["Yogur griego natural", "g", 100, 97, 9, 5, 4],
  ["Leche descremada", "ml", 100, 34, 3.4, 0.1, 5],
  ["Queso campesino", "g", 100, 265, 18, 21, 2],
  ["Arroz blanco (cocido)", "g", 100, 130, 2.7, 0.3, 28],
  ["Arroz integral (cocido)", "g", 100, 123, 2.7, 1, 26],
  ["Papa (cocida)", "g", 100, 87, 1.9, 0.1, 20],
  ["Papa criolla (cocida)", "g", 100, 97, 2, 0.1, 22],
  ["Yuca (cocida)", "g", 100, 160, 1.4, 0.3, 38],
  ["Plátano maduro (cocido)", "g", 100, 116, 0.8, 0.2, 31],
  ["Arepa de maíz blanca (mediana)", "unidad", 1, 150, 3.5, 2, 30],
  ["Pan integral", "g", 100, 247, 13, 3.4, 41],
  ["Avena en hojuelas", "g", 100, 389, 17, 7, 66],
  ["Pasta (cocida)", "g", 100, 158, 5.8, 0.9, 31],
  ["Fríjoles (cocidos)", "g", 100, 127, 8.7, 0.5, 23],
  ["Lentejas (cocidas)", "g", 100, 116, 9, 0.4, 20],
  ["Garbanzos (cocidos)", "g", 100, 164, 8.9, 2.6, 27],
  ["Banano", "unidad", 1, 105, 1.3, 0.4, 27],
  ["Manzana", "unidad", 1, 95, 0.5, 0.3, 25],
  ["Papaya", "g", 100, 43, 0.5, 0.3, 11],
  ["Fresas", "g", 100, 32, 0.7, 0.3, 7.7],
  ["Mango", "g", 100, 60, 0.8, 0.4, 15],
  ["Aguacate", "g", 100, 160, 2, 15, 9],
  ["Brócoli", "g", 100, 35, 2.4, 0.4, 7],
  ["Ensalada de verduras", "g", 100, 25, 1.5, 0.2, 5],
  ["Tomate", "g", 100, 18, 0.9, 0.2, 3.9],
  ["Aceite de oliva", "g", 10, 88, 0, 10, 0],
  ["Mantequilla de maní", "g", 100, 588, 25, 50, 20],
  ["Almendras", "g", 100, 579, 21, 50, 22],
  ["Miel", "g", 10, 30, 0, 0, 8],
  ["Gelatina sin azúcar", "unidad", 1, 10, 1, 0, 0],
  ["Café o tinto sin azúcar", "unidad", 1, 2, 0.3, 0, 0],
];
export function foodMacros(name, qty) {
  const f = FOODS.find((x) => x[0].toLowerCase() === String(name).toLowerCase().trim());
  if (!f) return null;
  const k = (+qty || 0) / f[2];
  return { unit: f[1], kcal: Math.round(f[3] * k), p: +(f[4] * k).toFixed(1), f: +(f[5] * k).toFixed(1), c: +(f[6] * k).toFixed(1) };
}

export function genCode(existing = []) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c;
  do {
    const arr = new Uint32Array(6);
    crypto.getRandomValues(arr);
    c = "SA-" + [...arr].map((n) => a[n % a.length]).join("");
  } while (existing.includes(c));
  return c;
}
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
export const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "";

export function youtubeId(url) {
  const m = String(url || "").match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}
