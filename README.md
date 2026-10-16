# Plataforma de afiliados · Sebastián Alemán

Plataforma web donde Sebastián carga la rutina y el plan de nutrición de cada afiliado, y cada afiliado entra con un código de acceso para ver su plan, registrar sus series y seguir su progreso.

> El físico es la consecuencia. La disciplina es el método.

## Qué hace

**Afiliado**
- Entra con el código que le genera Sebastián (formato `SA-XXXXXX`). La primera vez crea su contraseña.
- Llena un cuestionario inicial: objetivo, lesiones, gimnasio, equipo, preferencias, sueño, estrés, alimentación y medidas tomadas en casa con cinta métrica. Incluye la autorización de datos (Ley 1581 de 2012).
- **Hoy**: la sesión del día con series, repeticiones, kilos, RIR, descanso, indicaciones y video. Marca cada serie y arranca el temporizador de descanso. Ve lo que levantó la última vez.
- **Máquina ocupada**: cambia el ejercicio por una alternativa que trabaja el mismo músculo.
- **Racha** de entrenamientos. Si un día no puede entrenar, lo reporta y la racha no se rompe.
- **Nutrición**: calorías, macros, menú base y recomendaciones. Botón "Me salí del plan" que responde con empatía y opciones, sin castigo.
- **Progreso**: peso, medidas, mejores marcas, historial de sesiones con tonelaje y check-in semanal (energía, sueño, estrés, hambre).
- **Mi coach**: mensaje personal de Sebastián y acceso a WhatsApp.

**Coach**
- Tablero con lo que necesita atención: quién no ha entrenado, quién llenó el cuestionario y espera rutina, ausencias, salidas del plan, check-ins con energía baja y notas de sesión.
- Crear afiliados, generar y regenerar códigos, pausar accesos y copiar el mensaje de bienvenida para WhatsApp.
- Editor de rutina por mesociclo: semanas, notas por semana, días, grupo muscular, series, tipo de serie, reps, kg, RIR, descanso, indicaciones y alternativas. Copiar la rutina de otro afiliado.
- Calculadora de calorías (Mifflin-St Jeor) con objetivo, porcentajes de macros y menú con base de alimentos colombianos que calcula los macros sola.
- Biblioteca de ejercicios con videos y puntos clave de técnica.
- Ajustes de marca, WhatsApp y mensajes.

## Modo demostración

Sin configurar nada, la plataforma funciona con datos de ejemplo guardados en el navegador. Sirve para mostrarla.

- Coach: `sebastian@demo.co` · contraseña `aleman`
- Afiliados: `SA-7K2M9Q` o `SA-Q4TR8W` · contraseña `demo1234`
- Acceso nuevo para probar la activación: `SA-M8PX3D`

## Pasar a producción con Supabase (gratis hasta cientos de afiliados)

1. Crea una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo (región São Paulo).
2. En **SQL Editor**, pega todo `supabase/schema.sql` y ejecútalo.
3. En **Authentication > Sign In / Providers > Email**, desactiva **Confirm email** (los afiliados entran con código, no con correo).
4. En **Authentication > Users > Add user**, crea el usuario de Sebastián con su correo y una contraseña.
5. Vuelve a **SQL Editor** y ejecuta, con su correo:
   ```sql
   insert into public.coaches (user_id)
   select id from auth.users where email = 'entrenador.sebastian1995@gmail.com';
   ```
6. En **Project Settings > API**, copia la **Project URL** y la **anon public key** y pégalas en `js/config.js`.
7. Sube el cambio a GitHub. En un minuto la página queda conectada a la base de datos.
8. En la plataforma, entra a **Ejercicios** y pega los enlaces de los videos de Sebastián.

La anon key es pública por diseño. La seguridad la dan las reglas RLS del esquema: cada afiliado solo puede leer su propio plan y escribir sus propios registros, y solo el coach puede cambiar rutinas y nutrición.

## Estructura

```
index.html          Página única
css/styles.css      Estilos (claro y oscuro)
js/app.js           Arranque, rutas, portada e ingresos
js/member.js        Vistas del afiliado
js/coach.js         Panel del coach
js/api.js           Datos: modo demo (navegador) o Supabase
js/util.js          Cálculos de racha, macros, fechas y base de alimentos
js/demo-data.js     Datos de ejemplo
supabase/schema.sql Base de datos, reglas de seguridad y funciones
```

No necesita instalación ni compilación. Para probarla en local: `python3 -m http.server` y abrir `http://localhost:8000`.
