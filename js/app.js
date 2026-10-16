// Punto de entrada: arranca la capa de datos, enruta por hash y pinta la portada y los ingresos
import { createApi, normCode } from "./api.js";
import { esc, $ } from "./util.js";
import { toast } from "./ui.js";
import { renderMember } from "./member.js";
import { renderCoach } from "./coach.js";

const app = $("#app");
const ctx = { api: null, settings: {}, rerender: () => route() };

function demoBand() {
  if (ctx.api.mode !== "demo") return "";
  return `<div class="demo-band"><div class="wrap"><span>Modo demostración: los datos de ejemplo se guardan solo en este navegador.</span>
    <button type="button" id="reset-demo">Reiniciar datos de ejemplo</button></div></div>`;
}
ctx.demoBand = demoBand;
ctx.bindDemoBand = () => {
  const b = $("#reset-demo");
  if (b) b.onclick = async () => { await ctx.api.resetDemo(); location.hash = "#/"; location.reload(); };
};

function brandMark(settings) {
  const parts = String(settings.brand || "Sebastián Alemán").split(" ");
  const last = parts.pop();
  return `${esc(parts.join(" "))} <b>${esc(last)}</b>`;
}
ctx.brandMark = () => brandMark(ctx.settings);

const PLATES = `<svg class="plates" viewBox="0 0 400 400" aria-hidden="true">
  <circle cx="200" cy="200" r="190" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="2"/>
  <circle cx="200" cy="200" r="168" fill="#d6361f" fill-opacity=".92"/>
  <circle cx="200" cy="200" r="150" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="10"/>
  <circle cx="200" cy="200" r="96" fill="none" stroke="#000" stroke-opacity=".14" stroke-width="2"/>
  <circle cx="200" cy="200" r="34" fill="#16181d"/>
  <circle cx="200" cy="200" r="25" fill="none" stroke="#f3f2ee" stroke-opacity=".5" stroke-width="2"/>
  <text x="200" y="88" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, Arial" font-weight="800" font-size="40" fill="#f3f2ee" letter-spacing="2">25 KG</text>
  <text x="200" y="336" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="15" fill="#f3f2ee" fill-opacity=".8" letter-spacing="4">DISCIPLINA</text>
</svg>`;

function landing() {
  const s = ctx.settings;
  app.innerHTML = `${demoBand()}
  <header class="topbar"><div class="wrap"><a class="brand" href="#/">${brandMark(s)}</a>
    <a class="btn-quiet btn btn-sm" href="#/coach/ingresar">Soy el coach</a></div></header>
  <section class="hero"><div class="wrap">
    ${PLATES}
    <div class="eyebrow" style="color:inherit;opacity:.65">Asesoría de entrenamiento y nutrición</div>
    <h1>El físico es la <em>consecuencia</em>.</h1>
    <p class="lead">La disciplina es el método. Aquí está tu plan hecho a tu medida, el registro de cada serie y un coach real del otro lado que ajusta contigo semana a semana.</p>
    <div class="hero-actions">
      <a class="btn btn-accent" href="#/ingresar">Ingresar con mi código</a>
      ${s.whatsapp ? `<a class="btn btn-ghost" href="https://wa.me/${esc(String(s.whatsapp).replace(/\D/g, ""))}" target="_blank" rel="noopener">Quiero asesoría</a>` : ""}
    </div>
  </div></section>
  <main class="wrap" style="padding-block:40px 64px">
    <div class="pillars">
      <div class="pillar"><span class="n">01 · Entrenamiento</span><h3>Tu rutina, serie por serie</h3><p class="muted">Cargas, repeticiones, RIR y descanso definidos para ti y para el gimnasio donde entrenas. Registras lo que levantas y ves cómo progresas.</p></div>
      <div class="pillar"><span class="n">02 · Nutrición</span><h3>Comer sin castigo</h3><p class="muted">Calorías y macros calculados a tu medida con comidas reales. Si un día te sales del plan, te decimos cómo seguir, no te regañamos.</p></div>
      <div class="pillar"><span class="n">03 · Mente</span><h3>Constancia antes que perfección</h3><p class="muted">Racha de entrenamientos, check-in semanal y un coach que lee cómo te sientes. El cambio físico llega cuando el hábito se queda.</p></div>
    </div>
  </main>`;
  ctx.bindDemoBand();
}

