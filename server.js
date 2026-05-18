const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: permite que Plan 90 (Horizons) consuma estos endpoints desde otro dominio
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============================================
// HELPER: limpia respuesta JSON de la IA
// ============================================
function limpiarJSON(text) {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

// ============================================
// HELPER: arma bloque de datos del paciente
// ============================================
function datosPaciente(d) {
  const imc = (parseFloat(d.peso) / Math.pow(parseFloat(d.talla) / 100, 2)).toFixed(1);
  const ict = d.cintura ? (parseFloat(d.cintura) / parseFloat(d.talla)).toFixed(2) : null;
  const icc = (d.cintura && d.cadera) ? (parseFloat(d.cintura) / parseFloat(d.cadera)).toFixed(2) : null;

  return {
    imc,
    ict,
    icc,
    bloque: `
DATOS DEL PACIENTE:
- Nombre: ${d.nombre || 'Paciente'}
- Pais: ${d.pais || 'no reportado'}
- Edad: ${d.edad} anos
- Sexo: ${d.sexo}
- Peso: ${d.peso} kg
- Talla: ${d.talla} cm
- IMC: ${imc} kg/m2
${d.cintura ? `- Cintura: ${d.cintura} cm` : '- Cintura: no reportada'}
${d.cadera ? `- Cadera: ${d.cadera} cm` : '- Cadera: no reportada'}
${ict ? `- Relacion cintura/talla (ICT): ${ict} (saludable < 0.5)` : ''}
${icc ? `- Indice cintura/cadera (ICC): ${icc}` : ''}
- Antecedentes medicos: ${d.antecedentes || 'ninguno reportado'}
- Nivel de actividad fisica: ${d.nivel_actividad || 'no reportado'}
- Control alimentario: ${d.control_alimentario || 'no reportado'}
- Tiempo con sobrepeso: ${d.tiempo_sobrepeso || 'no reportado'}
- Intentos previos de perdida de peso: ${d.intentos_previos || 'no reportado'}
- Habitos actuales: ${d.habitos || 'no reportados'}
`
  };
}

// ============================================
// ENDPOINT 1: REPORTE CLINICO (llamada 1)
// Genera secciones 1-8, 11-14 del reporte
// ============================================
app.post('/api/reporte-clinico', async (req, res) => {
  const d = req.body;

  if (!d.peso || !d.talla || !d.edad || !d.sexo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios: peso, talla, edad, sexo' });
  }

  const { imc, ict, icc, bloque } = datosPaciente(d);

  const prompt = `Eres el Dr. Nicolas Pulecio Leal, medico general especializado en medicina preventiva y manejo del peso. Vas a generar las secciones CLINICAS de un reporte personalizado completo para este paciente. NO incluyas plan de alimentacion ni plan de ejercicio (eso va aparte).

REGLAS GENERALES:
- Lenguaje claro, empatico, espanol neutral
- Honestidad clinica sin dramatismo
- No inventes datos: si el paciente no reporto un dato, no lo menciones
- Personaliza segun los datos reales del paciente

REGLAS PARA EDAD BIOLOGICA:
PASO 1 - Punto de partida segun IMC:
- IMC 18.5-24.9 (normal) → edad cronologica
- IMC 25-26.9 (sobrepeso leve) → +2 anos
- IMC 27-29.9 (sobrepeso) → +4 anos
- IMC 30-34.9 (obesidad I) → +7 anos
- IMC 35-39.9 (obesidad II) → +10 anos
- IMC >= 40 (obesidad III) → +14 anos
PASO 2 - Cintura/talla (si hay dato):
- ICT < 0.5 → -1 ano
- ICT 0.5-0.55 → +1
- ICT 0.56-0.60 → +3
- ICT 0.61-0.65 → +5
- ICT > 0.65 → +7
PASO 3 - ICC (si hay dato): hombres > 0.95 o mujeres > 0.85 → +2
PASO 4 - Antecedentes: HTA/DM/dislipidemia/hipotiroidismo +2 a +4 cada uno; tabaquismo +5
PASO 5 - Habitos: sedentarismo total +3; actividad regular -2; mala alimentacion +2; buena -1; mal sueno +2; estres alto +2
PASO 6 - Factor edad: <30 anos reducir 20% el total sumado; >60 anos aumentar 10%
LIMITES: diferencia maxima +20 anos, minima -5 anos. Edad biologica nunca < 16 anos.

REGLAS PARA CLASIFICACION EOSS (Edmonton Obesity Staging System):
- Etapa 0: sin factores de riesgo relacionados con obesidad, peso saludable
- Etapa 1: factores de riesgo subclinicos (HTA limite, alteracion glucosa, sintomas leves)
- Etapa 2: enfermedades cronicas establecidas (HTA, DM, apnea, dislipidemia)
- Etapa 3: dano organico significativo (IAM previo, ACV, insuficiencia cardiaca)
- Etapa 4: discapacidad severa por obesidad
Devuelve el numero (0-4) y la interpretacion.

${bloque}

Responde UNICAMENTE con JSON valido. Sin markdown, sin backticks, sin texto extra. Estructura exacta:
{
  "portada": {
    "titulo": "Mi Reporte Plan 90",
    "subtitulo": "Reporte clinico personalizado por el Dr. Nicolas Pulecio Leal",
    "paciente": "${d.nombre || 'Paciente'}",
    "fecha_generacion": "fecha actual en formato dia de mes de ano"
  },
  "resumen_datos": {
    "peso_kg": ${d.peso},
    "talla_cm": ${d.talla},
    "imc": ${imc},
    "clasificacion_imc": "texto: Bajo peso/Normal/Sobrepeso/Obesidad I/II/III",
    ${d.cintura ? `"cintura_cm": ${d.cintura},` : ''}
    ${d.cadera ? `"cadera_cm": ${d.cadera},` : ''}
    ${ict ? `"ict": ${ict},` : ''}
    ${icc ? `"icc": ${icc},` : ''}
    "edad_cronologica": ${d.edad},
    "sexo": "${d.sexo}"
  },
  "clasificacion_eoss": {
    "etapa": NUMERO_0_A_4,
    "nombre_etapa": "texto descriptivo de la etapa",
    "interpretacion": "texto 2-3 lineas explicando que significa esa etapa para este paciente"
  },
  "riesgo_cardiovascular": {
    "nivel": "BAJO|MODERADO|ALTO|MUY ALTO",
    "descripcion": "texto 2-3 lineas explicando el riesgo cardiovascular especifico de este paciente",
    "factores_principales": ["factor1","factor2","factor3"]
  },
  "edad_biologica": {
    "valor": NUMERO_ENTERO,
    "diferencia": NUMERO (puede ser negativo),
    "interpretacion": "texto 2-3 lineas, honesto y empatico, sin dramatismo"
  },
  "hallazgos": ["hallazgo1","hallazgo2","hallazgo3","hallazgo4","hallazgo5"],
  "riesgos": ["riesgo1","riesgo2","riesgo3","riesgo4"],
  "meta_peso_90_dias": {
    "peso_objetivo_kg": NUMERO,
    "kilos_a_perder": NUMERO,
    "ritmo_semanal_kg": NUMERO,
    "descripcion": "texto explicando la meta de manera realista y motivadora"
  },
  "examenes_recomendados": [
    {"nombre":"texto","justificacion":"por que este paciente lo necesita","prioridad":"alta|media|baja"},
    {"nombre":"texto","justificacion":"texto","prioridad":"alta|media|baja"}
  ],
  "recomendaciones_estilo_vida": {
    "sueno": "texto con recomendacion especifica de horas y calidad",
    "manejo_estres": "texto con tecnicas concretas para este paciente",
    "hidratacion": "texto con litros diarios y momentos clave",
    "otros": "texto con 1-2 recomendaciones adicionales segun el caso"
  },
  "cierre_motivacional": "texto 3-4 lineas firmado por el Dr. Pulecio, motivador, realista, empatico",
  "disclaimer_legal": "Este reporte constituye una asesoria en habitos saludables y bienestar generada con apoyo de inteligencia artificial, supervisada por el Dr. Nicolas Pulecio Leal. NO reemplaza la consulta medica presencial ni constituye telemedicina. Consulta a tu medico antes de iniciar cualquier plan de alimentacion o ejercicio."
}

Genera contenido REAL personalizado para este paciente especifico segun sus datos. Reemplaza TODOS los campos "texto" y NUMERO con contenido real.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = limpiarJSON(response.content[0].text);
    const resultado = JSON.parse(text);

    res.json({ ok: true, imc, ict, icc, reporte_clinico: resultado });
  } catch (err) {
    console.error('Error reporte-clinico:', err.message);
    res.status(500).json({ error: 'Error generando el reporte clinico. Intenta de nuevo.' });
  }
});

// ============================================
// ENDPOINT 2: REPORTE PLANES (llamada 2)
// Genera secciones 9 y 10: alimentacion + ejercicio 12 semanas
// ============================================
app.post('/api/reporte-planes', async (req, res) => {
  const d = req.body;

  if (!d.peso || !d.talla || !d.edad || !d.sexo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios: peso, talla, edad, sexo' });
  }

  const { bloque } = datosPaciente(d);

  const prompt = `Eres el Dr. Nicolas Pulecio Leal, medico general especializado en medicina preventiva y manejo del peso. Genera el PLAN DE ALIMENTACION (7 dias base con alternativas) y el PLAN DE EJERCICIO (12 semanas en 4 fases) para este paciente.

REGLAS OBLIGATORIAS PARA EL PLAN DE ALIMENTACION:
1. Usa SOLO alimentos universales disponibles en cualquier supermercado del mundo:
   - Proteinas: pollo, pavo, pescado, atun, huevo, yogur natural, queso bajo en grasa, frijoles, lentejas, garbanzos, tofu
   - Carbohidratos: arroz integral, avena, quinoa, pasta integral, pan integral, batata, patata
   - Frutas: manzana, banano, naranja, fresa, piña, papaya, pera, kiwi
   - Verduras: lechuga, tomate, zanahoria, brocoli, espinaca, pepino, cebolla, pimenton, calabacin
   - Grasas saludables: aceite de oliva, aguacate, almendras, nueces, semillas de chia, semillas de girasol
   - Lacteos: leche descremada, yogur griego natural
2. PROHIBIDO alimentos regionales: NO arepa, NO changua, NO papa criolla, NO platano verde, NO patacones, NO ajiaco, NO sancocho, NO tamales, NO bunuelos, NO maracuya, NO lulo, NO guanabana, NO chicharron, NO morcilla.
3. Cada comida DEBE especificar GRAMOS EXACTOS o porciones medidas. Ejemplo correcto:
   "120 g de pechuga de pollo a la plancha + 1/2 taza (100 g) de arroz integral cocido + 2 tazas de ensalada (lechuga, tomate, pepino) con 1 cucharada de aceite de oliva"
4. PROHIBIDO terminos vagos: NO "algo magro", NO "una proteina", NO "porcion moderada". SIEMPRE alimento concreto con cantidad.
5. Estructura del menu: 7 dias (Lunes a Domingo) con desayuno, media manana, almuerzo, merienda, cena.
6. Por CADA comida (desayuno, almuerzo y cena), incluye 3-4 ALTERNATIVAS con gramos exactos.
7. Las meriendas y medias mananas pueden ser texto simple con cantidades.

REGLAS OBLIGATORIAS PARA EL PLAN DE EJERCICIO (12 SEMANAS EN 4 FASES):
1. PROHIBIDO anglicismos. Traduce siempre:
   - HIIT → "intervalos de alta intensidad"
   - Tabata → "intervalos cortos de esfuerzo (20 segundos esfuerzo, 10 segundos descanso)"
   - Cardio → "ejercicio aerobico"
   - Burpees → "saltos con flexion de pecho al suelo"
   - Plank → "plancha"
   - Push-ups → "flexiones de pecho"
   - Squats → "sentadillas"
   - Lunges → "zancadas"
   - Crunches → "abdominales"
   - Mountain climbers → "escaladores"
   - Jumping jacks → "saltos con apertura"
   - Deadlift → "peso muerto"
   - Warm-up → "calentamiento"
   - Cool-down → "estiramiento final"
2. Estructura: 4 fases de 3 semanas cada una
   - Fase 1 (semanas 1-3): Adaptacion - intensidad baja, enfoque en tecnica y consistencia
   - Fase 2 (semanas 4-6): Progresion - aumentar volumen, introducir resistencia
   - Fase 3 (semanas 7-9): Consolidacion - intensidad moderada, mayor variedad
   - Fase 4 (semanas 10-12): Intensificacion - mayor intensidad, ejercicios mas demandantes
3. Por cada fase: describe el objetivo y los principios generales. Da un ejemplo de semana tipo con 7 dias (Lunes a Domingo) detallando: tipo de ejercicio, duracion, repeticiones/series, descansos.
4. Adapta segun el nivel de actividad fisica reportado del paciente.

${bloque}

Responde UNICAMENTE con JSON valido. Sin markdown, sin backticks, sin texto extra. Estructura exacta:
{
  "plan_alimentacion": {
    "calorias_diarias_estimadas": "texto con kcal aproximadas",
    "principios": ["principio1","principio2","principio3","principio4"],
    "menu_base": [
      {
        "dia": "Lunes",
        "desayuno": {
          "principal": "texto con gramos exactos",
          "alternativas": ["alt1 con gramos","alt2 con gramos","alt3 con gramos"]
        },
        "media_manana": "texto con gramos",
        "almuerzo": {
          "principal": "texto con gramos exactos",
          "alternativas": ["alt1","alt2","alt3"]
        },
        "merienda": "texto con gramos",
        "cena": {
          "principal": "texto con gramos exactos",
          "alternativas": ["alt1","alt2","alt3"]
        }
      },
      {"dia":"Martes","desayuno":{"principal":"...","alternativas":["..","..",".."]},"media_manana":"..","almuerzo":{"principal":"..","alternativas":["..","..",".."]},"merienda":"..","cena":{"principal":"..","alternativas":["..","..",".."]}},
      {"dia":"Miercoles","desayuno":{"principal":"...","alternativas":["..","..",".."]},"media_manana":"..","almuerzo":{"principal":"..","alternativas":["..","..",".."]},"merienda":"..","cena":{"principal":"..","alternativas":["..","..",".."]}},
      {"dia":"Jueves","desayuno":{"principal":"...","alternativas":["..","..",".."]},"media_manana":"..","almuerzo":{"principal":"..","alternativas":["..","..",".."]},"merienda":"..","cena":{"principal":"..","alternativas":["..","..",".."]}},
      {"dia":"Viernes","desayuno":{"principal":"...","alternativas":["..","..",".."]},"media_manana":"..","almuerzo":{"principal":"..","alternativas":["..","..",".."]},"merienda":"..","cena":{"principal":"..","alternativas":["..","..",".."]}},
      {"dia":"Sabado","desayuno":{"principal":"...","alternativas":["..","..",".."]},"media_manana":"..","almuerzo":{"principal":"..","alternativas":["..","..",".."]},"merienda":"..","cena":{"principal":"..","alternativas":["..","..",".."]}},
      {"dia":"Domingo","desayuno":{"principal":"...","alternativas":["..","..",".."]},"media_manana":"..","almuerzo":{"principal":"..","alternativas":["..","..",".."]},"merienda":"..","cena":{"principal":"..","alternativas":["..","..",".."]}}
    ]
  },
  "plan_ejercicio": {
    "nivel_inicial": "texto describiendo el nivel actual del paciente",
    "objetivo_general": "texto del objetivo de las 12 semanas",
    "fases": [
      {
        "numero": 1,
        "nombre": "Adaptacion",
        "semanas": "1-3",
        "objetivo": "texto",
        "principios": ["p1","p2","p3"],
        "semana_tipo": [
          {"dia":"Lunes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Martes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Miercoles","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Jueves","tipo":"Descanso","duracion_min":0,"actividad":"Descanso activo: caminata ligera 15-20 minutos o estiramientos suaves"},
          {"dia":"Viernes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Sabado","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Domingo","tipo":"Descanso","duracion_min":0,"actividad":"Descanso completo"}
        ]
      },
      {
        "numero": 2,
        "nombre": "Progresion",
        "semanas": "4-6",
        "objetivo": "texto",
        "principios": ["p1","p2","p3"],
        "semana_tipo": [
          {"dia":"Lunes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Martes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Miercoles","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Jueves","tipo":"Descanso","duracion_min":0,"actividad":"Descanso activo"},
          {"dia":"Viernes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Sabado","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Domingo","tipo":"Descanso","duracion_min":0,"actividad":"Descanso completo"}
        ]
      },
      {
        "numero": 3,
        "nombre": "Consolidacion",
        "semanas": "7-9",
        "objetivo": "texto",
        "principios": ["p1","p2","p3"],
        "semana_tipo": [
          {"dia":"Lunes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Martes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Miercoles","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Jueves","tipo":"Descanso","duracion_min":0,"actividad":"Descanso activo"},
          {"dia":"Viernes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Sabado","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Domingo","tipo":"Descanso","duracion_min":0,"actividad":"Descanso completo"}
        ]
      },
      {
        "numero": 4,
        "nombre": "Intensificacion",
        "semanas": "10-12",
        "objetivo": "texto",
        "principios": ["p1","p2","p3"],
        "semana_tipo": [
          {"dia":"Lunes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Martes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Miercoles","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Jueves","tipo":"Descanso","duracion_min":0,"actividad":"Descanso activo"},
          {"dia":"Viernes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Sabado","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series y descansos"},
          {"dia":"Domingo","tipo":"Descanso","duracion_min":0,"actividad":"Descanso completo"}
        ]
      }
    ]
  }
}

Personalizado para este paciente segun IMC, antecedentes, nivel de actividad y habitos. Reemplaza TODOS los campos "texto" y NUMERO con contenido real y especifico.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = limpiarJSON(response.content[0].text);
    const resultado = JSON.parse(text);

    res.json({ ok: true, planes: resultado });
  } catch (err) {
    console.error('Error reporte-planes:', err.message);
    res.status(500).json({ error: 'Error generando los planes. Intenta de nuevo.' });
  }
});

