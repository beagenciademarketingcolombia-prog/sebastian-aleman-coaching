// Datos de ejemplo del modo demostración. Las fechas se generan relativas a hoy
// para que la racha, la semana actual y el historial siempre se vean vivos.
import { iso, addDays, parseISO, uid } from "./util.js";

export const DEMO_COACH = { email: "sebastian@demo.co", password: "aleman" };
export const DEMO_MEMBER_PASSWORD = "demo1234";

const EX = [
  ["Sentadilla libre con barra", "Pierna anterior", "Pecho alto y abdomen firme. Rodillas en dirección de la punta de los pies. Baja controlado 3 segundos.", "Sentadilla en Smith, sentadilla goblet"],
  ["Prensa 45°", "Pierna anterior", "Pies a la altura de la cadera. No despegues la zona lumbar del espaldar ni bloquees las rodillas arriba.", "Sentadilla hack, sentadilla goblet"],
  ["Extensión de cuádriceps", "Pierna anterior", "Pausa de 1 segundo arriba. Baja lento, sin rebotar.", "Sentadilla búlgara con pausa"],
  ["Sentadilla búlgara", "Pierna anterior", "Torso levemente inclinado para más glúteo, vertical para más cuádriceps. La rodilla de atrás baja recto.", "Zancada estática, step up"],
  ["Zancadas caminando", "Pierna anterior", "Paso largo, rodilla de atrás casi toca el piso. Empuja con el talón de adelante.", "Sentadilla búlgara, step up"],
  ["Peso muerto rumano con barra", "Pierna posterior", "Espalda neutra todo el recorrido. La cadera va hacia atrás, la barra pegada a las piernas.", "Peso muerto rumano con mancuernas, buenos días"],
  ["Curl femoral acostado", "Pierna posterior", "Cadera pegada al banco. Sube rápido, baja en 3 segundos.", "Curl femoral sentado, curl nórdico asistido"],
  ["Curl femoral sentado", "Pierna posterior", "Ajusta el rodillo arriba de la rodilla. Inclínate un poco hacia adelante.", "Curl femoral acostado"],
  ["Hip thrust con barra", "Glúteo", "Mentón hacia el pecho, costillas abajo. Pausa arriba apretando glúteo.", "Hip thrust en máquina, puente de glúteo"],
  ["Puente Kas", "Glúteo", "Rango corto, cadera de neutro a extensión. Tensión constante.", "Hip thrust con barra"],
  ["Abducción de cadera en máquina", "Glúteo", "Inclina el torso adelante para enfocar glúteo medio. Controla el regreso.", "Abducción con banda sentada"],
  ["Extensión de cadera en polea", "Glúteo", "Torso estable, no arquees la espalda. El movimiento sale de la cadera.", "Patada de glúteo en máquina"],
  ["Elevación de talones en prensa", "Pierna", "Pausa abajo estirando, sube hasta la punta. Sin rebote.", "Elevación de talones de pie"],
  ["Press banca con barra", "Pecho", "Escápulas juntas y abajo. Barra a la altura del esternón, codos a 45°.", "Press en máquina, press con mancuernas"],
  ["Press inclinado con mancuernas", "Pecho", "Banco a 30°. Baja hasta sentir estiramiento, sin chocar las mancuernas arriba.", "Press inclinado en Smith, press inclinado en máquina"],
  ["Aperturas en polea", "Pecho", "Codos semiflexionados fijos. Junta las manos frente al pecho.", "Peck deck, aperturas con mancuernas"],
  ["Fondos en paralelas", "Pecho", "Inclinado adelante para pecho. Baja hasta 90° en el codo.", "Fondos asistidos, press declinado"],
  ["Dominadas", "Espalda", "Inicia el movimiento con las escápulas. Pecho hacia la barra.", "Jalón al pecho, dominadas asistidas"],
  ["Jalón al pecho", "Espalda", "Agarre prono un poco más ancho que hombros. Codos hacia las costillas.", "Dominadas asistidas, jalón con agarre neutro"],
  ["Remo con barra", "Espalda", "Torso a 45°, espalda neutra. Lleva la barra al ombligo.", "Remo en máquina, remo con mancuerna"],
  ["Remo en polea baja", "Espalda", "Pecho alto, no balancees el torso. Pausa con escápulas juntas.", "Remo en máquina, remo con mancuerna"],
  ["Remo con mancuerna a una mano", "Espalda", "Rodilla y mano apoyadas en el banco. Codo hacia la cadera.", "Remo en polea baja"],
  ["Press militar con mancuernas", "Hombro", "Sentado con espaldar. No arquees la zona lumbar.", "Press en máquina de hombro"],
  ["Elevaciones laterales", "Hombro", "Sube hasta la altura del hombro, codos guían el movimiento. Sin balanceo.", "Elevaciones laterales en polea"],
  ["Elevaciones frontales con mancuernas", "Hombro", "Alterna brazos o ambos a la vez. Hasta la altura de los ojos.", "Elevación frontal con disco"],
  ["Face pull", "Hombro", "Cuerda a la altura de la cara. Abre los codos y gira hacia afuera.", "Pájaros con mancuernas"],
  ["Curl con barra", "Brazo", "Codos pegados al cuerpo. Sin impulso de la espalda.", "Curl con mancuernas, curl en polea"],
  ["Curl en polea", "Brazo", "Tensión constante. Aprieta arriba 1 segundo.", "Curl con barra"],
  ["Extensión de tríceps en polea", "Brazo", "Codos fijos al lado del cuerpo. Extiende completo abajo.", "Fondos en banco, press francés"],
  ["Crunch abdominal", "Abdomen", "Exhala al subir, sin halar el cuello.", "Crunch en polea"],
  ["Plancha", "Abdomen", "Glúteo apretado, cadera alineada con hombros. Respira.", "Plancha con rodillas apoyadas"],
  ["Cardio LISS en caminadora", "Cardio", "Ritmo en el que puedas hablar en frases cortas.", "Bicicleta estática, elíptica"],
];

