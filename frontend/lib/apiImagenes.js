// Cliente de la sub-api de imágenes (vive en el backend NestJS, raíz /api/imagenes)
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
import { conAuth, sesionExpirada } from './auth';

// Sube un archivo de imagen. Devuelve { nombre, url, tipo } (url relativa: /archivos/...)
export async function subirImagen(file, tipo = 'casa') {
  const fd = new FormData();
  fd.append('imagen', file);
  fd.append('tipo', tipo);
  const r = await fetch(`${API}/api/imagenes/subir`, { method: 'POST', headers: conAuth(), body: fd });
  if (sesionExpirada(r)) throw new Error('Tu sesión expiró; vuelve a iniciar sesión');
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'No se pudo subir la imagen');
  return j;
}

// URL absoluta para mostrar la imagen guardada
export function urlImagen(urlRel) {
  if (!urlRel) return '';
  if (/^https?:\/\//.test(urlRel)) return urlRel;
  return `${API}${urlRel}`;
}
