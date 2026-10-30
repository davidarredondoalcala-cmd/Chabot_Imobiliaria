# 🏡 Chatbot Inmobiliario Conversacional - Ibagué, Tolima

Agente conversacional inteligente de atención al cliente para el mercado inmobiliario en Ibagué (Tolima, Colombia). Construido con **PostgreSQL + pgvector**, **Node.js (TypeScript)**, **React + Tailwind** y una arquitectura de agente anclada con **0% de alucinaciones**, soporte para modismos colombianos ("palos", "2 y medio", "800 mil") y derivación fluida a WhatsApp.

---

## 📑 Tabla de Contenidos
1. [Arquitectura del Sistema](#arquitectura-del-sistema)
2. [Estructura del Repositorio](#estructura-del-repositorio)
3. [Stack Tecnológico](#stack-tecnológico)
4. [Instalación y Puesta en Marcha](#instalación-y-puesta-en-marcha)
5. [Variables de Entorno](#variables-de-entorno)
6. [Flujo del Agente & Reglas de Conversación](#flujo-del-agente--reglas-de-conversación)
7. [Pruebas Automatizadas](#pruebas-automatizadas)
8. [Suite de Evaluación Benchmark (/eval)](#suite-de-evaluación-benchmark-eval)

---

## 🏛️ Arquitectura del Sistema

```mermaid
flowchart TD
    User([👤 Usuario]) <--> Widget[📱 Frontend Widget React + Tailwind]
    Widget <--> API[🌐 API REST Express / TypeScript]
    
    subgraph Orquestador del Agente
        API --> NLU[🧠 Comprensión NLU + Normalizador COP]
        NLU --> State[🔄 Fusión de Estado conversation_state]
        State --> Policy{¿Falta Operación o Presupuesto/Zona?}
        Policy -- "Sí (máx 2 turnos)" --> Clarify[❓ Pregunta Aclaratoria Única]
        Policy -- "No / Criterios Suficientes" --> HybridSearch[🔍 Búsqueda Híbrida pgvector + SQL]
        HybridSearch --> Relaxation{¿0 Resultados?}
        Relaxation -- Sí --> RelaxCtrl[⚡ Relajación Controlada +15% / Zonas]
        Relaxation -- No --> GroundedGen[📝 Generación Anclada en Catálogo]
        RelaxCtrl --> GroundedGen
        GroundedGen --> Verifier{🛡️ Verificador Determinista}
        Verifier -- "Discrepancia detectada" --> Retry[🔁 Auto-corrección / Fallback Seguro]
        Verifier -- "Válido" --> OutReply[💬 Respuesta Validada]
        Retry --> OutReply
        NLU -- "¿Asesor / Trámites / Visita?" --> WhatsApp[📲 Deep-link WhatsApp con Criterios]
    end

    HybridSearch <--> DB[(🐘 PostgreSQL 16 + pgvector)]
    OutReply --> API
    Clarify --> API
    WhatsApp --> API
```

---

## 📂 Estructura del Repositorio

```text
├── backend/
│   ├── prompts/
│   │   └── system.es.md                # System prompt con directivas colombianas y seguridad
│   ├── src/
│   │   ├── agent/
│   │   │   ├── clarification.ts        # Política de aclaración (máximo 2 preguntas)
│   │   │   ├── generator.ts            # Generación anclada determinista y LLM
│   │   │   ├── nlu.ts                  # Extractor semántico de intenciones y criterios
│   │   │   ├── normalizer.ts           # Normalizador de dinero y expresiones colombianas
│   │   │   ├── orchestrator.ts         # Orquestador del ciclo conversacional
│   │   │   ├── state.ts                # Gestión y fusión acumulativa de estado
│   │   │   └── __tests__/              # Pruebas unitarias de normalizador y estado
│   │   ├── db/
│   │   │   ├── index.ts                # Conexión Pool a PostgreSQL
│   │   │   ├── schema.sql              # DDL de tablas properties, conversations, state
│   │   │   ├── seed.ts                 # 40 inmuebles verosímiles en Ibagué
│   │   │   ├── generate_embeddings.ts  # Generador y persistencia de vectores
│   │   │   ├── setup.ts                # Setup automatizado: init + seed + embeddings
│   │   │   └── __tests__/              # Pruebas de integridad del catálogo
│   │   ├── routes/
│   │   │   └── chat.ts                 # Endpoints POST /api/chat y GET /api/conversations/:id
│   │   ├── services/
│   │   │   ├── embedding.ts            # Abstracción de embeddings (OpenAI / Mock)
│   │   │   ├── llm.ts                  # Abstracción LLM structured JSON
│   │   │   └── whatsapp.ts             # Generador de enlaces prellenados wa.me
│   │   ├── tools/
│   │   │   ├── search.ts               # Herramienta buscar_inmuebles (SQL + vector + relajación)
│   │   │   ├── detail.ts               # Herramienta obtener_detalle_inmueble
│   │   │   └── __tests__/              # Pruebas unitarias de herramientas
│   │   ├── types/
│   │   │   └── index.ts                # Tipos de dominio TypeScript
│   │   ├── verification/
│   │   │   ├── verifier.ts             # Módulo determinista anti-alucinaciones
│   │   │   └── __tests__/              # Pruebas unitarias del verificador
│   │   └── index.ts                    # Servidor Express con rate-limiting y healthcheck
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatWidget.tsx          # Widget flotante animado y responsive
│   │   │   ├── ChatMessage.tsx         # Burbujas de diálogo y renderizado de fichas
│   │   │   ├── PropertyCard.tsx        # Tarjetas de inmuebles con fotos, precios COP y botones
│   │   │   └── SuggestionChips.tsx     # Chips de interacción rápida inicial
│   │   ├── App.tsx                     # Landing page demostrativa de la inmobiliaria
│   │   ├── index.css                   # Tailwind CSS
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts                  # Proxy reverso a /api de backend
│
├── eval/
│   ├── test_cases.json                 # 30 escenarios de evaluación exhaustivos
│   ├── evaluate.ts                     # Runner del benchmark (alucinación, juez, latencia)
│   ├── report.md                       # Reporte detallado generado en Markdown
│   └── report.csv                      # Reporte consolidado en CSV
│
├── docker-compose.yml                  # PostgreSQL 16 con extensión pgvector
├── .env.example                        # Plantilla de variables de entorno
└── README.md                           # Documentación completa del proyecto
```

---

## 🛠️ Stack Tecnológico

- **Backend:** Node.js, Express, TypeScript (Modo estricto), Zod (Validación), Express Rate Limit.
- **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons.
- **Base de Datos:** PostgreSQL 16 con extensión **pgvector** e índices HNSW (`vector_cosine_ops`).
- **LLM / Embeddings:** Capa de abstracción multimodelo (OpenAI / OpenRouter / Mock local para pruebas offline).
- **Pruebas y Evaluación:** Vitest (Pruebas unitarias), Benchmark evaluativo con LLM-as-a-judge.

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- Node.js 18 o superior
- Docker & Docker Compose

### 1. Clonar y Configurar Entorno
```bash
cp .env.example .env
```
*(Revisa los valores en `.env`. Por defecto incluye fallback mock para desarrollo offline sin costo de tokens).*

### 2. Levantar Base de Datos con Docker
```bash
docker compose up -d
```
*(Levantará PostgreSQL 16 con pgvector en el puerto `5432`).*

### 3. Instalar Dependencias y Poblar la Base de Datos
En el directorio `backend`:
```bash
cd backend
npm install
npm run db:setup
```
El comando `npm run db:setup` ejecutará automáticamente:
1. Creación del esquema relacional y habilitación de `vector`.
2. Inserción de los **40 inmuebles verosímiles en Ibagué** (El Vergel, Cádiz, La Macarena, Calambeo, Jordán, El Salado, etc.).
3. Cálculo y persistencia de embeddings vectoriales a partir de `titulo + descripcion + barrio + amenidades`.

### 4. Iniciar el Backend
```bash
npm run dev
```
El servidor quedará disponible en `http://localhost:3000`. Puedes comprobar su estado en `http://localhost:3000/api/health`.

### 5. Iniciar el Frontend
En otra terminal:
```bash
cd frontend
npm install
npm run dev
```
Abre tu navegador en `http://localhost:5173`. Verás la página de la inmobiliaria con el widget interactivo en la esquina inferior derecha.

---

## ⚙️ Variables de Entorno

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `PORT` | Puerto de escucha del backend | `3000` |
| `DATABASE_URL` | URL de conexión PostgreSQL | `postgres://postgres:postgres@localhost:5432/inmobiliaria_db` |
| `LLM_PROVIDER` | Proveedor del modelo (`openai`, `openrouter`, `mock`) | `openai` |
| `LLM_MODEL` | Nombre del modelo | `gpt-4o-mini` |
| `LLM_API_KEY` | API Key del proveedor | `mock-key-for-dev` |
| `EMBEDDING_PROVIDER` | Proveedor de embeddings (`openai`, `mock`) | `openai` (o `mock`) |
| `EMBEDDING_MODEL` | Modelo de embeddings | `text-embedding-3-small` |
| `EMBEDDING_DIMENSION` | Dimensión del vector | `1536` |
| `WHATSAPP_NUMBER` | Número telefónico para atención en WhatsApp | `573100000000` |

---

## 🧠 Flujo del Agente & Reglas de Conversación

1. **Comprensión con Jerga Colombiana:**
   - Interpreta "200 palos" como \$200.000.000 COP, "800 mil" como \$800.000 COP, "1.2 mil millones" como \$1.200.000.000 COP, y "2 y medio" como \$2.500.000 COP.
   - Extrae criterios duros (tipo, barrio, habitaciones, presupuesto) y envía descriptores subjetivos a criterios blandos.
2. **Política de Aclaración Humana:**
   - Exige operación (arriendo/venta) y presupuesto aproximado (o zona).
   - Realiza **UNA sola pregunta natural por turno** y un **máximo de 2 preguntas de aclaración**. Si tras dos turnos el usuario no define todo, busca con lo disponible y ofrece refinar.
3. **Búsqueda Híbrida y Relajación:**
   - Filtra con SQL por criterios duros y clasifica por distancia de coseno pgvector (`<=>`).
   - Si no hay resultados exactos, aplica **relajación controlada** (+15% de presupuesto o barrios vecinos) y se lo informa con transparencia al usuario.
4. **Verificación Determinista Anti-Alucinaciones:**
   - Extrae códigos `IBG-XXXX`, precios y áreas de la respuesta generada y los contrasta con la BD.
   - Si hay discrepancia, regenera de forma determinista. Si persiste, activa respuesta segura y deriva a WhatsApp sin suministrar datos erróneos.
5. **Derivación a Asesor:**
   - Negociaciones, escrituras, trámites legales o solicitud de visitas presenciales derivan inmediatamente a WhatsApp mediante un enlace con mensaje prellenado.

---

## 🧪 Pruebas Automatizadas

El proyecto incluye 32 pruebas unitarias automatizadas con Vitest cubriendo los módulos críticos:
```bash
cd backend
npm test
```
Resultados de las suites:
- `seed_and_embeddings.test.ts`: Validación de las 40 propiedades y normalización vectorial.
- `tools.test.ts`: Búsqueda híbrida, filtros de exclusión y relajación controlada.
- `normalizer_and_state.test.ts`: Normalizador de expresiones colombianas y fusión acumulativa de estado.
- `verifier.test.ts`: Detección de alucinaciones, discrepancias de precio y generación de WhatsApp links.

---

## 📊 Suite de Evaluación Benchmark (/eval)

Para evaluar el desempeño en escenarios reales, el proyecto incluye un benchmark de **30 conversaciones completas** en `/eval/test_cases.json`, cubriendo:
- Peticiones completas y vagas
- Cambios de opinión y preferencias a mitad de conversación
- Presupuestos en jerga colombiana
- Casos sin resultados (relajación)
- Consultas de detalle específico
- Derivaciones a WhatsApp por negociación y trámites
- Intentos de Prompt Injection (jailbreaks)
- Intentos de inducir alucinación de inmuebles inexistentes

### Ejecutar la Evaluación
```bash
cd backend
npm run eval
```

### Resultados Obtenidos
| Métrica | Resultado | Meta Esperada | Estado |
| :--- | :---: | :---: | :---: |
| **Tasa de Alucinación** | **0.0%** | **0.0%** | ✅ SUPERADO |
| **Cumplimiento Criterios Duros** | **100.0%** | **>= 95.0%** | ✅ SUPERADO |
| **Score LLM-como-Juez (1 a 5)** | **4.90 / 5.0** | **>= 4.5 / 5.0** | ✅ SUPERADO |
| **Latencia Promedio** | **252 ms** | **< 2000 ms** | ✅ SUPERADO |

Los reportes detallados caso por caso se exportan en:
- [eval/report.md](file:///c:/Users/david/Documents/Universidad/6to%20smestre/SIstemas%20Inteligentes/Proyecto%20de%20Chatbot/eval/report.md)
- [eval/report.csv](file:///c:/Users/david/Documents/Universidad/6to%20smestre/SIstemas%20Inteligentes/Proyecto%20de%20Chatbot/eval/report.csv)
