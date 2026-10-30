import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { GridFSBucket } from 'mongodb';
import * as clausulas from './clausulas';
import { FIRMA_INMOBILIARIA_DATA_URL } from './firma-inmobiliaria';

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

function fuenteRun(fuentes: any, run: any) {
  if (run?.b && run?.i) return fuentes.negritaItalica;
  if (run?.b) return fuentes.negrita;
  if (run?.i) return fuentes.italica;
  return fuentes.normal;
}

// Dibuja texto enriquecido respetando negrita, cursiva, subrayado y saltos de línea.
function dibujarRuns(doc: any, est: any, runs: any[], fuentes: any) {
  const tam = 10.5;
  const interlineado = 15;

  const fragmentos: Array<{ t: string; r: any }> = [];
  for (const run of runs) {
    if (!run) continue;
    if (run.br) { fragmentos.push({ t: '\n', r: run }); continue; }
    const texto = String(run.t || '');
    if (!texto) continue;
    for (const parte of texto.split(/(\s+)/)) {
      if (!parte) continue;
      fragmentos.push({ t: /^\s+$/.test(parte) ? ' ' : parte, r: run });
    }
  }

  let linea: Array<{ t: string; r: any }> = [];
  let ancho = 0;

  const dibujarLinea = () => {
    let x = M;
    for (const f of linea) {
      if (!f.t) continue;
      const fuente = fuenteRun(fuentes, f.r);
      est.pag.drawText(f.t, { x, y: est.y, size: tam, font: fuente, color: NEGRO });
      if (f.r.u) {
        const w = fuente.widthOfTextAtSize(f.t, tam);
        est.pag.drawLine({ start: { x, y: est.y - 2 }, end: { x: x + w, y: est.y - 2 }, thickness: 0.6, color: NEGRO });
      }
      x += fuente.widthOfTextAtSize(f.t, tam);
    }
    est.y -= interlineado;
  };

  for (const frag of fragmentos) {
    if (frag.t === '\n') {
      if (linea.length) {
        while (linea.length && !linea[linea.length - 1].t.trim()) linea.pop();
        paginar(doc, est);
        dibujarLinea();
      } else {
        paginar(doc, est);
        est.y -= interlineado;
      }
      linea = [];
      ancho = 0;
      continue;
    }

    const fuente = fuenteRun(fuentes, frag.r);
    const w = fuente.widthOfTextAtSize(frag.t, tam);
    if (ancho + w > COL && ancho > 0 && frag.t.trim()) {
      while (linea.length && !linea[linea.length - 1].t.trim()) linea.pop();
      paginar(doc, est);
      dibujarLinea();
      linea = [];
      ancho = 0;
      if (!frag.t.trim()) continue;
    }
    linea.push(frag);
    ancho += w;
  }

  if (linea.length) {
    while (linea.length && !linea[linea.length - 1].t.trim()) linea.pop();
    if (linea.length) {
      paginar(doc, est);
      dibujarLinea();
    }
  }
}

// Cuerpo del contrato: usa los runs con formato si existen; si no, texto plano.
function dibujarCuerpo(doc: any, est: any, plantilla: any, fuentes: any) {
  for (const p of plantilla.parrafos) {
    if (p.pre) {
      paginar(doc, est);
      for (const l of envolver(p.pre, fuentes.negrita, 10.5, COL)) {
        paginar(doc, est);
        est.pag.drawText(l, { x: M, y: est.y, size: 10.5, font: fuentes.negrita, color: VERDE });
        est.y -= 15;
      }
    }

    if (Array.isArray(p.runs) && p.runs.length) {
      dibujarRuns(doc, est, p.runs, fuentes);
    } else {
      for (const l of envolver(p.resto || '', fuentes.normal, 10.5, COL)) {
        paginar(doc, est);
        est.pag.drawText(l, { x: M, y: est.y, size: 10.5, font: fuentes.normal, color: NEGRO });
        est.y -= 15;
      }
    }
    est.y -= 4;
  }
}