export function buildDemo() {
  const today = iso();
  const exercises = EX.map(([name, muscle, cues, alternatives]) => ({ id: uid(), name, muscle, video_url: "", cues, alternatives }));
  const e = (name, sets, reps, rest, extra = {}) => ({ name, sets, type: "Serie tradicional", reps, kg: "", rir: "2", rest, notes: "", ...extra });

  // Inicio del mesociclo: el lunes de hace 3 semanas
  const dow = (parseISO(today).getDay() + 6) % 7;
  const start = addDays(today, -dow - 21);

  const lauraProgram = {
    name: "Mesociclo 1 · Recomposición",
    weeks: 8,
    startDate: start,
    weekNotes: { 4: "Semana de descarga: mismos ejercicios, una serie menos en cada uno." },
    days: [
      { weekday: 1, group: "Pierna anterior", exercises: [
        e("Sentadilla libre con barra", 4, "8/10", 120, { kg: "40", notes: "Si completas todo con RIR 2, sube 2,5 kg por lado." }),
        e("Prensa 45°", 3, "10/12", 90, { kg: "80" }),
        e("Extensión de cuádriceps", 3, "12/15", 60, { kg: "25" }),
        e("Zancadas caminando", 3, "12 c/u", 60, { kg: "8", notes: "Mancuerna en cada mano." }),
      ]},
      { weekday: 2, group: "Torso", exercises: [
        e("Jalón al pecho", 4, "10", 90, { kg: "35" }),
        e("Press inclinado con mancuernas", 3, "10", 90, { kg: "10" }),
        e("Remo en polea baja", 3, "12", 75, { kg: "30" }),
        e("Elevaciones laterales", 3, "15", 45, { kg: "4" }),
        e("Plancha", 3, "40 s", 45, { type: "Serie por segundos", rir: "" }),
      ]},
      { weekday: 4, group: "Glúteo", exercises: [
        e("Hip thrust con barra", 4, "10", 120, { kg: "60" }),
        e("Peso muerto rumano con barra", 3, "10", 90, { kg: "35" }),
        e("Abducción de cadera en máquina", 3, "20", 45, { kg: "40" }),
        e("Extensión de cadera en polea", 3, "12 c/u", 60, { kg: "10" }),
      ]},
      { weekday: 6, group: "Cardio", exercises: [
        e("Cardio LISS en caminadora", 1, "30 min", 0, { type: "Serie por minutos", rir: "", notes: "Inclinación 10 %, velocidad 5,5 km/h." }),
        e("Crunch abdominal", 3, "15", 45),
      ]},
    ],
  };

  const lauraNutrition = {
    basics: { sex: "F", age: 27, height: 165, weight: 70, activity: "ligero", goal: "cut" },
    kcalOverride: 1550,
    split: { p: 35, f: 22, c: 43 },
    water: "2,5 L",
    meals: [
      { name: "Desayuno", time: "7:00", items: [
        { food: "Arepa de maíz blanca (mediana)", qty: 1, unit: "unidad", kcal: 150, p: 3.5, f: 2, c: 30 },
        { food: "Huevo entero", qty: 1, unit: "unidad", kcal: 72, p: 6.3, f: 4.8, c: 0.4 },
        { food: "Clara de huevo", qty: 3, unit: "unidad", kcal: 51, p: 10.8, f: 0.3, c: 0.6 },
        { food: "Papaya", qty: 150, unit: "g", kcal: 65, p: 0.8, f: 0.5, c: 16.5 },
      ]},
      { name: "Media mañana", time: "10:00", items: [
        { food: "Yogur griego natural", qty: 170, unit: "g", kcal: 165, p: 15.3, f: 8.5, c: 6.8 },
        { food: "Fresas", qty: 100, unit: "g", kcal: 32, p: 0.7, f: 0.3, c: 7.7 },
      ]},
      { name: "Almuerzo", time: "13:00", items: [
        { food: "Pechuga de pollo (cocida)", qty: 150, unit: "g", kcal: 248, p: 46.5, f: 5.4, c: 0 },
        { food: "Arroz blanco (cocido)", qty: 120, unit: "g", kcal: 156, p: 3.2, f: 0.4, c: 33.6 },
        { food: "Ensalada de verduras", qty: 150, unit: "g", kcal: 38, p: 2.3, f: 0.3, c: 7.5 },
        { food: "Aguacate", qty: 40, unit: "g", kcal: 64, p: 0.8, f: 6, c: 3.6 },
      ]},
      { name: "Pre entreno", time: "17:00", items: [
        { food: "Banano", qty: 1, unit: "unidad", kcal: 105, p: 1.3, f: 0.4, c: 27 },
        { food: "Café o tinto sin azúcar", qty: 1, unit: "unidad", kcal: 2, p: 0.3, f: 0, c: 0 },
      ]},
      { name: "Cena", time: "20:00", items: [
        { food: "Tilapia (cocida)", qty: 150, unit: "g", kcal: 192, p: 39, f: 4.1, c: 0 },
        { food: "Papa criolla (cocida)", qty: 150, unit: "g", kcal: 146, p: 3, f: 0.2, c: 33 },
        { food: "Brócoli", qty: 100, unit: "g", kcal: 35, p: 2.4, f: 0.4, c: 7 },
      ]},
    ],
    recs: [
      "Pesa los alimentos las primeras dos semanas. Después vas a calcular a ojo con mucha más precisión.",
      "Los días de pierna puedes sumar media taza más de arroz en el almuerzo.",
      "Duerme mínimo 7 horas. El hambre y la recuperación dependen de eso más de lo que crees.",
      "Si vas a comer por fuera, elige proteína a la plancha y verdura. No tienes que pedir permiso para vivir.",
    ],
  };

  const members = [
    {
      id: uid(), code: "SA-7K2M9Q", claimed: true, name: "Laura Camila Peña", active: true,
      profile: { goal: "Pérdida de grasa", startWeight: 72, targetWeight: 64, height: 165, phone: "300 000 0000", plan: "Asesoría online", gym: "Smart Fit Ciudad Jardín" },
      program: lauraProgram, nutrition: lauraNutrition,
      anamnesis: {
        goal: "Bajar grasa y marcar piernas y glúteo", injuries: "Molestia leve en rodilla derecha al bajar escaleras", conditions: "Ninguna",
        experience: "6 meses", daysAvailable: "4", minutes: "60", gym: "Smart Fit Ciudad Jardín", equipment: "Gimnasio completo",
        zonePref: "Prefiero no cambiar de piso, me gusta quedarme en la zona de pierna", sleep: "6-7", stress: "3",
        food: "No me gusta el hígado. Almuerzo en la oficina entre semana.", why: "Quiero sentirme bien con mi cuerpo y ser constante por primera vez.",
        date: addDays(start, -3),
      },
      coach_note: "Laura, vas muy bien con la constancia. Esta semana quiero que te enfoques en la técnica de la sentadilla: graba tu última serie y me la mandas por WhatsApp.\n\nRecuerda: el resultado es la consecuencia, la disciplina es lo que controlas.",
    },
    {
      id: uid(), code: "SA-Q4TR8W", claimed: true, name: "Andrés Felipe Rojas", active: true,
      profile: { goal: "Hipertrofia", startWeight: 74, targetWeight: 80, height: 178, phone: "", plan: "Asesoría online", gym: "Bodytech Calle 90" },
      program: {
        name: "Mesociclo 3 · Fuerza e hipertrofia", weeks: 6, startDate: addDays(start, 7), weekNotes: {},
        days: [
          { weekday: 1, group: "Empuje", exercises: [e("Press banca con barra", 4, "6/8", 180, { kg: "70", rir: "1" }), e("Press inclinado con mancuernas", 3, "10", 90, { kg: "26" }), e("Fondos en paralelas", 3, "Al fallo", 90, { type: "Al fallo", rir: "0" }), e("Extensión de tríceps en polea", 3, "12", 60)] },
          { weekday: 2, group: "Tirón", exercises: [e("Dominadas", 4, "6", 150, { kg: "+10" }), e("Remo con barra", 4, "8", 120, { kg: "60" }), e("Face pull", 3, "15", 60), e("Curl con barra", 3, "10", 60, { kg: "30" })] },
          { weekday: 4, group: "Pierna", exercises: [e("Sentadilla libre con barra", 4, "6/8", 180, { kg: "90" }), e("Peso muerto rumano con barra", 3, "8", 120, { kg: "80" }), e("Prensa 45°", 3, "12", 90), e("Elevación de talones en prensa", 4, "15", 45)] },
          { weekday: 5, group: "Hombro", exercises: [e("Press militar con mancuernas", 4, "8", 120, { kg: "22" }), e("Elevaciones laterales", 4, "15", 45, { type: "Drop set" }), e("Remo con mancuerna a una mano", 3, "10", 75)] },
        ],
      },
      nutrition: { basics: { sex: "M", age: 29, height: 178, weight: 75.5, activity: "activo", goal: "bulk_slow" }, kcalOverride: 0, split: { p: 25, f: 25, c: 50 }, water: "3,5 L",
        meals: [
          { name: "Desayuno", time: "6:30", items: [{ food: "Avena en hojuelas", qty: 80, unit: "g", kcal: 311, p: 13.6, f: 5.6, c: 52.8 }, { food: "Huevo entero", qty: 3, unit: "unidad", kcal: 216, p: 18.9, f: 14.4, c: 1.2 }, { food: "Banano", qty: 1, unit: "unidad", kcal: 105, p: 1.3, f: 0.4, c: 27 }] },
          { name: "Almuerzo", time: "13:00", items: [{ food: "Carne de res magra (cocida)", qty: 200, unit: "g", kcal: 434, p: 52, f: 23.6, c: 0 }, { food: "Arroz blanco (cocido)", qty: 250, unit: "g", kcal: 325, p: 6.8, f: 0.8, c: 70 }, { food: "Fríjoles (cocidos)", qty: 150, unit: "g", kcal: 191, p: 13, f: 0.8, c: 34.5 }] },
          { name: "Post entreno", time: "19:30", items: [{ food: "Proteína whey", qty: 30, unit: "g", kcal: 120, p: 24, f: 1.5, c: 3 }, { food: "Banano", qty: 1, unit: "unidad", kcal: 105, p: 1.3, f: 0.4, c: 27 }] },
          { name: "Cena", time: "20:30", items: [{ food: "Pasta (cocida)", qty: 250, unit: "g", kcal: 395, p: 14.5, f: 2.3, c: 77.5 }, { food: "Pechuga de pollo (cocida)", qty: 150, unit: "g", kcal: 248, p: 46.5, f: 5.4, c: 0 }, { food: "Aceite de oliva", qty: 10, unit: "g", kcal: 88, p: 0, f: 10, c: 0 }] },
        ],
        recs: ["Creatina monohidratada 5 g todos los días, a cualquier hora.", "Si el peso no sube en dos semanas, me avisas y subimos 150 kcal."] },
      anamnesis: { goal: "Ganar masa muscular", injuries: "Ninguna", conditions: "Ninguna", experience: "4 años", daysAvailable: "4", minutes: "75", gym: "Bodytech Calle 90", equipment: "Gimnasio completo", zonePref: "Me da igual moverme", sleep: "7-8", stress: "2", food: "Como de todo", why: "Quiero subir de categoría y competir el próximo año.", date: addDays(start, 4) },
      coach_note: "Andrés, la semana 3 es la más pesada del bloque. Respeta los descansos de 3 minutos en press banca.",
    },
    {
      id: uid(), code: "SA-M8PX3D", claimed: false, name: "Carolina Pérez", active: true,
      profile: { goal: "Recomposición", startWeight: 61, targetWeight: 59, height: 160, phone: "", plan: "Asesoría online", gym: "" },
      program: { name: "", weeks: 8, startDate: "", weekNotes: {}, days: [] },
      nutrition: { basics: { sex: "F", age: 34, height: 160, weight: 61, activity: "ligero", goal: "cut_slow" }, kcalOverride: 0, split: { p: 30, f: 30, c: 40 }, water: "", meals: [], recs: [] },
      anamnesis: null, coach_note: "",
    },
  ];

  // Historial de Laura: casi todos los días programados hechos, una ausencia justificada
  const laura = members[0];
  const sessions = [], checkins = [], measurements = [];
  let k = 0;
  for (let d = start; d < today; d = addDays(d, 1)) {
    const wd = parseISO(d).getDay();
    const di = lauraProgram.days.findIndex((x) => x.weekday === wd);
    if (di < 0) continue;
    k++;
    if (k === 3) { checkins.push({ id: uid(), member_id: laura.id, kind: "absence", date: d, data: { reason: "Trabajo", note: "Me tocó quedarme hasta tarde en la oficina." } }); continue; }
    if (k === 6 && d < addDays(today, -10)) continue; // un día sin registrar, antes de la racha actual
    const week = Math.floor((parseISO(d) - parseISO(start)) / (7 * 86400000)) + 1;
    const prog = Math.max(0, week - 1) * 2.5;
    sessions.push({
      id: uid(), member_id: laura.id, date: d, day_index: di, week, completed: true,
      feeling: 3 + (k % 3 === 0 ? 1 : 0) + (k % 5 === 0 ? -1 : 0), note: k % 4 === 0 ? "Me sentí fuerte hoy." : "",
      logs: lauraProgram.days[di].exercises.map((x) => ({
        name: x.name,
        sets: Array.from({ length: +x.sets }, (_, i) => ({ reps: String(parseInt(x.reps) || ""), kg: x.kg ? String(+x.kg + prog) : "", rir: x.rir, done: true })),
      })),
    });
  }
  [72, 71.2, 70.6, 69.9].forEach((w, i) => {
    measurements.push({ id: uid(), member_id: laura.id, date: addDays(start, i * 7), data: { weight: w, waist: 78 - i * 0.9, hip: 102 - i * 0.6, chest: 92 - i * 0.3, arm: 29.5 - i * 0.1, thigh: 58 - i * 0.4, fat: i === 0 ? 31 : i === 3 ? 29.4 : "" } });
  });
  [1, 2, 3].forEach((i) => {
    checkins.push({ id: uid(), member_id: laura.id, kind: "weekly", date: addDays(start, i * 7 - 1), data: { energy: 3 + (i > 1 ? 1 : 0), sleep: 3, stress: i === 2 ? 4 : 3, hunger: 3, note: i === 2 ? "Semana pesada en el trabajo, pero cumplí." : "" } });
  });
  checkins.push({ id: uid(), member_id: laura.id, kind: "offplan", date: addDays(today, -5), data: { what: "Cumpleaños de mi mamá: torta y lechona", feeling: "Un poco culpable" } });

  // Andrés: dos semanas de registros
  const andres = members[1];
  for (let d = andres.program.startDate; d < today; d = addDays(d, 1)) {
    const wd = parseISO(d).getDay();
    const di = andres.program.days.findIndex((x) => x.weekday === wd);
    if (di < 0) continue;
    sessions.push({ id: uid(), member_id: andres.id, date: d, day_index: di, week: 1 + Math.floor((parseISO(d) - parseISO(andres.program.startDate)) / 604800000), completed: true, feeling: 4, note: "",
      logs: andres.program.days[di].exercises.map((x) => ({ name: x.name, sets: Array.from({ length: +x.sets }, () => ({ reps: String(parseInt(x.reps) || 8), kg: String(parseFloat(x.kg) || ""), rir: x.rir, done: true })) })) });
  }
  measurements.push({ id: uid(), member_id: andres.id, date: andres.program.startDate, data: { weight: 74.6, waist: 80, chest: 101, arm: 36, thigh: 57 } });
  measurements.push({ id: uid(), member_id: andres.id, date: addDays(today, -2), data: { weight: 75.4, waist: 80.5, chest: 102, arm: 36.5, thigh: 57.5 } });

  const settings = {
    brand: "Sebastián Alemán",
    tagline: "El físico es la consecuencia. La disciplina es el método.",
    whatsapp: "",
    welcome: "Bienvenido al equipo. Aquí vas a encontrar tu plan hecho a tu medida. Yo estoy del otro lado acompañándote: si algo no sale, me cuentas y lo ajustamos.",
    offplanTips: "Respira, no pasa nada. Una comida no define tu proceso.\nVuelve a tu plan en la siguiente comida, sin compensar con ayuno.\nSi te quedó hambre: tinto o aromática, gelatina sin azúcar, pepino o una arepa de maíz pequeña.\nToma 2 vasos de agua y prioriza proteína y verdura en lo que queda del día.",
  };

  return { settings, exercises, members, sessions, checkins, measurements };
}
