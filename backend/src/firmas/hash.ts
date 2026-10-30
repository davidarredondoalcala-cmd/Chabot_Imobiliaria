import crypto from 'crypto';

// JSON canónico: mismo objeto => mismo string, con claves ordenadas recursivamente.
// Base del hash del contrato para que la verificación sea determinista.
export function canonico(valor: any): any {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (valor && typeof valor === 'object') {
    return Object.keys(valor).sort().reduce((acc: any, k) => {
      acc[k] = canonico(valor[k]);
      return acc;
    }, {});
  }
  return valor;
}

export function sha256(texto: string) {
  return crypto.createHash('sha256').update(texto, 'utf8').digest('hex');
}

// Hash del contrato completo en el momento de crear el acuerdo
export function hashContrato(datos: any) {
  return sha256(JSON.stringify(canonico(datos)));
}

// Cadena de integridad encadenada:
// cada firma incluye el hash de la anterior; alterar una rompe toda la cadena posterior.
export function hashCadena(hashDocumento: string, hashAnterior: string | null, rol: string, cedula?: string) {
  return sha256(`${hashDocumento}|${hashAnterior || ''}|${rol}|${cedula || ''}`);
}

// Token único e intransferible por firmante (32 bytes aleatorios, URL-safe)
export function generarToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// IP real detrás del proxy (Render entrega X-Forwarded-For)
export function ipDe(req: any) {
  const xff = req?.headers?.['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req?.socket?.remoteAddress || req?.connection?.remoteAddress || 'desconocida';
}

// Comparación sin fugas de timing para tokens
export function tokenSeguro(a: any, b: any) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}
