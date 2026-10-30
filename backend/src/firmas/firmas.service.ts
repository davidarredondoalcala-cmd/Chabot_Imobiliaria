import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types, isValidObjectId } from 'mongoose';
import { NOMBRE_ACUERDO } from './model';
import { hashContrato, hashCadena, generarToken, ipDe, tokenSeguro } from './hash';
import { generarPdf, generarPdfBorrador, guardarEnGridFS, leerDeGridFS } from './pdf';
import { ErrorFirma } from './errores';
import { InmueblesService } from '../inmuebles/inmuebles.service';
import { CorreoService } from './correo.service';
import { INMOBILIARIA_INFO, FIRMA_INMOBILIARIA_DATA_URL } from './firma-inmobiliaria';

const METODOS = ['tipografica', 'canvas', 'imagen'];
const MAX_FIRMA = Number(process.env.MAX_FIRMA_BYTES || 1000000);

const fechaTexto = () => new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

function validarImagen(imagen: any) {
  if (typeof imagen !== 'string' || !imagen.startsWith('data:image/png;base64,')) {
    throw new ErrorFirma(400, 'La firma debe ser una imagen PNG (dataURL) normalizada');
  }
  if (imagen.length > MAX_FIRMA * 1.4) {
    throw new ErrorFirma(413, 'La imagen de firma supera el tamaño permitido');
  }
}

function buscarPorToken(acuerdo: any, token: any) {
  return acuerdo?.firmantes?.find((f: any) => tokenSeguro(f.token, token));
}

@Injectable()
export class FirmasService {
  constructor(
    @InjectModel(NOMBRE_ACUERDO) private readonly acuerdos: Model<any>,
    @InjectConnection() private readonly conn: Connection,
    private readonly inmuebles: InmueblesService,
    private readonly correo: CorreoService,
  ) {}

