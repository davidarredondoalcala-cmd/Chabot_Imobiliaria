// Filtros de entrada y validaciones de lógica de negocio para Habitat Capital.
// Garantiza la seriedad, consistencia y robustez de los datos en toda la aplicación.

/**
 * Filtra el texto para aceptar únicamente dígitos numéricos (0-9).
 * Limita la longitud máxima a `maxLen`.
 */
export function soloNumeros(val, maxLen = 10) {
  if (!val) return '';
  return String(val).replace(/\D/g, '').slice(0, maxLen);
}

/**
 * Filtra el texto para aceptar solo letras (con tildes castellanas), espacios y puntos.
 * No permite números ni caracteres especiales extraños.
 */
export function soloLetras(val, maxLen = 60) {
  if (!val) return '';
  return String(val)
    .replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s\.]/g, '')
    .slice(0, maxLen);
}

/**
 * Limpia y normaliza un correo electrónico: sin espacios y en minúsculas.
 */
export function limpiarEmail(val, maxLen = 80) {
  if (!val) return '';
  return String(val).replace(/\s/g, '').toLowerCase().slice(0, maxLen);
}

/**
 * Filtra direcciones urbanas permitiendo abreviaturas, números, numeral (#) y guiones (-).
 */
export function limpiarDireccion(val, maxLen = 80) {
  if (!val) return '';
  return String(val)
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s#\-\.,]/g, '')
    .slice(0, maxLen);
}

/**
 * Limpia texto general alfanumérico seguro recortado a longitud máxima.
 */
export function limpiarTexto(val, maxLen = 100) {
  if (!val) return '';
  return String(val).slice(0, maxLen);
}

/**
 * Valida si una cédula de ciudadanía o NIT tiene estructura lógica:
 * - Debe ser numérica.
 * - Debe tener entre 6 y 10 dígitos (estándar de la Registraduría Nacional de Colombia).
 * - No permite secuencias absurdas como '000000', '111111', etc.
 */
export function esCedulaValida(val) {
  if (!val) return false;
  const num = String(val).trim();
  if (!/^\d{6,10}$/.test(num)) return false;

  // Rechazar números con todos los dígitos idénticos (ej: 111111, 0000000)
  const primerDigito = num[0];
  if (num.split('').every((d) => d === primerDigito)) return false;

  // Rechazar secuencias triviales como 123456 o 123456789
  if (num === '123456' || num === '1234567' || num === '12345678' || num === '123456789' || num === '1234567890') {
    return false;
  }

  return true;
}

/**
 * Valida si un nombre de persona tiene coherencia:
 * - Al menos 3 caracteres.
 * - Al menos dos letras consecutivas.
 * - No puede ser solo repeticiones de la misma letra (ej: 'aaaaa', 'xxx').
 */
export function esNombreValido(val) {
  if (!val) return false;
  const t = String(val).trim();
  if (t.length < 3) return false;
  if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]{2,}/.test(t)) return false;

  // Rechazar repeticiones monótonas
  const letras = t.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (letras.length >= 3 && letras.split('').every((c) => c === letras[0])) {
    return false;
  }

  return true;
}

/**
 * Valida si un correo electrónico cumple con el formato estándar RFC.
 */
export function esEmailValido(val) {
  if (!val) return false;
  const e = String(val).trim().toLowerCase();
  // Regex estándar que requiere usuario, @, dominio y extensión de al menos 2 letras
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e);
}

/**
 * Valida un número entero positivo dentro de un rango específico.
 */
export function esNumeroEnRango(val, min, max) {
  const n = Number(val);
  if (isNaN(n)) return false;
  return n >= min && n <= max;
}