function memberLogin() {
  const demo = ctx.api.mode === "demo";
  app.innerHTML = `${demoBand()}
  <header class="topbar"><div class="wrap"><a class="brand" href="#/">${brandMark(ctx.settings)}</a></div></header>
  <main class="wrap"><section class="auth">
    <div class="stack">
      <div class="eyebrow">Zona de afiliados</div>
      <h1>Entra a tu plan</h1>
      <p class="muted prose" style="font-size:17px">Usa el código de acceso que te envió Sebastián por WhatsApp. La primera vez creas tu contraseña; después entras con código y contraseña.</p>
    </div>
    <form class="card panel" id="f-code" novalidate>
      <label class="field" for="code">Código de acceso<input id="code" class="code-input" placeholder="SA-XXXXXX" autocomplete="username" autocapitalize="characters" maxlength="10" required></label>
      <div id="step2" hidden class="stack">
        <p id="step2-msg" class="small"></p>
        <label class="field" for="pwd"><span id="pwd-label">Contraseña</span><input id="pwd" type="password" autocomplete="current-password" minlength="6"></label>
        <label class="field" for="pwd2" id="pwd2-wrap" hidden>Repite la contraseña<input id="pwd2" type="password" autocomplete="new-password" minlength="6"></label>
      </div>
      <p class="err" id="err"></p>
      <button class="btn-accent btn-block" type="submit" id="go">Continuar</button>
      ${demo ? `<div class="demo-codes hint"><span>Prueba con:</span>
        <button type="button" data-code="SA-7K2M9Q">SA-7K2M9Q</button>
        <button type="button" data-code="SA-Q4TR8W">SA-Q4TR8W</button>
        <span>contraseña <b class="mono">${esc(ctx.api.demoHints.memberPassword)}</b>, o</span>
        <button type="button" data-code="SA-M8PX3D">SA-M8PX3D</button><span>para activar un acceso nuevo.</span></div>` : ""}
    </form>
  </section></main>`;
  ctx.bindDemoBand();
  let status = null;
  const f = $("#f-code"), err = $("#err");
  const reset = () => { status = null; $("#step2").hidden = true; $("#go").textContent = "Continuar"; err.textContent = ""; };
  $("#code").addEventListener("input", reset);
  document.querySelectorAll("[data-code]").forEach((b) => (b.onclick = () => { $("#code").value = b.dataset.code; reset(); f.requestSubmit(); }));
  f.onsubmit = async (e) => {
    e.preventDefault(); err.textContent = "";
    const code = normCode($("#code").value);
    if (code.length < 9) { err.textContent = "El código tiene el formato SA- seguido de 6 caracteres."; return; }
    const btn = $("#go"); btn.disabled = true;
    try {
      if (!status) {
        status = await ctx.api.codeStatus(code);
        if (status === "invalid") { status = null; err.textContent = "Ese código no existe. Revísalo o pídele uno nuevo a tu coach."; return; }
        if (status === "paused") { status = null; err.textContent = "Tu acceso está pausado. Escríbele a tu coach para reactivarlo."; return; }
        $("#code").value = code;
        $("#step2").hidden = false;
        const first = status === "available";
        $("#step2-msg").textContent = first ? "Es tu primer ingreso. Crea una contraseña de mínimo 6 caracteres." : "Bienvenido de nuevo.";
        $("#pwd-label").textContent = first ? "Crea tu contraseña" : "Contraseña";
        $("#pwd").autocomplete = first ? "new-password" : "current-password";
        $("#pwd2-wrap").hidden = !first;
        btn.textContent = first ? "Activar mi acceso" : "Entrar";
        $("#pwd").focus();
        return;
      }
      const pwd = $("#pwd").value;
      if (pwd.length < 6) { err.textContent = "La contraseña debe tener mínimo 6 caracteres."; return; }
      if (status === "available") {
        if (pwd !== $("#pwd2").value) { err.textContent = "Las contraseñas no coinciden."; return; }
        await ctx.api.memberActivate(code, pwd);
        location.hash = "#/app/bienvenida";
      } else {
        await ctx.api.memberLogin(code, pwd);
        location.hash = "#/app/hoy";
      }
    } catch (ex) { err.textContent = ex.message; }
    finally { btn.disabled = false; }
  };
  $("#code").focus();
}

