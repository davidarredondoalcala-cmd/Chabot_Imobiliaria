import { Property } from '../types/index.js';
import { obtenerDetalleInmueble } from '../tools/detail.js';

export interface VerificationResult {
  isValid: boolean;
  discrepancies: string[];
  verifiedProperties: Property[];
}

/**
 * Módulo determinista de verificación obligatoria antes de enviar al usuario.
 * Extrae de la respuesta los códigos de inmuebles, precios, áreas y habitaciones citados
 * y los compara contra la base de datos real.
 */
export async function verifyReplyIntegrity(replyText: string): Promise<VerificationResult> {
  const discrepancies: string[] = [];
  const verifiedProperties: Property[] = [];

  // 1. Extraer todos los códigos de inmuebles citados (ej. IBG-0001)
  const codeMatches = Array.from(replyText.matchAll(/\b(IBG-\d{4})\b/gi));
  const citedCodes = Array.from(new Set(codeMatches.map(m => m[1].toUpperCase())));

  for (const code of citedCodes) {
    const realProp = await obtenerDetalleInmueble(code);
    if (!realProp) {
      discrepancies.push(`ALUCINACIÓN: El inmueble con código "${code}" no existe en el catálogo.`);
      continue;
    }

    verifiedProperties.push(realProp);

    // Segmentar el texto del bloque exclusivo de este inmueble (desde su código hasta el siguiente o fin de bloque)
    const codeIndex = replyText.toUpperCase().indexOf(code);
    const afterCode = replyText.slice(codeIndex);
    const nextCodeMatch = afterCode.slice(code.length).search(/\bIBG-\d{4}\b/i);
    const blockLength = nextCodeMatch !== -1 ? code.length + nextCodeMatch : Math.min(250, afterCode.length);
    const snippet = afterCode.slice(0, blockLength);

    // A. Verificación de Precio
    // Buscar patrones de precios en COP en el snippet: ej. $2.500.000 o 2500000 o 2.5 millones
    const priceMatches = Array.from(snippet.matchAll(/\$\s*([\d\.]+)/g));
    for (const pm of priceMatches) {
      const cleanDigits = pm[1].replace(/\./g, '');
      const parsedNum = parseInt(cleanDigits, 10);
      if (parsedNum > 10000) {
        // Tolerancia si el precio es totalmente distinto al real
        const diffRatio = Math.abs(parsedNum - realProp.precio) / realProp.precio;
        if (diffRatio > 0.05) {
          discrepancies.push(
            `DISCREPANCIA DE PRECIO en ${code}: se citó COP $${parsedNum.toLocaleString('es-CO')} pero el catálogo registra COP $${realProp.precio.toLocaleString('es-CO')}.`
          );
        }
      }
    }

    // B. Verificación de Habitaciones
    const habMatch = snippet.match(/(\d+)\s*(?:hab|habitaci(?:ones|ón)|alcobas)/i);
    if (habMatch) {
      const citedHab = parseInt(habMatch[1], 10);
      if (citedHab !== realProp.habitaciones) {
        discrepancies.push(
          `DISCREPANCIA DE HABITACIONES en ${code}: se citó ${citedHab} habitaciones pero el catálogo registra ${realProp.habitaciones}.`
        );
      }
    }

    // C. Verificación de Área
    const areaMatch = snippet.match(/(\d+(?:[\.,]\d+)?)\s*(?:m2|m²|metros)/i);
    if (areaMatch) {
      const citedArea = parseFloat(areaMatch[1].replace(',', '.'));
      if (Math.abs(citedArea - realProp.area_m2) > 2) {
        discrepancies.push(
          `DISCREPANCIA DE ÁREA en ${code}: se citó ${citedArea} m² pero el catálogo registra ${realProp.area_m2} m².`
        );
      }
    }
  }

  return {
    isValid: discrepancies.length === 0,
    discrepancies,
    verifiedProperties,
  };
}