// ============================================
// ENDPOINTS VIEJOS (compatibilidad)
// ============================================

// Radiografia gratis (la edad biologica con muro de pago)
app.post('/api/radiografia', async (req, res) => {
  const d = req.body;

  if (!d.peso || !d.talla || !d.edad || !d.sexo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const { imc, ict, icc, bloque } = datosPaciente(d);

  const prompt = `Eres el Dr. Nicolas Pulecio Leal. Genera una RADIOGRAFIA DE SALUD BIOLOGICA breve con la edad biologica del paciente. NO incluyas plan de alimentacion ni ejercicio.

REGLAS PARA EDAD BIOLOGICA:
PASO 1 - IMC: 18.5-24.9 → cronologica; 25-26.9 → +2; 27-29.9 → +4; 30-34.9 → +7; 35-39.9 → +10; >=40 → +14
PASO 2 - ICT (si hay): <0.5 → -1; 0.5-0.55 → +1; 0.56-0.60 → +3; 0.61-0.65 → +5; >0.65 → +7
PASO 3 - ICC (si hay): hombre >0.95 o mujer >0.85 → +2
PASO 4 - Antecedentes: HTA/DM/dislipidemia +2-4 cada uno; tabaquismo +5
PASO 5 - Habitos: sedentarismo +3; activo regular -2; mala alim +2; buena -1; mal sueno +2
PASO 6 - <30 anos: reducir 20%; >60: aumentar 10%
LIMITES: max +20, min -5. Nunca <16.

${bloque}

Responde UNICAMENTE con JSON valido, sin markdown. Estructura:
{"edad_biologica":NUMERO,"diferencia_edad":NUMERO,"interpretacion_edad":"texto 2-3 lineas honesto","clasificacion_imc":"texto","categoria_riesgo":"BAJO|MODERADO|ALTO|MUY ALTO","mensaje_principal":"texto 2-3 lineas","hallazgos":["h1","h2","h3","h4"],"riesgos":["r1","r2","r3"],"meta_peso_ideal":"texto","mensaje_cierre":"texto 2-3 lineas"}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }]
    });
    const text = limpiarJSON(response.content[0].text);
    const resultado = JSON.parse(text);
    res.json({ ok: true, imc, relacionCinturaTalla: ict, icc, resultado });
  } catch (err) {
    console.error('Error radiografia:', err.message);
    res.status(500).json({ error: 'Error procesando evaluacion' });
  }
});

// Redirige endpoint antiguo
app.post('/api/evaluar', async (req, res) => {
  req.url = '/api/radiografia';
  app._router.handle(req, res);
});

app.post('/api/plan-premium', async (req, res) => {
  return res.status(410).json({ error: 'Endpoint reemplazado. Usa /api/reporte-clinico y /api/reporte-planes' });
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'plan90-backend',
    endpoints: ['/api/reporte-clinico', '/api/reporte-planes', '/api/radiografia', '/api/health']
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
