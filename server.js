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

  const prompt = `Eres el Dr. Nicolás Pulecio Leal, médico general colombiano especializado en medicina preventiva y manejo del peso. 
Analiza los siguientes datos de un paciente y genera una evaluación personalizada, empática y motivadora en español colombiano.

DATOS DEL PACIENTE:
- Nombre: ${nombre || 'Paciente'}
- Edad: ${edad} años
- Sexo: ${sexo}
- Peso: ${peso} kg
- Talla: ${talla} cm
- IMC calculado: ${imc} kg/m²
${cintura ? `- Cintura: ${cintura} cm` : ''}
${cadera ? `- Cadera: ${cadera} cm` : ''}
${relacionCinturaTalla ? `- Relación cintura/talla: ${relacionCinturaTalla}` : ''}
${icc ? `- Índice cintura/cadera: ${icc}` : ''}
${antecedentes ? `- Antecedentes médicos: ${antecedentes}` : ''}
${habitos ? `- Hábitos actuales: ${habitos}` : ''}

Genera una evaluación estructurada con este formato EXACTO en JSON:
{
  "clasificacion_imc": "texto de clasificación",
  "categoria_riesgo": "BAJO | MODERADO | ALTO | MUY ALTO",
  "mensaje_principal": "mensaje empático y personalizado de 2-3 oraciones dirigido al paciente por su nombre, sin estigmatizar, reconociendo su valentía de evaluar su salud",
  "hallazgos": [
    "hallazgo 1 en lenguaje sencillo",
    "hallazgo 2",
    "hallazgo 3"
  ],
  "riesgos": [
    "riesgo 1 explicado de forma comprensible",
    "riesgo 2"
  ],
  "recomendaciones": [
    {
      "icono": "🥗",
      "titulo": "Alimentación",
      "descripcion": "recomendación concreta y práctica"
    },
    {
      "icono": "🏃",
      "titulo": "Movimiento",
      "descripcion": "recomendación concreta y práctica"
    },
    {
      "icono": "😴",
      "titulo": "Descanso",
      "descripcion": "recomendación concreta y práctica"
    },
    {
      "icono": "🩺",
      "titulo": "Siguiente paso médico",
      "descripcion": "qué consultar con su médico"
    }
  ],
  "meta_peso_ideal": "rango de peso saludable calculado en kg",
  "mensaje_cierre": "frase motivadora corta y genuina",
  "advertencia_medica": true
}

IMPORTANTE: Responde SOLO con el JSON válido, sin texto adicional, sin markdown, sin backticks.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text.trim();
    const resultado = JSON.parse(text);

    res.json({
      ok: true,
      imc,
      relacionCinturaTalla,
      icc,
      resultado
    });
  } catch (err) {
    console.error('Error API:', err.message);
    res.status(500).json({ error: 'Error al procesar la evaluación. Intenta de nuevo.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
