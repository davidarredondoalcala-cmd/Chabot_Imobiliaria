
export const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  '305367642614-imcnroh46epfbp8cmr3bbhqu230aa0jf.apps.googleusercontent.com';

// Lista blanca de administradores: SOLO estos correos de Google pueden entrar.
// Editable aquí o con la variable de entorno ADMIN_EMAILS (separados por coma).
const ADMIN_POR_DEFECTO = [
  'macanabernal@gmail.com',
  'montoyaherreracarlosmario@gmail.com',
  'davidarredondoalcala@gmail.com',
];

export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || ADMIN_POR_DEFECTO.join(','))
  .split(',')
  .map((e) => normalizar(e))
  .filter(Boolean);

// Normaliza un correo para comparar siempre en minúsculas y sin espacios.
export function normalizar(email: string) {
  return String(email || '').trim().toLowerCase();
}

export function esAdmin(email: string) {
  return ADMIN_EMAILS.includes(normalizar(email));
}

// Duración de la sesión (7 días)
export const DIAS_SESION = 7;