function coachLogin() {
  const demo = ctx.api.mode === "demo";
  app.innerHTML = `${demoBand()}
  <header class="topbar"><div class="wrap"><a class="brand" href="#/">${brandMark(ctx.settings)}</a></div></header>
  <main class="wrap"><section class="auth">
    <div class="stack"><div class="eyebrow">Panel del coach</div><h1>Tu equipo, en un solo lugar</h1>
      <p class="muted prose" style="font-size:17px">Crea afiliados, genera sus códigos de acceso, arma rutinas y planes de nutrición y revisa cómo va cada uno.</p></div>
    <form class="card panel" id="f-coach">
      <label class="field" for="email">Correo<input id="email" type="email" autocomplete="username" required></label>
      <label class="field" for="cpwd">Contraseña<input id="cpwd" type="password" autocomplete="current-password" required></label>
      <p class="err" id="err"></p>
      <button class="btn-block" type="submit">Entrar al panel</button>
      ${demo ? `<p class="hint">Demostración: <span class="mono">${esc(ctx.api.demoHints.coach.email)}</span> · contraseña <span class="mono">${esc(ctx.api.demoHints.coach.password)}</span>
        <button type="button" class="btn-quiet btn-sm" id="fill">Llenar</button></p>` : ""}
    </form>
  </section></main>`;
  ctx.bindDemoBand();
  $("#fill")?.addEventListener("click", () => { $("#email").value = ctx.api.demoHints.coach.email; $("#cpwd").value = ctx.api.demoHints.coach.password; });
  $("#f-coach").onsubmit = async (e) => {
    e.preventDefault(); $("#err").textContent = "";
    try { await ctx.api.coachLogin($("#email").value, $("#cpwd").value); location.hash = "#/coach"; }
    catch (ex) { $("#err").textContent = ex.message; }
  };
}

async function route() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const parts = hash.split("/").filter(Boolean);
  const sess = await ctx.api.session();
  window.scrollTo(0, 0);
  try {
    if (parts[0] === "app") {
      if (sess?.role !== "member") return (location.hash = "#/ingresar");
      return await renderMember(app, ctx, parts.slice(1));
    }
    if (parts[0] === "coach" && parts[1] !== "ingresar") {
      if (sess?.role !== "coach") return (location.hash = "#/coach/ingresar");
      return await renderCoach(app, ctx, parts.slice(1));
    }
    if (parts[0] === "coach") { if (sess?.role === "coach") return (location.hash = "#/coach"); return coachLogin(); }
    if (parts[0] === "ingresar") { if (sess?.role === "member") return (location.hash = "#/app/hoy"); return memberLogin(); }
    if (sess?.role === "member") return (location.hash = "#/app/hoy");
    if (sess?.role === "coach") return (location.hash = "#/coach");
    landing();
  } catch (ex) {
    console.error(ex);
    app.innerHTML = `<main class="wrap page"><div class="card stack"><h2>Algo salió mal</h2><p class="muted">${esc(ex.message)}</p><a class="btn" href="#/">Volver al inicio</a></div></main>`;
  }
}

ctx.logout = async () => { await ctx.api.logout(); location.hash = "#/"; toast("Sesión cerrada"); };

(async function start() {
  app.innerHTML = `<div class="loading">Cargando</div>`;
  try {
    ctx.api = await createApi();
    ctx.settings = await ctx.api.getSettings().catch(() => ({}));
  } catch (ex) {
    app.innerHTML = `<main class="wrap page"><div class="card stack"><h2>No pudimos conectar</h2><p class="muted">${esc(ex.message)}</p><p class="small muted">Revisa la conexión a internet o la configuración de Supabase en js/config.js.</p></div></main>`;
    return;
  }
  window.addEventListener("hashchange", route);
  route();
})();
