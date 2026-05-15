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
Genera un plan de salud COMPLETO y MUY DETALLADO en espanol LATAM. Usa alimentos colombianos reales y accesibles.

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
{"clasificacion_imc":"texto","categoria_riesgo":"BAJO","mensaje_principal":"texto","hallazgos":["h1","h2","h3"],"riesgos":["r1","r2"],"meta_peso_ideal":"texto","mensaje_cierre":"texto","plan_alimentacion":{"calorias_diarias":"texto","principios":["p1","p2","p3"],"semana":[{"dia":"Lunes","desayuno":{"nombre":"texto","descripcion":"texto","opciones":["op1","op2"]},"media_manana":"texto","almuerzo":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"merienda":"texto","cena":{"nombre":"texto","descripcion":"texto","opciones":["op1"]}},{"dia":"Martes","desayuno":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"media_manana":"texto","almuerzo":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"merienda":"texto","cena":{"nombre":"texto","descripcion":"texto","opciones":["op1"]}},{"dia":"Miercoles","desayuno":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"media_manana":"texto","almuerzo":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"merienda":"texto","cena":{"nombre":"texto","descripcion":"texto","opciones":["op1"]}},{"dia":"Jueves","desayuno":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"media_manana":"texto","almuerzo":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"merienda":"texto","cena":{"nombre":"texto","descripcion":"texto","opciones":["op1"]}},{"dia":"Viernes","desayuno":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"media_manana":"texto","almuerzo":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"merienda":"texto","cena":{"nombre":"texto","descripcion":"texto","opciones":["op1"]}},{"dia":"Sabado","desayuno":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"media_manana":"texto","almuerzo":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"merienda":"texto","cena":{"nombre":"texto","descripcion":"texto","opciones":["op1"]}},{"dia":"Domingo","desayuno":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"media_manana":"texto","almuerzo":{"nombre":"texto","descripcion":"texto","opciones":["op1"]},"merienda":"texto","cena":{"nombre":"texto","descripcion":"texto","opciones":["op1"]}}]},"plan_ejercicio":{"nivel_actual":"texto","objetivo":"texto","semanas":[{"semana":1,"titulo":"Adaptacion","descripcion":"texto","dias":[{"dia":"Lunes","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Martes","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Miercoles","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jueves","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"},{"dia":"Viernes","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sabado","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Domingo","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"}]},{"semana":2,"titulo":"Progresion","descripcion":"texto","dias":[{"dia":"Lunes","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Martes","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Miercoles","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jueves","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"},{"dia":"Viernes","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sabado","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Domingo","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"}]},{"semana":3,"titulo":"Consolidacion","descripcion":"texto","dias":[{"dia":"Lunes","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Martes","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Miercoles","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jueves","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"},{"dia":"Viernes","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sabado","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Domingo","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"}]},{"semana":4,"titulo":"Intensificacion","descripcion":"texto","dias":[{"dia":"Lunes","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Martes","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Miercoles","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Jueves","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"},{"dia":"Viernes","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Sabado","tipo":"texto","duracion":"texto","actividad":"texto"},{"dia":"Domingo","tipo":"Descanso","duracion":"-","actividad":"Descanso completo"}]}]}}

Reemplaza todos los valores "texto", "op1", "h1", etc. con contenido REAL, detallado y personalizado para este paciente especifico.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
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