  // ===== Crear acuerdo: genera los tokens y el hash del contrato =====
  async crearAcuerdo({ inmueble, tipo, datos, firmantes, frontendUrl }: any) {
    if (!['arriendo', 'venta'].includes(tipo)) throw new ErrorFirma(400, 'Tipo de contrato inválido');
    if (!datos || typeof datos !== 'object') throw new ErrorFirma(400, 'Faltan los datos del contrato');

    // Las dos partes del contrato firman primero; en arriendo, cada codeudor firma después (solo si existe)
    const maxFirmantes = tipo === 'arriendo' ? 12 : 2;
    if (!Array.isArray(firmantes) || firmantes.length < 2 || firmantes.length > maxFirmantes) {
      throw new ErrorFirma(400, 'Se requieren las dos partes del contrato (y los codeudores solo en arriendo)');
    }

    // El snapshot congela los datos y la fecha del contrato
    // La Inmobiliaria es la propietaria por defecto y sus datos quedan sellados
    const snapshot = {
      ...datos,
      fecha: datos.fecha || fechaTexto(),
      ...(tipo === 'arriendo'
        ? { arr: INMOBILIARIA_INFO.nombre, arrCedula: INMOBILIARIA_INFO.cedula, arrEmail: INMOBILIARIA_INFO.email }
        : { vend: INMOBILIARIA_INFO.nombre, vendCedula: INMOBILIARIA_INFO.cedula, vendEmail: INMOBILIARIA_INFO.email }),
    };

    const contratoHash = hashContrato(snapshot);

    const conOrden = firmantes.map((f: any, i: number) => {
      if (!f.rol || typeof f.rol !== 'string') throw new ErrorFirma(400, 'Cada firmante necesita un rol');
      if (i >= 2 && f.rol !== 'codeudor') throw new ErrorFirma(400, 'Después de las dos partes solo pueden firmar codeudores');

      const esInmobiliaria = f.rol === 'arrendador' || f.rol === 'vendedor';
      if (esInmobiliaria) {
        // La firma corporativa de la Inmobiliaria viene precargada y firmada por defecto como propietaria
        const nombreInm = INMOBILIARIA_INFO.nombre;
        const cedulaInm = INMOBILIARIA_INFO.cedula;
        const emailInm = INMOBILIARIA_INFO.email;
        const fechaFirma = new Date();
        const cadena = hashCadena(contratoHash, null, f.rol, cedulaInm);

        return {
          rol: f.rol,
          orden: i + 1,
          estado: 'firmada',
          token: generarToken(),
          nombre: nombreInm,
          email: emailInm,
          cedula: cedulaInm,
          datos: { nombre: nombreInm, cedula: cedulaInm, email: emailInm },
          imagen: FIRMA_INMOBILIARIA_DATA_URL,
          evidencia: {
            usuario: { nombre: nombreInm, cedula: cedulaInm, email: emailInm },
            metodo: 'imagen',
            fecha: fechaFirma,
            ip: '127.0.0.1 (Firma autorizada del propietario)',
            userAgent: 'Habitat Capital Legal Platform',
            hashDocumento: contratoHash,
            hashAnterior: null,
            hashCadena: cadena,
          },
        };
      }

      return {
        rol: f.rol,
        orden: i + 1,
        estado: 'pendiente',
        token: generarToken(),
        nombre: f.nombre || '',
        email: f.email || '',
        cedula: f.cedula || '',
        datos: null,
        imagen: null,
        evidencia: null,
      };
    });

    const acuerdo = await this.acuerdos.create({
      inmueble: inmueble || undefined,
      tipo,
      datos: snapshot,
      fechaContrato: snapshot.fecha,
      contratoHash,
      firmantes: conOrden,
    });

    // Generación del PDF borrador oficial para adjuntarlo al correo automático de Brevo
    let pdfBuffer: Buffer | undefined;
    const cleanDir = (snapshot.dir || 'Inmueble').replace(/[^a-zA-Z0-9_-]/g, '_');
    const pdfNombre = `Contrato_${tipo === 'arriendo' ? 'Arrendamiento' : 'Compraventa'}_${cleanDir}.pdf`;
    try {
      pdfBuffer = await generarPdfBorrador(tipo, snapshot);
    } catch (e: any) {
      console.warn('No se pudo generar buffer PDF borrador para adjunto:', e.message);
    }

    // Envío automático de correos con Brevo API a contrapartes y codeudores pendientes
    let baseUrl = frontendUrl || process.env.FRONTEND_URL || 'https://habitatcapitalweb.vercel.app';
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
    for (const f of conOrden) {
      if (f.estado === 'pendiente' && f.email && typeof f.email === 'string' && f.email.includes('@')) {
        this.correo.enviarEnlaceFirma({
          destinatario: f.email.trim(),
          nombre: f.nombre || '',
          rol: f.rol,
          tipoContrato: tipo,
          urlFirma: `${baseUrl}/firma/${f.token}`,
          inmuebleNombre: snapshot.nombre || snapshot.dir || 'Inmueble Habitat Capital',
          direccion: snapshot.dir ? `${snapshot.dir}${snapshot.bar ? ` · Barrio ${snapshot.bar}` : ''}` : undefined,
          pdfBuffer,
          pdfNombre,
        }).catch((err) => console.error(`Error al despachar correo a ${f.email}:`, err));
      }
    }

    return this.pactoPublico(acuerdo);
  }

  // Vista "pública" del acuerdo: sin tokens ni imágenes, con los links por separado
  private pactoPublico(acuerdo: any) {
    const links = acuerdo.firmantes.map((f: any) => ({
      rol: f.rol,
      orden: f.orden,
      nombre: f.nombre || '',
      email: f.email || '',
      token: f.token,
      url: `/firma/${f.token}`,
      estado: f.estado,
    }));
    return {
      id: acuerdo._id,
      tipo: acuerdo.tipo,
      estado: acuerdo.estado,
      inmueble: acuerdo.inmueble,
      links,
      firmantes: acuerdo.firmantes.map((f: any) => ({
        rol: f.rol, orden: f.orden, estado: f.estado,
        nombre: f.nombre || f.datos?.nombre || '',
        email: f.email || '',
        imagen: f.estado === 'firmada' ? (f.imagen || null) : null,
        tieneImagen: !!f.imagen,
        rechazo: f.rechazo || null,
      })),
      creadoEn: acuerdo.creadoEn,
      cerradoEn: acuerdo.cerradoEn,
      rechazadoEn: acuerdo.rechazadoEn,
    };
  }

