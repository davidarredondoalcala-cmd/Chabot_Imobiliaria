// URL del backend NestJS (en Vercel se define NEXT_PUBLIC_API_URL)
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
import { conAuth, sesionExpirada } from './auth';

export async function getInmuebles() {
  const r = await fetch(`${API}/inmuebles`, { cache: 'no-store', headers: conAuth() });
  if (sesionExpirada(r)) throw new Error('Tu sesión expiró; vuelve a iniciar sesión');
  if (!r.ok) throw new Error('Error al cargar inmuebles');
  return r.json();
}

export async function crearContrato(id, datos) {
  const r = await fetch(`${API}/inmuebles/${id}/contratos`, {
    method: 'POST', headers: conAuth({ 'Content-Type': 'application/json' }), body: JSON.stringify(datos),
  });
  if (sesionExpirada(r)) throw new Error('Tu sesión expiró; vuelve a iniciar sesión');
  if (!r.ok) throw new Error('Error al guardar el contrato');
  return r.json();
}

export async function crearInmueble(datos) {
  const r = await fetch(`${API}/inmuebles`, {
    method: 'POST', headers: conAuth({ 'Content-Type': 'application/json' }), body: JSON.stringify(datos),
  });
  if (sesionExpirada(r)) throw new Error('Tu sesión expiró; vuelve a iniciar sesión');
  if (!r.ok) throw new Error('Error al guardar el inmueble');
  return r.json();
}

export async function setFotoInmueble(id, foto) {
  const r = await fetch(`${API}/inmuebles/${id}/foto`, {
    method: 'POST', headers: conAuth({ 'Content-Type': 'application/json' }), body: JSON.stringify({ foto }),
  });
  if (sesionExpirada(r)) throw new Error('Tu sesión expiró; vuelve a iniciar sesión');
  if (!r.ok) throw new Error('Error al guardar la foto');
  return r.json();
}
