// Cliente HTTP del módulo de firmas (vive en el backend NestJS, raíz /api/firmas).
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
import { conAuth, getToken, sesionExpirada } from './auth';

async function j(r) {
  sesionExpirada(r);
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || 'Error en la API de firmas');
  }
  return r.json();
}

// Administrativo: requiere sesión.
export async function crearAcuerdo(datos) {
  const r = await fetch(`${API}/api/firmas/acuerdos`, {
    method: 'POST', headers: conAuth({ 'Content-Type': 'application/json' }), body: JSON.stringify(datos),
  });
  return j(r);
}

// Administrativo: estado del acuerdo (para saber cuándo se completó la firma).
export async function obtenerAcuerdo(id) {
  const r = await fetch(`${API}/api/firmas/acuerdos/${id}`, { cache: 'no-store', headers: conAuth() });
  return j(r);
}

// Público: el firmante externo abre su enlace sin sesión.
export async function porToken(token) {
  const r = await fetch(`${API}/api/firmas/t/${token}`, { cache: 'no-store' });
  return j(r);
}

// Público: firma por enlace privado.
export async function firmar(token, cuerpo) {
  const r = await fetch(`${API}/api/firmas/t/${token}/firmar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  });
  return j(r);
}

// Público: rechazo por enlace privado (rol administrador dentro del acuerdo).
export async function rechazar(token, observaciones) {
  const r = await fetch(`${API}/api/firmas/t/${token}/rechazar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ observaciones }),
  });
  return j(r);
}

// Administrativo: requiere sesión.
export async function verificar(id) {
  const r = await fetch(`${API}/api/firmas/acuerdos/${id}/verificar`, { cache: 'no-store', headers: conAuth() });
  return j(r);
}

// El PDF del acuerdo se descarga desde un <a href>. Se adjunta como ?token= la
// sesión del administrador si existe; si no, el token del firmante (página pública
// /firma/[token]), que el backend también acepta.
export const urlPdf = (id, tokenFirmante) => {
  const t = getToken() || tokenFirmante;
  return `${API}/api/firmas/acuerdos/${id}/pdf${t ? `?token=${encodeURIComponent(t)}` : ''}`;
};

// Descarga el PDF final con fetch + blob: así se manda la sesión por cabecera,
// el firmante se identifica con su ?token= y cualquier error llega como mensaje.
export async function descargarPdfFinal(id, tokenFirmante) {
  const q = tokenFirmante ? `?token=${encodeURIComponent(tokenFirmante)}` : '';
  const r = await fetch(`${API}/api/firmas/acuerdos/${id}/pdf${q}`, { headers: conAuth(), cache: 'no-store' });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || 'No se pudo descargar el PDF firmado');
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contrato-firmado-${id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Administrativo: descarga directa del PDF del contrato en borrador (sin firmas).
// Hace POST con la sesión y dispara la descarga del archivo recibido.
export async function descargarPdfBorrador(tipo, datos) {
  const r = await fetch(`${API}/api/firmas/borrador/pdf`, {
    method: 'POST',
    headers: conAuth({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ tipo, datos }),
  });
  sesionExpirada(r);
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || 'No se pudo generar el PDF');
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `borrador-${tipo}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
