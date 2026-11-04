import { stripAccents, CIUDADES_CONOCIDAS } from './nlu';

/**
 * Distancia de Levenshtein (número mínimo de inserciones, eliminaciones o sustituciones).
 */
export function levenshteinDistance(a: string, b: string): number {
  const s1 = a || '';
  const s2 = b || '';
  const m = s1.length;
  const n = s2.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // Eliminación
        dp[i][j - 1] + 1,       // Inserción
        dp[i - 1][j - 1] + cost // Sustitución
      );
    }
  }

  return dp[m][n];
}

/**
 * Palabras comunes del español y del dominio que NO deben confundirse con nombres de ciudades ni barrios.
 */
export const STOP_WORDS = new Set<string>([
  'casa', 'casas', 'caza', 'cazas', 'apto', 'aptos', 'apartamento', 'apartamentos', 'inmueble', 'inmuebles',
  'propiedad', 'propiedades', 'vivienda', 'viviendas', 'habitacion', 'habitaciones', 'alcoba', 'alcobas',
  'cuarto', 'cuartos', 'pieza', 'piezas', 'bano', 'banos', 'estrato', 'garaje', 'garajes', 'parqueadero',
  'parqueaderos', 'balcon', 'terraza', 'patio', 'piscina', 'm2', 'metro', 'metros', 'precio', 'valor', 'canon',
  'arriendo', 'arriendos', 'arrendar', 'alquiler', 'alquileres', 'alquilar', 'venta', 'ventas', 'vender',
  'compra', 'compras', 'comprar', 'compro', 'presupuesto', 'millon', 'millones', 'palo', 'palos', 'lucas',
  'barras', 'pesos', 'plata', 'dinero', 'asesor', 'asesora', 'persona', 'humano', 'visita', 'cita', 'agendar',
  'contacto', 'whatsapp', 'telefono', 'numero', 'para', 'hacia', 'desde', 'hasta', 'entre', 'sobre', 'bajo',
  'con', 'sin', 'por', 'del', 'las', 'los', 'les', 'una', 'uno', 'unos', 'unas', 'otro', 'otra', 'otros', 'otras',
  'este', 'esta', 'estos', 'estas', 'aqui', 'alla', 'alli', 'donde', 'como', 'cual', 'cuales', 'quien', 'quienes',
  'que', 'cuando', 'cuanto', 'cuanta', 'cuantos', 'cuantas', 'algo', 'nada', 'todo', 'toda', 'todos', 'todas',
  'cada', 'casi', 'caso', 'bien', 'buen', 'bueno', 'buena', 'buenos', 'buenas', 'hola', 'holaa', 'gracias',
  'muchas', 'muchos', 'favor', 'ayuda', 'quiero', 'quisiera', 'busco', 'buscando', 'necesito', 'tienen', 'tienes',
  'habra', 'tendra', 'hay', 'dime', 'muestrame', 'ensename', 'ver', 'mirar', 'saber', 'alguna', 'algun', 'alguno',
  'zona', 'zonas', 'barrio', 'barrios', 'sector', 'sectores', 'ciudad', 'ciudades', 'lugar', 'lugares',
  'mas', 'menos', 'mayor', 'menor', 'gran', 'grande', 'chico', 'pequeno', 'alta', 'alto', 'baja', 'bajo'
]);

export interface FuzzyMatchResult {
  match: string;      // Nombre canónico para mostrar (ej. "Cali", "El Poblado")
  clave: string;      // Clave normalizada
  original: string;   // Texto original que escribió la persona (ej. "Celi", "el verjel")
  distancia: number;  // Distancia calculada
}

/**
 * Umbral de distancia máxima permitida según la longitud de la palabra de referencia.
 */
function maxDistanceForLength(len: number): number {
  if (len <= 4) return 1;       // cali -> celi (dist 1)
  if (len <= 8) return 2;       // bogota -> vogota (dist 1), medellin -> medeyin (dist 2)
  return 3;                     // barranquilla -> barankilla (dist 2)
}

/**
 * Busca una ciudad mediante coincidencia difusa (tolerancia a errores ortográficos).
 * Prioriza primero palabras tras preposiciones de lugar ("en Celi", "hacia Vogota", "para Medelin").
 */
