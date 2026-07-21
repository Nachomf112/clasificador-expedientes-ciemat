# 🏛️ Clasificador de Expedientes CIEMAT

Asistente de clasificación normativa para la tramitación de contratos menores en el CIEMAT — determina tipo de objeto, CPV, umbral aplicable y redacción de memoria justificativa en segundos.

`Estado` `Activo` &nbsp; `Marco legal` `LCSP 9/2017` &nbsp; `Modelo` `Claude Sonnet` &nbsp; `Licencia` `Uso interno`

---

## 🌐 Acceso

**[expedientes.menarguez-ia.com](https://expedientes.menarguez-ia.com)**

Funciona en escritorio y móvil, directamente desde el navegador. Sin instalación.

---

## 📋 Qué resuelve

| Duda | Respuesta que da la app |
|---|---|
| ¿Suministro, servicio u obra? | Clasificación del objeto contractual con criterio funcional, no solo comercial |
| ¿Qué CPV le corresponde? | Código CPV orientativo y su familia |
| ¿Qué umbral se aplica? | 15.000 € general o 50.000 € por excepción DA54 (I+D+i), según el caso |
| ¿Qué tiene que llevar la memoria? | Párrafo institucional listo para pegar, con causa de no fraccionamiento y no planificación |

---

## ⚙️ Cómo funciona

1. Escribes la pregunta en lenguaje natural (ej. *"las pesas de calibración, ¿son material de ferretería o de laboratorio?"*).
2. El frontend envía la consulta a `/api/clasificar`.
3. Una función serverless en Vercel llama a la API de Claude con el marco normativo de contratación menor cargado en el system prompt.
4. Se devuelve un JSON estructurado que el frontend pinta en pantalla.
5. El historial de consultas queda guardado en `localStorage` del navegador — no sale de tu equipo.

---

## 📚 Marco legal cubierto

| Norma | Contenido relevante |
|---|---|
| Ley 9/2017 (LCSP) | Arts. 2, 118, 118.3, Disposición Adicional 54ª |
| Ley 39/2015 | Procedimiento administrativo común |
| Ley 40/2015 | Régimen jurídico del sector público |
| RDL 5/2015 (EBEP) | Estatuto Básico del Empleado Público |
| Instrucción 1/2019 OIReScon | Criterios de tramitación de contratos menores |

---

## 🗂️ Estructura del proyecto

clasificador-expedientes-ciemat/
├── index.html          → frontend estático (sin build)
├── api/
│   └── clasificar.js   → función serverless (Vercel), llama a la API de Anthropic
└── package.json        → fija Node >=18 (fetch nativo, sin dependencias)
---

## 🚀 Despliegue (Vercel)

1. Importar el repo en Vercel — framework **Other**, sin build command.
2. **Settings → Environment Variables** → añadir `ANTHROPIC_API_KEY` (generada en [console.anthropic.com](https://console.anthropic.com)).
3. Deploy. Vercel expone `api/clasificar.js` automáticamente como `/api/clasificar`.
4. Dominio propio opcional en **Settings → Domains**, con CNAME desde el proveedor DNS.

La API key nunca se expone en el navegador: vive solo en el servidor.

---

## ⚠️ Aviso

Herramienta de apoyo a la redacción. No sustituye la revisión de Gabinete Jurídico ante casos límite o de interpretación dudosa.

---

**Creada por Ignacio Menárguez Fernández** · División de Combustión y Gasificación, CIEMAT
