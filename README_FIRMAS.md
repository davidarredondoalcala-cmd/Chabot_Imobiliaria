# Módulo de Firmas Electrónicas + API de Imágenes — README

Documento de todo lo que se construyó en esta entrega. El `README.md` original de la plataforma no se tocó.

---

## 1. Resumen ejecutivo

Se implementaron dos entregables nuevos, integrados **dentro del backend NestJS existente** (un solo servicio, puerto 4000):

1. **Módulo de firmas electrónicas** con firma secuencial de las dos partes (comprador → vendedor / arrendador → arrendatario), 3 métodos de firma, evidencia técnica por firma (fecha, hora, IP, hash SHA-256 encadenado), PDF final único con anexo de evidencia y verificación de integridad, conforme a la **Ley 527 de 1999**.
2. **API genérica de subida de imágenes** (fotos de casas, hoteles, etc.), independiente del módulo de firmas.

Todo vive en `backend/src/firmas/` y `backend/src/imagenes/` (módulos NestJS registrados en `AppModule`) más los archivos nuevos del frontend. La API Express independiente que existía en la carpeta `api/` (puerto 4100) fue **eliminada** tras portar sus rutas: el frontend consume todo desde `NEXT_PUBLIC_API_URL` (el mismo backend de siempre). Las rutas `/api/firmas/...`, `/api/imagenes/...`, `/archivos/:nombre` y `/api/salud` se conservan **idénticas** a la API original.

## 2. Estructura de carpetas creada

```
Inombiliaria_Software/
├── backend/                            # NestJS existente + módulos nuevos (puerto 4000)
│   └── src/
│       ├── main.ts                     # + express.json({limit:'10mb'}) y estáticos /archivos
│       ├── app.module.ts               # + FirmasModule, ImagenesModule y filtro global
│       ├── filtros.ts                  # ErrorFirma/Multer/HttpException → {error:'...'}
│       ├── firmas/
│       │   ├── firmas.module.ts        # MongooseModule.forFeature + controladores
│       │   ├── firmas.controller.ts    # 7 endpoints bajo /api/firmas
│       │   ├── salud.controller.ts     # GET /api/salud
│       │   ├── firmas.service.ts       # crear, firmar (turnos), rechazar, verificar, PDF
│       │   ├── model.ts                # Schemas: AcuerdoFirma, Firma, Evidencia, Rechazo
│       │   ├── hash.ts                 # SHA-256 canónico, cadena encadenada, tokens, IP
│       │   ├── clausulas.ts            # Plantilla del contrato (espejo de Hoja.js) para el PDF
│       │   ├── errores.ts              # ErrorFirma(status, mensaje)
│       │   └── pdf.ts                  # pdf-lib: contrato + evidencia + GridFS (recibe la conexión de Nest)
│       └── imagenes/
│           ├── imagenes.module.ts
│           ├── imagenes.controller.ts  # POST /subir, GET / (listado)
│           └── storage.ts              # multer 2.x + sharp: valida, redimensiona ≤2048px
│
├── frontend/                           # archivos nuevos + ediciones mínimas
│   ├── app/firma/[token]/page.js       # NUEVA ruta de firma (antes daba 404)
│   ├── app/firma/[token]/firma.css     # estilos propios del módulo + impresión
│   ├── components/firmas/
│   │   ├── FirmaFlujo.js               # orquestador: identidad + método + preview + condiciones
│   │   ├── FirmaTipografica.js         # método 1
│   │   ├── FirmaCanvas.js              # método 2
│   │   ├── FirmaImagen.js              # método 3
│   │   ├── FirmaEspacio.js             # slot de firma dentro del contrato
│   │   └── EvidenciaTabla.js           # tabla de evidencia técnica
│   ├── lib/normalizar.js               # normalización PNG 600×240 + quitar fondo
│   ├── lib/apiFirmas.js                # cliente HTTP de firmas → NEXT_PUBLIC_API_URL
│   └── lib/apiImagenes.js              # cliente HTTP de imágenes → NEXT_PUBLIC_API_URL
│
└── README_FIRMAS.md                    # este documento
```

**Archivos existentes modificados (ver §10).**

## 3. Los 3 métodos de firma

Todos producen la **misma salida**: `dataURL PNG 600×240 con fondo transparente`, vía `lib/normalizar.js` (recorta márgenes transparentes, escala manteniendo proporción con 16px de aire y centra).

