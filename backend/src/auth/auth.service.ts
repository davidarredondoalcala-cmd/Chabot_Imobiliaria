import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ErrorFirma } from '../firmas/errores';
import { GOOGLE_CLIENT_ID, esAdmin, normalizar, DIAS_SESION } from './config';
import { NOMBRE_SESION, NOMBRE_USUARIO } from './model';


const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const EMISORES = ['https://accounts.google.com', 'accounts.google.com'];

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(NOMBRE_USUARIO) private readonly usuarios: Model<any>,
    @InjectModel(NOMBRE_SESION) private readonly sesiones: Model<any>,
  ) {}


  async loginConGoogle(credential: string) {
    if (typeof credential !== 'string' || credential.length < 20) {
      throw new ErrorFirma(400, 'Falta el token de Google');
    }

    let payload: any;
    try {
      ({ payload } = await jwtVerify(credential, JWKS, {
        issuer: EMISORES,
        audience: GOOGLE_CLIENT_ID,
        clockTolerance: 60, 
      }));
    } catch (e: any) {
      console.error('[auth] Falló la verificación del token de Google:', e?.code || e?.name, e?.message);
      if (e?.code === 'ERR_JWKS_TIMEOUT' || e?.code === 'ERR_JOSE_GENERIC' || e?.name === 'TypeError') {
        throw new ErrorFirma(503, 'No se pudo contactar a Google para verificar la cuenta. Intenta de nuevo.');
      }
      if (e?.code === 'ERR_JWT_EXPIRED') {
        throw new ErrorFirma(401, 'El inicio de sesión de Google expiró. Intenta de nuevo.');
      }
      throw new ErrorFirma(401, 'No se pudo verificar la cuenta de Google');
    }

    const email = normalizar(payload.email);
    if (!email) throw new ErrorFirma(400, 'La cuenta de Google no trae correo');
    if (payload.email_verified === false) {
      throw new ErrorFirma(403, 'El correo de Google no está verificado');
    }

    if (!esAdmin(email)) {
      throw new ErrorFirma(403, 'Este correo no está autorizado como administrador');
    }

    const usuario = await this.usuarios.findOneAndUpdate(
      { email },
      {
        $set: {
          googleId: String(payload.sub || ''),
          email,
          nombre: String(payload.name || ''),
          foto: String(payload.picture || ''),
          ultimoAcceso: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    const token = randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + DIAS_SESION * 24 * 60 * 60 * 1000);
    await this.sesiones.create({ token, email, usuario: usuario._id, expira });

    return { token, usuario: this.publico(usuario) };
  }


  async usuarioDe(req: any) {
    const cabecera = String(req?.headers?.authorization || '');
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : '';
    if (!token) return null;

    const sesion = await this.sesiones.findOne({ token });
    if (!sesion) return null;
    if (sesion.expira && sesion.expira.getTime() < Date.now()) {
      await this.sesiones.deleteOne({ _id: sesion._id });
      return null;
    }
    const usuario = await this.usuarios.findById(sesion.usuario);
    if (!usuario) return null;
    return this.publico(usuario);
  }

  async salir(req: any) {
    const cabecera = String(req?.headers?.authorization || '');
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : '';
    if (token) await this.sesiones.deleteOne({ token });
    return { ok: true };
  }

  private publico(u: any) {
    return { email: u.email, nombre: u.nombre || '', foto: u.foto || '', admin: true };
  }
}