  // Vista para un firmante con su token: contrato + estado + evidencias (sin tokens de otros)
  private vistaToken(acuerdo: any, propia: any) {
    const turno = acuerdo.firmantes.find((f: any) => f.estado === 'pendiente');
    return {
      id: acuerdo._id,
      tipo: acuerdo.tipo,
      estado: acuerdo.estado,
      datos: acuerdo.datos,
      fechaContrato: acuerdo.fechaContrato,
      contratoHash: acuerdo.contratoHash,
      miRol: propia.rol,
      miOrden: propia.orden,
      miEstado: propia.estado,
      miNombre: propia.datos?.nombre || propia.nombre || '',
      turno: turno ? { rol: turno.rol, orden: turno.orden, nombre: turno.nombre || '' } : null,
      firmantes: acuerdo.firmantes.map((f: any) => ({
        rol: f.rol, orden: f.orden, estado: f.estado,
        nombre: f.datos?.nombre || f.nombre || '',
        imagen: f.estado === 'firmada' ? (f.imagen || null) : null,
        evidencia: f.estado === 'firmada' && f.evidencia ? {
          metodo: f.evidencia.metodo,
          fecha: f.evidencia.fecha,
          ip: f.evidencia.ip,
          hashDocumento: f.evidencia.hashDocumento,
          hashCadena: f.evidencia.hashCadena,
          usuario: f.evidencia.usuario,
        } : null,
        rechazo: f.rechazo || null,
      })),
      pdfDisponible: acuerdo.estado === 'firmado' || acuerdo.estado === 'rechazado',
      cerradoEn: acuerdo.cerradoEn,
      rechazadoEn: acuerdo.rechazadoEn,
    };
  }

  async obtenerPorToken(token: string) {
    if (!token || token.length < 10) throw new ErrorFirma(404, 'Enlace inválido');
    const acuerdo = await this.acuerdos.findOne({ 'firmantes.token': token });
    if (!acuerdo) throw new ErrorFirma(404, 'Enlace inválido o expirado');
    const propia = buscarPorToken(acuerdo, token);
    if (!propia) throw new ErrorFirma(404, 'Enlace inválido');
    return this.vistaToken(acuerdo, propia);
  }

  async obtenerAcuerdo(id: string) {
    const acuerdo = await this.acuerdos.findById(id);
    if (!acuerdo) throw new ErrorFirma(404, 'Acuerdo no encontrado');
    return this.pactoPublico(acuerdo);
  }

  // ¿El token corresponde a un firmante de este acuerdo? (para el PDF por enlace)
  async tieneToken(id: string, token: string) {
    if (!token) return false;
    const acuerdo = await this.acuerdos.findById(id);
    if (!acuerdo) return false;
    return !!buscarPorToken(acuerdo, token);
  }

  // Verifica si un token pertenece a cualquier acuerdo activo (para autorizar previsualización o borrador)
  async validarTokenFirmante(token: string) {
    if (!token || token.length < 10) return false;
    const acuerdo = await this.acuerdos.findOne({ 'firmantes.token': token });
    return !!acuerdo;
  }

