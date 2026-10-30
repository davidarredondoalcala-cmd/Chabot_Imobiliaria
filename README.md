# Habitat Capital (Next.js + NestJS + MongoDB Atlas)

```
backend/   NestJS (Node.js) + Mongoose  -> API REST en el puerto 4000
frontend/  Next.js (React)              -> interfaz web en el puerto 3000
```

## 1. Base de datos (MongoDB Atlas)
1. Crea un cluster gratuito en https://cloud.mongodb.com y un usuario de base de datos.
2. En *Network Access* permite tu IP (o 0.0.0.0/0 para Render).
3. Copia la cadena de conexión (*Connect > Drivers*).
4. En `backend/` copia `.env.example` como `.env` y pega la cadena en `MONGODB_URI`.
Al arrancar, si la colección está vacía, el backend carga inmuebles de ejemplo.

## 2. Backend
```
cd backend
npm install
npm run start:dev
```
Endpoints: `GET /inmuebles` · `POST /inmuebles/:id/contratos`

## 3. Frontend
```
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev
```
Abre http://localhost:3000

## 4. Despliegue
- **Render (backend):** Root Directory `backend`, Build `npm install && npm run build`, Start `npm run start:prod`.
  Variables: `MONGODB_URI`, `FRONTEND_URL` (URL de Vercel).
- **Vercel (frontend):** Root Directory `frontend`. Variable: `NEXT_PUBLIC_API_URL` (URL de Render).

"Descargar PDF" abre la impresión del navegador: elige "Guardar como PDF".

## Agregar inmuebles y filtros
- **＋ Agregar inmueble** (en la lista): tipo (casa/apartamento), nombre, estado, dirección, barrio, linderos, habitaciones, baños, área (m²), valor y, si está arrendada, vencimiento y día de pago. Endpoint: `POST /inmuebles`.
- **Filtros** (en la lista): habitaciones y baños (mínimo), tamaño en m² (mín–máx), rango de precio (mín–máx) y estado. Se aplican al instante en el frontend y se combinan entre sí.
- Los inmuebles de ejemplo ya existentes en Atlas reciben habitaciones/baños/área automáticamente al arrancar el backend.

> Seguridad: las credenciales de Atlas van solo en `backend/.env` (ignorado por git). `.env.example` debe tener únicamente valores de ejemplo.

## 5. Chatbot Inmobiliario Inteligente (Ibagué)
El proyecto incluye un agente conversacional inteligente integrado tanto en el backend como en la interfaz web:
- **Backend (NestJS):** Endpoints públicos `POST /api/chat`, `GET /api/conversations/:id` y `GET /api/health`.
  - Conexión híbrida con la base de datos de MongoDB Atlas y el catálogo verificado de Ibagué.
  - Normalizador de modismos y dinero colombiano ("palos", "2 y medio", "800 mil").
  - Módulo NLU estructurado, política de aclaración de máximo 2 turnos y enlaces directos a WhatsApp para visitas y asesores.
- **Frontend (Next.js):** Widget flotante (`ChatWidget`) interactivo disponible en toda la plataforma con sugerencias rápidas, burbujas de diálogo y tarjetas visuales de propiedades con botón directo a WhatsApp.
- **Carpeta dedicada:** Todo el proyecto del chatbot (`backend/`, `frontend/`, `eval/`, dataset y notebooks) se encuentra archivado en la carpeta `chatbot/`.
