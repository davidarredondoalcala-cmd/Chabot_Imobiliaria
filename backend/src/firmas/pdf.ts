import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { GridFSBucket } from 'mongodb';
import * as clausulas from './clausulas';

const A4 = { w: 595.28, h: 841.89 };
const M = 50; // margen
const COL = A4.w - M * 2; // ancho útil
const NEGRO = rgb(0.13, 0.13, 0.13);
const VERDE = rgb(0.06, 0.30, 0.26);
const GRIS = rgb(0.4, 0.4, 0.4);

const METODOS: any = { tipografica: 'Tipográfica (teclado)', canvas: 'A pulso (canvas)', imagen: 'Imagen subida' };

// pdf-lib no envuelve texto: word-wrap manual con medición de fuente
function envolver(texto: any, fuente: any, tam: number, anchoMax: number) {
  const palabras = String(texto).split(/\s+/);
  const lineas: string[] = [];
  let actual = '';
  for (const p of palabras) {
    const cand = actual ? actual + ' ' + p : p;
    if (fuente.widthOfTextAtSize(cand, tam) <= anchoMax) actual = cand;
    else { if (actual) lineas.push(actual); actual = p; }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function fechaBogota(date: any) {
  return new Date(date).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

// Estado del dibujo de página (página actual + posición Y)
function paginar(doc: any, estado: any) {
  if (!estado.pag || estado.y < M + 40) {
    estado.pag = doc.addPage([A4.w, A4.h]);
    estado.y = A4.h - M;
  }
  return estado.pag;
}

export async function generarPdf(acuerdo: any) {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const courier = await doc.embedFont(StandardFonts.Courier);
  const italica = await doc.embedFont(StandardFonts.HelveticaOblique);

  const est = { pag: null as any, y: 0 };
  const plantilla = clausulas.construir(acuerdo.tipo, { ...acuerdo.datos, fecha: acuerdo.fechaContrato });

  // ===== Membrete =====
  paginar(doc, est);
  const memT = 'HABITAT CAPITAL';
  const memSub = 'Gestión inmobiliaria y contratos electrónicos';
  est.pag.drawText(memT, { x: M, y: est.y, size: 15, font: negrita, color: VERDE });
  const ref = `Documento generado electrónicamente - Ref. ${acuerdo._id}`;
  est.pag.drawText(ref, { x: A4.w - M - negrita.widthOfTextAtSize(ref, 7.5), y: est.y + 1, size: 7.5, font: negrita, color: GRIS });
  est.y -= 13;
  est.pag.drawText(memSub, { x: M, y: est.y, size: 8.5, font: italica, color: GRIS });
  est.y -= 8;
  // reglas dobles del membrete
  est.pag.drawLine({ start: { x: M, y: est.y }, end: { x: A4.w - M, y: est.y }, thickness: 1.4, color: VERDE });
  est.y -= 3;
  est.pag.drawLine({ start: { x: M, y: est.y }, end: { x: A4.w - M, y: est.y }, thickness: 0.5, color: GRIS });
  est.y -= 34;

  // ===== Título =====
  const t = plantilla.titulo;
  est.pag.drawText(t, { x: (A4.w - negrita.widthOfTextAtSize(t, 13)) / 2, y: est.y, size: 13, font: negrita, color: VERDE });
  est.y -= 14;
  est.pag.drawLine({ start: { x: M + 40, y: est.y }, end: { x: A4.w - M - 40, y: est.y }, thickness: 0.6, color: GRIS });
  est.y -= 24;

  // ===== Cuerpo del contrato =====
  for (const p of plantilla.parrafos) {
    if (p.pre) {
      paginar(doc, est);
      const lineasPre = envolver(p.pre, negrita, 10.5, COL);
      for (const l of lineasPre) {
        paginar(doc, est);
        est.pag.drawText(l, { x: M, y: est.y, size: 10.5, font: negrita, color: VERDE });
        est.y -= 15;
      }
      // el resto del párrafo va en la misma línea visual cuando es corto
      const lineas = envolver(p.resto, helv, 10.5, COL);
      for (const l of lineas) {
        paginar(doc, est);
        est.pag.drawText(l, { x: M, y: est.y, size: 10.5, font: helv, color: NEGRO });
        est.y -= 15;
      }
    } else {
      for (const l of envolver(p.resto, helv, 10.5, COL)) {
        paginar(doc, est);
        est.pag.drawText(l, { x: M, y: est.y, size: 10.5, font: helv, color: NEGRO });
        est.y -= 15;
      }
    }
    est.y -= 4;
  }

  // ===== Bloque de firmas =====
  est.y -= 30;
  const filas: any[][] = [];
  let fila: any[] = [];
  // Arriendo: tras arrendador y arrendatario aparecen los codeudores (si los hay); no firman por enlace
  const cods = acuerdo.tipo === 'arriendo' ? (acuerdo.datos?.cods || []).filter(Boolean) : [];
  const bloque = [...acuerdo.firmantes, ...cods.map((c: string) => ({ rol: 'Codeudor', nombre: c, sinFirma: true }))];
  for (const f of bloque) {
    fila.push(f);
    if (fila.length === 2) { filas.push(fila); fila = []; }
  }
  if (fila.length) filas.push(fila);

  const anchoCol = COL / 2 - 10;
  for (const fr of filas) {
    if (est.y < 140) { est.pag = null; est.y = 0; } // fuerza página nueva
    paginar(doc, est);
    for (let i = 0; i < fr.length; i++) {
      const f = fr[i];
      const x = M + i * (anchoCol + 20);
      // imagen de firma (PNG con fondo transparente, 600x240)
      if (f.imagen && f.estado === 'firmada') {
        try {
          const png = f.imagen.replace(/^data:image\/png;base64,/, '');
          const embebida = await doc.embedPng(Buffer.from(png, 'base64'));
          const wImg = 140;
          const hImg = wImg * (embebida.height / embebida.width);
          est.pag.drawImage(embebida, { x: x + (anchoCol - wImg) / 2, y: est.y - hImg + 16, width: wImg, height: hImg });
        } catch { /* si el PNG falla, sigue con solo el nombre */ }
      }
      // línea de firma
      est.pag.drawLine({ start: { x, y: est.y }, end: { x: x + anchoCol, y: est.y }, thickness: 1, color: NEGRO });
      const nombre = f.datos?.nombre || f.nombre || '____________________';
      const nombreL = envolver(nombre, helv, 9.5, anchoCol)[0] || nombre;
      est.pag.drawText(nombreL, { x, y: est.y - 14, size: 9.5, font: helv, color: NEGRO });
      const rolTxt = f.sinFirma ? f.rol : `${f.rol}${f.estado === 'firmada' ? '' : ' (pendiente)'}`;
      est.pag.drawText(rolTxt, { x, y: est.y - 26, size: 8.5, font: italica, color: GRIS });
      if (f.evidencia) {
        est.pag.drawText(`${METODOS[f.evidencia.metodo] || f.evidencia.metodo}`, { x, y: est.y - 38, size: 7.5, font: italica, color: GRIS });
        est.pag.drawText(fechaBogota(f.evidencia.fecha), { x, y: est.y - 48, size: 7.5, font: italica, color: GRIS });
      }
    }
    est.y -= 70;
  }

  // ===== Anexo de evidencia (solo con al menos una firma) =====
  const firmadas = acuerdo.firmantes.filter((f: any) => f.evidencia);
  if (firmadas.length) {
    est.pag = doc.addPage([A4.w, A4.h]);
    est.y = A4.h - M;

    const tAnexo = 'ANEXO – EVIDENCIA DE FIRMAS ELECTRÓNICAS';
    est.pag.drawText(tAnexo, { x: (A4.w - negrita.widthOfTextAtSize(tAnexo, 11)) / 2, y: est.y, size: 11, font: negrita, color: VERDE });
    est.y -= 24;

    const nota = 'Documento extendido conforme a la Ley 527 de 1999 (mensajes de datos) y al Decreto 878 de 2014. Cada firma electrónica quedó asociada a la identidad del firmante, el método empleado, la fecha y hora (hora de Bogotá, UTC-5), la dirección IP desde la que se emitió y la huella SHA-256 del contrato al momento de firmar. Las huellas se encuentran encadenadas: la alteración de cualquier firma invalida las huellas posteriores. Integridad verificable contra el hash del contrato indicado.';
    for (const l of envolver(nota, helv, 8.5, COL)) {
      paginar(doc, est);
      est.pag.drawText(l, { x: M, y: est.y, size: 8.5, font: helv, color: NEGRO });
      est.y -= 12;
    }
    est.y -= 8;

    // Hash del contrato
    paginar(doc, est);
    est.pag.drawText('Hash del contrato (SHA-256):', { x: M, y: est.y, size: 8.5, font: negrita, color: NEGRO });
    est.y -= 12;
    const h = acuerdo.contratoHash || '';
    for (let i = 0; i < h.length; i += 64) {
      paginar(doc, est);
      est.pag.drawText(h.slice(i, i + 64), { x: M + 8, y: est.y, size: 8, font: courier, color: NEGRO });
      est.y -= 11;
    }
    est.y -= 10;

    // Tabla compacta por firmante
    const cols = [
      { t: 'Rol', w: 58 }, { t: 'Nombre', w: 92 }, { t: 'Cédula', w: 62 },
      { t: 'Método', w: 78 }, { t: 'Fecha y hora (Bogotá)', w: 108 }, { t: 'IP', w: 70 },
    ];
    paginar(doc, est);
    cols.forEach((c, i) => {
      const x = M + cols.slice(0, i).reduce((a, b) => a + b.w, 0);
      est.pag.drawText(c.t, { x, y: est.y, size: 7.5, font: negrita, color: VERDE });
    });
    est.y -= 4;
    est.pag.drawLine({ start: { x: M, y: est.y }, end: { x: M + COL, y: est.y }, thickness: 0.8, color: GRIS });
    est.y -= 14;

    for (const f of firmadas) {
      const ev = f.evidencia;
      const celdas = [
        f.rol, ev.usuario?.nombre || '', ev.usuario?.cedula || '',
        METODOS[ev.metodo] || ev.metodo, fechaBogota(ev.fecha), ev.ip || '',
      ];
      paginar(doc, est);
      celdas.forEach((c, i) => {
        const x = M + cols.slice(0, i).reduce((a, b) => a + b.w, 0);
        const txt = envolver(c, helv, 7, cols[i].w - 4)[0] || '';
        est.pag.drawText(txt, { x, y: est.y, size: 7, font: helv, color: NEGRO });
      });
      est.y -= 12;
      // Huellas SHA-256 en courier debajo de cada fila
      const huellas = [
        `Hash documento: ${ev.hashDocumento}`,
        `Hash cadena:    ${ev.hashCadena}${ev.hashAnterior ? `   (anterior: ${ev.hashAnterior.slice(0, 16)}...)` : ''}`,
      ];
      for (const lin of huellas) {
        paginar(doc, est);
        est.pag.drawText(lin, { x: M + 10, y: est.y, size: 7, font: courier, color: GRIS });
        est.y -= 10;
      }
      est.y -= 4;
    }

    // Rechazo si existe
    const rech = acuerdo.firmantes.find((f: any) => f.rechazo);
    if (rech) {
      est.y -= 6;
      paginar(doc, est);
      const tR = `RECHAZO POR ${rech.rol.toUpperCase()}`;
      est.pag.drawText(tR, { x: M, y: est.y, size: 9, font: negrita, color: rgb(0.79, 0.16, 0.16) });
      est.y -= 14;
      for (const l of envolver(`Observaciones: ${rech.rechazo.observaciones} — ${fechaBogota(rech.rechazo.fecha)} (IP ${rech.rechazo.ip || 'n/d'})`, helv, 8.5, COL)) {
        paginar(doc, est);
        est.pag.drawText(l, { x: M, y: est.y, size: 8.5, font: helv, color: NEGRO });
        est.y -= 12;
      }
    }

    // Pie
    est.y -= 10;
    paginar(doc, est);
    est.pag.drawText(`Acuerdo ${acuerdo._id} — estado: ${acuerdo.estado} — generado ${fechaBogota(new Date())}`, { x: M, y: est.y, size: 7, font: italica, color: GRIS });
  }

  return Buffer.from(await doc.save());
}

// ===== PDF de un contrato en BORRADOR (sin firmas): se genera al vuelo para descargar =====
export async function generarPdfBorrador(tipo: string, datos: any) {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const italica = await doc.embedFont(StandardFonts.HelveticaOblique);

  const fecha = datos?.fecha || new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  const plantilla = clausulas.construir(tipo, { ...datos, fecha });

  const est = { pag: null as any, y: 0 };

  // Membrete
  paginar(doc, est);
  est.pag.drawText('HABITAT CAPITAL', { x: M, y: est.y, size: 15, font: negrita, color: VERDE });
  const ref = 'Borrador — sin firmas';
  est.pag.drawText(ref, { x: A4.w - M - negrita.widthOfTextAtSize(ref, 7.5), y: est.y + 1, size: 7.5, font: negrita, color: GRIS });
  est.y -= 13;
  est.pag.drawText('Gestión inmobiliaria y contratos electrónicos', { x: M, y: est.y, size: 8.5, font: italica, color: GRIS });
  est.y -= 8;
  est.pag.drawLine({ start: { x: M, y: est.y }, end: { x: A4.w - M, y: est.y }, thickness: 1.4, color: VERDE });
  est.y -= 3;
  est.pag.drawLine({ start: { x: M, y: est.y }, end: { x: A4.w - M, y: est.y }, thickness: 0.5, color: GRIS });
  est.y -= 34;

  // Título
  const t = plantilla.titulo;
  est.pag.drawText(t, { x: (A4.w - negrita.widthOfTextAtSize(t, 13)) / 2, y: est.y, size: 13, font: negrita, color: VERDE });
  est.y -= 14;
  est.pag.drawLine({ start: { x: M + 40, y: est.y }, end: { x: A4.w - M - 40, y: est.y }, thickness: 0.6, color: GRIS });
  est.y -= 24;

  // Cuerpo
  for (const p of plantilla.parrafos) {
    if (p.pre) {
      paginar(doc, est);
      for (const l of envolver(p.pre, negrita, 10.5, COL)) {
        paginar(doc, est);
        est.pag.drawText(l, { x: M, y: est.y, size: 10.5, font: negrita, color: VERDE });
        est.y -= 15;
      }
      for (const l of envolver(p.resto, helv, 10.5, COL)) {
        paginar(doc, est);
        est.pag.drawText(l, { x: M, y: est.y, size: 10.5, font: helv, color: NEGRO });
        est.y -= 15;
      }
    } else {
      for (const l of envolver(p.resto, helv, 10.5, COL)) {
        paginar(doc, est);
        est.pag.drawText(l, { x: M, y: est.y, size: 10.5, font: helv, color: NEGRO });
        est.y -= 15;
      }
    }
    est.y -= 4;
  }

  // Bloque de firmas (nombres y roles, sin imagen ni evidencia)
  est.y -= 30;
  const filas: any[][] = [];
  let fila: any[] = [];
  for (const f of plantilla.firmas) {
    fila.push(f);
    if (fila.length === 2) { filas.push(fila); fila = []; }
  }
  if (fila.length) filas.push(fila);

  const anchoCol = COL / 2 - 10;
  for (const fr of filas) {
    if (est.y < 140) { est.pag = null; est.y = 0; }
    paginar(doc, est);
    for (let i = 0; i < fr.length; i++) {
      const f = fr[i];
      const x = M + i * (anchoCol + 20);
      est.pag.drawLine({ start: { x, y: est.y }, end: { x: x + anchoCol, y: est.y }, thickness: 1, color: NEGRO });
      const nombre = f.nombre || '____________________';
      const nombreL = envolver(nombre, helv, 9.5, anchoCol)[0] || nombre;
      est.pag.drawText(nombreL, { x, y: est.y - 14, size: 9.5, font: helv, color: NEGRO });
      est.pag.drawText(String(f.rol || ''), { x, y: est.y - 26, size: 8.5, font: italica, color: GRIS });
    }
    est.y -= 70;
  }

  return Buffer.from(await doc.save());
}

// ===== GridFS: el PDF final se congela al cerrar el acuerdo =====
export async function guardarEnGridFS(buffer: Buffer, nombre: string, db: any) {
  const bucket = new GridFSBucket(db, { bucketName: 'pdfs' });
  const stream = bucket.openUploadStream(nombre);
  await new Promise<void>((res, rej) => {
    stream.on('finish', () => res());
    stream.on('error', rej);
    stream.end(buffer);
  });
  return stream.id;
}

export async function leerDeGridFS(id: any, db: any) {
  const bucket = new GridFSBucket(db, { bucketName: 'pdfs' });
  const stream = bucket.openDownloadStream(id);
  const chunks: Buffer[] = [];
  await new Promise<void>((res, rej) => {
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => res());
    stream.on('error', rej);
  });
  return Buffer.concat(chunks);
}