  // ===== Firmar: registra evidencia y encadena hashes (sin bloquear por turno) =====
  async firmar(token: string, { datos, metodo, imagen, condiciones, req }: any) {
    const acuerdo: any = await this.acuerdos.findOne({ 'firmantes.token': token });
    const propia = buscarPorToken(acuerdo, token);
    if (!acuerdo || !propia) throw new ErrorFirma(404, 'Enlace inválido o expirado');

    if (acuerdo.estado === 'firmado') throw new ErrorFirma(409, 'El acuerdo ya está cerrado; las firmas quedaron bloqueadas');
    if (acuerdo.estado === 'rechazado') throw new ErrorFirma(409, 'El acuerdo fue rechazado y no puede firmarse');
    if (propia.estado !== 'pendiente') throw new ErrorFirma(409, 'Tu firma ya fue registrada');

    if (condiciones !== true) throw new ErrorFirma(400, 'Debes aceptar las condiciones de firma electrónica');
    if (!METODOS.includes(metodo)) throw new ErrorFirma(400, 'Método de firma inválido');
    validarImagen(imagen);

    const cedula = String(datos?.cedula || '').trim();
    const nombre = String(datos?.nombre || '').trim();
    if (nombre.length < 3) throw new ErrorFirma(400, 'Escribe tu nombre completo');
    if (cedula.length < 5) throw new ErrorFirma(400, 'Escribe tu número de cédula');

    // Integridad: el hash guardado debe seguir coincidiendo con el snapshot
    const recomputado = hashContrato(acuerdo.datos);
    if (recomputado !== acuerdo.contratoHash) {
      throw new ErrorFirma(409, 'El contrato fue alterado después de crear el acuerdo');
    }

    // Evidencia técnica — Ley 527 de 1999
    // Busca la última firma registrada cronológicamente para encadenar
    const anteriores = [...acuerdo.firmantes]
      .filter((f: any) => f.estado === 'firmada' && f.evidencia?.hashCadena)
      .sort((a: any, b: any) => new Date(a.evidencia.fecha).getTime() - new Date(b.evidencia.fecha).getTime());
    const anterior = anteriores[anteriores.length - 1];
    const hashAnterior = anterior?.evidencia?.hashCadena || null;
    const hashDoc = acuerdo.contratoHash;
    const cadena = hashCadena(hashDoc, hashAnterior, propia.rol, cedula);

    propia.datos = { nombre, cedula, email: String(datos?.email || '').trim() };
    propia.imagen = imagen;
    propia.estado = 'firmada';
    propia.evidencia = {
      usuario: propia.datos,
      metodo,
      fecha: new Date(),
      ip: ipDe(req),
      userAgent: String(req?.headers?.['user-agent'] || '').slice(0, 200),
      hashDocumento: hashDoc,
      hashAnterior,
      hashCadena: cadena,
    };
    acuerdo.markModified('firmantes');

    // ¿Cerramos el acuerdo? (cuando ya no quedan firmas pendientes)
    const quedan = acuerdo.firmantes.filter((f: any) => f.estado === 'pendiente');
    if (quedan.length === 0) {
      acuerdo.estado = 'firmado';
      acuerdo.cerradoEn = new Date();
      await acuerdo.save();
      await this.marcarInmueble(acuerdo);
      // Congela el PDF final en GridFS y envía copia firmada oficial por correo con Brevo
      try {
        const buffer = await generarPdf(acuerdo);
        acuerdo.pdfGridId = await guardarEnGridFS(buffer, `acuerdo-${acuerdo._id}.pdf`, this.conn.db);
        await acuerdo.save();

        const baseUrl = process.env.FRONTEND_URL || 'https://habitatcapitalweb.vercel.app';
        const pdfNombre = `Contrato_Firmado_${acuerdo.tipo === 'arriendo' ? 'Arrendamiento' : 'Compraventa'}_${acuerdo._id}.pdf`;

        // Notificar por correo a cada parte con el PDF oficial firmado
        for (const f of acuerdo.firmantes) {
          const email = f.datos?.email || f.email;
          if (email && typeof email === 'string' && email.includes('@')) {
            this.correo.enviarContratoFinalFirmado({
              destinatario: email.trim(),
              nombre: f.datos?.nombre || f.nombre || 'Estimado(a) firmante',
              rol: f.rol,
              tipoContrato: acuerdo.tipo,
              inmuebleNombre: acuerdo.datos?.nombre || acuerdo.datos?.dir || 'Inmueble Habitat Capital',
              direccion: acuerdo.datos?.dir ? `${acuerdo.datos.dir}${acuerdo.datos.bar ? ` · Barrio ${acuerdo.datos.bar}` : ''}` : undefined,
              urlVerificacion: `${baseUrl}/firma/${f.token}`,
              pdfBuffer: buffer,
              pdfNombre,
            }).catch((err) => console.error(`Error al enviar contrato final firmado a ${email}:`, err));
          }
        }
      } catch (e: any) {
        console.error('No se pudo archivar el PDF en GridFS o enviar correos finales:', e.message);
      }
    } else {
      await acuerdo.save();
    }

    return this.vistaToken(acuerdo, propia);
  }

