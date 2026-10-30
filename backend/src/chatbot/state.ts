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

  // Operación:
  if (extracted.operacion) {
    if (current.operacion && current.operacion !== extracted.operacion && userMessage) {
      const lower = userMessage.toLowerCase();
      const hasExplicitArriendo = /\b(arriendos?|arrendar|alquiler(?:es)?|alquilar|arrendo)\b/i.test(lower);
      const hasExplicitVenta = /\b(comprar?|compras?|compro|comprarme|adquirir|ventas?|vender)\b/i.test(lower);

      if (extracted.operacion === 'arriendo' && hasExplicitArriendo) {
        merged.operacion = 'arriendo';
      } else if (extracted.operacion === 'venta' && hasExplicitVenta) {
        merged.operacion = 'venta';
      }
    } else {
      merged.operacion = extracted.operacion;
    }
  }

  // Criterios duros
  const { criterios_duros } = extracted;

  if (criterios_duros.tipo) {
    merged.tipo = criterios_duros.tipo;
  }
  if (criterios_duros.ciudad) {
    merged.ciudad = criterios_duros.ciudad;
  }
  if (criterios_duros.barrios && criterios_duros.barrios.length > 0) {
    merged.barrios = criterios_duros.barrios;
  }
  if (criterios_duros.precio_min != null && criterios_duros.precio_min > 0) {
    merged.precio_min = criterios_duros.precio_min;
  }
  if (criterios_duros.precio_max != null && criterios_duros.precio_max > 0) {
    merged.precio_max = criterios_duros.precio_max;
  }
  if (criterios_duros.habitaciones_min != null && criterios_duros.habitaciones_min > 0) {
    merged.habitaciones_min = criterios_duros.habitaciones_min;
  }
  if (criterios_duros.banos_min != null && criterios_duros.banos_min > 0) {
    merged.banos_min = criterios_duros.banos_min;
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
