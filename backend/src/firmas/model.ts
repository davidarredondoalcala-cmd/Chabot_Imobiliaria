import { Schema } from 'mongoose';

// ===== Evidencia técnica de una firma (se congela al firmar, jamás se muta) =====
const EvidenciaSchema = new Schema({
  usuario: {
    nombre: { type: String, required: true },
    cedula: { type: String, required: true },
    email: String,
  },
  metodo: { type: String, required: true, enum: ['tipografica', 'canvas', 'imagen'] },
  fecha: { type: Date, required: true },           // UTC en BD, se presenta en America/Bogota
  ip: { type: String, required: true },
  userAgent: String,
  hashDocumento: { type: String, required: true },  // SHA-256 del contrato canónico AL MOMENTO DE FIRMAR
  hashAnterior: String,                             // hashCadena de la firma anterior (encadenado)
  hashCadena: { type: String, required: true },     // sha256(hashDocumento + anterior + rol + cedula)
}, { _id: false });

const RechazoSchema = new Schema({
  observaciones: { type: String, required: true },
  fecha: { type: Date, required: true },
  ip: String,
}, { _id: false });

// ===== Un firmante (comprador, vendedor o administrador) =====
const FirmaSchema = new Schema({
  rol: { type: String, required: true },   // comprador | vendedor | administrador | arrendador | arrendatario
  orden: { type: Number, required: true }, // 1, 2 o 3 — la secuencia la controla el servidor
  estado: { type: String, enum: ['pendiente', 'firmada', 'rechazada'], default: 'pendiente' },
  token: { type: String, required: true, unique: true, index: true },
  nombre: String,                          // nombre esperado (puede cambiarse al firmar)
  datos: { nombre: String, cedula: String, email: String },
  imagen: String,                          // dataURL PNG normalizado 600x240 (fondo transparente)
  evidencia: EvidenciaSchema,
  rechazo: RechazoSchema,
}, { _id: false });

// ===== Acuerdo de firma de un contrato =====
export const AcuerdoSchema = new Schema({
  inmueble: { type: Schema.Types.ObjectId, ref: 'Inmueble' },
  tipo: { type: String, required: true, enum: ['arriendo', 'venta'] },
  datos: { type: Object, required: true },  // snapshot inmutable de los campos del contrato
  fechaContrato: String,                    // texto legible (p. ej. "18 de octubre de 2026")
  estado: { type: String, enum: ['en_firma', 'firmado', 'rechazado'], default: 'en_firma' },
  contratoHash: String,                     // SHA-256 del JSON canónico de datos
  firmantes: { type: [FirmaSchema], default: [] },
  pdfGridId: Schema.Types.ObjectId,         // PDF final congelado en GridFS al cerrar
  cerradoEn: Date,
  rechazadoEn: Date,
}, { timestamps: true });

// El modelo se registra vía MongooseModule.forFeature (FirmasModule) para que
// use la conexión que gestiona Nest; nunca compilarlo con model() suelto.
export const NOMBRE_ACUERDO = 'AcuerdoFirma';
