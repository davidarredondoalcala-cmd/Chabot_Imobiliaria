import { ConversationCriterios } from './types';

export interface ClarificationDecision {
  needsClarification: boolean;
  question?: string;
  fieldNeeded?: 'operacion' | 'presupuesto_o_zona' | 'presupuesto_venta';
}

/** Máximo de veces seguidas que se insiste por el presupuesto en una compra */
const MAX_PREGUNTAS_PRESUPUESTO_VENTA = 2;

/**
 * Evalúa si se requiere formular una pregunta de aclaración al usuario.
 * Criterios esenciales: operación y presupuesto aproximado (o zona).
 * En COMPRA el presupuesto es obligatorio antes de mostrar opciones.
 * Máximo 2 turnos de aclaración seguidos.
 */
export function evaluateClarificationPolicy(criterios: ConversationCriterios): ClarificationDecision {
  const turnos = criterios.turnos_aclaracion || 0;
  const hasPresupuesto = (criterios.precio_max != null && criterios.precio_max > 0) || (criterios.precio_min != null && criterios.precio_min > 0);
  const hasBarrio = Boolean(criterios.barrios && criterios.barrios.length > 0);
  const hasCiudad = Boolean(criterios.ciudad);
  const hasZona = hasBarrio || hasCiudad;
  const sector = hasBarrio
    ? ` en ${criterios.barrios!.join(', ')}`
    : hasCiudad
      ? ` en ${criterios.ciudad}`
      : '';

  // Si el usuario aceptó ver otras zonas o todas las opciones de la ciudad, NO solicitar aclaración de barrio
  if (criterios.acepta_otras_zonas) {
    return { needsClarification: false };
  }

  // Si el usuario ya fue informado de que su presupuesto era insuficiente y ahora está explorando opciones ("muéstrame...", habitaciones, etc.),
  // no bloquearlo con otra aclaración de presupuesto: permitirle ver el catálogo disponible
  if (criterios.presupuesto_insuficiente_anterior || criterios.explorando_sin_presupuesto) {
    return { needsClarification: false };
  }

  // Si el usuario ya especificó un sector, barrio o ciudad, NO lo bloqueamos:
  // ejecutamos la búsqueda de inmediato para mostrarle opciones reales disponibles
  // y en la respuesta se le sugiere afinar detalles si es necesario.
  if (hasZona) {
    return { needsClarification: false };
  }

  // Límite estricto de máximo 2 preguntas de aclaración seguidas
  if (turnos >= 2) {
    return { needsClarification: false };
  }

  // Compra general sin presupuesto y sin zona: preguntar presupuesto o zona antes de dar opciones
  if (
    criterios.operacion === 'venta' &&
    !hasPresupuesto &&
    !criterios.orden_precio &&
    (criterios.turnos_presupuesto || 0) < MAX_PREGUNTAS_PRESUPUESTO_VENTA
  ) {
    const que = criterios.tipo === 'casa' ? 'la casa' : criterios.tipo === 'apartamento' ? 'el apartamento' : 'la casa o el apartamento';
    return {
      needsClarification: true,
      fieldNeeded: 'presupuesto_venta',
      question: `¡Perfecto, vamos a buscar para comprar! Antes de mostrarte opciones, cuéntame: ¿con qué presupuesto aproximado cuentas para ${que}? (por ejemplo: "300 millones")`,
    };
  }

  // Falta operación (arriendo o venta) y tampoco hay zona especificada
  if (!criterios.operacion) {
    const inmuebleTexto = criterios.tipo === 'casa'
      ? 'tu casa ideal'
      : criterios.tipo === 'apartamento'
        ? 'tu apartamento ideal'
        : 'tu inmueble ideal';

    return {
      needsClarification: true,
      fieldNeeded: 'operacion',
      question: `¡Con gusto te ayudo a encontrar ${inmuebleTexto}! ¿Estás buscando en arriendo o para comprar? También puedes indicarme la ciudad o sector de tu preferencia.`,
    };
  }

  // Si el usuario pidió explícitamente ordenar por precio (más caros o más baratos),
  // no se debe pedir presupuesto porque su objetivo es ver los extremos del catálogo
  if (criterios.orden_precio) {
    return { needsClarification: false };
  }

  // Falta presupuesto aproximado Y falta zona
  if (!hasPresupuesto) {
    return {
      needsClarification: true,
      fieldNeeded: 'presupuesto_o_zona',
      question: `Perfecto para ${criterios.operacion}. ¿Tienes algún presupuesto aproximado en mente o alguna ciudad o sector de tu preferencia?`,
    };
  }

  // Si ya tenemos suficiente información para buscar
  return { needsClarification: false };
}
