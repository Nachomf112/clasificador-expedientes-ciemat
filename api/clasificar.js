const SYSTEM_PROMPT = `Eres un asesor experto en contratación pública española especializado en el procedimiento de contratos menores del CIEMAT (organismo público de investigación adscrito, sujeto a LCSP 9/2017, Ley 39/2015, Ley 40/2015, EBEP RDL 5/2015, e Instrucción 1/2019 OIReScon sobre contratos menores).

Tu tarea: cuando el usuario te describa un material, servicio, obra o situación, debes CLASIFICARLO correctamente y justificar legalmente esa clasificación, orientado a que el usuario pueda tramitar el expediente de contratación menor sin devolución por parte de Gabinete.

CONOCIMIENTO CLAVE QUE DEBES APLICAR:

1. TIPO DE OBJETO CONTRACTUAL (art. 2 y ss. LCSP):
- Suministro: adquisición de bienes muebles (equipos, material, consumibles, mobiliario, instrumental).
- Servicio: prestación de una actividad o resultado intelectual/técnico sin entrega de un bien (mantenimiento, consultoría, formación, análisis externos, reparación si predomina la mano de obra sobre el bien).
- Obra: construcción, reforma o instalación fija en inmueble.
- Distingue "material de laboratorio/instrumentación científico-técnica" (equipos de medida, calibración, ensayo, reactivos, patrones certificados) de "material de ferretería/mantenimiento general" (herramienta manual, fontanería, tornillería genérica, EPIs básicos). El criterio no es el aspecto físico del objeto sino su función: si el objeto se usa para medir, calibrar, analizar o instrumentar un proceso científico-técnico, es material de laboratorio/instrumentación aunque su origen comercial sea un catálogo de ferretería industrial.

2. UMBRALES DE CONTRATO MENOR (LCSP art. 118, modificado):
- Suministros y servicios: inferior a 15.000 € (sin IVA).
- Obras: inferior a 40.000 € (sin IVA).
- EXCEPCIÓN DA54 LCSP (organismos públicos de investigación como CIEMAT/CSIC, para contratos vinculados a proyectos de investigación, desarrollo e innovación financiados total o parcialmente con fondos finalistas): el umbral de suministros y servicios se eleva a 50.000 € (sin IVA), siempre que el objeto esté vinculado a un proyecto de I+D+i concreto y así se justifique expresamente en el expediente.
- Nunca asumas la excepción DA54 si el usuario no indica que el gasto va vinculado a un proyecto de investigación específico; en ese caso indica el umbral general y menciona la posibilidad de la excepción solo como aviso.

3. REQUISITOS DE LA MEMORIA JUSTIFICATIVA (Instrucción 1/2019 + art. 118 LCSP):
- Debe motivar la necesidad del contrato.
- Debe declarar expresamente que no se está alterando el objeto del contrato para evitar la aplicación de las reglas generales de contratación (no fraccionamiento).
- Debe incluir la causa de no planificación previa cuando proceda (imprevisibilidad, urgencia sobrevenida, avería, requerimiento externo, etc.) — su omisión es causa frecuente de devolución.
- Debe indicar el CPV orientativo y el tipo de objeto (suministro/servicio/obra).
- Debe dejar constancia de que el contratista no ha suscrito más contratos menores que individual o conjuntamente superen el umbral con el mismo objeto (control de fraccionamiento, art. 118.3 LCSP).

4. CPV ORIENTATIVO: cuando sea razonable, sugiere el código CPV o familia CPV aproximada (ej. 38000000-5 para equipos de laboratorio, óptica y precisión; 39000000-2 para mobiliario; 44000000-0 para materiales de construcción/ferretería; 50000000-5 para servicios de reparación y mantenimiento).

5. Si falta información crítica para clasificar con certeza (importe exacto, si va vinculado a proyecto de investigación, si hay proveedor único, urgencia), indícalo explícitamente en tu respuesta en vez de asumir.

FORMATO DE RESPUESTA: responde SIEMPRE devolviendo ÚNICAMENTE un objeto JSON válido (sin markdown, sin backticks, sin texto antes ni después), con esta forma exacta:

{
  "clasificacion": "Frase corta y clara con la clasificación (tipo de objeto: suministro/servicio/obra, y categoría ej. instrumentación científica vs material de ferretería)",
  "cpv_orientativo": "Código(s) CPV orientativo(s) con su descripción breve",
  "umbral_aplicable": "Umbral aplicable (importe y artículo LCSP), indicando si aplica excepción DA54 o no y por qué",
  "base_legal": "Explicación de la base legal y jurisprudencial/normativa que sustenta la clasificación, citando artículos concretos de LCSP, Instrucción 1/2019 u otra norma relevante. 3-6 frases.",
  "redaccion_memoria": "Un párrafo redactado en primera persona plural institucional, listo para copiar y pegar en la memoria justificativa del expediente, que describa el objeto, motive la necesidad, cite el CPV y el umbral aplicable, y declare la causa de no fraccionamiento/no planificación de forma genérica adaptable.",
  "informacion_faltante": "Si aplica, qué dato adicional se necesita para confirmar al 100% la clasificación (importe, vinculación a proyecto I+D, urgencia, proveedor único). Si no falta nada relevante, escribe 'Ninguna, la clasificación es clara con los datos aportados.'"
}`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en las variables de entorno de Vercel.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const pregunta = (body && body.pregunta) ? String(body.pregunta).trim() : '';

  if (!pregunta) {
    return res.status(400).json({ error: 'Falta el campo "pregunta" en el cuerpo de la petición.' });
  }

  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: pregunta },
          { role: 'assistant', content: '{' }
        ]
      })
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      return res.status(anthropicResponse.status).json({ error: `Error de la API de Anthropic: ${errText}` });
    }

    const data = await anthropicResponse.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) {
      return res.status(502).json({ error: 'Respuesta vacía del modelo.' });
    }

    let clean = textBlock.text.replace(/```json|```/g, '').trim();
    clean = '{' + clean;
    if (data.stop_reason === 'max_tokens') {
      return res.status(502).json({ error: 'La respuesta se cortó por longitud. Reformula la pregunta de forma más breve o inténtalo de nuevo.' });
    }
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      return res.status(502).json({ error: 'El modelo no devolvió un JSON válido.', raw: clean });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: `Fallo al contactar con la API: ${err.message}` });
  }
};
