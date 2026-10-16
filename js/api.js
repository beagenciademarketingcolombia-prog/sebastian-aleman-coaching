// Capa de datos con dos motores:
//  - "demo": guarda todo en el navegador (localStorage) con datos de ejemplo
//  - "supabase": base de datos real con autenticación y reglas RLS
// Las vistas solo usan este módulo, así que cambiar de motor no toca la interfaz.
import { SUPABASE_URL, SUPABASE_ANON_KEY, MEMBER_EMAIL_DOMAIN } from "./config.js";
import { buildDemo, DEMO_COACH, DEMO_MEMBER_PASSWORD } from "./demo-data.js";
import { genCode, uid, iso, addDays } from "./util.js";

const normCode = (c) => {
  let s = String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith("SA")) s = s.slice(2);
  return "SA-" + s;
};
const memberEmail = (code) => `${normCode(code).toLowerCase()}@${MEMBER_EMAIL_DOMAIN}`;

// ------------------------------------------------------------------ DEMO
const KEY = "alemancoach-demo-v2";
const SKEY = "alemancoach-demo-session";
const store = {
  get(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

function demoApi() {
  let db = store.get(KEY, null);
  if (!db) {
    db = buildDemo();
    db.passwords = {};
    db.members.forEach((m) => { if (m.claimed) db.passwords[m.id] = DEMO_MEMBER_PASSWORD; });
    store.set(KEY, db);
  }
  let sess = store.get(SKEY, null);
  const save = () => store.set(KEY, db);
  const clone = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const pub = (m) => { const { claimed, ...rest } = m; return { ...clone(rest), claimed: !!claimed }; };
  const mine = (memberId) => sess && (sess.role === "coach" || sess.memberId === memberId);
  const need = (cond) => { if (!cond) throw new Error("No tienes permiso para hacer esto."); };

  return {
    mode: "demo",
    demoHints: { coach: DEMO_COACH, memberPassword: DEMO_MEMBER_PASSWORD },
    async init() {},
    async session() { return sess; },
    async coachLogin(email, pwd) {
      if (String(email).trim().toLowerCase() !== DEMO_COACH.email || pwd !== DEMO_COACH.password)
        throw new Error("Correo o contraseña incorrectos.");
      sess = { role: "coach" }; store.set(SKEY, sess); return sess;
    },
    async codeStatus(code) {
      const m = db.members.find((x) => x.code === normCode(code));
      if (!m) return "invalid";
      if (!m.active) return "paused";
      return m.claimed ? "claimed" : "available";
    },
    async memberActivate(code, pwd) {
      const m = db.members.find((x) => x.code === normCode(code));
      if (!m || !m.active || m.claimed) throw new Error("Este código no está disponible.");
      m.claimed = true; db.passwords[m.id] = pwd; save();
      sess = { role: "member", memberId: m.id }; store.set(SKEY, sess); return sess;
    },
    async memberLogin(code, pwd) {
      const m = db.members.find((x) => x.code === normCode(code));
      if (!m || !m.claimed || db.passwords[m.id] !== pwd) throw new Error("El código o la contraseña no coinciden.");
      if (!m.active) throw new Error("Tu acceso está pausado. Escríbele a tu coach para reactivarlo.");
      sess = { role: "member", memberId: m.id }; store.set(SKEY, sess); return sess;
    },
    async logout() { sess = null; store.del(SKEY); },
    async resetDemo() { store.del(KEY); store.del(SKEY); },

    async getSettings() { return clone(db.settings); },
    async saveSettings(s) { need(sess?.role === "coach"); db.settings = clone(s); save(); },

    async listExercises() { return clone(db.exercises).sort((a, b) => a.name.localeCompare(b.name, "es")); },
    async saveExercise(ex) {
      need(sess?.role === "coach");
      if (ex.id) { const i = db.exercises.findIndex((x) => x.id === ex.id); if (i >= 0) db.exercises[i] = clone(ex); else db.exercises.push(clone(ex)); }
      else db.exercises.push({ ...clone(ex), id: uid() });
      save();
    },
    async deleteExercise(id) { need(sess?.role === "coach"); db.exercises = db.exercises.filter((x) => x.id !== id); save(); },

    async listMembers() { need(sess?.role === "coach"); return db.members.map(pub); },
    async getMember(id) { need(mine(id)); const m = db.members.find((x) => x.id === id); return m ? pub(m) : null; },
    async myMember() { need(sess?.role === "member"); const m = db.members.find((x) => x.id === sess.memberId); return m ? pub(m) : null; },
    async createMember(data) {
      need(sess?.role === "coach");
      const m = { id: uid(), code: genCode(db.members.map((x) => x.code)), claimed: false, active: true, anamnesis: null, coach_note: "",
        profile: {}, program: { name: "", weeks: 8, startDate: iso(), weekNotes: {}, days: [] },
        nutrition: { basics: {}, split: { p: 30, f: 25, c: 45 }, meals: [], recs: [], water: "" }, ...clone(data) };
      db.members.push(m); save(); return pub(m);
    },
    async updateMember(id, patch) {
      need(sess?.role === "coach");
      const m = db.members.find((x) => x.id === id); Object.assign(m, clone(patch)); save(); return pub(m);
    },
    async regenCode(id) {
      need(sess?.role === "coach");
      const m = db.members.find((x) => x.id === id);
      m.code = genCode(db.members.map((x) => x.code)); m.claimed = false; delete db.passwords[id]; save(); return pub(m);
    },
    async deleteMember(id) {
      need(sess?.role === "coach");
      db.members = db.members.filter((x) => x.id !== id);
      for (const t of ["sessions", "checkins", "measurements"]) db[t] = db[t].filter((x) => x.member_id !== id);
      save();
    },
    async saveAnamnesis(data) {
      need(sess?.role === "member");
      db.members.find((x) => x.id === sess.memberId).anamnesis = clone(data); save();
    },

    async listSessions(memberId, sinceDays = 400) {
      need(mine(memberId)); const since = addDays(iso(), -sinceDays);
      return clone(db.sessions.filter((s) => s.member_id === memberId && s.date >= since)).sort((a, b) => b.date.localeCompare(a.date));
    },
    async upsertSession(s) {
      need(mine(s.member_id));
      const i = db.sessions.findIndex((x) => x.member_id === s.member_id && x.date === s.date && x.day_index === s.day_index);
      const row = { ...clone(s), id: i >= 0 ? db.sessions[i].id : uid() };
      if (i >= 0) db.sessions[i] = row; else db.sessions.push(row);
      save(); return clone(row);
    },
    async listCheckins(memberId) {
      need(mine(memberId));
      return clone(db.checkins.filter((c) => c.member_id === memberId)).sort((a, b) => b.date.localeCompare(a.date));
    },
    async addCheckin(c) { need(mine(c.member_id)); const row = { ...clone(c), id: uid() }; db.checkins.push(row); save(); return row; },
    async deleteCheckin(id) {
      const c = db.checkins.find((x) => x.id === id); need(c && mine(c.member_id));
      db.checkins = db.checkins.filter((x) => x.id !== id); save();
    },
    async listMeasurements(memberId) {
      need(mine(memberId));
      return clone(db.measurements.filter((c) => c.member_id === memberId)).sort((a, b) => a.date.localeCompare(b.date));
    },
    async addMeasurement(m) { need(mine(m.member_id)); const row = { ...clone(m), id: uid() }; db.measurements.push(row); save(); return row; },
    async deleteMeasurement(id) {
      const m = db.measurements.find((x) => x.id === id); need(m && mine(m.member_id));
      db.measurements = db.measurements.filter((x) => x.id !== id); save();
    },
    async coachActivity(days = 60) {
      need(sess?.role === "coach"); const since = addDays(iso(), -days);
      return { sessions: clone(db.sessions.filter((s) => s.date >= since)), checkins: clone(db.checkins.filter((c) => c.date >= since)) };
    },
  };
}

// -------------------------------------------------------------- SUPABASE
async function supabaseApi() {
  const lib = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
  const { createClient } = await import(/* @vite-ignore */ lib);
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  const ok = ({ data, error }) => { if (error) throw new Error(translate(error.message)); return data; };
  const translate = (m) => {
    if (/Invalid login credentials/i.test(m)) return "El usuario o la contraseña no coinciden.";
    if (/Password should be at least/i.test(m)) return "La contraseña debe tener mínimo 6 caracteres.";
    if (/already registered/i.test(m)) return "Este código ya fue activado. Ingresa con tu contraseña.";
    if (/Email not confirmed/i.test(m)) return "Falta desactivar la confirmación de correo en Supabase (ver README).";
    return m;
  };
  const toMember = (r) => r && ({ ...r, claimed: !!r.user_id });
  let cached = null;

  async function resolveRole() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return (cached = null);
    const isCoach = ok(await sb.rpc("is_coach"));
    if (isCoach) return (cached = { role: "coach" });
    const rows = ok(await sb.from("members").select("id").eq("user_id", user.id).limit(1));
    return (cached = rows[0] ? { role: "member", memberId: rows[0].id } : null);
  }

  return {
    mode: "supabase",
    async init() { await resolveRole(); },
    async session() { return cached; },
    async coachLogin(email, pwd) {
      ok(await sb.auth.signInWithPassword({ email: String(email).trim(), password: pwd }));
      const s = await resolveRole();
      if (s?.role !== "coach") { await sb.auth.signOut(); cached = null; throw new Error("Esta cuenta no tiene permisos de coach."); }
      return s;
    },
    async codeStatus(code) { return ok(await sb.rpc("code_status", { p_code: normCode(code) })); },
    async memberActivate(code, pwd) {
      const email = memberEmail(code);
      const r = await sb.auth.signUp({ email, password: pwd });
      if (r.error && /already registered/i.test(r.error.message)) ok(await sb.auth.signInWithPassword({ email, password: pwd }));
      else ok(r);
      if (!r.data?.session) {
        const s = await sb.auth.getSession();
        if (!s.data.session) throw new Error("Falta desactivar la confirmación de correo en Supabase (ver README).");
      }
      ok(await sb.rpc("claim_member", { p_code: normCode(code) }));
      return resolveRole();
    },
    async memberLogin(code, pwd) {
      ok(await sb.auth.signInWithPassword({ email: memberEmail(code), password: pwd }));
      const s = await resolveRole();
      if (!s) { await sb.auth.signOut(); throw new Error("Tu acceso está pausado o el código cambió. Escríbele a tu coach."); }
      return s;
    },
    async logout() { await sb.auth.signOut(); cached = null; },

    async getSettings() { const r = ok(await sb.from("settings").select("data").eq("id", 1).maybeSingle()); return r?.data || {}; },
    async saveSettings(data) { ok(await sb.from("settings").upsert({ id: 1, data, updated_at: new Date().toISOString() })); },

    async listExercises() { return ok(await sb.from("exercises").select("*").order("name")); },
    async saveExercise(ex) {
      const row = { name: ex.name, muscle: ex.muscle, video_url: ex.video_url, cues: ex.cues, alternatives: ex.alternatives };
      if (ex.id) ok(await sb.from("exercises").update(row).eq("id", ex.id)); else ok(await sb.from("exercises").insert(row));
    },
    async deleteExercise(id) { ok(await sb.from("exercises").delete().eq("id", id)); },

    async listMembers() { return ok(await sb.from("members").select("*").order("created_at")).map(toMember); },
    async getMember(id) { return toMember(ok(await sb.from("members").select("*").eq("id", id).maybeSingle())); },
    async myMember() { return cached?.memberId ? this.getMember(cached.memberId) : null; },
    async createMember(data) {
      const existing = ok(await sb.from("members").select("code")).map((x) => x.code);
      const row = { code: genCode(existing), name: data.name, active: true, profile: data.profile || {},
        program: data.program || { name: "", weeks: 8, startDate: iso(), weekNotes: {}, days: [] },
        nutrition: data.nutrition || { basics: {}, split: { p: 30, f: 25, c: 45 }, meals: [], recs: [], water: "" }, coach_note: "" };
      return toMember(ok(await sb.from("members").insert(row).select().single()));
    },
    async updateMember(id, patch) {
      const allowed = ["name", "active", "profile", "program", "nutrition", "coach_note"];
      const row = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k)));
      row.updated_at = new Date().toISOString();
      return toMember(ok(await sb.from("members").update(row).eq("id", id).select().single()));
    },
    async regenCode(id) {
      const existing = ok(await sb.from("members").select("code")).map((x) => x.code);
      return toMember(ok(await sb.from("members").update({ code: genCode(existing), user_id: null }).eq("id", id).select().single()));
    },
    async deleteMember(id) { ok(await sb.from("members").delete().eq("id", id)); },
    async saveAnamnesis(data) { ok(await sb.rpc("save_anamnesis", { p: data })); },

    async listSessions(memberId, sinceDays = 400) {
      return ok(await sb.from("sessions").select("*").eq("member_id", memberId).gte("date", addDays(iso(), -sinceDays)).order("date", { ascending: false }));
    },
    async upsertSession(s) {
      const row = { member_id: s.member_id, date: s.date, day_index: s.day_index, week: s.week, logs: s.logs, feeling: s.feeling ?? null, note: s.note || "", completed: !!s.completed };
      return ok(await sb.from("sessions").upsert(row, { onConflict: "member_id,date,day_index" }).select().single());
    },
    async listCheckins(memberId) { return ok(await sb.from("checkins").select("*").eq("member_id", memberId).order("date", { ascending: false })); },
    async addCheckin(c) { return ok(await sb.from("checkins").insert({ member_id: c.member_id, kind: c.kind, date: c.date, data: c.data }).select().single()); },
    async deleteCheckin(id) { ok(await sb.from("checkins").delete().eq("id", id)); },
    async listMeasurements(memberId) { return ok(await sb.from("measurements").select("*").eq("member_id", memberId).order("date")); },
    async addMeasurement(m) { return ok(await sb.from("measurements").insert({ member_id: m.member_id, date: m.date, data: m.data }).select().single()); },
    async deleteMeasurement(id) { ok(await sb.from("measurements").delete().eq("id", id)); },
    async coachActivity(days = 60) {
      const since = addDays(iso(), -days);
      const [sessions, checkins] = await Promise.all([
        sb.from("sessions").select("member_id,date,day_index,completed,feeling,logs").gte("date", since).then(ok),
        sb.from("checkins").select("*").gte("date", since).then(ok),
      ]);
      return { sessions, checkins };
    },
  };
}

export async function createApi() {
  const api = SUPABASE_URL && SUPABASE_ANON_KEY ? await supabaseApi() : demoApi();
  await api.init();
  return api;
}
export { normCode };