### 3.1 Tipográfica — `FirmaTipografica.js`
- El usuario escribe su nombre (compartido con el formulario de identidad) y ve vista previa en vivo.
- 3 fuentes manuscritas (Caveat, Dancing Script, Great Vibes) cargadas desde Google Fonts con `<link>` inyectado.
- Se pinta en un canvas 900×360 (ajustando el tamaño de fuente si el nombre es largo) y se normaliza.
- Exporta PNG transparente.

### 3.2 A pulso (canvas) — `FirmaCanvas.js`
- **Pointer Events** + `setPointerCapture` + `touch-action: none`: funciona con mouse, touchpad y pantalla táctil.
- Escalado por `devicePixelRatio` (nítido en pantallas retina) y redibujo al cambiar el tamaño de ventana.
- Trazo suave con curvas cuadráticas (puntos medios); ancho variable sutil con `pressure` cuando el dispositivo lo soporta.
- Estado = array de trazos ⇒ botones **Limpiar** (vacía todo) y **Rehacer** (deshace el último trazo).
- Validación de no-vacío: sin trazos o si el resultado normalizado no tiene píxeles visibles, no se habilita “Firmar”.

### 3.3 Imagen — `FirmaImagen.js`
- Sube foto o escaneo; valida **formato (PNG/JPG)** y **tamaño máximo 5 MB**.
- Redimensiona a ≤1600 px de trabajo, **quita/aclara el fondo** con relleno por inundación desde los bordes (umbral de luminancia ajustable con slider de tolerancia; solo borra lo que toca el borde, preserva los blancos internos del trazo).
- Vista previa y botón **Reemplazar**.
- Exporta PNG transparente normalizado.

## 4. Flujo secuencial

```
en_firma ──(comprador firma)──► en_firma ──(vendedor firma)──► en_firma ──(admin firma)──► firmado (PDF congelado en GridFS, firmas bloqueadas)
                                              └─(admin rechaza con observaciones)──► rechazado (firmas previas conservadas como evidencia)
```

- Cada parte recibe un **enlace privado** `/firma/[token]` (32 bytes aleatorios, URL-safe, índice único).
- **El turno lo decide el servidor**: firmar con un token que no tiene el turno responde `409`. El frontend solo pinta el mensaje “Ahora le corresponde firmar a: …”.
- Al cerrar (3ª firma), el PDF se genera y se **congela en GridFS**; posteriores descargas sirven ese mismo archivo.
- Tras cerrar, cualquier intento de firmar responde `409` (bloqueo server-side).
- El administrador (orden 3) puede **rechazar con observaciones**; las firmas de comprador y vendedor se conservan como evidencia en el PDF del estado rechazado.

## 5. Modelo de datos (colección `acuerdofirmas`, misma BD)

```js
AcuerdoFirma {
  inmueble,                      // referencia al inmueble (opcional)
  tipo: 'arriendo' | 'venta',
  datos: {...},                  // snapshot inmutable de los campos del contrato + fecha
  fechaContrato,                 // texto legible ("18 de octubre de 2026")
  estado: 'en_firma' | 'firmado' | 'rechazado',
  contratoHash,                  // SHA-256 del JSON canónico (claves ordenadas) de datos
  firmantes: [Firma],
  pdfGridId,                     // GridFS, solo al cerrar
  cerradoEn, rechazadoEn, timestamps
}
Firma {
  rol, orden (1|2|3), estado ('pendiente'|'firmada'|'rechazada'),
  token,                         // único e intransferible
  datos: { nombre, cedula, email },
  imagen,                        // dataURL PNG normalizado
  evidencia: { usuario, metodo, fecha (UTC), ip, userAgent,
               hashDocumento, hashAnterior, hashCadena },
  rechazo: { observaciones, fecha, ip }   // solo administrador
}
```

El PDF final se almacena en **GridFS** (bucket `pdfs`), no en disco local, para que sobreviva a despliegues con sistema de archivos efímero (Render).

## 6. Endpoints

### Firmas — `/api/firmas`

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/acuerdos` | Crea acuerdo + 3 tokens; recibe `{inmueble, tipo, datos, firmantes:[{rol,nombre}×3]}` |
| GET | `/acuerdos/:id` | Estado del acuerdo (panel administrativo) |
| GET | `/t/:token` | Datos públicos para la pantalla de firma (contrato, turno, rol) |
| POST | `/t/:token/firmar` | `{datos:{nombre,cedula,email}, metodo, imagen, condiciones:true}` — valida turno en servidor |
| POST | `/t/:token/rechazar` | `{observaciones}` — solo orden 3, en su turno |
| GET | `/acuerdos/:id/verificar` | Recomputa todos los hashes → `{integro, contratoIntegro, cadenaIntegra, firmas[]}` |
| GET | `/acuerdos/:id/pdf` | Descarga el PDF (GridFS si está congelado; si no, se genera al vuelo) |

Errores de negocio: `400` validación, `403` rol, `404` enlace, `409` turno/bloqueo, `413` tamaño.

### Imágenes (genérica) — `/api/imagenes`

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/subir` | multipart: campo `imagen` (PNG/JPG/WEBP ≤10 MB) + `tipo` opcional (casa/hotel/…). Valida magic bytes con sharp, redimensiona ≤2048 px |
| GET | `/?tipo=casa` | Listado (filtro opcional por prefijo de tipo) |

