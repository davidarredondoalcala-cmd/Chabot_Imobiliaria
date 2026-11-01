import { ConversationCriterios, ConversationState, ExtractedUnderstanding } from './types';

// Memoria volátil para sesiones
const memoryStates = new Map<string, ConversationState>();
const conversationMessages = new Map<string, Array<{ id: string; role: string; content: string; created_at: string; metadata?: any }>>();

export async function getConversationState(conversationId: string): Promise<ConversationState> {
  if (memoryStates.has(conversationId)) {
    return memoryStates.get(conversationId)!;
  }

  const newState: ConversationState = {
    conversation_id: conversationId,
    criterios: { turnos_aclaracion: 0 },
    ultimo_listado_ids: [],
    updated_at: new Date(),
  };
  memoryStates.set(conversationId, newState);
  return newState;
}

export async function saveConversationState(state: ConversationState): Promise<void> {
  state.updated_at = new Date();
  memoryStates.set(state.conversation_id, state);
}

export async function getConversationMessages(conversationId: string) {
  return conversationMessages.get(conversationId) || [];
}

export async function recordMessage(conversationId: string, role: 'user' | 'assistant', content: string, metadata?: any) {
  const list = conversationMessages.get(conversationId) || [];
  list.push({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    created_at: new Date().toISOString(),
    metadata,
  });
  conversationMessages.set(conversationId, list);
}

/**
 * Fusiona los criterios acumulados con los nuevos extraídos del último mensaje.
 * Si el usuario cambia una preferencia explícita, la nueva reemplaza a la anterior.
 */
export function mergeConversationCriterios(
  current: ConversationCriterios,
  extracted: ExtractedUnderstanding,
  userMessage?: string
): ConversationCriterios {
  const merged: ConversationCriterios = { ...current };
  const lower = (userMessage || '').toLowerCase();

  // 1. Detección de reseteo explícito o flexibilización de presupuesto
  const pideResetPresupuesto = /\b(sin\s+presupuesto|cualquier\s+(?:precio|presupuesto|valor)|sin\s+l[ií]mite|no\s+importa\s+el\s+(?:precio|presupuesto|valor)|presupuesto\s+libre|libre\s+de\s+presupuesto)\b/i.test(lower);
  if (pideResetPresupuesto) {
    merged.precio_max = null;
    merged.precio_min = null;
    merged.presupuesto_insuficiente_anterior = false;
  }

  // 2. Operación (arriendo / venta):
  if (extracted.operacion) {
    if (current.operacion && current.operacion !== extracted.operacion) {
      // Cambio explícito de operación: el presupuesto de compra no aplica a arriendo ni viceversa
      merged.operacion = extracted.operacion;
      merged.precio_min = null;
      merged.precio_max = null;
      merged.presupuesto_insuficiente_anterior = false;
    } else {
      merged.operacion = extracted.operacion;
    }
  }

  // 3. Criterios duros
  const { criterios_duros } = extracted;

  const ambosTipos = /\b(ambos|ambas|cualquiera|casa\s+o\s+apartamento|apartamento\s+o\s+casa|casas\s+o\s+apartamentos|no\s+importa\s+el\s+tipo)\b/i.test(lower);
  if (ambosTipos) {
    merged.tipo = null;
  } else if (criterios_duros.tipo) {
    merged.tipo = criterios_duros.tipo;
  }
  if (criterios_duros.amenidades && criterios_duros.amenidades.length > 0) {
    merged.amenidades = criterios_duros.amenidades;
  }
  if (criterios_duros.ciudad) {
    merged.ciudad = criterios_duros.ciudad;
  }

  // Zonas / Barrios / Aceptación de otras zonas:
  const aceptaOtrasZonas = /otras?\s+(?:zonas?|sectores?|barrios?)|todas?\s+las\s+(?:zonas?|opciones)|sin\s+importar\s+el\s+(?:barrio|sector)|cualquier\s+(?:zona|barrio|sector)|toda\s+la\s+ciudad|en\s+ibagu[eé]/i.test(lower);

  if (criterios_duros.barrios && criterios_duros.barrios.length > 0) {
    merged.barrios = criterios_duros.barrios;
    merged.acepta_otras_zonas = false;
  } else if (aceptaOtrasZonas) {
    // El usuario aceptó o pidió ver otras zonas / toda la ciudad
    merged.barrios = null;
    merged.acepta_otras_zonas = true;
  }

  // Presupuesto nuevo en este mensaje:
  if (criterios_duros.precio_min != null && criterios_duros.precio_min > 0) {
    merged.precio_min = criterios_duros.precio_min;
    merged.presupuesto_insuficiente_anterior = false;
  }
  if (criterios_duros.precio_max != null && criterios_duros.precio_max > 0) {
    merged.precio_max = criterios_duros.precio_max;
    merged.presupuesto_insuficiente_anterior = false;
  }

  // Si el presupuesto anterior fue insuficiente (por debajo del mínimo) y el usuario
  // ahora pide ver inmuebles o cambia criterios (como habitaciones, tipo, etc.) SIN mencionar un presupuesto nuevo:
  // soltamos el presupuesto imposible para que no quede atascado en bucle.
  const cambioCriteriosSinPresupuesto =
    (criterios_duros.habitaciones_min != null ||
     criterios_duros.habitaciones_max != null ||
     criterios_duros.tipo != null ||
     criterios_duros.barrios != null ||
     aceptaOtrasZonas ||
     /\b(?:mu[eé]strame|ver|qu[eé]\s+(?:tienes|hay|opciones)|algun(?:os?|as?)|opciones|ens[eé][nñ]ame)\b/i.test(lower)) &&
    criterios_duros.precio_max == null &&
    criterios_duros.precio_min == null;

  if (current.presupuesto_insuficiente_anterior && cambioCriteriosSinPresupuesto) {
    merged.precio_max = null;
    merged.precio_min = null;
    merged.presupuesto_insuficiente_anterior = true;
    merged.explorando_sin_presupuesto = true;
  }

  // Habitaciones:
  if (criterios_duros.habitaciones_min !== undefined) {
    merged.habitaciones_min = criterios_duros.habitaciones_min;
  }
  if (criterios_duros.habitaciones_max !== undefined) {
    merged.habitaciones_max = criterios_duros.habitaciones_max;
  }

  // Baños:
  if (criterios_duros.banos_min !== undefined) {
    merged.banos_min = criterios_duros.banos_min;
  }
  if (criterios_duros.banos_max !== undefined) {
    merged.banos_max = criterios_duros.banos_max;
  }

  if (criterios_duros.parqueaderos_min != null && criterios_duros.parqueaderos_min > 0) {
    merged.parqueaderos_min = criterios_duros.parqueaderos_min;
  }
  if (criterios_duros.area_min != null && criterios_duros.area_min > 0) {
    merged.area_min = criterios_duros.area_min;
  }
  if (criterios_duros.estrato != null && criterios_duros.estrato > 0) {
    merged.estrato = criterios_duros.estrato;
  }
  if (criterios_duros.orden_precio !== undefined) {
    merged.orden_precio = criterios_duros.orden_precio;
    if (criterios_duros.orden_precio != null) {
      merged.precio_max = null;
      merged.precio_min = null;
    }
  }

  // Criterios blandos
  if (extracted.criterios_blandos && extracted.criterios_blandos.trim().length > 0) {
    if (merged.criterios_blandos) {
      merged.criterios_blandos = `${merged.criterios_blandos}, ${extracted.criterios_blandos}`;
    } else {
      merged.criterios_blandos = extracted.criterios_blandos;
    }
  }

  return merged;
}
