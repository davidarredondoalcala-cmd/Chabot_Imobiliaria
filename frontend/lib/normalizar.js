// Normalización de firmas: los 3 métodos producen el MISMO formato final
// (PNG 600x240, fondo transparente, contenido recortado y centrado con 16px de aire).

export const ANCHO = 600;
export const ALTO = 240;
const PAD = 16;

export function cargarImagen(src) {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error('No se pudo leer la imagen'));
    img.src = src;
  });
}

// Recorta los márgenes transparentes, escala al formato y centra.
// Acepta un <canvas> o un dataURL. Devuelve dataURL PNG 600x240.
export async function normalizar(origen) {
  const img = typeof origen === 'string' ? await cargarImagen(origen) : origen;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('La firma está vacía');

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  const { data } = ctx.getImageData(0, 0, w, h);
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('La firma está vacía');

  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const esc = Math.min((ANCHO - PAD * 2) / cw, (ALTO - PAD * 2) / ch);
  const dw = Math.round(cw * esc);
  const dh = Math.round(ch * esc);

  const out = document.createElement('canvas');
  out.width = ANCHO;
  out.height = ALTO;
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(c, minX, minY, cw, ch, Math.round((ANCHO - dw) / 2), Math.round((ALTO - dh) / 2), dw, dh);
  return out.toDataURL('image/png');
}

// Quita el fondo aclaro de una firma fotografiada (relleno por inundación
// desde los bordes: solo se borra lo que toca el borde, no los blancos internos).
export function quitarFondo(canvas, umbral = 210) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const visitado = new Uint8Array(w * h);
  const cola = [];

  const esFondo = (i) => {
    const o = i * 4;
    const lum = 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
    return d[o + 3] > 0 && lum >= umbral;
  };

  for (let x = 0; x < w; x++) { cola.push(x); cola.push(x + (h - 1) * w); }
  for (let y = 0; y < h; y++) { cola.push(y * w); cola.push(y * w + w - 1); }

  while (cola.length) {
    const i = cola.pop();
    if (i < 0 || i >= w * h || visitado[i]) continue;
    visitado[i] = 1;
    if (!esFondo(i)) continue;
    d[i * 4 + 3] = 0;
    cola.push(i - 1, i + 1, i - w, i + w);
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}
