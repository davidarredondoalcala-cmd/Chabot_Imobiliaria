import { describe, it, expect } from 'vitest';
import { verifyReplyIntegrity } from '../verifier.js';
import { buildWhatsAppLink } from '../../services/whatsapp.js';

describe('Fase 4: Verificador Determinista Anti-Alucinaciones', () => {
  it('debe detectar un inmueble inexistente o inventado', async () => {
    const fakeText = 'Te recomiendo mucho la casa campestre (IBG-9999) ubicada en Calambeo por $500.000.000.';
    const result = await verifyReplyIntegrity(fakeText);

    expect(result.isValid).toBe(false);
    expect(result.discrepancies.length).toBeGreaterThan(0);
    expect(result.discrepancies[0]).toContain('no existe en el catálogo');
  });

  it('debe detectar discrepancia cuando el precio citado no coincide con el real', async () => {
    // IBG-0001 cuesta 2.500.000 COP en el catálogo
    const wrongPriceText = 'El apartamento en El Vergel (IBG-0001) tiene un canon de arriendo de $1.200.000 mensuales.';
    const result = await verifyReplyIntegrity(wrongPriceText);

    expect(result.isValid).toBe(false);
    expect(result.discrepancies.some(d => d.includes('DISCREPANCIA DE PRECIO'))).toBe(true);
  });

  it('debe aprobar una respuesta fiel con datos exactos del catálogo', async () => {
    // IBG-0001: 2.500.000 COP, 3 habitaciones, 85 m2
    const accurateText = 'Encontré el apartamento (IBG-0001) en El Vergel por $2.500.000 con 3 habitaciones y 85 m2.';
    const result = await verifyReplyIntegrity(accurateText);

    expect(result.isValid).toBe(true);
    expect(result.discrepancies.length).toBe(0);
    expect(result.verifiedProperties.length).toBe(1);
    expect(result.verifiedProperties[0].codigo).toBe('IBG-0001');
  });
});

describe('Fase 4: Derivación a WhatsApp', () => {
  it('debe generar un deep-link a WhatsApp con el número y mensaje prellenado', () => {
    const link = buildWhatsAppLink({
      codigoInmueble: 'IBG-0004',
      motivo: 'visita',
      criterios: {
        operacion: 'venta',
        tipo: 'casa',
        precio_max: 800000000,
        barrios: ['Calambeo']
      }
    });

    expect(link).toContain('https://wa.me/');
    expect(link).toContain('text=');
    const decoded = decodeURIComponent(link);
    expect(decoded).toContain('IBG-0004');
    expect(decoded).toContain('Calambeo');
    expect(decoded).toContain('visita presencial');
  });
});
