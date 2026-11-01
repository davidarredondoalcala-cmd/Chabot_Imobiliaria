import { Operacion } from './types';

/**
 * Tabla de palabras numéricas en español para conversión a entero.
 */
const SPANISH_NUMBERS: Record<string, number> = {
  cero: 0,
  un: 1, uno: 1, una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16, dieciséis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiun: 21, veintiún: 21, veintiuno: 21, veintiuna: 21,
  veintidos: 22, veintidós: 22,
  veintitres: 23, veintitrés: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26, veintiséis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100, ciento: 100,
  doscientos: 200, doscientas: 200,
  trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400,
  quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900,
};

/**
 * Parsea números expresados en palabras en español (ej. "novecientos mil", "millón doscientos").
 */
export function parseSpanishWordsNumber(phrase: string): number | null {
  const norm = phrase
    .toLowerCase()
    .replace(/[,\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Caso "medio millon" / "medio millón"
  if (/\bmedio\s*mill[oó]n\b/i.test(norm)) {
    return 500_000;
  }

  // Caso "X y medio" en palabras (ej. "dos y medio", "uno y medio", "tres y medio")
  const wordYMedio = norm.match(/\b(un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+y\s+medio\b/i);
  if (wordYMedio) {
    const base = SPANISH_NUMBERS[wordYMedio[1].toLowerCase()] || 0;
    if (base > 0) return Math.round((base + 0.5) * 1_000_000);
  }

  const words = norm.split(/\s+/).filter(w => w !== 'y' && w !== 'de' && w !== 'con');

  let total = 0;
  let currentGroup = 0;
  let hasNumberWord = false;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];

    if (w === 'millon' || w === 'millón' || w === 'millones') {
      const mult = currentGroup === 0 ? 1 : currentGroup;
      total += mult * 1_000_000;
      currentGroup = 0;
      hasNumberWord = true;
    } else if (w === 'mil') {
      const mult = currentGroup === 0 ? 1 : currentGroup;
      total += mult * 1_000;
      currentGroup = 0;
      hasNumberWord = true;
    } else if (SPANISH_NUMBERS[w] !== undefined) {
      currentGroup += SPANISH_NUMBERS[w];
      hasNumberWord = true;
    }
  }

  // Si quedó un remanente posterior a millones (ej. "millon doscientos" -> total=1.000.000, currentGroup=200)
  // En modismo colombiano "un millón doscientos" equivale a $1.200.000 (doscientos mil adicionales)
  if (currentGroup > 0) {
    if (total >= 1_000_000 && currentGroup < 1_000) {
      total += currentGroup * 1_000;
    } else {
      total += currentGroup;
    }
  }

  // Si no hay palabras de escala (mil, millón) y el número es menor a 10 (ej. "una mandarina", "un perro"),
  // se trata de un artículo indeterminado y no de una cifra monetaria.
  if (!norm.includes('mil') && !norm.includes('millon') && !norm.includes('millón') && !norm.includes('millones')) {
    if (total < 10) return null;
  }

  return hasNumberWord && total > 0 ? total : null;
}

/**
 * Normaliza una cifra textual colombiana a valor numérico entero en pesos colombianos (COP).
 * Soporta de manera integral:
 * - Notación 'k' / 'K': "900k", "900 k", "900K", "1.200k", "850k"
 * - Notación 'm' / 'M': "1m", "1.5M", "200M", "350m" (excluyendo m2/m²)
 * - Jerga colombiana de miles: "900 lucas", "850 barras"
 * - Jerga colombiana de millones: "200 palos", "1 palo", "medio palo", "palo y medio"
 * - Frases con palabras: "novecientos mil", "ochocientos cincuenta mil", "millón doscientos", "dos y medio"
 * - Cifras estándar completas: "900.000", "900,000", "1.500.000", "250.000.000", "900000"
 * - Contextual: "arriendo de 900" => 900.000, "venta de 250" => 250.000.000
 */
export function parseSingleAmount(phrase: string, context?: Operacion | null): number | null {
  const clean = phrase.toLowerCase().replace(/[$]/g, '').trim();

  // 1. Mil millones (ej. "1.2 mil millones", "1,2 mil millones", "mil millones", "billones")
  const milMillonesMatch = clean.match(/([\d]+(?:[\.,]\d+)?)\s*(?:mil\s*millones|billones)/i);
  if (milMillonesMatch) {
    const val = parseFloat(milMillonesMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1_000_000_000);
  }
  if (clean.includes('mil millones')) {
    return 1_000_000_000;
  }

  // 2. Palos (jerga colombiana para millones)
  if (clean.includes('medio palo')) return 500_000;
  if (clean.includes('palo y medio') || clean.includes('un palo y medio')) return 1_500_000;
  const palosMatch = clean.match(/([\d]+(?:[\.,]\d+)?)\s*palos?\b/i);
  if (palosMatch) {
    const val = parseFloat(palosMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1_000_000);
  }
  if (/\b(?:un|1)\s*palo\b/i.test(clean)) return 1_000_000;

  // 3. Millones con palabras clave explícitas (ej. "300 millones", "1.5 millones", "millon y medio")
  if (clean.includes('millon y medio') || clean.includes('millón y medio')) return 1_500_000;
  const millonesMatch = clean.match(/([\d]+(?:[\.,]\d+)?)\s*(?:millones|millon|millón)\b/i);
  if (millonesMatch) {
    const val = parseFloat(millonesMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1_000_000);
  }

  // 4. Notación 'M' o 'm' (ej. "1m", "1.5M", "200M", "350m")
  // Excluyendo rigurosamente metros cuadrados (m2, m², mts, metros, lineale)
  const mMatch = clean.match(/\b(\d+(?:[\.,]\d+)?)\s*m\b(?!\s*(?:2|²|cuadrad|lineal|ts?\b))/i);
  if (mMatch) {
    const val = parseFloat(mMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1_000_000);
  }

  // 5. Notación 'k' / 'K' (ej. "900k", "900 k", "900K", "1.200k", "1200k", "850k")
  const kMatch = clean.match(/(\d+(?:[\.,]\d+)?)\s*k\b/i);
  if (kMatch) {
    let numStr = kMatch[1];
    // Manejar casos con punto separador de miles en K (ej. 1.200k => 1200 * 1000)
    if (/^\d{1,3}\.\d{3}$/.test(numStr)) {
      numStr = numStr.replace('.', '');
    } else {
      numStr = numStr.replace(',', '.');
    }
    const val = parseFloat(numStr);
    if (!isNaN(val)) return Math.round(val * 1_000);
  }

  // 6. Jerga colombiana para miles: "lucas" y "barras" (ej. "900 lucas", "850 barras")
  const slangMilesMatch = clean.match(/\b(\d+(?:[\.,]\d+)?)\s*(?:lucas?|barras?)\b/i);
  if (slangMilesMatch) {
    const val = parseFloat(slangMilesMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1_000);
  }

  // 7. Notación explícita con palabra "mil" (ej. "900 mil", "850 mil")
  const milMatch = clean.match(/([\d]+(?:[\.,]\d+)?)\s*mil\b/i);
  if (milMatch) {
    const val = parseFloat(milMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1_000);
  }

  // 8. Expresiones numéricas "X y medio" (ej. "2 y medio", "3 y medio")
  const yMedioMatch = clean.match(/([\d]+)\s*y\s*medio\b/i);
  if (yMedioMatch) {
    const base = parseFloat(yMedioMatch[1]);
    if (!isNaN(base)) return Math.round((base + 0.5) * 1_000_000);
  }

  // 9. Números escritos en letras en español (ej. "novecientos mil", "ochocientos cincuenta mil", "millon doscientos")
  const wordsVal = parseSpanishWordsNumber(clean);
  if (wordsVal !== null) {
    return wordsVal;
  }

  // 10. Cifras completas con separadores de miles (ej. "1.500.000", "900.000", "250.000.000", "900,000")
  const formattedMatch = clean.match(/\b(\d{1,3}(?:[\.,]\d{3})+)\b/);
  if (formattedMatch) {
    const flat = formattedMatch[1].replace(/[\.,]/g, '');
    const val = parseInt(flat, 10);
    if (!isNaN(val)) return val;
  }

  // 11. Cifras planas sin separadores de 5 a 12 dígitos (ej. "900000", "1500000")
  const plainNumberMatch = clean.match(/\b(\d{5,12})\b/);
  if (plainNumberMatch) {
    const val = parseInt(plainNumberMatch[1], 10);
    if (!isNaN(val)) return val;
  }

  // 12. Contextual para números cortos aislados (ej. en arriendo "hasta 900" => 900.000, en venta "con 250" => 250.000.000)
  const shortNumMatch = clean.match(/\b(\d{2,4})\b/);
  if (shortNumMatch && context) {
    const num = parseInt(shortNumMatch[1], 10);
    if (context === 'arriendo' && num >= 100 && num <= 9999) {
      return num * 1_000;
    }
    if (context === 'venta' && num >= 30 && num <= 5000) {
      return num * 1_000_000;
    }
  }

  return null;
}

/**
 * Extrae rangos o límites de presupuesto en texto libre con soporte amplio para
 * lenguaje natural y modismos colombianos.
 */
export function normalizeColombianMoney(
  text: string,
  context?: Operacion | null
): { min?: number; max?: number } {
  const result: { min?: number; max?: number } = {};
  const lower = text.toLowerCase();

  // Caso: "entre X e Y" / "entre X y Y" / "de X a Y"
  const rangeMatch = lower.match(/(?:entre|de)\s+([\w\s\.,]+?)\s+(?:y|a|hasta)\s+([\w\s\.,]+)/i);
  if (rangeMatch) {
    let rawMin = rangeMatch[1].trim();
    let rawMax = rangeMatch[2].trim();

    // Propagar unidad si solo se especificó en el límite superior
    if (/millones|millon|millón|m\b/i.test(rawMax) && !/millon|mil|palo|lucas|barras|k\b/i.test(rawMin)) {
      rawMin = `${rawMin} millones`;
    } else if (/\bmil\b|k\b|lucas|barras/i.test(rawMax) && !/millon|mil|palo|lucas|barras|k\b/i.test(rawMin)) {
      rawMin = `${rawMin} mil`;
    } else if (/palos?/i.test(rawMax) && !/millon|mil|palo|lucas|barras|k\b/i.test(rawMin)) {
      rawMin = `${rawMin} palos`;
    }

    const minVal = parseSingleAmount(rawMin, context);
    const maxVal = parseSingleAmount(rawMax, context);
    if (minVal && maxVal) {
      result.min = Math.min(minVal, maxVal);
      result.max = Math.max(minVal, maxVal);
      return result;
    }
  }

  // Caso límite superior con prefijos naturales:
  // "hasta 900k", "maximo 900k", "que cueste como maximo 900k", "a lo sumo 900k", "menos de 900k", "con presupuesto de 900k"
  const maxMatch = lower.match(/(?:hasta|maximo|máximo|como\s+(?:maximo|máximo|mucho)|a\s+lo\s+sumo|cueste\s+(?:como\s+)?(?:maximo|máximo)|coste\s+(?:como\s+)?(?:maximo|máximo)|menos\s+de|no\s+(?:mas\s+de|más\s+de|pase\s+de|supere|exceda)|tope\s+(?:de\s+)?|techo\s+(?:de\s+)?|presupuesto\s+(?:de\s+)?|con\s+presupuesto\s+(?:de\s+)?|(?:tengo|dispongo\s+de|cuento\s+con)\s+|con\s+)\s*([^,\.;\n]+)/i);
  if (maxMatch) {
    const val = parseSingleAmount(maxMatch[1], context);
    if (val) {
      result.max = val;
      return result;
    }
  }

  // Caso límite inferior:
  const minMatch = lower.match(/(?:desde|minimo|mínimo|mas\s+de|más\s+de|por\s+encima\s+de)\s*([^,\.;\n]+)/i);
  if (minMatch) {
    const val = parseSingleAmount(minMatch[1], context);
    if (val) {
      result.min = val;
      return result;
    }
  }

  // Búsqueda general de cualquier mención de dinero en la oración
  const generalPatterns = [
    // 1. Número seguido de unidad explícita: 900k, 1.5M, 200 palos, 900 lucas, 800 mil, etc.
    /(\d+(?:[\.,]\d+)?\s*(?:mil\s*millones|millones|mill[oó]n|palos?|lucas?|barras?|k\b|m\b|mil\b|y\s*medio))/gi,
    // 2. Modismos fijos: un palo, medio palo, palo y medio, dos y medio, millon y medio, medio millon
    /(?:un\s+palo|medio\s+palo|palo\s+y\s+medio|dos\s+y\s+medio|mill[oó]n\s+y\s+medio|medio\s+mill[oó]n)/gi,
    // 3. Frases con millones en letras: "un millón doscientos", "trescientos millones", "dos millones"
    /(?:(?:un|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+)?mill[oó]n(?:es)?(?:\s+(?:y\s+medio|doscientos|trescientos|cuatrocientos|quinientos|seiscientos|setecientos|ochocientos|novecientos|mil|\d+)(?:\s*mil)?)?/gi,
    // 4. Frases con miles en letras: "novecientos mil", "ochocientos cincuenta mil", "quinientos mil"
    /(?:(?:novecientos|ochocientos|setecientos|seiscientos|quinientos|cuatrocientos|trescientos|doscientos|ciento|cien)(?:\s+(?:y\s+)?(?:veinte|veinti[a-záéíóú]+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve))*\s+mil)/gi,
    // 5. Cifras formateadas: 1.500.000, 900.000, etc.
    /\b(\d{1,3}(?:[\.,]\d{3})+)\b/g,
    // 6. Cifras planas: 900000
    /\b(\d{5,11})\b/g
  ];

  for (const regex of generalPatterns) {
    const matches = Array.from(lower.matchAll(regex));
    if (matches.length > 0) {
      for (const m of matches) {
        const parsed = parseSingleAmount(m[0], context);
        if (parsed) {
          result.max = parsed;
          result.min = Math.max(0, Math.round(parsed * 0.4));
          return result;
        }
      }
    }
  }

  return result;
}
