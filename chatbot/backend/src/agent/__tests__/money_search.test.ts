import { describe, it, expect } from 'vitest';
import { processUserMessage } from '../orchestrator.js';

describe('Búsqueda flexible por presupuesto con "mil" y "millones"', () => {
  it('al escribir "de 1 millon", debe inferir arriendo, encontrar inmuebles y no fallar', async () => {
    const convId = `test-1m-${Date.now()}`;
    const response = await processUserMessage(convId, 'de 1 millon');

    expect(response.properties.length).toBeGreaterThan(0);
    expect(response.reply).not.toContain('No encontramos inmuebles con esos criterios');
    expect(response.reply).not.toContain('fallback local');
    // Debe incluir inmuebles reales acordes
    for (const p of response.properties) {
      expect(p.operacion).toBe('arriendo');
    }
  });

  it('al escribir "de 2 millones", debe encontrar opciones acordes y nunca devolver mensaje de fallback técnico', async () => {
    const convId = `test-2m-${Date.now()}`;
    const response = await processUserMessage(convId, 'de 2 millones');

    expect(response.properties.length).toBeGreaterThan(0);
    expect(response.reply).not.toContain('fallback');
    expect(response.reply).not.toContain('No encontramos inmuebles');
    for (const p of response.properties) {
      expect(p.operacion).toBe('arriendo');
    }
  });

  it('al escribir "800 mil", debe devolver opciones en el rango de arriendo económico', async () => {
    const convId = `test-800k-${Date.now()}`;
    const response = await processUserMessage(convId, '800 mil');

    expect(response.properties.length).toBeGreaterThan(0);
    expect(response.properties[0].operacion).toBe('arriendo');
  });

  it('al escribir "200 millones" o "200 palos", debe inferir venta y devolver propiedades', async () => {
    const convId = `test-200m-${Date.now()}`;
    const response = await processUserMessage(convId, '200 millones');

    expect(response.properties.length).toBeGreaterThan(0);
    for (const p of response.properties) {
      expect(p.operacion).toBe('venta');
    }
  });

  it('al preguntar por compra de casa con un presupuesto bajo (ej. 10 millones), solo informa desde qué valor empiezan los inmuebles, sin listar', async () => {
    const convId = `test-compra-10m-${Date.now()}`;
    const response = await processUserMessage(convId, 'compra de casa con un presupuesto de 10 millones');

    // Fuera de presupuesto: no se listan inmuebles (ni arriendos ni ventas)
    expect(response.properties.length).toBe(0);
    expect(response.reply).toContain('empiezan desde');
    expect(response.reply).toContain('en venta');
    expect(response.reply).toContain('casas');
    expect(response.reply).not.toContain('IBG-');
  });
});
