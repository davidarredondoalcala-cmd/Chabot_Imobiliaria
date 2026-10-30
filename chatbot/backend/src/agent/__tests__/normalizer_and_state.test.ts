import { describe, it, expect } from 'vitest';
import { parseSingleAmount, normalizeColombianMoney } from '../normalizer.js';
import { mergeConversationCriterios } from '../state.js';
import { evaluateClarificationPolicy } from '../clarification.js';
import { ExtractedUnderstanding, ConversationCriterios } from '../../types/index.js';

describe('Fase 3: Normalizador de Dinero Colombiano', () => {
  it('debe interpretar correctamente "200 palos" como 200.000.000 COP', () => {
    expect(parseSingleAmount('200 palos')).toBe(200_000_000);
  });

  it('debe interpretar "un palo" y "medio palo"', () => {
    expect(parseSingleAmount('un palo')).toBe(1_000_000);
    expect(parseSingleAmount('medio palo')).toBe(500_000);
    expect(parseSingleAmount('palo y medio')).toBe(1_500_000);
  });

  it('debe interpretar "300 millones" y "1.5 millones"', () => {
    expect(parseSingleAmount('300 millones')).toBe(300_000_000);
    expect(parseSingleAmount('1.5 millones')).toBe(1_500_000);
  });

  it('debe interpretar "1.2 mil millones"', () => {
    expect(parseSingleAmount('1.2 mil millones')).toBe(1_200_000_000);
  });

  it('debe interpretar "800 mil" y "800k"', () => {
    expect(parseSingleAmount('800 mil')).toBe(800_000);
    expect(parseSingleAmount('800k')).toBe(800_000);
  });

  it('debe interpretar "2 y medio" en contexto de arriendo como 2.500.000 COP', () => {
    expect(parseSingleAmount('2 y medio', 'arriendo')).toBe(2_500_000);
  });

  it('debe normalizar presupuestos en frases con límites "hasta 2 millones"', () => {
    const res = normalizeColombianMoney('tengo hasta 2 millones para pagar');
    expect(res.max).toBe(2_000_000);
  });

  it('debe normalizar rangos "entre 1 y 2 millones"', () => {
    const res = normalizeColombianMoney('busco algo entre 1 y 2 millones');
    expect(res.min).toBe(1_000_000);
    expect(res.max).toBe(2_000_000);
  });
});

describe('Fase 3: Fusión de Estado (Conversation State)', () => {
  it('debe reemplazar preferencias anteriores cuando el usuario cambia de opinión', () => {
    const currentState: ConversationCriterios = {
      operacion: 'arriendo',
      tipo: 'apartamento',
      precio_max: 1500000,
      barrios: ['El Vergel'],
      turnos_aclaracion: 0
    };

    const newExtracted: ExtractedUnderstanding = {
      intencion: 'buscar',
      operacion: 'venta', // Cambió de arriendo a venta
      criterios_duros: {
        tipo: 'casa', // Cambió de apartamento a casa
        ciudad: 'Ibagué',
        barrios: ['Calambeo'],
        precio_min: null,
        precio_max: 600000000,
        habitaciones_min: null,
        banos_min: null,
        parqueaderos_min: null,
        area_min: null,
        estrato: null
      },
      criterios_blandos: 'con clima fresco'
    };

    const merged = mergeConversationCriterios(currentState, newExtracted);
    expect(merged.operacion).toBe('venta');
    expect(merged.tipo).toBe('casa');
    expect(merged.barrios).toEqual(['Calambeo']);
    expect(merged.precio_max).toBe(600000000);
    expect(merged.criterios_blandos).toBe('con clima fresco');
  });

  it('debe preservar criterios previos no modificados', () => {
    const currentState: ConversationCriterios = {
      operacion: 'arriendo',
      tipo: 'apartamento',
      precio_max: 2000000,
      barrios: ['Piedra Pintada']
    };

    const updateRooms: ExtractedUnderstanding = {
      intencion: 'buscar',
      operacion: null,
      criterios_duros: {
        tipo: null,
        ciudad: null,
        barrios: null,
        precio_min: null,
        precio_max: null,
        habitaciones_min: 3,
        banos_min: null,
        parqueaderos_min: null,
        area_min: null,
        estrato: null
      },
      criterios_blandos: null
    };

    const merged = mergeConversationCriterios(currentState, updateRooms);
    expect(merged.operacion).toBe('arriendo');
    expect(merged.tipo).toBe('apartamento');
    expect(merged.barrios).toEqual(['Piedra Pintada']);
    expect(merged.precio_max).toBe(2000000);
    expect(merged.habitaciones_min).toBe(3);
  });
});

describe('Fase 3: Política de Aclaración', () => {
  it('debe pedir aclaración si falta la operación', () => {
    const decision = evaluateClarificationPolicy({});
    expect(decision.needsClarification).toBe(true);
    expect(decision.fieldNeeded).toBe('operacion');
  });

  it('debe pedir aclaración si tiene operación pero no tiene presupuesto ni zona', () => {
    const decision = evaluateClarificationPolicy({ operacion: 'arriendo' });
    expect(decision.needsClarification).toBe(true);
    expect(decision.fieldNeeded).toBe('presupuesto_o_zona');
  });

  it('NO debe pedir aclaración si ya tiene operación y presupuesto', () => {
    const decision = evaluateClarificationPolicy({
      operacion: 'arriendo',
      precio_max: 1500000
    });
    expect(decision.needsClarification).toBe(false);
  });

  it('NO debe pedir aclaración si ya tiene operación de arriendo y zona', () => {
    const decision = evaluateClarificationPolicy({
      operacion: 'arriendo',
      barrios: ['El Vergel']
    });
    expect(decision.needsClarification).toBe(false);
  });

  it('en compra SÍ debe pedir aclaración de presupuesto antes de mostrar opciones aunque tenga zona', () => {
    const decision = evaluateClarificationPolicy({
      operacion: 'venta',
      barrios: ['El Vergel']
    });
    expect(decision.needsClarification).toBe(true);
    expect(decision.fieldNeeded).toBe('presupuesto_venta');
  });

  it('NO debe pedir más de 2 aclaraciones seguidas (límite superado)', () => {
    const decision = evaluateClarificationPolicy({
      turnos_aclaracion: 2
    });
    expect(decision.needsClarification).toBe(false);
  });
});
