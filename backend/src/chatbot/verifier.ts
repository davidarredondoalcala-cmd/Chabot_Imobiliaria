import { Property, VerificationResult } from './types';
import { obtenerDetalleInmueble } from './detail';

/**
 * Módulo determinista de verificación obligatoria antes de enviar al usuario.
 * Extrae de la respuesta los códigos de inmuebles citados y los compara contra el catálogo.
 */
export async function verifyReplyIntegrity(
  replyText: string,
  extraProperties?: Property[]
): Promise<VerificationResult> {
  const discrepancies: string[] = [];
  const verifiedProperties: Property[] = [];

  const codeMatches = Array.from(replyText.matchAll(/\b((?:IBG|HC)-\d{4})\b/gi));
  const citedCodes = Array.from(new Set(codeMatches.map(m => m[1].toUpperCase())));

  for (const code of citedCodes) {
    const realProp = await obtenerDetalleInmueble(code, extraProperties);
    if (!realProp) {
      discrepancies.push(`ALUCINACIÓN: El inmueble con código "${code}" no existe en el catálogo.`);
      continue;
    }

    verifiedProperties.push(realProp);

    const codeIndex = replyText.toUpperCase().indexOf(code);
    const afterCode = replyText.slice(codeIndex);
    const nextCodeMatch = afterCode.slice(code.length).search(/\b(?:IBG|HC)-\d{4}\b/i);
    const blockLength = nextCodeMatch !== -1 ? code.length + nextCodeMatch : Math.min(250, afterCode.length);
    const snippet = afterCode.slice(0, blockLength);

    // Verificación de Precio
    const priceMatches = Array.from(snippet.matchAll(/\$\s*([\d\.]+)/g));
    for (const pm of priceMatches) {
      const cleanDigits = pm[1].replace(/\./g, '');
      const parsedNum = parseInt(cleanDigits, 10);
      if (parsedNum > 10000) {
        const diffRatio = Math.abs(parsedNum - realProp.precio) / realProp.precio;
        if (diffRatio > 0.05) {
          discrepancies.push(
            `DISCREPANCIA DE PRECIO en ${code}: se citó COP $${parsedNum.toLocaleString('es-CO')} pero el catálogo registra COP $${realProp.precio.toLocaleString('es-CO')}.`
          );
        }
      }
    }
  }

  return {
    isValid: discrepancies.length === 0,
    discrepancies,
    verifiedProperties,
  };
}
