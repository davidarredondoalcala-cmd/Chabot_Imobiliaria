import { Operacion } from '../types/index.js';

/**
 * Normaliza una cifra textual colombiana a valor numérico entero en pesos colombianos (COP).
 * Soporta modismos:
 * - "200 palos", "1 palo", "medio palo"
 * - "300 millones", "1.5 millones", "1,5 millones", "millón doscientos"
 * - "1.2 mil millones", "mil millones"
 * - "800 mil", "800k", "ochocientos mil"
 * - "2 y medio" (contextual: arriendo => 2.5M, venta => 2.5M)
 */
export function parseSingleAmount(phrase: string, context?: Operacion | null): number | null {
  let clean = phrase.toLowerCase().replace(/[$]/g, '').trim();

  // Mil millones (ej. "1.2 mil millones", "1,2 mil millones", "mil millones")
  const milMillonesMatch = clean.match(/([\d]+(?:[\.,]\d+)?)\s*(?:mil\s*millones|billones)/i);
  if (milMillonesMatch) {
    const val = parseFloat(milMillonesMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1_000_000_000);
  }
  if (clean.includes('mil millones')) {
    return 1_000_000_000;
  }

  // Palos (jerga colombiana para millones)
  // ej. "200 palos", "un palo", "medio palo", "palo y medio"
  if (clean.includes('medio palo')) {
    return 500_000;
  }
  if (clean.includes('palo y medio') || clean.includes('un palo y medio')) {
    return 1_500_000;
  }
  const palosMatch = clean.match(/([\d]+(?:[\.,]\d+)?)\s*(?:palos?)/i);
  if (palosMatch) {
    const val = parseFloat(palosMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1_000_000);
  }
  if (/\b(?:un|1)\s*palo\b/i.test(clean)) {
    return 1_000_000;
  }

  // Millones (ej. "300 millones", "1.5 millones", "1,5 millones", "millon y medio", "dos millones")
  if (clean.includes('millon y medio') || clean.includes('millón y medio')) {
    return 1_500_000;
  }
  const millonesMatch = clean.match(/([\d]+(?:[\.,]\d+)?)\s*(?:millones|millon|millón)/i);
  if (millonesMatch) {
    const val = parseFloat(millonesMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1_000_000);
  }

  // Miles (ej. "800 mil", "900k", "ochocientos mil")
  const kMatch = clean.match(/([\d]+(?:[\.,]\d+)?)\s*k\b/i);
  if (kMatch) {
    const val = parseFloat(kMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1_000);
  }

  const milMatch = clean.match(/([\d]+(?:[\.,]\d+)?)\s*mil\b/i);
  if (milMatch) {
    const val = parseFloat(milMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1_000);
  }

  // Expresiones como "2 y medio", "tres y medio"
  const yMedioMatch = clean.match(/([\d]+)\s*y\s*medio/i);
  if (yMedioMatch) {
    const base = parseFloat(yMedioMatch[1]);
    if (!isNaN(base)) {
      return Math.round((base + 0.5) * 1_000_000);
    }
  }

  // Quitar puntos de miles en cifras completas (ej. "1.500.000")
  const flatClean = clean.replace(/\./g, '');
  const plainNumberMatch = flatClean.match(/\b(\d{5,12})\b/);
  if (plainNumberMatch) {
    const val = parseInt(plainNumberMatch[1], 10);
    if (!isNaN(val)) return val;
  }

  return null;
}

/**
 * Extrae rangos o límites de presupuesto en texto libre
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

    // Si rawMax tiene "millones" o "mil" y rawMin es solo un número (ej. "entre 1 y 2 millones")
    if (/millones|millon|millón/i.test(rawMax) && !/millon|mil|palo/i.test(rawMin)) {
      rawMin = `${rawMin} millones`;
    } else if (/\bmil\b/i.test(rawMax) && !/millon|mil|palo/i.test(rawMin)) {
      rawMin = `${rawMin} mil`;
    } else if (/palos?/i.test(rawMax) && !/millon|mil|palo/i.test(rawMin)) {
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

  // Caso límite superior: "hasta X", "máximo X", "menos de X", "que no pase de X", "presupuesto de X"
  const maxMatch = lower.match(/(?:hasta|maximo|máximo|menos\s+de|presupuesto\s+(?:de\s+)?|no\s+pase\s+de|tope\s+(?:de\s+)?)\s*([^,\.;\n]+)/i);
  if (maxMatch) {
    const val = parseSingleAmount(maxMatch[1], context);
    if (val) {
      result.max = val;
      return result;
    }
  }

  // Caso límite inferior: "desde X", "mínimo X", "más de X"
  const minMatch = lower.match(/(?:desde|minimo|mínimo|mas\s+de|más\s+de)\s*([^,\.;\n]+)/i);
  if (minMatch) {
    const val = parseSingleAmount(minMatch[1], context);
    if (val) {
      result.min = val;
      return result;
    }
  }

  // Búsqueda general de cualquier mención de dinero
  // ej. "tengo 200 palos", "busco de 800 mil", "puedo pagar 1.2 millones", "de 1 millon"
  const generalPatterns = [
    /(\d+(?:[\.,]\d+)?\s*(?:mil\s*millones|millones|mill[oó]n|palos?|k\b|mil\b|y\s*medio))/gi,
    /(?:un\s+palo|medio\s+palo|palo\s+y\s+medio)/gi,
    /\b(\d{6,11})\b/g
  ];

  for (const regex of generalPatterns) {
    const matches = Array.from(lower.matchAll(regex));
    if (matches.length > 0) {
      const parsed = parseSingleAmount(matches[0][0], context);
      if (parsed) {
        // Para frases como "de 1 millon", "de 2 millones", "800 mil" se define una ventana
        // de presupuesto flexible para garantizar que el catálogo siempre encuentre inmuebles
        if (parsed <= 20_000_000) {
          // Rango de arriendo: ventana de tolerancia de +35% para no excluir excelentes opciones
          result.max = Math.round(parsed * 1.35);
          result.min = Math.max(0, Math.round(parsed * 0.6));
        } else {
          // Rango de venta: ventana de tolerancia de +25%
          result.max = Math.round(parsed * 1.25);
          result.min = Math.max(0, Math.round(parsed * 0.7));
        }
        return result;
      }
    }
  }

  return result;
}
