import { describe, it, expect } from 'vitest';
import { processUserMessage } from '../orchestrator.js';

describe('Integración Habitat Capital: Catálogo oficial y validación estricta de presupuesto', () => {
  it('Compra de casa con presupuesto de 10 millones debe indicar que empiezan desde $300.000.000 COP sin listar inmuebles', async () => {
    const convId = `test-habitat-casa-10m-${Date.now()}`;
    const response = await processUserMessage(convId, 'compra de casa con un presupuesto de 10 millones');

    expect(response.properties.length).toBe(0);
    expect(response.reply).toContain('300.000.000');
    expect(response.reply).toContain('casas en venta');
    expect(response.reply).toContain('empiezan desde');
    expect(response.reply).not.toContain('IBG-');
  });

  it('Compra de apartamento con presupuesto de 50 millones debe indicar que empiezan desde $210.000.000 COP sin listar inmuebles', async () => {
    const convId = `test-habitat-apto-50m-${Date.now()}`;
    const response = await processUserMessage(convId, 'compra de apartamento con presupuesto de 50 millones');

    expect(response.properties.length).toBe(0);
    expect(response.reply).toContain('210.000.000');
    expect(response.reply).toContain('apartamentos en venta');
    expect(response.reply).toContain('empiezan desde');
    expect(response.reply).not.toContain('IBG-');
  });

  it('Compra en general con presupuesto de 10 millones debe indicar que empiezan desde $210.000.000 COP', async () => {
    const convId = `test-habitat-compra-10m-${Date.now()}`;
    const response = await processUserMessage(convId, 'compra con presupuesto de 10 millones');

    expect(response.properties.length).toBe(0);
    expect(response.reply).toContain('210.000.000');
    expect(response.reply).toContain('en venta');
    expect(response.reply).toContain('empiezan desde');
  });

  it('Arriendo de casa con presupuesto de 500 mil debe indicar que empiezan desde $900.000 COP al mes', async () => {
    const convId = `test-habitat-arr-casa-${Date.now()}`;
    const response = await processUserMessage(convId, 'arriendo de casa con presupuesto de 500 mil');

    expect(response.properties.length).toBe(0);
    expect(response.reply).toContain('900.000');
    expect(response.reply).toContain('casas en arriendo');
    expect(response.reply).toContain('empiezan desde');
  });

  it('Arriendo de apartamento con presupuesto de 500 mil debe indicar que empiezan desde $850.000 COP al mes', async () => {
    const convId = `test-habitat-arr-apto-${Date.now()}`;
    const response = await processUserMessage(convId, 'arriendo de apartamento con presupuesto de 500 mil');

    expect(response.properties.length).toBe(0);
    expect(response.reply).toContain('850.000');
    expect(response.reply).toContain('apartamentos en arriendo');
    expect(response.reply).toContain('empiezan desde');
  });

  it('Antes de dar opciones de compra debe preguntar por el presupuesto', async () => {
    const convId = `test-habitat-ask-budget-${Date.now()}`;
    const response = await processUserMessage(convId, 'Hola, quiero comprar una casa');

    expect(response.properties.length).toBe(0);
    expect(response.reply.toLowerCase()).toContain('presupuesto');
    expect(response.reply.toLowerCase()).toContain('casa');
  });

  it('Al preguntar por un sector específico sin operación, debe nombrar explícitamente ese sector y el tipo de inmueble', async () => {
    const convId = `test-sector-vergel-${Date.now()}`;
    const response = await processUserMessage(convId, 'Un apartamento en el vergel');

    expect(response.reply).toContain('El Vergel');
    expect(response.reply).toContain('apartamento');
    expect(response.reply).toContain('arriendo o para comprar');
    expect(response.reply).not.toContain('en Ibagué!');
  });

  it('Al preguntar por otro sector específico (ej. Calambeo o Cádiz), debe nombrar ese sector específico', async () => {
    const convId1 = `test-sector-calambeo-${Date.now()}`;
    const resCalambeo = await processUserMessage(convId1, 'Una casa en calambeo');
    expect(resCalambeo.reply).toContain('Calambeo');
    expect(resCalambeo.reply).toContain('casa');

    const convId2 = `test-sector-cadiz-${Date.now()}`;
    const resCadiz = await processUserMessage(convId2, 'Un apartamento en cadiz');
    expect(resCadiz.reply).toContain('Cádiz');
    expect(resCadiz.reply).toContain('apartamento');
  });
});