export function buscarCiudadFuzzy(userMessage: string): FuzzyMatchResult | null {
  const clean = stripAccents(userMessage);

  // 1. Prioridad: token o frase tras preposición de destino ("en Celi", "para Vogota", "de Medelin")
  const prepRegex = /\b(?:en|para|hacia|de|por)\s+(?:el\s+|la\s+|ciudad\s+de\s+|municipio\s+de\s+)?([a-zñ]{3,25})\b/gi;
  let matchPrep: RegExpExecArray | null;

  while ((matchPrep = prepRegex.exec(clean)) !== null) {
    const rawTarget = matchPrep[1].trim().toLowerCase();
    if (STOP_WORDS.has(rawTarget)) continue;

    let bestCity: FuzzyMatchResult | null = null;
    let minDistance = 999;

    for (const [key, prettyName] of Object.entries(CIUDADES_CONOCIDAS)) {
      if (key.includes(' ') && !key.startsWith(rawTarget)) continue; // omitir compuestas a menos que coincidan
      const primaryKey = key.split(' ')[0];
      const maxAllowed = maxDistanceForLength(primaryKey.length);
      const dist = levenshteinDistance(rawTarget, primaryKey);

      if (dist > 0 && dist <= maxAllowed && dist < minDistance) {
        minDistance = dist;
        bestCity = {
          match: prettyName,
          clave: key,
          original: matchPrep[1],
          distancia: dist,
        };
      }
    }

    if (bestCity) {
      return bestCity;
    }
  }

  // 2. Segunda prioridad: escaneo de palabras individuales en el mensaje completo
  const words = clean.split(/[^a-zñ0-9]+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  let bestGlobal: FuzzyMatchResult | null = null;
  let minGlobalDistance = 999;

  for (const word of words) {
    for (const [key, prettyName] of Object.entries(CIUDADES_CONOCIDAS)) {
      const primaryKey = key.split(' ')[0];
      const maxAllowed = maxDistanceForLength(primaryKey.length);
      const dist = levenshteinDistance(word, primaryKey);

      if (dist > 0 && dist <= maxAllowed && dist < minGlobalDistance) {
        minGlobalDistance = dist;
        bestGlobal = {
          match: prettyName,
          clave: key,
          original: word,
          distancia: dist,
        };
      }
    }
  }

  return bestGlobal;
}

/**
 * Busca un barrio o sector mediante coincidencia difusa.
 */
export function buscarBarrioFuzzy(userMessage: string, knownBarrios: string[]): FuzzyMatchResult | null {
  const clean = stripAccents(userMessage);

  // Escanear palabras o bi-gramas tras preposiciones ("en el pobaldo", "en el verjel", "en ciudad jardn")
  const prepRegex = /\b(?:en|por|sector|barrio)\s+(?:el\s+|la\s+)?([a-zñ]{3,20}(?:\s+[a-zñ]{3,20})?)\b/gi;
  let matchPrep: RegExpExecArray | null;

  while ((matchPrep = prepRegex.exec(clean)) !== null) {
    const rawTarget = matchPrep[1].trim().toLowerCase();
    if (STOP_WORDS.has(rawTarget)) continue;

    let bestBarrio: FuzzyMatchResult | null = null;
    let minDistance = 999;

    for (const b of knownBarrios) {
      const bClean = stripAccents(b).toLowerCase();
      // Comparar contra el nombre completo o la palabra principal del barrio
      const mainWord = bClean.replace(/^(el|la|los|las|valle\s+del)\s+/, '');
      const maxAllowed = maxDistanceForLength(bClean.length);

      const distFull = levenshteinDistance(rawTarget, bClean);
      const distMain = levenshteinDistance(rawTarget, mainWord);
      const dist = Math.min(distFull, distMain);

      if (dist > 0 && dist <= maxAllowed && dist < minDistance) {
        minDistance = dist;
        bestBarrio = {
          match: b,
          clave: bClean,
          original: matchPrep[1],
          distancia: dist,
        };
      }
    }

    if (bestBarrio) {
      return bestBarrio;
    }
  }

  return null;
}
