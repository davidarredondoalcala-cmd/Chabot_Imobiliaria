const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const CLAVE = 'habitat_sesion';
const CLAVE_GOOGLE = 'habitat_google_client_id';

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '305367642614-imcnroh46epfbp8cmr3bbhqu230aa0jf.apps.googleusercontent.com';

export function getSesion() {
  if (typeof window === 'undefined') return null;
  try { return JSON.parse(localStorage.getItem(CLAVE) || 'null'); } catch { return null; }
}

export function getToken() {
  return getSesion()?.token || '';
}

export function guardarSesion(sesion) {
  try { localStorage.setItem(CLAVE, JSON.stringify(sesion)); } catch { /* almacenamiento no disponible */ }
  window.dispatchEvent(new Event('habitat-sesion'));
}

export function limpiarSesion() {
  try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
  window.dispatchEvent(new Event('habitat-sesion'));
}


export function conAuth(extra = {}) {
  const token = getToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

export function sesionExpirada(r) {
  if (r && r.status === 401) {
    limpiarSesion();
    return true;
  }
  return false;
}


export async function loginGoogle(credential) {
  let r;
  try {
    r = await fetch(`${API}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Intenta de nuevo en unos segundos.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'No se pudo iniciar sesión');
  guardarSesion(j);
  return j;
}

export async function salir() {
  try {
    await fetch(`${API}/api/auth/salir`, { method: 'POST', headers: conAuth() });
  } catch { /* si falla la red, igual cerramos localmente */ }
  limpiarSesion();
}

export async function yo() {
  const r = await fetch(`${API}/api/auth/me`, { headers: conAuth(), cache: 'no-store' });
  if (sesionExpirada(r)) return null;
  if (!r.ok) throw new Error('El servidor no respondió');
  const j = await r.json().catch(() => ({}));

  if (!j.usuario) { limpiarSesion(); return null; }
  return j.usuario;
}


let promesaGoogle = null;
export function cargarGoogle(scriptId = 'gsi-client') {
  if (typeof document === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (promesaGoogle) return promesaGoogle;

  promesaGoogle = new Promise((resolve, reject) => {
    let s = document.getElementById(scriptId);
    const fallo = () => {
      promesaGoogle = null; // permite reintentar
      s?.remove();
      reject(new Error('No se pudo cargar Google'));
    };
    if (!s) {
      s = document.createElement('script');
      s.id = scriptId;
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    s.addEventListener('load', resolve, { once: true });
    s.addEventListener('error', fallo, { once: true });
    setTimeout(() => { if (!window.google?.accounts?.id) fallo(); }, 15000);
  });
  return promesaGoogle;
}