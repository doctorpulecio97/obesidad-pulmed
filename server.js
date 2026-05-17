const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============================================
// ENDPOINT 1: RADIOGRAFIA (GRATIS)
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
Genera una RADIOGRAFIA DE SALUD breve pero impactante para este paciente. NO incluyas plan de alimentacion ni plan de ejercicio (eso es para el reporte premium pago).

DATOS DEL PACIENTE:
- Nombre: ${nombre || 'Paciente'}
- Edad: ${edad} anos
- Sexo: ${sexo}
- Peso: ${peso} kg
- Talla: ${talla} cm
- IMC: ${imc} kg/m2
${cintura ? `- Cintura: ${cintura} cm` : ''}
${cadera ? `- Cadera: ${cadera} cm` : ''}
${relacionCinturaTalla ? `- Relacion cintura/talla: ${relacionCinturaTalla}` : ''}
${icc ? `- Indice cintura/cadera: ${icc}` : ''}
${antecedentes ? `- Antecedentes: ${antecedentes}` : ''}
${habitos ? `- Habitos actuales: ${habitos}` : ''}

Responde UNICAMENTE con JSON valido. Sin markdown, sin backticks, sin texto extra. El JSON debe tener esta estructura exacta:
{"clasificacion_imc":"texto","categoria_riesgo":"BAJO|MODERADO|ALTO|MUY ALTO","mensaje_principal":"texto motivacional 2-3 lineas","hallazgos":["h1","h2","h3","h4"],"riesgos":["r1","r2","r3"],"meta_peso_ideal":"texto con rango de peso ideal en kg","mensaje_cierre":"texto motivacional para cerrar la radiografia 2-3 lineas, invitando a tomar el siguiente paso"}

Reemplaza todos los valores "texto", "h1", etc. con contenido REAL, personalizado para este paciente especifico segun su IMC, antecedentes y habitos. Lenguaje claro, empatico, en espanol neutral. Los hallazgos deben ser interpretacion de IMC, ICT, ICC y antecedentes. Los riesgos deben ser concretos (riesgo cardiovascular, metabolico, etc.).`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
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

  // Validacion basica de pago - en produccion conectar con pasarela real
  if (!pagoConfirmado) {
    return res.status(403).json({ error: 'Pago no confirmado' });
  }

  if (!peso || !talla || !edad || !sexo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const imc = (parseFloat(peso) / Math.pow(parseFloat(talla) / 100, 2)).toFixed(1);

  const prompt = `Eres el Dr. Nicolas Pulecio Leal, medico general especializado en medicina preventiva y manejo del peso.
Genera el PLAN PREMIUM 90 DIAS para este paciente: plan de alimentacion 7 dias + plan de ejercicio 4 semanas progresivas.

REGLAS OBLIGATORIAS PARA EL PLAN DE ALIMENTACION:
1. Usa SOLO alimentos universales disponibles en cualquier supermercado del mundo: pollo, pescado, atun, huevo, arroz, avena, quinoa, pasta integral, pan integral, frijoles, lentejas, garbanzos, frutas comunes (manzana, banano, naranja, fresa, piña, papaya), verduras comunes (lechuga, tomate, zanahoria, brocoli, espinaca, pepino, cebolla, pimenton), aceite de oliva, yogur natural, queso bajo en grasa, leche descremada, almendras, nueces, semillas.
2. PROHIBIDO usar alimentos regionales: NO arepa, NO changua, NO papa criolla, NO platano verde, NO patacones, NO ajiaco, NO sancocho, NO tamales, NO buñuelos, NO maracuya, NO lulo, NO guanabana.
3. Cada comida DEBE especificar GRAMOS EXACTOS o porciones medidas. Ejemplos correctos:
   - "120 g de pechuga de pollo a la plancha + 1/2 taza (100 g) de arroz integral cocido + 2 tazas de ensalada (lechuga, tomate, pepino) con 1 cucharada de aceite de oliva"
   - "2 huevos revueltos + 1 rebanada de pan integral + 1 manzana mediana + 1 taza de te verde sin azucar"