Las imágenes se sirven en `/archivos/:nombre`. **Sin conexión con el módulo de firmas**: la firma por imagen se envía como base64 al endpoint de firmas.

## 7. Evidencia técnica y validez legal (Ley 527 de 1999)

Por cada firma se registra: **usuario** (nombre, cédula, email), **método**, **fecha y hora** (UTC en BD, presentada en `America/Bogota`), **IP** (X-Forwarded-For detrás del proxy; socket.remoteAddress en local), userAgent y **huellas SHA-256**:

- `contratoHash` = SHA-256 del JSON canónico del contrato **al momento de crear el acuerdo**; se revalida en cada firma (si `datos` cambió, se rechaza).
- `hashDocumento` = el `contratoHash` congelado en el momento de firmar.
- `hashCadena` = SHA-256 encadenado: `sha256(hashDocumento | hashAnterior | rol | cédula)`. Alterar una firma invalida **toda la cadena posterior**.
- `GET /verificar` recomputa todo desde la BD: si alguien altera el snapshot o una huella, responde `integro: false`.

Encaje con la Ley 527 (mensajes de datos):
- Art. 5 y 7: el contrato + evidencia son mensajes de datos reproducibles y verificables; el endpoint de verificación lo demuestra de forma automática.
- Cada firma electrónica quedó asociada a la identidad del firmante y a su declaración de voluntad (casilla obligatoria de aceptación).
- El PDF final incluye un **anexo de evidencia** con todos los datos por firmante.

**Límite declarado (no es asesoría legal):** esto es una **firma electrónica simple**, no una firma digital certificada con PKI (Art. 9 Ley 527 / infraestructura de clave pública). La evidencia almacenada está lista para migrar a un certificado digital (GovCo, Cámara de Comercio, etc.) si se requiere valor probatorio reforzado. Sin autenticación de usuarios en la plataforma, la identidad la aporta el token + cédula auto-declarada: riesgo residual documentado como mejora futura.

## 8. PDF final e impresión

- **PDF del servidor** (`backend/src/firmas/pdf.ts`, pdf-lib, A4): cláusulas del contrato (espejo de `Hoja.js`), bloque de firmas con las imágenes PNG embebidas (140 px de ancho, proporcionales) y **anexo de evidencia** (tabla + hash del contrato + huellas encadenadas en Courier + nota Ley 527 + rechazo si existe).
- **Vista en navegador**: la ruta `/firma/[token]` renderiza el mismo componente `Hoja` con las firmas ya registradas incrustadas.
- **Impresión/PDF del navegador**: `window.print()` con el `@media print` existente (A4) más reglas nuevas en `firma.css` (oculta controles, conserva contrato y evidencia).
- **Antes de firmar**: impresión y descarga disponibles (PDF del navegador con espacios vacíos). **Después de cerrar**: PDF del servidor único con todo.

## 9. Instalación y arranque

Dos procesos (todo el backend en un solo servicio):

```bash
# 1. Backend NestJS (puerto 4000) — firmas + imágenes + inmuebles
cd Inombiliaria_Software/backend
npm install
cp .env.example .env   # pon tu MONGODB_URI (y FRONTEND_URL para CORS)

# Sin MongoDB local: demo efímera en 27017 (solo desarrollo)
node demo-mongo.js

npm run start:dev

# 2. Frontend (puerto 3000)
cd Inombiliaria_Software/frontend
npm install
npm run dev
```

Variables relevantes del backend: `MONGODB_URI` (BD), `FRONTEND_URL` (CORS; acepta varias separadas por coma), `UPLOAD_DIR` (carpeta de imágenes; por defecto `uploads/imagenes` y si el SO es de solo lectura cae a la temporal del SO), `MAX_FIRMA_BYTES` (1 MB), `MAX_IMAGEN_BYTES` (10 MB). El JSON de las firmas se lee con límite de **10 MB** (`main.ts`).