  // Firmas completas: el inmueble pasa a Arrendada (arriendo) o Vendida (compraventa)
  private async marcarInmueble(acuerdo: any) {
    if (!acuerdo.inmueble) return;
    const d = acuerdo.datos || {};
    const firmasObj: any = { codeudores: [] };
    for (const f of acuerdo.firmantes || []) {
      if (f.rol === 'codeudor') {
        firmasObj.codeudores.push(f.imagen || null);
      } else {
        firmasObj[f.rol] = f.imagen || null;
      }
    }
    try {
      await this.inmuebles.crearContrato(String(acuerdo.inmueble), {
        modo: acuerdo.tipo,
        acuerdoId: String(acuerdo._id),
        firmantes: acuerdo.firmantes.map((f: any) => f.datos?.nombre || f.nombre),
        dur: d.dur, dia: d.dia, val: d.val, dir: d.dir, bar: d.bar, lin: d.lin,
        datos: d,
        firmas: firmasObj,
      });
    } catch (e: any) {
      console.error('No se pudo actualizar el estado del inmueble:', e.message);
    }
  }

  // ===== Rechazo: solo el administrador (orden 3) en su turno =====
  async rechazar(token: string, { observaciones, req }: any) {
    const acuerdo: any = await this.acuerdos.findOne({ 'firmantes.token': token });
    const propia = buscarPorToken(acuerdo, token);
    if (!acuerdo || !propia) throw new ErrorFirma(404, 'Enlace inválido o expirado');

    if (acuerdo.estado === 'firmado') throw new ErrorFirma(409, 'El acuerdo ya está cerrado');
    if (acuerdo.estado === 'rechazado') throw new ErrorFirma(409, 'El acuerdo ya fue rechazado');
    if (propia.rol !== 'administrador') throw new ErrorFirma(403, 'Solo el administrativo puede rechazar el acuerdo');
    if (propia.estado !== 'pendiente') throw new ErrorFirma(409, 'Tu respuesta ya fue registrada');

    const txt = String(observaciones || '').trim();
    if (txt.length < 5) throw new ErrorFirma(400, 'Escribe las observaciones del rechazo');

    propia.estado = 'rechazada';
    propia.rechazo = { observaciones: txt.slice(0, 2000), fecha: new Date(), ip: ipDe(req) };
    acuerdo.estado = 'rechazado';
    acuerdo.rechazadoEn = new Date();
    await acuerdo.save();

    // El PDF del acuerdo rechazado conserva firmas previas + anexo con el rechazo
    try {
      const buffer = await generarPdf(acuerdo);
      acuerdo.pdfGridId = await guardarEnGridFS(buffer, `acuerdo-${acuerdo._id}-rechazado.pdf`, this.conn.db);
      await acuerdo.save();
    } catch (e: any) {
      console.error('No se pudo archivar el PDF (rechazado) en GridFS:', e.message);
    }

    return this.vistaToken(acuerdo, propia);
  }

