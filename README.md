# Clasificador de Expedientes · CIEMAT

Herramienta interna de apoyo a la contratación menor en el CIEMAT (División de Combustión y Gasificación). Permite consultar en lenguaje natural la naturaleza de un suministro, servicio u obra, y obtener al instante su clasificación, el umbral legal aplicable y un texto listo para pegar en la memoria justificativa del expediente.

**Demo:** [expedientes.menarguez-ia.com](https://expedientes.menarguez-ia.com)

---

## Qué resuelve

Antes de tramitar un contrato menor hay que decidir varias cosas que a menudo generan devoluciones de Gabinete si se justifican mal:

- ¿Es un suministro, un servicio o una obra?
- ¿Qué CPV le corresponde?
- ¿Qué umbral se aplica — el general de 15.000 €, o la excepción de 50.000 € por vinculación a un proyecto de I+D+i (DA54 LCSP)?
- ¿Qué hay que declarar en la memoria justificativa para que no la devuelvan (causa de no fraccionamiento, causa de no planificación, Instrucción 1/2019)?

Esta app responde a esas preguntas con base legal citada (LCSP 9/2017, Ley 39/2015, Ley 40/2015, EBEP, Instrucción 1/2019) y genera un párrafo de memoria adaptable.

## Cómo funciona

1. El usuario escribe una pregunta libre (ej. *"las pesas de calibración, ¿son material de ferretería o de laboratorio?"*).
2. El frontend (`index.html`) envía la pregunta a `/api/clasificar`.
3. La función serverless (`api/clasificar.js`) llama a la API de Claude con un system prompt que codifica el marco normativo de contratación menor, y devuelve un JSON estructurado.
4. El frontend muestra: clasificación, CPV orientativo, umbral aplicable, base legal, redacción sugerida para la memoria, e información que falta confirmar.
5. El historial de consultas se guarda en `localStorage` del navegador (no se envía a ningún servidor propio, solo queda en el equipo del usuario).

## Estructura del proyecto
clasificador-expedientes-ciemat/
├── index.html → frontend estático (sin build)
├── api/
│ └── clasificar.js → función serverless (Vercel), llama a la API de Anthropic
└── package.json → fija Node >=18 (usa fetch nativo, sin dependencias)
## Despliegue (Vercel)

1. Importar este repo en Vercel como proyecto nuevo, framework Other (sin build command).
2. En Settings → Environment Variables, añadir:
   - `ANTHROPIC_API_KEY` — clave generada en [console.anthropic.com](https://console.anthropic.com)
3. Deploy. Vercel expone automáticamente `api/clasificar.js` como endpoint `/api/clasificar`.
4. (Opcional) Dominio propio en Settings → Domains, apuntando un CNAME desde el proveedor DNS al valor que indique Vercel.

La API key nunca se expone en el navegador: vive solo en la variable de entorno del servidor.

## Marco legal cubierto

- Ley 9/2017, de 8 de noviembre, de Contratos del Sector Público (LCSP) — arts. 2, 118, 118.3, DA54
- Ley 39/2015 y Ley 40/2015
- RDL 5/2015 (EBEP)
- Instrucción 1/2019 OIReScon sobre contratos menores

## Aviso

Esta herramienta es un apoyo a la redacción y no sustituye la revisión de Gabinete Jurídico ante casos límite o de interpretación dudosa.

---

Creada por **Ignacio Menárguez Fernández** · División de Combustión y Gasificación, CIEMAT
