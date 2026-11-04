const crypto = require('crypto');
const { search } = require('./search.js');

// ---------------------------------------------------------------------------
// Protección del endpoint
// ---------------------------------------------------------------------------
const LIMITE_POR_IP_HORA = 20;
const LIMITE_GLOBAL_DIA = 300;
const MAX_CARACTERES_PREGUNTA = 3000;

function obtenerIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'desconocida';
}

// Devuelve null si Redis no está configurado. Lanza error si Redis falla.
async function contarUso(ip) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const ahora = Date.now();
  const bucketHora = Math.floor(ahora / 3600000);
  const bucketDia = Math.floor(ahora / 86400000);
  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
  const keyIp = `rl:clasificador:ip:${ipHash}:${bucketHora}`;
  const keyGlobal = `rl:clasificador:global:${bucketDia}`;

  const r = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([
      ['INCR', keyIp],
      ['EXPIRE', keyIp, 3700],
      ['INCR', keyGlobal],
      ['EXPIRE', keyGlobal, 90000]
    ])
  });
  if (!r.ok) throw new Error(`Redis respondió ${r.status}`);
  const out = await r.json();
  return {
    usoIp: Number(out[0] && out[0].result),
    usoGlobal: Number(out[2] && out[2].result),
    minutosHastaSiguienteHora: Math.max(1, Math.ceil((3600000 - (ahora % 3600000)) / 60000))
  };
}