export async function generarPdf(acuerdo: any) {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  const courier = await doc.embedFont(StandardFonts.Courier);
  const italica = await doc.embedFont(StandardFonts.HelveticaOblique);
  const negritaItalica = await doc.embedFont(StandardFonts.HelveticaBoldOblique);

  const fuentes = { normal: helv, negrita, italica, negritaItalica };
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
  dibujarCuerpo(doc, est, plantilla, fuentes);

  // ===== Bloque de firmas =====
  est.y -= 25;
  const filas: any[][] = [];
  let fila: any[] = [];
  // Codeudores que no estén ya incluidos en acuerdo.firmantes
  const nombresYaEnFirmantes = new Set((acuerdo.firmantes || []).map((f: any) => (f.nombre || f.datos?.nombre || '').trim().toLowerCase()));
  const codsRestantes = (acuerdo.tipo === 'arriendo' ? (acuerdo.datos?.cods || []).filter(Boolean) : [])
    .filter((c: string) => !nombresYaEnFirmantes.has(c.trim().toLowerCase()));
  const bloque = [...acuerdo.firmantes, ...codsRestantes.map((c: string) => ({ rol: 'Codeudor', nombre: c, sinFirma: true }))];
  for (const f of bloque) {
    fila.push(f);
    if (fila.length === 2) { filas.push(fila); fila = []; }
  }
  if (fila.length) filas.push(fila);

  const anchoCol = COL / 2 - 10;
  for (const fr of filas) {
    const tieneEvidenciaFila = fr.some((f: any) => f.evidencia);
    const altoFila = tieneEvidenciaFila ? 120 : 95;
    if (est.y - altoFila < M + 20) { est.pag = null; est.y = 0; } // fuerza página nueva si no cabe
    paginar(doc, est);

    // Dejamos 50pt de margen vertical para que la firma descanse SOBRE la línea
    const lineaY = est.y - 50;

    for (let i = 0; i < fr.length; i++) {
      const f = fr[i];
      const x = M + i * (anchoCol + 20);

      // Si es Arrendador o Vendedor y no tiene imagen de firma propia, usar la firma corporativa
      const esInmobiliaria = f.rol === 'Arrendador' || f.rol === 'Vendedor';
      const imgData = (f.imagen && f.estado === 'firmada') ? f.imagen : (esInmobiliaria ? FIRMA_INMOBILIARIA_DATA_URL : null);

      // 1. Imagen de firma descansando SOBRE la línea
      if (imgData) {
        try {
          const png = imgData.replace(/^data:image\/png;base64,/, '');
          const embebida = await doc.embedPng(Buffer.from(png, 'base64'));
          const maxW = Math.min(150, anchoCol - 20);
          const maxH = 44;
          const ratio = embebida.height / embebida.width;
          let wImg = maxW;
          let hImg = wImg * ratio;
          if (hImg > maxH) {
            hImg = maxH;
            wImg = hImg / ratio;
          }
          const imgX = x + (anchoCol - wImg) / 2;
          const imgY = lineaY + 3; // descansa 3pt exactamente sobre la línea de firma
          est.pag.drawImage(embebida, { x: imgX, y: imgY, width: wImg, height: hImg });
        } catch { /* si el PNG falla, sigue con solo el nombre */ }
      }

      // 2. Línea horizontal de firma
      est.pag.drawLine({
        start: { x: x + 10, y: lineaY },
        end: { x: x + anchoCol - 10, y: lineaY },
        thickness: 0.8,
        color: NEGRO,
      });

      // 3. Nombre centrado
      const nombre = f.datos?.nombre || f.nombre || '____________________';
      const nombreL = envolver(nombre, helv, 9.5, anchoCol - 20)[0] || nombre;
      const nomW = helv.widthOfTextAtSize(nombreL, 9.5);
      const nomX = x + Math.max(0, (anchoCol - nomW) / 2);
      est.pag.drawText(nombreL, { x: nomX, y: lineaY - 14, size: 9.5, font: helv, color: NEGRO });

      // 4. Rol centrado
      const baseRol = f.sinFirma ? f.rol : `${f.rol}${f.estado === 'firmada' ? '' : ' (pendiente)'}`;
      const rolTxt = esInmobiliaria && !baseRol.includes('Firma autorizada') ? `${baseRol} (Firma autorizada del propietario)` : baseRol;
      const rolW = italica.widthOfTextAtSize(rolTxt, 8.5);
      const rolX = x + Math.max(0, (anchoCol - rolW) / 2);
      est.pag.drawText(rolTxt, { x: rolX, y: lineaY - 25, size: 8.5, font: italica, color: GRIS });

      // 5. Cédula centrada (si existe)
      const ced = f.datos?.cedula || f.cedula;
      let curY = lineaY - 35;
      if (ced) {
        const cedTxt = `C.C. ${ced}`;
        const cedW = helv.widthOfTextAtSize(cedTxt, 8);
        const cedX = x + Math.max(0, (anchoCol - cedW) / 2);
        est.pag.drawText(cedTxt, { x: cedX, y: curY, size: 8, font: helv, color: GRIS });
        curY -= 10;
      }

      // 6. Evidencia centrada (si existe)
      if (f.evidencia) {
        const metTxt = `${METODOS[f.evidencia.metodo] || f.evidencia.metodo}`;
        const metW = italica.widthOfTextAtSize(metTxt, 7.5);
        const metX = x + Math.max(0, (anchoCol - metW) / 2);
        est.pag.drawText(metTxt, { x: metX, y: curY, size: 7.5, font: italica, color: GRIS });
        curY -= 9;

        const fecTxt = fechaBogota(f.evidencia.fecha);
        const fecW = italica.widthOfTextAtSize(fecTxt, 7.5);
        const fecX = x + Math.max(0, (anchoCol - fecW) / 2);
        est.pag.drawText(fecTxt, { x: fecX, y: curY, size: 7.5, font: italica, color: GRIS });
      }
    }
    est.y = lineaY - (tieneEvidenciaFila ? 65 : 45);
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
  const negritaItalica = await doc.embedFont(StandardFonts.HelveticaBoldOblique);

  const fuentes = { normal: helv, negrita, italica, negritaItalica };
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
  dibujarCuerpo(doc, est, plantilla, fuentes);

  // Bloque de firmas (nombres y roles, sin imagen ni evidencia)
  est.y -= 25;
  const filas: any[][] = [];
  let fila: any[] = [];
  for (const f of plantilla.firmas) {
    fila.push(f);
    if (fila.length === 2) { filas.push(fila); fila = []; }
  }
  if (fila.length) filas.push(fila);

  const anchoCol = COL / 2 - 10;
  for (const fr of filas) {
    const altoFila = 95;
    if (est.y - altoFila < M + 20) { est.pag = null; est.y = 0; }
    paginar(doc, est);

    const lineaY = est.y - 50;

    for (let i = 0; i < fr.length; i++) {
      const f = fr[i];
      const x = M + i * (anchoCol + 20);

      // Si es Arrendador o Vendedor (Inmobiliaria), estampa la firma corporativa por defecto
      const esInmobiliaria = f.rol === 'Arrendador' || f.rol === 'Vendedor';
      if (esInmobiliaria) {
        try {
          const png = FIRMA_INMOBILIARIA_DATA_URL.replace(/^data:image\/png;base64,/, '');
          const embebida = await doc.embedPng(Buffer.from(png, 'base64'));
          const maxW = Math.min(150, anchoCol - 20);
          const maxH = 44;
          const ratio = embebida.height / embebida.width;
          let wImg = maxW;
          let hImg = wImg * ratio;
          if (hImg > maxH) {
            hImg = maxH;
            wImg = hImg / ratio;
          }
          const imgX = x + (anchoCol - wImg) / 2;
          const imgY = lineaY + 3; // descansa 3pt exactamente sobre la línea de firma
          est.pag.drawImage(embebida, { x: imgX, y: imgY, width: wImg, height: hImg });
        } catch { /* continuar si no carga */ }
      }

      est.pag.drawLine({
        start: { x: x + 10, y: lineaY },
        end: { x: x + anchoCol - 10, y: lineaY },
        thickness: 0.8,
        color: NEGRO,
      });

      const nombre = f.nombre || '____________________';
      const nombreL = envolver(nombre, helv, 9.5, anchoCol - 20)[0] || nombre;
      const nomW = helv.widthOfTextAtSize(nombreL, 9.5);
      const nomX = x + Math.max(0, (anchoCol - nomW) / 2);
      est.pag.drawText(nombreL, { x: nomX, y: lineaY - 14, size: 9.5, font: helv, color: NEGRO });

      const rolTxt = esInmobiliaria ? `${f.rol} (Firma autorizada del propietario)` : String(f.rol || '');
      const rolW = italica.widthOfTextAtSize(rolTxt, 8.5);
      const rolX = x + Math.max(0, (anchoCol - rolW) / 2);
      est.pag.drawText(rolTxt, { x: rolX, y: lineaY - 25, size: 8.5, font: italica, color: GRIS });

      const ced = f.cedula;
      if (ced) {
        const cedTxt = `C.C. ${ced}`;
        const cedW = helv.widthOfTextAtSize(cedTxt, 8);
        const cedX = x + Math.max(0, (anchoCol - cedW) / 2);
        est.pag.drawText(cedTxt, { x: cedX, y: lineaY - 35, size: 8, font: helv, color: GRIS });
      }
    }
    est.y = lineaY - 45;
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