  // ===== Verificación de integridad (recomputa todos los hashes) =====
  async verificar(id: string) {
    const acuerdo = await this.acuerdos.findById(id);
    if (!acuerdo) throw new ErrorFirma(404, 'Acuerdo no encontrado');

    const contratoIntegro = hashContrato(acuerdo.datos) === acuerdo.contratoHash;
    const firmas: any[] = [];
    let cadenaIntegra = true;

    // Se verifican las firmas en el orden cronológico en que fueron registradas
    const firmadasOrdenadas = [...acuerdo.firmantes]
      .filter((f: any) => f.estado === 'firmada' && f.evidencia)
      .sort((a: any, b: any) => new Date(a.evidencia.fecha).getTime() - new Date(b.evidencia.fecha).getTime());

    for (const f of firmadasOrdenadas) {
      const docOk = f.evidencia.hashDocumento === acuerdo.contratoHash;
      const esperado = hashCadena(acuerdo.contratoHash, f.evidencia.hashAnterior, f.rol, f.evidencia.usuario?.cedula);
      const cadenaOk = esperado === f.evidencia.hashCadena;
      if (!docOk || !cadenaOk) cadenaIntegra = false;
      firmas.push({
        rol: f.rol, orden: f.orden, estado: f.estado,
        fecha: f.evidencia.fecha, ip: f.evidencia.ip, metodo: f.evidencia.metodo,
        hashDocumento: f.evidencia.hashDocumento,
        hashCadena: f.evidencia.hashCadena,
        verificada: docOk && cadenaOk,
      });
    }

    for (const f of acuerdo.firmantes.filter((f: any) => f.estado !== 'firmada' || !f.evidencia)) {
      firmas.push({ rol: f.rol, orden: f.orden, estado: f.estado, verificada: null });
    }

    return {
      id: acuerdo._id,
      estado: acuerdo.estado,
      contratoHash: acuerdo.contratoHash,
      contratoIntegro,
      cadenaIntegra,
      integro: contratoIntegro && cadenaIntegra,
      firmas,
    };
  }

  // ===== PDF (desde GridFS si está congelado; si no, se genera al vuelo) =====
  async pdfDe(id: string) {
    const acuerdo = await this.acuerdos.findById(id);
    if (!acuerdo) throw new ErrorFirma(404, 'Acuerdo no encontrado');
    if (acuerdo.pdfGridId) {
      try { return await leerDeGridFS(acuerdo.pdfGridId, this.conn.db); } catch { /* si falla, regenera */ }
    }
    return generarPdf(acuerdo);
  }

  // ===== PDF de un borrador (sin firmas): se descarga desde el formulario =====
  async pdfBorrador(tipo: string, datos: any) {
    if (!['arriendo', 'venta'].includes(tipo)) throw new ErrorFirma(400, 'Tipo de contrato inválido');
    if (!datos || typeof datos !== 'object') throw new ErrorFirma(400, 'Faltan los datos del contrato');
    return generarPdfBorrador(tipo, datos);
  }

  // ===== Obtener acuerdo más reciente de un inmueble (para visor de contrato con firmas) =====
  async obtenerPorInmueble(inmuebleId: string) {
    if (!inmuebleId) return null;
    const conds: any[] = [{ inmueble: inmuebleId }];
    if (isValidObjectId(inmuebleId)) {
      conds.push({ inmueble: new Types.ObjectId(inmuebleId) });
    }
    const acuerdo: any = await this.acuerdos
      .findOne({ $or: conds })
      .sort({ createdAt: -1 });

    if (!acuerdo) return null;

    const firmasObj: any = { codeudores: [] };
    for (const f of acuerdo.firmantes || []) {
      if (f.rol === 'codeudor') {
        firmasObj.codeudores.push(f.imagen || null);
      } else {
        firmasObj[f.rol] = f.imagen || null;
      }
    }

    return {
      id: String(acuerdo._id),
      tipo: acuerdo.tipo,
      estado: acuerdo.estado,
      datos: acuerdo.datos,
      firmantes: (acuerdo.firmantes || []).map((f: any) => ({
        rol: f.rol,
        orden: f.orden,
        estado: f.estado,
        nombre: f.nombre || f.datos?.nombre || '',
        cedula: f.cedula || f.datos?.cedula || '',
        email: f.email || f.datos?.email || '',
        imagen: f.imagen || null,
      })),
      firmas: firmasObj,
      fechaContrato: acuerdo.fechaContrato,
      cerradoEn: acuerdo.cerradoEn,
    };
  }
}