const SYSTEM_PROMPT = `Eres un asesor experto en contratación pública española especializado en el procedimiento de contratos menores del CIEMAT (organismo público de investigación adscrito, sujeto a LCSP 9/2017, Ley 39/2015, Ley 40/2015, EBEP RDL 5/2015, e Instrucción 1/2019 OIReScon sobre contratos menores).

Tu tarea: cuando el usuario te describa un material, servicio, obra o situación, debes CLASIFICARLO correctamente y justificar legalmente esa clasificación, orientado a que el usuario pueda tramitar el expediente de contratación menor sin devolución por parte de Gabinete.

CONOCIMIENTO CLAVE QUE DEBES APLICAR:

1. TIPO DE OBJETO CONTRACTUAL (contrato de obras: arts. 12-13 LCSP; contrato de suministro: art. 16 LCSP; contrato de servicios: art. 17 LCSP):
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

4. CPV ORIENTATIVO: el CPV es siempre orientativo y debe confirmarse en el vocabulario CPV oficial. Elige PRIMERO de esta lista de códigos de referencia (descripciones según el CPV oficial) y usa el más específico que describa el objeto; no mezcles códigos de ramas distintas ni elijas un código por parecido de nombre:
- 38000000 Equipo de laboratorio, óptica y precisión (excepto gafas) [familia general de laboratorio]
- 38300000 Instrumentos de medida
- 38310000 Balanzas de precisión
- 38311000 Balanzas electrónicas y accesorios
- 38311100 Balanzas analíticas electrónicas
- 38311200 Balanzas técnicas electrónicas
- 38311210 Pesas de calibración
- 38340000 Instrumentos para medir magnitudes
- 38341000 Instrumentos de medición de radiaciones (SOLO para radiación, no para metrología general)
- 38400000 Instrumentos para verificar características físicas
- 38410000 Instrumentos de recuento (contadores) (NO es "instrumentos de medida" en general)
- 38412000 Termómetros
- 38416000 Medidores de pH
- 38418000 Calorímetros
- 38423000 Equipos de medición de presión
- 38430000 Aparatos de detección y análisis
- 38432000 Aparatos de análisis
- 38432200 Cromatógrafos
- 38433000 Espectrómetros
- 38437000 Pipetas de laboratorio y accesorios
- 38900000 Instrumentos de evaluación o ensayo diversos
- 39000000 Mobiliario (incluidos mobiliario de oficina), equipamiento y electrodomésticos
- 44000000 Estructuras y materiales de construcción; productos auxiliares de la construcción (ferretería, material de construcción)
- 50000000 Servicios de reparación y mantenimiento
Si el objeto no encaja en esta lista, propón la familia más cercana que conozcas indicando expresamente que el código debe verificarse. Escribe el código de 8 dígitos; añade el dígito de control solo si lo conoces con certeza. Indica siempre "orientativo, confirmar en el CPV oficial".

5. Si falta información crítica para clasificar con certeza (importe exacto, si va vinculado a proyecto de investigación, si hay proveedor único, urgencia), indícalo explícitamente en tu respuesta en vez de asumir.

6. FRAGMENTOS NORMATIVOS RECUPERADOS: a continuación de la pregunta del usuario recibirás una sección "FRAGMENTOS NORMATIVOS RELEVANTES" con extractos literales de la normativa oficial indexada (LCSP, Ley 39/2015, Ley 40/2015, EBEP, Instrucción 1/2019, etc.), recuperados automáticamente por relevancia a la consulta. Estos fragmentos son la fuente autoritativa: básate en ellos para tu "base_legal" citando el artículo y norma exactos tal como aparecen en el fragmento, en vez de recitar de memoria. Si los fragmentos recuperados no contienen la respuesta exacta a la pregunta, dilo explícitamente y razona con tu conocimiento general dejando claro que no está anclado a un fragmento recuperado. Nunca inventes un número de artículo que no aparezca en los fragmentos si citas uno como fuente.

7. NO INVENTAR HECHOS NI REQUISITOS: (a) En "redaccion_memoria", cualquier dato de hecho que el usuario no haya aportado (causa de no planificación, importe, proveedor, comprobación de contratos previos con el contratista, urgencia, proyecto concreto) debe dejarse como marcador entre corchetes y mayúsculas para rellenar, por ejemplo [INDICAR CAUSA REAL DE LA NO PLANIFICACIÓN: avería, requerimiento externo, necesidad sobrevenida...], [INDICAR IMPORTE SIN IVA], [CONFIRMAR QUE EL CONTRATISTA NO HA SUSCRITO OTROS CONTRATOS MENORES CON EL MISMO OBJETO]. Nunca redactes como ocurrido algo que el usuario no ha dicho. (b) Cita un número de artículo solo si aparece en los fragmentos recuperados o en la lista de artículos de definición del punto 1 (arts. 12-13, 16 y 17 LCSP). Si no estás seguro del número de artículo, cita la norma sin número y no lo inventes. (c) No afirmes como requisito legal nada que no conste en los fragmentos recuperados; si es una práctica habitual o recomendable pero no consta, preséntala como "recomendación a confirmar con Gabinete" y no como obligación.

FORMATO DE RESPUESTA: responde SIEMPRE devolviendo ÚNICAMENTE un objeto JSON válido (sin markdown, sin backticks, sin texto antes ni después), con esta forma exacta:

{
  "clasificacion": "Frase corta y clara con la clasificación (tipo de objeto: suministro/servicio/obra, y categoría ej. instrumentación científica vs material de ferretería)",
  "cpv_orientativo": "Código(s) CPV orientativo(s) con su descripción breve",
  "umbral_aplicable": "Umbral aplicable (importe y artículo LCSP), indicando si aplica excepción DA54 o no y por qué",
  "base_legal": "Explicación de la base legal que sustenta la clasificación, citando artículos concretos anclados en los fragmentos recuperados cuando existan (LCSP, Instrucción 1/2019 u otra norma relevante). 3-6 frases.",
  "redaccion_memoria": "Un párrafo redactado en primera persona plural institucional, listo para copiar y pegar en la memoria justificativa del expediente, que describa el objeto, motive la necesidad, cite el CPV y el umbral aplicable, y declare la no alteración del objeto para evitar las reglas generales (no fraccionamiento). Todo dato de hecho no aportado por el usuario (causa de no planificación, importe, comprobación de contratos previos con el contratista, etc.) va como marcador [EN MAYÚSCULAS ENTRE CORCHETES] para rellenar, nunca inventado.",
  "informacion_faltante": "Si aplica, qué dato adicional se necesita para confirmar al 100% la clasificación (importe, vinculación a proyecto I+D, urgencia, proveedor único). Si no falta nada relevante, escribe 'Ninguna, la clasificación es clara con los datos aportados.'",
  "fuentes": "Lista breve de los artículos y normas concretas de los fragmentos recuperados que has usado como base (ej. 'Art. 118 LCSP, Instrucción 1/2019 - Directriz III'). Si no usaste ningún fragmento recuperado, escribe 'Ninguno de los fragmentos recuperados aportaba lo necesario; respuesta basada en conocimiento general.'"
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

  if (pregunta.length > MAX_CARACTERES_PREGUNTA) {
    return res.status(413).json({
      error: `La consulta es demasiado larga (${pregunta.length} caracteres). El máximo es ${MAX_CARACTERES_PREGUNTA}. Resúmela e inténtalo de nuevo.`
    });
  }

  // Límite de uso (fail-open si Redis no está configurado o falla)
  try {
    const uso = await contarUso(obtenerIp(req));
    if (uso) {
      if (uso.usoGlobal > LIMITE_GLOBAL_DIA) {
        return res.status(429).json({
          error: 'Se ha alcanzado el límite diario de consultas de la herramienta. Vuelve a intentarlo mañana.'
        });
      }
      if (uso.usoIp > LIMITE_POR_IP_HORA) {
        return res.status(429).json({
          error: `Has superado el límite de ${LIMITE_POR_IP_HORA} consultas por hora. Inténtalo de nuevo en unos ${uso.minutosHastaSiguienteHora} minutos.`
        });
      }
    } else {
      console.warn('Rate limit desactivado: faltan KV_REST_API_URL / KV_REST_API_TOKEN.');
    }
  } catch (e) {
    console.error('Fallo en el control de límite de uso (se permite la petición):', e.message);
  }

  try {
    const fragmentosRelevantes = search(pregunta, 6);

    let bloqueFragmentos = '';
    if (fragmentosRelevantes.length > 0) {
      bloqueFragmentos = '\n\nFRAGMENTOS NORMATIVOS RELEVANTES (recuperados automáticamente, cita el artículo/norma exactos si los usas):\n\n' +
        fragmentosRelevantes.map((f, i) => `[${i + 1}] (${f.doc} · ${f.id})\n${f.text}`).join('\n\n');
    } else {
      bloqueFragmentos = '\n\n(No se han recuperado fragmentos normativos relevantes para esta consulta. Responde con tu conocimiento general y indícalo en el campo "fuentes".)';
    }

    const mensajeUsuario = pregunta + bloqueFragmentos;

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1800,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: mensajeUsuario }
        ]
      })
    });

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text();
      return res.status(anthropicResponse.status).json({ error: `Error de la API de Anthropic: ${errText}` });
    }

    const data = await anthropicResponse.json();

    if (data.stop_reason === 'max_tokens') {
      return res.status(502).json({ error: 'La respuesta se cortó por longitud. Reformula la pregunta de forma más breve o inténtalo de nuevo.' });
    }

    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) {
      return res.status(502).json({ error: 'Respuesta vacía del modelo.' });
    }

    const raw = textBlock.text;
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      return res.status(502).json({ error: 'El modelo no devolvió un JSON válido.', raw });
    }
    const clean = raw.slice(firstBrace, lastBrace + 1);

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
