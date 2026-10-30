import { describe, it, expect } from 'vitest';
import { processUserMessage } from '../orchestrator.js';
import { SEED_PROPERTIES } from '../../db/seed.js';

describe('Especialización exclusiva en Casas y Apartamentos', () => {
  it('el catálogo completo de propiedades solo debe contener tipos "casa" o "apartamento"', () => {
    expect(SEED_PROPERTIES.length).toBe(40);
    for (const prop of SEED_PROPERTIES) {
      expect(['casa', 'apartamento']).toContain(prop.tipo);
      expect(prop.tipo).not.toBe('local');
      expect(prop.tipo).not.toBe('oficina');
      expect(prop.tipo).not.toBe('lote');
    }
  });

  it('al consultar por casas o apartamentos debe responder con opciones residenciales del catálogo', async () => {
    const convId = `test-res-${Date.now()}`;
    const resApto = await processUserMessage(convId, 'Busco apartamento en arriendo en El Vergel');
    expect(resApto.properties.length).toBeGreaterThan(0);
    for (const p of resApto.properties) {
      expect(p.tipo).toBe('apartamento');
    }

    const resCasa = await processUserMessage(`test-casa-${Date.now()}`, 'Busco casa en venta en Calambeo con presupuesto de 400 millones');
    expect(resCasa.properties.length).toBeGreaterThan(0);
    for (const p of resCasa.properties) {
      expect(p.tipo).toBe('casa');
    }
  });

  it('al preguntar por un local comercial, oficina o lote, debe aclarar amablemente que solo maneja casas y apartamentos', async () => {
    const convId = `test-nonres-${Date.now()}`;
    const res = await processUserMessage(convId, 'Busco un local comercial en arriendo para un restaurante');
    
    expect(res.reply).toContain('casas y apartamentos');
    expect(res.reply).toContain('local comercial');
    expect(res.properties.length).toBe(0);
    expect(res.whatsappUrl).toBeDefined();
  });
});
