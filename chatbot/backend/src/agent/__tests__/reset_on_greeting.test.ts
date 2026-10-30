import { describe, it, expect } from 'vitest';
import { processUserMessage } from '../orchestrator.js';
import { getConversationState } from '../state.js';

describe('Reinicio de conversación con Saludo ("HOLA")', () => {
  it('al recibir "HOLA" o "como estas?" debe reiniciar el estado de la conversación y formular las preguntas guía', async () => {
    const convId = `test-reset-${Date.now()}`;

    // Paso 1: Usuario busca algo y genera estado previo
    await processUserMessage(convId, 'Busco apartamento en arriendo en El Vergel por 2 millones');
    const stateBefore = await getConversationState(convId);
    expect(stateBefore.criterios.operacion).toBe('arriendo');
    expect(stateBefore.criterios.tipo).toBe('apartamento');

    // Paso 2: Usuario escribe "HOLA"
    const response = await processUserMessage(convId, 'HOLA');

    // Verificar que respondió con saludo y preguntas guía
    expect(response.reply).toContain('¡Hola! Qué gusto saludarte');
    expect(response.reply).toContain('¿Estás buscando inmueble en arriendo o para comprar?');
    expect(response.properties.length).toBe(0);

    // Verificar que el estado acumulado de criterios previos se limpió
    const stateAfter = await getConversationState(convId);
    expect(stateAfter.criterios.tipo).toBeUndefined();
    expect(stateAfter.criterios.operacion).toBeUndefined();
    expect(stateAfter.ultimo_listado_ids.length).toBe(0);
  });

  it('al recibir "como estas?" debe saludar cordialmente y hacer preguntas sin buscar inmuebles vacíos', async () => {
    const convId = `test-saludo-${Date.now()}`;
    const response = await processUserMessage(convId, 'como estas?');

    expect(response.reply).toContain('¡Hola! Qué gusto saludarte');
    expect(response.reply).not.toContain('No encontramos inmuebles con esos criterios');
    expect(response.properties.length).toBe(0);
  });
});
