import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { NOMBRE_ACUERDO } from './model';
import { hashContrato, hashCadena, generarToken, ipDe, tokenSeguro } from './hash';
import { generarPdf, generarPdfBorrador, guardarEnGridFS, leerDeGridFS } from './pdf';
import { ErrorFirma } from './errores';
import { InmueblesService } from '../inmuebles/inmuebles.service';

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
  ) {}

  // ===== Crear acuerdo: genera los 3 tokens y el hash del contrato =====
  async crearAcuerdo({ inmueble, tipo, datos, firmantes }: any) {
    if (!['arriendo', 'venta'].includes(tipo)) throw new ErrorFirma(400, 'Tipo de contrato inválido');
    if (!datos || typeof datos !== 'object') throw new ErrorFirma(400, 'Faltan los datos del contrato');

    // Las dos partes del contrato firman primero; en arriendo, cada codeudor firma después (solo si existe)
    const maxFirmantes = tipo === 'arriendo' ? 12 : 2;
    if (!Array.isArray(firmantes) || firmantes.length < 2 || firmantes.length > maxFirmantes) {
      throw new ErrorFirma(400, 'Se requieren las dos partes del contrato (y los codeudores solo en arriendo)');
    }

    const conOrden = firmantes.map((f: any, i: number) => {
      if (!f.rol || typeof f.rol !== 'string') throw new ErrorFirma(400, 'Cada firmante necesita un rol');
      if (i >= 2 && f.rol !== 'codeudor') throw new ErrorFirma(400, 'Después de las dos partes solo pueden firmar codeudores');
      return {
        rol: f.rol,
        orden: i + 1,
        estado: 'pendiente',
        token: generarToken(),
        nombre: f.nombre || '',
        datos: null,
        imagen: null,
        evidencia: null,
      };
    });

    // El snapshot congela la fecha del contrato: pantalla, PDF y hash coinciden siempre
    const snapshot = { ...datos, fecha: datos.fecha || fechaTexto() };
    const acuerdo = await this.acuerdos.create({
      inmueble: inmueble || undefined,
      tipo,
      datos: snapshot,
      fechaContrato: snapshot.fecha,
      contratoHash: hashContrato(snapshot),
      firmantes: conOrden,
    });

    return this.pactoPublico(acuerdo);
  }

  // Vista "pública" del acuerdo: sin tokens ni imágenes, con los links por separado
  private pactoPublico(acuerdo: any) {
    const links = acuerdo.firmantes.map((f: any) => ({
      rol: f.rol,
      orden: f.orden,
      nombre: f.nombre || '',
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
        imagen: f.imagen || null, // solo visible una vez firmada
        evidencia: f.estado === 'firmada' ? {
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

  // ===== Firmar: valida el TURNO en servidor, registra evidencia y encadena hashes =====
  async firmar(token: string, { datos, metodo, imagen, condiciones, req }: any) {
    const acuerdo: any = await this.acuerdos.findOne({ 'firmantes.token': token });
    const propia = buscarPorToken(acuerdo, token);
    if (!acuerdo || !propia) throw new ErrorFirma(404, 'Enlace inválido o expirado');

    if (acuerdo.estado === 'firmado') throw new ErrorFirma(409, 'El acuerdo ya está cerrado; las firmas quedaron bloqueadas');
    if (acuerdo.estado === 'rechazado') throw new ErrorFirma(409, 'El acuerdo fue rechazado y no puede firmarse');
    if (propia.estado !== 'pendiente') throw new ErrorFirma(409, 'Tu firma ya fue registrada');

    const turno = acuerdo.firmantes.find((f: any) => f.estado === 'pendiente');
    if (!turno || turno.orden !== propia.orden) {
      throw new ErrorFirma(409, `Ahora le corresponde firmar a: ${turno?.rol || '—'}`);
    }

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
    const anterior = [...acuerdo.firmantes]
      .filter((f: any) => f.estado === 'firmada' && f.evidencia)
      .sort((a: any, b: any) => a.orden - b.orden)
      .pop();
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

    // ¿Cerramos el acuerdo? (cuando ya no quedan firmas pendientes)
    const quedan = acuerdo.firmantes.filter((f: any) => f.estado === 'pendiente');
    if (quedan.length === 0) {
      acuerdo.estado = 'firmado';
      acuerdo.cerradoEn = new Date();
      await acuerdo.save();
      await this.marcarInmueble(acuerdo);
      // Congela el PDF final en GridFS
      try {
        const buffer = await generarPdf(acuerdo);
        acuerdo.pdfGridId = await guardarEnGridFS(buffer, `acuerdo-${acuerdo._id}.pdf`, this.conn.db);
        await acuerdo.save();
      } catch (e: any) {
        console.error('No se pudo archivar el PDF en GridFS:', e.message);
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
    try {
      await this.inmuebles.crearContrato(String(acuerdo.inmueble), {
        modo: acuerdo.tipo,
        firmantes: acuerdo.firmantes.map((f: any) => f.datos?.nombre || f.nombre),
        dur: d.dur, dia: d.dia, val: d.val, dir: d.dir, bar: d.bar, lin: d.lin,
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
    let anterior: string | null = null;
    const firmas: any[] = [];
    let cadenaIntegra = true;

    for (const f of [...acuerdo.firmantes].sort((a: any, b: any) => a.orden - b.orden)) {
      if (f.estado !== 'firmada' || !f.evidencia) {
        firmas.push({ rol: f.rol, orden: f.orden, estado: f.estado, verificada: null });
        continue;
      }
      const docOk = f.evidencia.hashDocumento === acuerdo.contratoHash;
      const esperado = hashCadena(acuerdo.contratoHash, anterior, f.rol, f.evidencia.usuario?.cedula);
      const cadenaOk = esperado === f.evidencia.hashCadena;
      if (!docOk || !cadenaOk) cadenaIntegra = false;
      anterior = f.evidencia.hashCadena;
      firmas.push({
        rol: f.rol, orden: f.orden, estado: f.estado,
        fecha: f.evidencia.fecha, ip: f.evidencia.ip, metodo: f.evidencia.metodo,
        hashDocumento: f.evidencia.hashDocumento,
        hashCadena: f.evidencia.hashCadena,
        verificada: docOk && cadenaOk,
      });
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
}
