import { Schema } from 'mongoose';

// ===== Usuario administrador (creado/actualizado en el primer login con Google) =====
export const UsuarioSchema = new Schema(
  {
    googleId: { type: String, required: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    nombre: String,
    foto: String,
    ultimoAcceso: Date,
  },
  { timestamps: true },
);

// ===== Sesión: token opaco aleatorio (no JWT → no necesita secreto externo) =====
export const SesionSchema = new Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, index: true },
    usuario: { type: Schema.Types.ObjectId, ref: 'Usuario' },
    expira: { type: Date, required: true },
  },
  { timestamps: true, collection: 'sesiones' },
);

export const NOMBRE_USUARIO = 'Usuario';
export const NOMBRE_SESION = 'Sesion';
