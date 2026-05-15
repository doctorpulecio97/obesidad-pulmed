const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.post('/api/evaluar', async (req, res) => {
  const { nombre, edad, sexo, peso, talla, cintura, cadera, antecedentes, habitos } = req.body;

  if (!peso || !talla || !edad || !sexo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  const imc = (parseFloat(peso) / Math.pow(parseFloat(talla) / 100, 2)).toFixed(1);
  const relacionCinturaTalla = cintura ? (parseFloat(cintura) / parseFloat(talla)).toFixed(2) : null;
  const icc = (cintura && cadera) ? (parseFloat(cintura) / parseFloat(cadera)).toFixed(2) : null;

  const prompt = `Eres el Dr. Nicolas Pulecio Leal, medico general colombiano especializado en medicina preventiva y manejo del peso.
Genera un plan de salud COMPLETO de 90 DIAS (12 SEMANAS) MUY DETALLADO en espanol LATAM. Usa alimentos colombianos reales y accesibles.

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

INSTRUCCIONES CRITICAS:
1. El plan de ejercicio DEBE tener EXACTAMENTE 12 SEMANAS organizadas en 3 fases progresivas:
   - FASE 1 (Semanas 1-4): ADAPTACION - intensidad ligera, generar habito, 3-4 dias activos
   - FASE 2 (Semanas 5-8): PROGRESION - intensidad moderada, 5 dias activos
   - FASE 3 (Semanas 9-12): CONSOLIDACION - intensidad alta, 5-6 dias activos
2. Para cada dia usa "tipo" con valores CORTOS como: "Cardio", "Fuerza", "HIIT", "Descanso", "Movilidad", "Mixto"
3. La "actividad" debe ser CORTA (maximo 8-12 palabras), tipo: "Caminata rapida + estiramientos" o "Sentadillas, lagartijas, plancha"
4. La "duracion" formato corto: "30 min", "45 min", "-" para descanso
5. El plan de alimentacion son 7 dias modelo que se repiten durante los 90 dias
6. Adapta TODO al perfil del paciente: edad, sexo, IMC, antecedentes medicos y habitos
7. Si tiene comorbilidades, considera restricciones especificas

Responde UNICAMENTE con JSON valido. Sin markdown, sin backticks, sin texto extra. Estructura EXACTA con las 12 semanas:

{"clasificacion_imc":"texto","categoria_riesgo":"BAJO","mensaje_principal":"texto","hallazgos":["h1","h2","h3"],"riesgos":["r1","r2"],"meta_peso_ideal":"texto","mensaje_cierre":"texto","plan_alimentacion":{"calorias_diarias":"texto","principios":["p1","p2","p3"],"semana":[{"dia":"Lunes","desayuno":{"nombre":"texto","descripcion":"texto","opciones":["op1","op2"]},"media_manana":"texto","almuerzo":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"merienda":"texto","cena":{"nombre":"texto","descripcion":"texto","opciones":["op1"]}},{"dia":"Martes","desayuno":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"media_manana":"texto","almuerzo":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"merienda":"texto","cena":{"nombre":"texto","descripcion":"texto","opciones":["op1"]}},{"dia":"Miercoles","desayuno":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"media_manana":"texto","almuerzo":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"merienda":"texto","cena":{"nombre":"texto","descripcion":"texto","opciones":["op1"]}},{"dia":"Jueves","desayuno":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"media_manana":"texto","almuerzo":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"merienda":"texto","cena":{"nombre":"texto","descripcion":"texto","opciones":["op1"]}},{"dia":"Viernes","desayuno":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"media_manana":"texto","almuerzo":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"merienda":"texto","cena":{"nombre":"texto","descripcion":"texto","opciones":["op1"]}},{"dia":"Sabado","desayuno":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"media_manana":"texto","almuerzo":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"merienda":"texto","cena":{"nombre":"texto","descripcion":"texto","opciones":["op1"]}},{"dia":"Domingo","desayuno":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"media_manana":"texto","almuerzo":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"merienda":"texto","cena":{"nombre":"texto","descripcion":"texto","opciones":["op1"]}}]},"plan_ejercicio":{"nivel_actual":"texto","objetivo":"texto","fases":[{"nombre":"Fase 1 - Adaptacion","semanas_rango":"Semanas 1-4","descripcion":"texto","semanas":[{"semana":1,"dias":[{"dia":"Lun","tipo":"Cardio","duracion":"30 min","actividad":"texto"},{"dia":"Mar","tipo":"Fuerza","duracion":"30 min","actividad":"texto"},{"dia":"Mie","tipo":"Cardio","duracion":"30 min","actividad":"texto"},{"dia":"Jue","tipo":"Descanso","duracion":"-","actividad":"-"},{"dia":"Vie","tipo":"Mixto","duracion":"30 min","actividad":"texto"},{"dia":"Sab","tipo":"Cardio","duracion":"30 min","actividad":"texto"},{"dia":"Dom","tipo":"Descanso","duracion":"-","actividad":"-"}]},{"semana":2,"dias":[{"dia":"Lun","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mar","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jue","tipo":"Descanso","duracion":"-","actividad":"-"},{"dia":"Vie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sab","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Dom","tipo":"Descanso","duracion":"-","actividad":"-"}]},{"semana":3,"dias":[{"dia":"Lun","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mar","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jue","tipo":"Descanso","duracion":"-","actividad":"-"},{"dia":"Vie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sab","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Dom","tipo":"Descanso","duracion":"-","actividad":"-"}]},{"semana":4,"dias":[{"dia":"Lun","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mar","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jue","tipo":"Descanso","duracion":"-","actividad":"-"},{"dia":"Vie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sab","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Dom","tipo":"Descanso","duracion":"-","actividad":"-"}]}]},{"nombre":"Fase 2 - Progresion","semanas_rango":"Semanas 5-8","descripcion":"texto","semanas":[{"semana":5,"dias":[{"dia":"Lun","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mar","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jue","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Vie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sab","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Dom","tipo":"Descanso","duracion":"-","actividad":"-"}]},{"semana":6,"dias":[{"dia":"Lun","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mar","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jue","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Vie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sab","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Dom","tipo":"Descanso","duracion":"-","actividad":"-"}]},{"semana":7,"dias":[{"dia":"Lun","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mar","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jue","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Vie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sab","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Dom","tipo":"Descanso","duracion":"-","actividad":"-"}]},{"semana":8,"dias":[{"dia":"Lun","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mar","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jue","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Vie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sab","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Dom","tipo":"Descanso","duracion":"-","actividad":"-"}]}]},{"nombre":"Fase 3 - Consolidacion","semanas_rango":"Semanas 9-12","descripcion":"texto","semanas":[{"semana":9,"dias":[{"dia":"Lun","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mar","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jue","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Vie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sab","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Dom","tipo":"texto","duracion":"texto","actividad":"texto"}]},{"semana":10,"dias":[{"dia":"Lun","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mar","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jue","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Vie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sab","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Dom","tipo":"texto","duracion":"texto","actividad":"texto"}]},{"semana":11,"dias":[{"dia":"Lun","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mar","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jue","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Vie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sab","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Dom","tipo":"texto","duracion":"texto","actividad":"texto"}]},{"semana":12,"dias":[{"dia":"Lun","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mar","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Mie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jue","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Vie","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sab","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Dom","tipo":"texto","duracion":"texto","actividad":"texto"}]}]}]}}

OBLIGATORIO: El array "fases" DEBE tener 3 fases con 4 semanas cada una (total 12 semanas). Reemplaza todos los valores "texto" con contenido REAL personalizado para este paciente.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 24000,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = response.content[0].text.trim();
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const resultado = JSON.parse(text);

    res.json({ ok: true, imc, relacionCinturaTalla, icc, resultado });
  } catch (err) {
    console.error('Error API:', err.message);
    res.status(500).json({ error: 'Error al procesar la evaluacion. Intenta de nuevo.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
