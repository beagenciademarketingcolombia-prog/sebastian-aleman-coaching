// Piezas de interfaz compartidas: toast, modal, íconos, gráfico de línea
import { esc, $, fmtDate } from "./util.js";

let toastTimer;
export function toast(msg, kind = "") {
  const t = $("#toast");
  t.textContent = msg; t.className = "toast " + kind; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2800);
}

// Modal genérico. Devuelve una promesa que se resuelve con lo que retorne onSubmit (o null si se cierra).
export function modal({ title, body, submitLabel = "Guardar", cancelLabel = "Cancelar", danger = false, onSubmit, onOpen }) {
  return new Promise((resolve) => {
    const root = $("#modal-root");
    root.innerHTML = `<div class="modal-back" role="presentation"><form class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header><h2>${esc(title)}</h2><button type="button" class="btn-quiet" data-close aria-label="Cerrar">✕</button></header>
      <div class="stack">${body}</div>
      <p class="err" data-err></p>
      <div class="row" style="justify-content:flex-end">
        ${cancelLabel ? `<button type="button" class="btn-ghost" data-close>${esc(cancelLabel)}</button>` : ""}
        ${submitLabel ? `<button type="submit" class="${danger ? "btn-accent" : ""}">${esc(submitLabel)}</button>` : ""}
      </div></form></div>`;
    const back = root.firstElementChild, form = back.firstElementChild;
    const close = (v) => { root.innerHTML = ""; document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") close(null); };
    document.addEventListener("keydown", onKey);
    back.addEventListener("click", (e) => { if (e.target === back) close(null); });
    form.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => close(null)));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
      try { const v = onSubmit ? await onSubmit(form) : true; if (v !== false) close(v ?? true); }
      catch (err) { form.querySelector("[data-err]").textContent = err.message || String(err); }
      finally { if (btn) btn.disabled = false; }
    };
    onOpen?.(form);
    (form.querySelector("input,select,textarea") || form.querySelector('button[type="submit"]'))?.focus();
  });
}
export const confirmDialog = (title, text, label = "Confirmar") =>
  modal({ title, body: `<p>${esc(text)}</p>`, submitLabel: label, danger: true });

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast("Copiado", "ok"); return true; }
  catch { await modal({ title: "Copia este texto", body: `<textarea readonly rows="5" onfocus="this.select()">${esc(text)}</textarea>`, submitLabel: "Listo", cancelLabel: "" }); return false; }
}

export const ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/></svg>',
  week: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  food: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v8M15 21V3c3 1 4 4 4 8h-4"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18M5 16l5-5 3 3 6-7"/></svg>',
  coach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>',
};

// Gráfico de línea simple en SVG, con escala compartida para puntos, grilla y etiquetas
export function lineChart(points, { unit = "", height = 200, decimals = 1 } = {}) {
  if (points.length < 2) return `<div class="empty">Necesitas al menos dos registros para ver la tendencia.</div>`;
  const W = 640, H = height, L = 46, R = 16, T = 16, B = 30;
  const ys = points.map((p) => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  const pad = Math.max((max - min) * 0.2, 0.5); min -= pad; max += pad;
  const step = niceStep((max - min) / 4);
  min = Math.floor(min / step) * step; max = Math.ceil(max / step) * step;
  const x = (i) => L + (i * (W - L - R)) / (points.length - 1);
  const y = (v) => T + ((max - v) * (H - T - B)) / (max - min);
  const ticks = []; for (let v = min; v <= max + 1e-9; v += step) ticks.push(v);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join("");
  const area = `${path}L${x(points.length - 1).toFixed(1)},${H - B}L${L},${H - B}Z`;
  const every = Math.ceil(points.length / 6);
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tendencia">
    ${ticks.map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v.toFixed(step < 1 ? 1 : 0)}</text>`).join("")}
    <path class="area" d="${area}" opacity=".6"/>
    <path class="line" d="${path}"/>
    ${points.map((p, i) => `<circle class="dot ${i === points.length - 1 ? "last" : ""}" cx="${x(i)}" cy="${y(p.y)}" r="${i === points.length - 1 ? 5 : 3.5}"><title>${esc(fmtDate(p.x))}: ${p.y.toFixed(decimals)} ${unit}</title></circle>`).join("")}
    ${points.map((p, i) => (i % every === 0 || i === points.length - 1) ? `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(fmtDate(p.x))}</text>` : "").join("")}
  </svg></div>`;
}
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export function videoLink(url) {
  if (!url) return "";
  return `<a class="btn btn-ghost btn-sm" href="${esc(url)}" target="_blank" rel="noopener">▶ Ver video</a>`;
}
