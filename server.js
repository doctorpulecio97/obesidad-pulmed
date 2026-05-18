const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function limpiarJSON(text) {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

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
// ENDPOINT 1: REPORTE CLINICO
// ============================================
app.post('/api/reporte-clinico', async (req, res) => {
  const d = req.body;

  if (!d.peso || !d.talla || !d.edad || !d.sexo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios: peso, talla, edad, sexo' });
  }

  const { imc, ict, icc, bloque } = datosPaciente(d);
  const edadCronologica = parseInt(d.edad);

  const prompt = `Eres el Dr. Nicolas Pulecio Leal, medico general especializado en medicina preventiva. Vas a generar las secciones CLINICAS de un reporte personalizado. NO incluyas plan de alimentacion ni ejercicio (eso va aparte).

REGLAS GENERALES:
- Lenguaje claro, empatico, espanol neutral, sin dramatismo
- Honestidad clinica
- No inventes datos: si el paciente no reporto un dato, no lo menciones
- Personaliza segun los datos reales

============================================
CALCULO DE EDAD BIOLOGICA (CRITICO - OBLIGATORIO SEGUIR PASO A PASO)
============================================

Edad cronologica: ${edadCronologica} anos. Vas a calcular con ARITMETICA EXACTA. Debes mostrar el desglose en el JSON.

PASO 1 - PUNTOS POR IMC (NO PUEDES SUMAR DE OTRA MANERA):
- IMC < 18.5 → +2
- IMC 18.5 a 24.9 → 0 (normal)
- IMC 25.0 a 26.9 → +2 (sobrepeso leve)
- IMC 27.0 a 29.9 → +3 (sobrepeso)
- IMC 30.0 a 34.9 → +5 (obesidad I)
- IMC 35.0 a 39.9 → +8 (obesidad II)
- IMC >= 40 → +12 (obesidad III)

PASO 2 - PUNTOS POR CINTURA/TALLA (ICT) - solo si hay dato:
- ICT < 0.5 → -1 (saludable)
- ICT 0.5 a 0.55 → +1
- ICT 0.56 a 0.60 → +2
- ICT 0.61 a 0.65 → +3
- ICT > 0.65 → +4

PASO 3 - PUNTOS POR ICC - solo si hay dato:
- Hombre con ICC > 0.95: +1
- Mujer con ICC > 0.85: +1
- (Si esta en limites normales: 0)

PASO 4 - PUNTOS POR ANTECEDENTES (sumar cada uno que aplique):
- Hipertension arterial: +2
- Diabetes mellitus: +3
- Dislipidemia: +1
- Hipotiroidismo: +1
- Tabaquismo activo: +3
- Ansiedad/depresion/trastorno mental sin tratamiento: +1
- Apnea del sueno: +1
- Sindrome metabolico ya diagnosticado: +2
- "Ninguno" o vacio: 0

PASO 5 - PUNTOS POR HABITOS (sumar todos los que apliquen):
- Sedentarismo total: +2
- Actividad fisica regular (3+ veces/semana): -2
- Actividad fisica moderada: -1
- Alimentacion alta en ultraprocesados/azucar: +1
- Buena alimentacion (verduras, no procesados): -1
- Sueno deficiente (menos de 6h): +1
- Estres alto cronico: +1

PASO 6 - FACTOR DE EDAD (multiplicador del total de puntos):
- Si edad cronologica < 30: multiplicar el subtotal por 0.7 (mayor margen de recuperacion)
- Si edad cronologica 30-49: multiplicar por 1.0
- Si edad cronologica 50-65: multiplicar por 1.1
- Si edad cronologica > 65: multiplicar por 1.2

PASO 7 - CALCULO FINAL:
subtotal = paso1 + paso2 + paso3 + paso4 + paso5
total_sumado = round(subtotal × factor_paso6)
edad_biologica = edad_cronologica + total_sumado

LIMITES OBLIGATORIOS:
- total_sumado maximo = +15 (aunque la suma de mas)
- total_sumado minimo = -5 (aunque reste mas)
- edad_biologica nunca menor a 16

EJEMPLO DE CALCULO PARA ENTENDER (paciente diferente):
Hombre 28 anos, IMC 30, cintura 100 cm, talla 175, sedentario, sin antecedentes
- IMC 30 → +5
- ICT 0.57 → +2
- Sedentarismo → +2
- Subtotal: 9
- Factor edad <30: 0.7 → 9 × 0.7 = 6.3 → redondear a 6
- Edad biologica: 28 + 6 = 34 anos

============================================
CLASIFICACION EOSS (Edmonton Obesity Staging System)
============================================
- Etapa 0: IMC normal o sobrepeso leve sin factores de riesgo
- Etapa 1: factores de riesgo subclinicos o sintomas leves (HTA limite, alteracion glucemia leve, dolor articular leve, dificultad respiratoria con esfuerzo)
- Etapa 2: enfermedades cronicas establecidas (HTA, DM2, dislipidemia, apnea, esteatohepatitis, sindrome metabolico)
- Etapa 3: dano organico significativo (IAM, ACV, insuficiencia cardiaca, complicaciones de diabetes)
- Etapa 4: discapacidad severa por obesidad

============================================
${bloque}
============================================

Responde UNICAMENTE con JSON valido. Sin markdown. Estructura EXACTA:
{
  "portada": {
    "titulo": "Mi Reporte Plan 90",
    "subtitulo": "Reporte clinico personalizado por el Dr. Nicolas Pulecio Leal",
    "paciente": "${d.nombre || 'Paciente'}",
    "fecha_generacion": "fecha actual: dia de mes de ano"
  },
  "resumen_datos": {
    "peso_kg": ${d.peso},
    "talla_cm": ${d.talla},
    "imc": ${imc},
    "clasificacion_imc": "Bajo peso/Normal/Sobrepeso leve/Sobrepeso/Obesidad I/Obesidad II/Obesidad III",
    ${d.cintura ? `"cintura_cm": ${d.cintura},` : ''}
    ${d.cadera ? `"cadera_cm": ${d.cadera},` : ''}
    ${ict ? `"ict": ${ict},` : ''}
    ${icc ? `"icc": ${icc},` : ''}
    "edad_cronologica": ${edadCronologica},
    "sexo": "${d.sexo}"
  },
  "clasificacion_eoss": {
    "etapa": 0,
    "nombre_etapa": "texto",
    "interpretacion": "texto 2-3 lineas"
  },
  "riesgo_cardiovascular": {
    "nivel": "BAJO|MODERADO|ALTO|MUY ALTO",
    "descripcion": "texto 2-3 lineas",
    "factores_principales": ["f1","f2","f3"]
  },
  "edad_biologica": {
    "calculo": {
      "puntos_imc": NUMERO,
      "puntos_ict": NUMERO,
      "puntos_icc": NUMERO,
      "puntos_antecedentes": NUMERO,
      "puntos_habitos": NUMERO,
      "subtotal": NUMERO,
      "factor_edad_aplicado": NUMERO_DECIMAL,
      "total_sumado": NUMERO_ENTERO
    },
    "valor": NUMERO_ENTERO,
    "diferencia": NUMERO,
    "interpretacion": "texto 2-3 lineas, honesto, sin dramatismo. Si la diferencia es positiva: mencionar que es reversible. Si es negativa: felicitar."
  },
  "hallazgos": ["h1","h2","h3","h4","h5"],
  "riesgos": ["r1","r2","r3","r4"],
  "meta_peso_90_dias": {
    "peso_objetivo_kg": NUMERO,
    "kilos_a_perder": NUMERO,
    "ritmo_semanal_kg": 0.5,
    "descripcion": "texto realista"
  },
  "examenes_recomendados": [
    {"nombre":"texto","justificacion":"texto","prioridad":"alta|media|baja"},
    {"nombre":"texto","justificacion":"texto","prioridad":"alta|media|baja"}
  ],
  "recomendaciones_estilo_vida": {
    "sueno": "texto",
    "manejo_estres": "texto",
    "hidratacion": "texto",
    "otros": "texto"
  },
  "cierre_motivacional": "texto 3-4 lineas firmado por el Dr. Pulecio",
  "disclaimer_legal": "Este reporte constituye una asesoria en habitos saludables y bienestar generada con apoyo de inteligencia artificial, supervisada por el Dr. Nicolas Pulecio Leal. NO reemplaza la consulta medica presencial ni constituye telemedicina. Consulta a tu medico antes de iniciar cualquier plan de alimentacion o ejercicio."
}

VALIDACION FINAL OBLIGATORIA antes de devolver: verifica que edad_biologica.valor = ${edadCronologica} + edad_biologica.calculo.total_sumado. Si no coincide, recalcula.`;

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
// ENDPOINT 2: REPORTE PLANES
// ============================================
app.post('/api/reporte-planes', async (req, res) => {
  const d = req.body;

  if (!d.peso || !d.talla || !d.edad || !d.sexo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios: peso, talla, edad, sexo' });
  }

  const { bloque } = datosPaciente(d);

  const prompt = `Eres el Dr. Nicolas Pulecio Leal. Genera el PLAN DE ALIMENTACION (7 dias base con alternativas) y el PLAN DE EJERCICIO (12 semanas en 4 fases) para este paciente.

REGLAS PLAN ALIMENTACION:
1. Alimentos universales SOLAMENTE: pollo, pavo, pescado, atun, huevo, yogur natural, queso bajo en grasa, frijoles, lentejas, garbanzos, tofu, arroz integral, avena, quinoa, pasta integral, pan integral, batata, papa, manzana, banano, naranja, fresa, pina, papaya, pera, kiwi, lechuga, tomate, zanahoria, brocoli, espinaca, pepino, cebolla, pimenton, calabacin, aceite de oliva, aguacate, almendras, nueces, semillas de chia, semillas de girasol, leche descremada, yogur griego.
2. PROHIBIDO: arepa, changua, papa criolla, platano verde, patacones, ajiaco, sancocho, tamales, bunuelos, maracuya, lulo, guanabana, chicharron, morcilla.
3. Cada comida con GRAMOS EXACTOS. Ejemplo: "120 g de pechuga de pollo a la plancha + 1/2 taza (100 g) de arroz integral cocido + 2 tazas de ensalada con 1 cucharada de aceite de oliva".
4. PROHIBIDO terminos vagos como "algo magro" o "porcion moderada". SIEMPRE alimento concreto con cantidad.
5. Estructura: 7 dias (Lunes-Domingo) con desayuno, media manana, almuerzo, merienda, cena.
6. Por cada desayuno, almuerzo y cena: incluye 3 alternativas con gramos exactos.

REGLAS PLAN EJERCICIO (12 SEMANAS, 4 FASES):
1. PROHIBIDO anglicismos. Traduce: HIIT → "intervalos de alta intensidad"; Tabata → "intervalos cortos de esfuerzo (20s esfuerzo, 10s descanso)"; Cardio → "ejercicio aerobico"; Burpees → "saltos con flexion"; Plank → "plancha"; Push-ups → "flexiones de pecho"; Squats → "sentadillas"; Lunges → "zancadas"; Crunches → "abdominales"; Mountain climbers → "escaladores"; Jumping jacks → "saltos con apertura"; Deadlift → "peso muerto"; Warm-up → "calentamiento"; Cool-down → "estiramiento final".
2. 4 fases de 3 semanas: Adaptacion (1-3), Progresion (4-6), Consolidacion (7-9), Intensificacion (10-12).
3. Por fase: objetivo, principios y una semana tipo de 7 dias con tipo, duracion, repeticiones, series y descansos.
4. Adapta al nivel de actividad reportado.

${bloque}

Responde UNICAMENTE JSON valido. Sin markdown. Estructura exacta:
{
  "plan_alimentacion": {
    "calorias_diarias_estimadas": "texto",
    "principios": ["p1","p2","p3","p4"],
    "menu_base": [
      {"dia":"Lunes","desayuno":{"principal":"...","alternativas":["..","..",".."]},"media_manana":"..","almuerzo":{"principal":"..","alternativas":["..","..",".."]},"merienda":"..","cena":{"principal":"..","alternativas":["..","..",".."]}},
      {"dia":"Martes","desayuno":{"principal":"...","alternativas":["..","..",".."]},"media_manana":"..","almuerzo":{"principal":"..","alternativas":["..","..",".."]},"merienda":"..","cena":{"principal":"..","alternativas":["..","..",".."]}},
      {"dia":"Miercoles","desayuno":{"principal":"...","alternativas":["..","..",".."]},"media_manana":"..","almuerzo":{"principal":"..","alternativas":["..","..",".."]},"merienda":"..","cena":{"principal":"..","alternativas":["..","..",".."]}},
      {"dia":"Jueves","desayuno":{"principal":"...","alternativas":["..","..",".."]},"media_manana":"..","almuerzo":{"principal":"..","alternativas":["..","..",".."]},"merienda":"..","cena":{"principal":"..","alternativas":["..","..",".."]}},
      {"dia":"Viernes","desayuno":{"principal":"...","alternativas":["..","..",".."]},"media_manana":"..","almuerzo":{"principal":"..","alternativas":["..","..",".."]},"merienda":"..","cena":{"principal":"..","alternativas":["..","..",".."]}},
      {"dia":"Sabado","desayuno":{"principal":"...","alternativas":["..","..",".."]},"media_manana":"..","almuerzo":{"principal":"..","alternativas":["..","..",".."]},"merienda":"..","cena":{"principal":"..","alternativas":["..","..",".."]}},
      {"dia":"Domingo","desayuno":{"principal":"...","alternativas":["..","..",".."]},"media_manana":"..","almuerzo":{"principal":"..","alternativas":["..","..",".."]},"merienda":"..","cena":{"principal":"..","alternativas":["..","..",".."]}}
    ]
  },
  "plan_ejercicio": {
    "nivel_inicial": "texto",
    "objetivo_general": "texto",
    "fases": [
      {"numero":1,"nombre":"Adaptacion","semanas":"1-3","objetivo":"texto","principios":["p1","p2","p3"],"semana_tipo":[
        {"dia":"Lunes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto con repeticiones, series, descansos"},
        {"dia":"Martes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Miercoles","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Jueves","tipo":"Descanso","duracion_min":0,"actividad":"Descanso activo: caminata 15-20 min"},
        {"dia":"Viernes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Sabado","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Domingo","tipo":"Descanso","duracion_min":0,"actividad":"Descanso completo"}
      ]},
      {"numero":2,"nombre":"Progresion","semanas":"4-6","objetivo":"texto","principios":["p1","p2","p3"],"semana_tipo":[
        {"dia":"Lunes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Martes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Miercoles","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Jueves","tipo":"Descanso","duracion_min":0,"actividad":"Descanso activo"},
        {"dia":"Viernes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Sabado","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Domingo","tipo":"Descanso","duracion_min":0,"actividad":"Descanso completo"}
      ]},
      {"numero":3,"nombre":"Consolidacion","semanas":"7-9","objetivo":"texto","principios":["p1","p2","p3"],"semana_tipo":[
        {"dia":"Lunes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Martes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Miercoles","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Jueves","tipo":"Descanso","duracion_min":0,"actividad":"Descanso activo"},
        {"dia":"Viernes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Sabado","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Domingo","tipo":"Descanso","duracion_min":0,"actividad":"Descanso completo"}
      ]},
      {"numero":4,"nombre":"Intensificacion","semanas":"10-12","objetivo":"texto","principios":["p1","p2","p3"],"semana_tipo":[
        {"dia":"Lunes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Martes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Miercoles","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Jueves","tipo":"Descanso","duracion_min":0,"actividad":"Descanso activo"},
        {"dia":"Viernes","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Sabado","tipo":"texto","duracion_min":NUMERO,"actividad":"texto"},
        {"dia":"Domingo","tipo":"Descanso","duracion_min":0,"actividad":"Descanso completo"}
      ]}
    ]
  }
}

Personalizado para este paciente segun IMC, antecedentes, nivel de actividad y habitos.`;

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
app.post('/api/radiografia', async (req, res) => {
  const d = req.body;
  if (!d.peso || !d.talla || !d.edad || !d.sexo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }
  // Reutiliza la logica del reporte-clinico pero responde con la estructura vieja
  const { imc, ict, icc, bloque } = datosPaciente(d);
  const prompt = `Eres el Dr. Nicolas Pulecio Leal. Genera radiografia breve con edad biologica calibrada.

Sigue ESTRICTAMENTE este algoritmo:
IMC <18.5 +2; 18.5-24.9 0; 25-26.9 +2; 27-29.9 +3; 30-34.9 +5; 35-39.9 +8; >=40 +12
ICT <0.5 -1; 0.5-0.55 +1; 0.56-0.60 +2; 0.61-0.65 +3; >0.65 +4
ICC hombre >0.95 o mujer >0.85: +1
Antecedentes: HTA+2, DM+3, dislipidemia+1, hipotiroidismo+1, tabaquismo+3, ansiedad+1
Habitos: sedentarismo+2, activo regular -2, mala alim+1, buena -1, mal sueno+1, estres+1
Edad <30: subtotal × 0.7. 30-49: ×1.0. 50-65: ×1.1. >65: ×1.2.
Limite max +15, min -5.

${bloque}

JSON solamente, sin markdown:
{"edad_biologica":NUMERO,"diferencia_edad":NUMERO,"interpretacion_edad":"2-3 lineas","clasificacion_imc":"texto","categoria_riesgo":"BAJO|MODERADO|ALTO|MUY ALTO","mensaje_principal":"2-3 lineas","hallazgos":["h1","h2","h3","h4"],"riesgos":["r1","r2","r3"],"meta_peso_ideal":"texto","mensaje_cierre":"2-3 lineas"}`;

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

app.post('/api/evaluar', async (req, res) => {
  req.url = '/api/radiografia';
  app._router.handle(req, res);
});

app.post('/api/plan-premium', async (req, res) => {
  return res.status(410).json({ error: 'Endpoint reemplazado. Usa /api/reporte-clinico y /api/reporte-planes' });
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'plan90-backend',
    version: '2.1',
    endpoints: ['/api/reporte-clinico', '/api/reporte-planes', '/api/radiografia', '/api/health']
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
