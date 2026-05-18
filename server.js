const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============================================
// ENDPOINT 1: RADIOGRAFIA (GRATIS) - con EDAD BIOLOGICA CALIBRADA
// ============================================
app.post('/api/radiografia', async (req, res) => {
  const { nombre, edad, sexo, peso, talla, cintura, cadera, antecedentes, habitos } = req.body;

  if (!peso || !talla || !edad || !sexo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const imc = (parseFloat(peso) / Math.pow(parseFloat(talla) / 100, 2)).toFixed(1);
  const relacionCinturaTalla = cintura ? (parseFloat(cintura) / parseFloat(talla)).toFixed(2) : null;
  const icc = (cintura && cadera) ? (parseFloat(cintura) / parseFloat(cadera)).toFixed(2) : null;

  const prompt = `Eres el Dr. Nicolas Pulecio Leal, medico general especializado en medicina preventiva y manejo del peso.
Genera una RADIOGRAFIA DE SALUD BIOLOGICA con un dato estrella: la EDAD BIOLOGICA/METABOLICA estimada del paciente comparada con su edad cronologica.

NO incluyas plan de alimentacion ni plan de ejercicio.

REGLAS ESTRICTAS PARA CALCULAR LA EDAD BIOLOGICA:
- Edad cronologica del paciente: ${edad} anos
- Sexo: ${sexo}
- IMC: ${imc} kg/m2
${relacionCinturaTalla ? `- Relacion cintura/talla (ICT): ${relacionCinturaTalla} (saludable < 0.5)` : ''}
${icc ? `- Indice cintura/cadera (ICC): ${icc}` : ''}

PASO 1: PUNTO DE PARTIDA SEGUN IMC
- IMC 18.5 a 24.9 (normal) → punto de partida: edad cronologica
- IMC 25 a 26.9 (sobrepeso leve) → +2 anos
- IMC 27 a 29.9 (sobrepeso) → +4 anos
- IMC 30 a 34.9 (obesidad I) → +7 anos
- IMC 35 a 39.9 (obesidad II) → +10 anos
- IMC >= 40 (obesidad III) → +14 anos
- IMC < 18.5 (bajo peso) → +1 a +3 anos por riesgo nutricional

PASO 2: AJUSTAR POR CINTURA (factor mas importante de salud cardiovascular)
- Si NO hay dato de cintura → no sumar nada por cintura
- ICT < 0.5 → resta 1 ano del partida
- ICT 0.5 a 0.55 → suma 1 ano
- ICT 0.56 a 0.60 → suma 3 anos
- ICT 0.61 a 0.65 → suma 5 anos
- ICT > 0.65 → suma 7 anos

PASO 3: AJUSTAR POR ICC (si hay dato)
- Hombres con ICC > 0.95 o mujeres con ICC > 0.85 → suma 2 anos extra (obesidad androide)

PASO 4: AJUSTAR POR ANTECEDENTES
- Hipertension, diabetes, dislipidemia, hipotiroidismo: +2 a +4 anos por cada uno
- Tabaquismo activo: +5 anos
- Trastorno de salud mental sin tratamiento: +1 a +2 anos
- Si NO hay antecedentes (campo vacio o "ninguna") → no sumar nada

PASO 5: AJUSTAR POR HABITOS
- Sedentarismo total ("no hago nada", "nada", "sedentario") → +3 anos
- Actividad fisica regular (camina, gimnasio 3+ veces/semana) → resta 2 anos
- Alimentacion alta en ultraprocesados, fritos, azucar → +2 anos
- Buenos habitos alimentarios (verduras, no procesados) → resta 1 ano
- Mal dormir (menos de 6h) → +2 anos
- Estres alto cronico → +2 anos
- Si no hay datos de habitos o estan vacios → no sumar nada

PASO 6: FACTOR DE EDAD (margen de recuperacion)
- Si paciente tiene < 30 anos → reducir 20% el total de anos sumados (mas margen de recuperacion)
- Si paciente tiene > 60 anos → aumentar 10% el total de anos sumados

REGLAS DE COHERENCIA:
- La edad biologica NUNCA puede ser menor a 16 anos.
- La diferencia maxima posible (edad biologica - edad cronologica) es +20 anos en casos extremos.
- La diferencia minima posible es -5 anos en pacientes muy saludables.
- Para un IMC normal sin factores de riesgo, edad biologica debe ser igual o muy cercana a la cronologica.
- NO seas dramatico. Se realista y honesto. Es mejor decir "+5 anos" cierto, que "+15 anos" exagerado.
- Devuelve la edad biologica como NUMERO ENTERO.

DATOS DEL PACIENTE:
- Nombre: ${nombre || 'Paciente'}
- Edad cronologica: ${edad} anos
- Sexo: ${sexo}
- Peso: ${peso} kg
- Talla: ${talla} cm
- IMC: ${imc} kg/m2
${cintura ? `- Cintura: ${cintura} cm` : '- Cintura: NO REPORTADA (no incluyas ICT en hallazgos)'}
${cadera ? `- Cadera: ${cadera} cm` : '- Cadera: NO REPORTADA (no incluyas ICC en hallazgos)'}
${relacionCinturaTalla ? `- Relacion cintura/talla: ${relacionCinturaTalla}` : ''}
${icc ? `- Indice cintura/cadera: ${icc}` : ''}
${antecedentes ? `- Antecedentes: ${antecedentes}` : '- Antecedentes: ninguno reportado'}
${habitos ? `- Habitos actuales: ${habitos}` : '- Habitos: no reportados'}

Calcula paso a paso siguiendo las reglas anteriores y devuelve el resultado.

Responde UNICAMENTE con JSON valido. Sin markdown, sin backticks, sin texto extra. Estructura exacta:
{"edad_biologica":NUMERO,"diferencia_edad":NUMERO,"interpretacion_edad":"texto explicando con HONESTIDAD CLINICA que significa esa edad biologica vs cronologica, 2-3 lineas, claro y empatico, sin dramatismo","clasificacion_imc":"texto","categoria_riesgo":"BAJO|MODERADO|ALTO|MUY ALTO","mensaje_principal":"texto motivacional 2-3 lineas que mencione la edad biologica","hallazgos":["h1","h2","h3","h4"],"riesgos":["r1","r2","r3"],"meta_peso_ideal":"texto con rango de peso ideal en kg","mensaje_cierre":"texto motivacional para cerrar, invitando a tomar el siguiente paso 2-3 lineas"}

REGLAS DEL JSON:
- "edad_biologica" es un NUMERO ENTERO sin comillas.
- "diferencia_edad" es la diferencia (edad_biologica - edad_cronologica). Puede ser negativo.
- "interpretacion_edad": HONESTA, NO DRAMATICA, calibrada al numero real.
- NO menciones ICT ni ICC en hallazgos si el paciente NO reporto cintura o cadera.
- Hallazgos: interpretacion clara de IMC, ICT, ICC y antecedentes REALES (no inventes datos).
- Riesgos: solo los que aplican segun los datos reales.
- Lenguaje claro, empatico, espanol neutral. Sin alarmismo innecesario.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = response.content[0].text.trim();
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const resultado = JSON.parse(text);

    res.json({ ok: true, imc, relacionCinturaTalla, icc, resultado });
  } catch (err) {
    console.error('Error API radiografia:', err.message);
    res.status(500).json({ error: 'Error al procesar la evaluacion. Intenta de nuevo.' });
  }
});

// ============================================
// ENDPOINT 2: PLAN PREMIUM (PAGO)
// ============================================
app.post('/api/plan-premium', async (req, res) => {
  const { nombre, edad, sexo, peso, talla, cintura, cadera, antecedentes, habitos, pagoConfirmado } = req.body;

  if (!pagoConfirmado) {
    return res.status(403).json({ error: 'Pago no confirmado' });
  }

  if (!peso || !talla || !edad || !sexo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const imc = (parseFloat(peso) / Math.pow(parseFloat(talla) / 100, 2)).toFixed(1);

  const prompt = `Eres el Dr. Nicolas Pulecio Leal, medico general especializado en medicina preventiva y manejo del peso.
Genera el PLAN PREMIUM 90 DIAS: plan de alimentacion 7 dias + plan de ejercicio 4 semanas progresivas.

REGLAS OBLIGATORIAS PARA EL PLAN DE ALIMENTACION:
1. Usa SOLO alimentos universales disponibles en cualquier supermercado del mundo: pollo, pescado, atun, huevo, arroz, avena, quinoa, pasta integral, pan integral, frijoles, lentejas, garbanzos, frutas comunes (manzana, banano, naranja, fresa, piña, papaya), verduras comunes (lechuga, tomate, zanahoria, brocoli, espinaca, pepino, cebolla, pimenton), aceite de oliva, yogur natural, queso bajo en grasa, leche descremada, almendras, nueces, semillas.
2. PROHIBIDO usar alimentos regionales: NO arepa, NO changua, NO papa criolla, NO platano verde, NO patacones, NO ajiaco, NO sancocho, NO tamales, NO buñuelos, NO maracuya, NO lulo, NO guanabana.
3. Cada comida DEBE especificar GRAMOS EXACTOS o porciones medidas. Ejemplos:
   - "120 g de pechuga de pollo a la plancha + 1/2 taza (100 g) de arroz integral cocido + 2 tazas de ensalada con 1 cucharada de aceite de oliva"
   - "2 huevos revueltos + 1 rebanada de pan integral + 1 manzana mediana + 1 taza de te verde sin azucar"
4. PROHIBIDO terminos vagos: NO "algo magro", NO "una proteina", NO "porcion moderada". SIEMPRE alimento concreto con cantidad.
5. Lenguaje claro y simple.

REGLAS OBLIGATORIAS PARA EL PLAN DE EJERCICIO:
1. PROHIBIDO usar anglicismos. Traduce siempre:
   - HIIT → "intervalos de alta intensidad"
   - Tabata → "intervalos cortos de esfuerzo (20 segundos esfuerzo, 10 segundos descanso)"
   - Rest-pause → "series con pausas cortas"
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
2. Cada dia DEBE incluir: tipo de ejercicio, duracion total, ejercicios especificos con NUMERO DE REPETICIONES, NUMERO DE SERIES y TIEMPO DE DESCANSO entre series.

DATOS DEL PACIENTE:
- Nombre: ${nombre || 'Paciente'}
- Edad: ${edad} anos
- Sexo: ${sexo}
- Peso: ${peso} kg
- Talla: ${talla} cm
- IMC: ${imc} kg/m2
${cintura ? `- Cintura: ${cintura} cm` : ''}
${cadera ? `- Cadera: ${cadera} cm` : ''}
${antecedentes ? `- Antecedentes: ${antecedentes}` : ''}
${habitos ? `- Habitos actuales: ${habitos}` : ''}

Responde UNICAMENTE con JSON valido. Sin markdown, sin backticks. Estructura exacta:
{"plan_alimentacion":{"calorias_diarias":"texto","principios":["p1","p2","p3"],"semana":[{"dia":"Lunes","desayuno":{"nombre":"texto","descripcion":"texto con gramos exactos","opciones":["op1 con gramos","op2 con gramos"]},"media_manana":"texto con gramos","almuerzo":{"nombre":"texto","descripcion":"texto con gramos exactos","opciones":["op1 con gramos"]},"merienda":"texto con gramos","cena":{"nombre":"texto","descripcion":"texto con gramos exactos","opciones":["op1 con gramos"]}},{"dia":"Martes","desayuno":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"media_manana":"texto con gramos","almuerzo":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"merienda":"texto con gramos","cena":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]}},{"dia":"Miercoles","desayuno":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"media_manana":"texto con gramos","almuerzo":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"merienda":"texto con gramos","cena":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]}},{"dia":"Jueves","desayuno":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"media_manana":"texto con gramos","almuerzo":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"merienda":"texto con gramos","cena":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]}},{"dia":"Viernes","desayuno":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"media_manana":"texto con gramos","almuerzo":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"merienda":"texto con gramos","cena":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]}},{"dia":"Sabado","desayuno":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"media_manana":"texto con gramos","almuerzo":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"merienda":"texto con gramos","cena":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]}},{"dia":"Domingo","desayuno":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"media_manana":"texto con gramos","almuerzo":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"merienda":"texto con gramos","cena":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]}}]},"plan_ejercicio":{"nivel_actual":"texto","objetivo":"texto","semanas":[{"semana":1,"titulo":"Adaptacion","descripcion":"texto","dias":[{"dia":"Lunes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos en espanol claro"},{"dia":"Martes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos en espanol claro"},{"dia":"Miercoles","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos en espanol claro"},{"dia":"Jueves","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"},{"dia":"Viernes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos en espanol claro"},{"dia":"Sabado","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos en espanol claro"},{"dia":"Domingo","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"}]},{"semana":2,"titulo":"Progresion","descripcion":"texto","dias":[{"dia":"Lunes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Martes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Miercoles","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Jueves","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"},{"dia":"Viernes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Sabado","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Domingo","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"}]},{"semana":3,"titulo":"Consolidacion","descripcion":"texto","dias":[{"dia":"Lunes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Martes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Miercoles","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Jueves","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"},{"dia":"Viernes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Sabado","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Domingo","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"}]},{"semana":4,"titulo":"Intensificacion","descripcion":"texto","dias":[{"dia":"Lunes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Martes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Miercoles","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Jueves","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"},{"dia":"Viernes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Sabado","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Domingo","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"}]}]}}

Personalizado para este paciente especifico segun su IMC, antecedentes y habitos. Espanol neutral.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = response.content[0].text.trim();
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const resultado = JSON.parse(text);

    res.json({ ok: true, resultado });
  } catch (err) {
    console.error('Error API plan premium:', err.message);
    res.status(500).json({ error: 'Error al generar el plan premium. Intenta de nuevo.' });
  }
});

// Compatibilidad con endpoint viejo
app.post('/api/evaluar', async (req, res) => {
  req.url = '/api/radiografia';
  app._router.handle(req, res);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
