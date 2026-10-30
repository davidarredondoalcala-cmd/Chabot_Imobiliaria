import { describe, it, expect } from 'vitest';
import { processUserMessage } from '../orchestrator.js';

describe('Compra: preguntar presupuesto antes de dar opciones', () => {
  it('"Comprar" sin presupuesto pregunta el presupuesto y no lista inmuebles', async () => {
    const convId = `test-budget-ask-${Date.now()}`;
    const r1 = await processUserMessage(convId, 'Comprar');

    expect(r1.properties.length).toBe(0);
    expect(r1.reply).toContain('presupuesto');
    expect(r1.reply).not.toContain('IBG-');
  });

  it('"quiero comprar una casa" pregunta presupuesto; al responder con monto muestra casas en venta', async () => {
    const convId = `test-budget-flow-${Date.now()}`;
    const r1 = await processUserMessage(convId, 'quiero comprar una casa');
    expect(r1.properties.length).toBe(0);
    expect(r1.reply).toContain('presupuesto');
    expect(r1.reply).toContain('la casa');

    const r2 = await processUserMessage(convId, '400 millones');
    expect(r2.properties.length).toBeGreaterThan(0);
    for (const p of r2.properties) {
      expect(p.operacion).toBe('venta');
      expect(p.tipo).toBe('casa');
    }
  });

  it('en arriendo NO exige presupuesto si ya dio zona', async () => {
    const convId = `test-rent-nobudget-${Date.now()}`;
    const r = await processUserMessage(convId, 'busco apartamento en arriendo en El Vergel');
    expect(r.properties.length).toBeGreaterThan(0);
  });

  it('si el usuario ignora el presupuesto dos veces no se queda en bucle', async () => {
    const convId = `test-budget-loop-${Date.now()}`;
    await processUserMessage(convId, 'Comprar');
    await processUserMessage(convId, 'casa');
    const r3 = await processUserMessage(convId, 'casa');
    expect(r3.reply).not.toContain('¿con qué presupuesto aproximado');
  });
});