En producción **no hay servicio extra**: Vercel (frontend) define `NEXT_PUBLIC_API_URL=https://proyecto-ing-software-2ek3.onrender.com` (el backend NestJS de Render, que ya existía) y Render redespliega solo desde GitHub. Rutas idénticas → el solo hecho de apuntar la variable al backend resuelve el `Failed to fetch`.

## 10. Archivos existentes modificados (los únicos)

| Archivo | Cambio | Líneas aprox. |
|---|---|---|
| `frontend/components/Hoja.js` | Prop opcional `firmas` (default `undefined` ⇒ render idéntico al anterior); los slots `.sig` usan `<FirmaEspacio>`; el bloque del administrativo solo se muestra cuando se pasa `firmas`; `S.fecha` congela la fecha del contrato | ~12 |
| `frontend/components/ContratoForm.js` | El botón “Enviar link para firma” llama a `crearAcuerdo` y muestra los 3 enlaces reales; se eliminó el link falso (`Math.random`) y el botón “Simular firma” | ~10 |
| `frontend/lib/apiFirmas.js` | `NEXT_PUBLIC_API_FIRMAS`/`:4100` → `NEXT_PUBLIC_API_URL`/`:4000` (mismo backend) | 2 |
| `frontend/lib/apiImagenes.js` | Igual: `NEXT_PUBLIC_API_FIRMAS`/`:4100` → `NEXT_PUBLIC_API_URL`/`:4000` | 2 |
| `backend/src/app.module.ts` | Registra `FirmasModule`, `ImagenesModule` y el filtro global de errores | +5 |
| `backend/src/main.ts` | `express.json({limit:'10mb'})` (firmas base64) + `express.static` de `/archivos` | +5 |
| `backend/package.json` | Dependencias del port: `multer`, `pdf-lib`, `sharp` (+ `mongodb-memory-server` dev para el demo local) | 3 |

**No se tocó:** esquemas/servicios/rutas de inmuebles, `lib/api.js`, `globals.css`, `page.js`, catálogo, login, `Detalles.js`, etc.

## 11. Pruebas realizadas (checklist E2E)

**E2E contra el backend NestJS en `http://localhost:4000` (23 aserciones, todas OK):**

1. `GET /api/salud` → `ok:true`.
2. `GET /inmuebles` → semilla cargada.
3. `POST /api/firmas/acuerdos` → acuerdo + 3 links (HTTP 200).
4. JSON de 200 KB aceptado (límite 10 MB de `main.ts`).
5. Firmar fuera de turno (admin primero) → `409`.
6. Firmar sin aceptar condiciones → `400`.
7. Firma 1 (arrendador) → turno pasa a 2; repetir firma propia → `409`.
8. Firma 2 (arrendatario) → turno pasa a 3; firma 3 (admin) → `firmado`, PDF disponible.
9. PDF → cabecera `%PDF`, membrete “HABITAT CAPITAL” y título (streams descomprimidos).
10. Verificar integridad → `integro:true`, 3/3 firmas verificadas.
11. Token inexistente → `404`.
12. Acuerdo paralelo: admin **rechaza** con observaciones → `rechazado` + PDF del rechazado → `200`.
13. Alterar el contrato en BD → verificación responde `integro:false` / `contratoIntegro:false`.
14. Subir imagen (`multipart`) → `200` con `/archivos/...`; servida con `image/png`.
15. Mimetype no permitido → `400`; PNG corrupto → `400` (magic bytes con sharp).
16. Listado `GET /api/imagenes?tipo=casa`.
17. CORS con el `Origin` de Vercel → `access-control-allow-origin` permitido.

Además: `tsc --noEmit` sin errores y `next build` compila con la ruta `/firma/[token]` y la portada intacta.

## 12. Limitaciones y mejoras futuras

- **Autenticación**: no hay login en la plataforma; la identidad se aporta en el enlace. Mejora: JWT/ magic links por email.
- **Firma digital certificada**: migrar a PKI (GovCo / Cámara de Comercio) para valor probatorio reforzado.
- **Notificaciones**: los enlaces se copian a mano; falta envío automático por correo (SMTP/SendGrid).
- **Storage de imágenes**: `backend/uploads/imagenes` es local (en Render free solo vive en `/tmp`, efímero). Mejora: Cloudinary/S3/GridFS.
- **Firmas de codeudores**: en arriendo, los codeudores no firman por separado (solo aparecen en el contrato); el flujo es de 2 firmas: comprador/arrendador → vendedor/arrendatario (ya no firma el administrador).
- **Reintento de acuerdo rechazado**: actualmente se crea un nuevo acuerdo; no hay “reabrir el mismo”.