4. PROHIBIDO terminos vagos: NO "algo magro", NO "una proteina", NO "porcion moderada". SIEMPRE alimento concreto con cantidad.
5. Lenguaje claro y simple. Las opciones alternativas tambien con cantidades exactas.

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
3. Ejemplo: "Caminata rapida 30 minutos + circuito de fuerza: 3 series de 15 sentadillas, 10 flexiones de pecho (apoyadas en rodillas si es necesario), 20 abdominales y 30 segundos de plancha. Descansa 60 segundos entre series."
4. Lenguaje claro, sin jerga de gimnasio.

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

Responde UNICAMENTE con JSON valido. Sin markdown, sin backticks, sin texto extra. Estructura exacta:
{"plan_alimentacion":{"calorias_diarias":"texto","principios":["p1","p2","p3"],"semana":[{"dia":"Lunes","desayuno":{"nombre":"texto","descripcion":"texto con gramos exactos","opciones":["op1 con gramos","op2 con gramos"]},"media_manana":"texto con gramos","almuerzo":{"nombre":"texto","descripcion":"texto con gramos exactos","opciones":["op1 con gramos"]},"merienda":"texto con gramos","cena":{"nombre":"texto","descripcion":"texto con gramos exactos","opciones":["op1 con gramos"]}},{"dia":"Martes","desayuno":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"media_manana":"texto con gramos","almuerzo":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"merienda":"texto con gramos","cena":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]}},{"dia":"Miercoles","desayuno":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"media_manana":"texto con gramos","almuerzo":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"merienda":"texto con gramos","cena":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]}},{"dia":"Jueves","desayuno":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"media_manana":"texto con gramos","almuerzo":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"merienda":"texto con gramos","cena":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]}},{"dia":"Viernes","desayuno":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"media_manana":"texto con gramos","almuerzo":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"merienda":"texto con gramos","cena":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]}},{"dia":"Sabado","desayuno":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"media_manana":"texto con gramos","almuerzo":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"merienda":"texto con gramos","cena":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]}},{"dia":"Domingo","desayuno":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"media_manana":"texto con gramos","almuerzo":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]},"merienda":"texto con gramos","cena":{"nombre":"texto","descripcion":"texto con gramos","opciones":["op1"]}}]},"plan_ejercicio":{"nivel_actual":"texto","objetivo":"texto","semanas":[{"semana":1,"titulo":"Adaptacion","descripcion":"texto","dias":[{"dia":"Lunes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos en espanol claro"},{"dia":"Martes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos en espanol claro"},{"dia":"Miercoles","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos en espanol claro"},{"dia":"Jueves","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"},{"dia":"Viernes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos en espanol claro"},{"dia":"Sabado","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos en espanol claro"},{"dia":"Domingo","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"}]},{"semana":2,"titulo":"Progresion","descripcion":"texto","dias":[{"dia":"Lunes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Martes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Miercoles","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Jueves","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"},{"dia":"Viernes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Sabado","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Domingo","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"}]},{"semana":3,"titulo":"Consolidacion","descripcion":"texto","dias":[{"dia":"Lunes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Martes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Miercoles","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Jueves","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"},{"dia":"Viernes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Sabado","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Domingo","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"}]},{"semana":4,"titulo":"Intensificacion","descripcion":"texto","dias":[{"dia":"Lunes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Martes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Miercoles","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Jueves","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"},{"dia":"Viernes","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Sabado","tipo":"texto","duracion":"texto","actividad":"texto con repeticiones series y descansos"},{"dia":"Domingo","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"}]}]}}

Personalizado para este paciente especifico segun su IMC, antecedentes y habitos. Todo en espanol neutral y claro.`;

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

// Compatibilidad con endpoint viejo (redirige a radiografia)
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
