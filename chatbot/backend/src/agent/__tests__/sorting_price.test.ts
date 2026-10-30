import { describe, it, expect } from 'vitest';
import { processUserMessage } from '../orchestrator.js';

describe('Ordenamiento correcto por precio (los más caros vs los más baratos)', () => {
  it('al pedir "los arriendos mas caros", debe ordenar descendentemente con los cánones más altos', async () => {
    const convId = `test-caros-${Date.now()}`;
    const response = await processUserMessage(convId, 'dame los arriendos mas caros');

    expect(response.properties.length).toBeGreaterThan(0);
    // Verificar que están ordenados de mayor a menor precio
    for (let i = 0; i < response.properties.length - 1; i++) {
      expect(response.properties[i].precio).toBeGreaterThanOrEqual(response.properties[i + 1].precio);
    }
    // El primer arriendo debe ser uno de los más costosos del catálogo (ej. >= 2.500.000 COP)
    expect(response.properties[0].precio).toBeGreaterThanOrEqual(2_500_000);
  });

  it('al pedir "los arriendos mas baratos", debe ordenar ascendentemente con los cánones más económicos', async () => {
    const convId = `test-baratos-${Date.now()}`;
    const response = await processUserMessage(convId, 'muéstrame los arriendos mas baratos');

    expect(response.properties.length).toBeGreaterThan(0);
    // Verificar que están ordenados de menor a mayor precio
    for (let i = 0; i < response.properties.length - 1; i++) {
      expect(response.properties[i].precio).toBeLessThanOrEqual(response.properties[i + 1].precio);
    }
    // El más barato debe ser el más económico del catálogo (<= 1.000.000 COP, ej. $850.000 de Santa Ana o $900.000 de El Salado)
    expect(response.properties[0].precio).toBeLessThanOrEqual(1_000_000);
    expect(response.properties[0].codigo).toBe('IBG-0018'); // Inmueble más económico: Santa Ana 850k
  });

  it('al alternar entre "los más caros" y luego "los más baratos" en la misma charla, no debe bloquearse', async () => {
    const convId = `test-switch-${Date.now()}`;

    // Turno 1: pide los más caros
    const resp1 = await processUserMessage(convId, 'quiero ver los arriendos más caros');
    expect(resp1.properties[0].precio).toBeGreaterThanOrEqual(2_500_000);

    // Turno 2: en la misma conversación pide los más baratos
    const resp2 = await processUserMessage(convId, 'ahora muéstrame los arriendos más baratos');
    expect(resp2.properties[0].precio).toBeLessThanOrEqual(1_000_000);
    expect(resp2.properties[0].precio).toBeLessThan(resp1.properties[0].precio);
  });
});
