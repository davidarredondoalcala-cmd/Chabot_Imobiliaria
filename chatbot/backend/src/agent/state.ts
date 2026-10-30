import { query } from '../db/index.js';
import { ConversationCriterios, ConversationState, ExtractedUnderstanding } from '../types/index.js';

// Memoria volátil para sesiones locales / tests
const memoryStates = new Map<string, ConversationState>();

export async function getConversationState(conversationId: string): Promise<ConversationState> {
  try {
    const res = await query(
      `SELECT conversation_id, criterios, ultimo_listado_ids, updated_at
       FROM conversation_state
       WHERE conversation_id = $1`,
      [conversationId]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        conversation_id: row.conversation_id,
        criterios: (row.criterios as ConversationCriterios) || {},
        ultimo_listado_ids: row.ultimo_listado_ids || [],
        updated_at: new Date(row.updated_at),
      };
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[State] Error consultando conversation_state en PostgreSQL:', err);
    }
  }

  // Fallback en memoria
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
  memoryStates.set(state.conversation_id, state);

  try {
    // Asegurar que la conversación existe primero en la tabla conversations
    await query(
      `INSERT INTO conversations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
      [state.conversation_id]
    );

    await query(
      `INSERT INTO conversation_state (conversation_id, criterios, ultimo_listado_ids, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (conversation_id) DO UPDATE SET
         criterios = EXCLUDED.criterios,
         ultimo_listado_ids = EXCLUDED.ultimo_listado_ids,
         updated_at = NOW()`,
      [state.conversation_id, JSON.stringify(state.criterios), state.ultimo_listado_ids]
    );
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[State] Error guardando conversation_state en PostgreSQL:', err);
    }
  }
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
      // Si la operación previa era venta o arriendo y el usuario no usó palabras explícitas de cambio, se preserva la operación establecida
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
      // Si el usuario pide explícitamente ver los más caros o los más baratos,
      // limpiamos restricciones de presupuesto previas para mostrar el ranking real del catálogo
      merged.precio_max = null;
      merged.precio_min = null;
    }
  }

  // Criterios blandos: acumular si son complementarios o actualizar
  if (extracted.criterios_blandos && extracted.criterios_blandos.trim().length > 0) {
    if (merged.criterios_blandos) {
      merged.criterios_blandos = `${merged.criterios_blandos}, ${extracted.criterios_blandos}`;
    } else {
      merged.criterios_blandos = extracted.criterios_blandos;
    }
  }

  return merged;
}
