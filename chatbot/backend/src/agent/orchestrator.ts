import { Property } from '../types/index.js';
import { getConversationState, saveConversationState, mergeConversationCriterios } from './state.js';
import { understandUserMessage } from './nlu.js';
import { evaluateClarificationPolicy } from './clarification.js';
import { buscarInmuebles } from '../tools/search.js';
import { obtenerDetalleInmueble } from '../tools/detail.js';
import {
  generateGroundedSearchReply,
  generateDeterministicSearchReply,
  generateDeterministicDetailReply
} from './generator.js';
import { verifyReplyIntegrity } from '../verification/verifier.js';
import { buildWhatsAppLink } from '../services/whatsapp.js';
import { query } from '../db/index.js';

export interface ChatResponse {
  conversationId: string;
  reply: string;
  properties: Property[];
  needsHuman: boolean;
  whatsappUrl?: string;
  metadata?: Record<string, any>;
}

export async function processUserMessage(
  conversationId: string,
  userMessage: string
): Promise<ChatResponse> {
  const meta: Record<string, any> = {
    received_at: new Date().toISOString(),
  };

  // 1. Obtener estado previo de la conversación
  const state = await getConversationState(conversationId);

  // 2. Comprensión (NLU estructurada)
  const understanding = await understandUserMessage(userMessage);
  meta.understanding = understanding;

  // Detección de reinicio o saludo puro (ej. "hola", "cómo estás", "reiniciar")
  const isPureGreetingOrReset =
    /^\s*(hola|buen[oa]s?|buenos d[ií]as|buenas tardes|buenas noches|quiubo|qu[eé] tal|c[oó]mo est[aá]s|reiniciar|inicio|empezar|comenzar)[\s\.,!¡?¿]*$/i.test(userMessage.trim()) ||
    (/^\s*(hola|buenas|reiniciar|inicio)\b/i.test(userMessage.trim()) &&
      !understanding.operacion &&
      !understanding.criterios_duros.tipo &&
      !understanding.criterios_duros.barrios &&
      !understanding.criterios_duros.precio_max &&
      !understanding.codigo_inmueble_mencionado);

  if (isPureGreetingOrReset) {
    // REINICIAR completamente el estado acumulado de la conversación
    state.criterios = { turnos_aclaracion: 1 };
    state.ultimo_listado_ids = [];
    await saveConversationState(state);

    const greetingReply =
      '¡Hola! Qué gusto saludarte. Soy tu asesor virtual inmobiliario en Ibagué. 🏡\n\nPara ayudarte a encontrar la mejor opción en nuestro catálogo, cuéntame:\n\n1. **¿Estás buscando inmueble en arriendo o para comprar?**\n2. **¿Qué tipo de propiedad prefieres** (casa o apartamento)?\n3. **¿Tienes algún presupuesto aproximado o barrio de preferencia** (como El Vergel, Calambeo, Cádiz o Piedra Pintada)?';

    await saveMessagesAndLog(conversationId, userMessage, greetingReply, meta);

    return {
      conversationId,
      reply: greetingReply,
      properties: [],
      needsHuman: false,
      metadata: meta,
    };
  }

  // Si el usuario solicita un tipo de inmueble no residencial (local, lote, oficina, bodega, etc.)
  if (understanding.tipo_no_soportado && !understanding.criterios_duros.tipo) {
    const waLink = buildWhatsAppLink({
      criterios: state.criterios,
      motivo: 'asesor'
    });

    const reply = `Actualmente nuestro catálogo se especializa única y exclusivamente en **casas y apartamentos** en Ibagué. 🏡🏢\n\n¿Te gustaría que busquemos una casa o un apartamento residencial? O si requieres asesoría comercial para un ${understanding.tipo_no_soportado}, con gusto te puedo comunicar con un asesor por WhatsApp.`;

    await saveMessagesAndLog(conversationId, userMessage, reply, meta);

    return {
      conversationId,
      reply,
      properties: [],
      needsHuman: false,
      whatsappUrl: waLink,
      metadata: meta,
    };
  }

  // Si el usuario explícitamente solicita asesor, negociar, documentos o visita
  if (understanding.solicita_asesor || understanding.intencion === 'hablar_con_asesor') {
    const waLink = buildWhatsAppLink({
      criterios: state.criterios,
      codigoInmueble: understanding.codigo_inmueble_mencionado || state.ultimo_listado_ids[0],
      motivo: /visita/i.test(userMessage) ? 'visita' : (/negociar|descuento/i.test(userMessage) ? 'negociacion' : 'asesor')
    });

    const reply = '¡Con mucho gusto! Para trámites notariales, visitas presenciales o negociación comercial, te comunico directamente con nuestro asesor especializado en Ibagué. Haz clic en el siguiente enlace para chatear por WhatsApp.';

    await saveMessagesAndLog(conversationId, userMessage, reply, meta);

    return {
      conversationId,
      reply,
      properties: [],
      needsHuman: true,
      whatsappUrl: waLink,
      metadata: meta,
    };
  }

  // 3. Caso: Detalle específico de un inmueble
  if (understanding.intencion === 'detalle_inmueble' && understanding.codigo_inmueble_mencionado) {
    const prop = await obtenerDetalleInmueble(understanding.codigo_inmueble_mencionado);
    if (prop) {
      const reply = generateDeterministicDetailReply(prop);
      const waLink = buildWhatsAppLink({
        propiedad: prop,
        codigoInmueble: prop.codigo,
        motivo: 'visita'
      });

      await saveMessagesAndLog(conversationId, userMessage, reply, meta);

      return {
        conversationId,
        reply,
        properties: [prop],
        needsHuman: false,
        whatsappUrl: waLink,
        metadata: meta,
      };
    }
  }

  // 4. Fusión de estado acumulado con lo nuevo extraído
  state.criterios = mergeConversationCriterios(state.criterios, understanding, userMessage);

  // 5. Política de aclaración (máximo 2 preguntas seguidas)
  const clarification = evaluateClarificationPolicy(state.criterios);
  if (clarification.needsClarification && clarification.question) {
    state.criterios.turnos_aclaracion = (state.criterios.turnos_aclaracion || 0) + 1;
    if (clarification.fieldNeeded === 'presupuesto_venta') {
      state.criterios.turnos_presupuesto = (state.criterios.turnos_presupuesto || 0) + 1;
    }
    await saveConversationState(state);

    const reply = clarification.question;
    await saveMessagesAndLog(conversationId, userMessage, reply, meta);

    return {
      conversationId,
      reply,
      properties: [],
      needsHuman: false,
      metadata: meta,
    };
  }

  // 6. Búsqueda híbrida en catálogo
  const searchResult = await buscarInmuebles({
    ...state.criterios,
    excluir_codigos: state.criterios.orden_precio ? undefined : state.ultimo_listado_ids,
  });

  const propertiesToReturn = searchResult.inmuebles.map(i => i.inmueble);

  // 7. Generación anclada de respuesta
  let rawReply = await generateGroundedSearchReply(
    searchResult.inmuebles,
    userMessage,
    searchResult.criterio_relajado,
    state.criterios
  );

  // 8. Verificación determinista obligatoria antes de enviar
  let verification = await verifyReplyIntegrity(rawReply);
  meta.verification_attempt_1 = verification;

  if (!verification.isValid) {
    console.warn('[Orchestrator] Discrepancia detectada en intento 1. Regenerando de forma determinista...');
    // Reintento determinista 1: usar plantilla estricta
    rawReply = generateDeterministicSearchReply(searchResult.inmuebles, searchResult.criterio_relajado);
    verification = await verifyReplyIntegrity(rawReply);
    meta.verification_attempt_2 = verification;

    // Si aún persistiera cualquier anomalía (ej. código inventado que no existe en el catálogo devuelto)
    if (!verification.isValid) {
      console.error('[Orchestrator] Fallo de verificación persistente. Enviando respuesta segura sin datos dudosos.');
      meta.verification_failed = true;
      meta.discrepancies = verification.discrepancies;

      const safeWaLink = buildWhatsAppLink({
        criterios: state.criterios,
        motivo: 'verificacion_dudosa'
      });

      const safeReply = 'Déjame confirmar esos datos con un asesor para garantizarte la información exacta y vigente de nuestro catálogo. Puedes escribirnos directamente por WhatsApp.';

      await saveMessagesAndLog(conversationId, userMessage, safeReply, meta);

      return {
        conversationId,
        reply: safeReply,
        properties: [],
        needsHuman: true,
        whatsappUrl: safeWaLink,
        metadata: meta,
      };
    }
  }

  // Actualizar estado de conversación con los nuevos IDs mostrados
  if (propertiesToReturn.length > 0) {
    state.ultimo_listado_ids = [
      ...state.ultimo_listado_ids,
      ...propertiesToReturn.map(p => p.codigo)
    ];
  }
  // Resetear contador de aclaraciones tras una búsqueda exitosa
  state.criterios.turnos_aclaracion = 0;
  await saveConversationState(state);

  const waLink = propertiesToReturn.length > 0
    ? buildWhatsAppLink({
        criterios: state.criterios,
        codigoInmueble: propertiesToReturn[0].codigo,
        motivo: 'visita'
      })
    : undefined;

  await saveMessagesAndLog(conversationId, userMessage, rawReply, meta);

  return {
    conversationId,
    reply: rawReply,
    properties: propertiesToReturn,
    needsHuman: false,
    whatsappUrl: waLink,
    metadata: meta,
  };
}

async function saveMessagesAndLog(
  conversationId: string,
  userMessage: string,
  assistantReply: string,
  metadata: Record<string, any>
) {
  try {
    // Asegurar que la conversación existe
    await query(`INSERT INTO conversations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [conversationId]);

    // Mensaje del usuario
    await query(
      `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
      [conversationId, userMessage]
    );

    // Respuesta del asistente con metadata de auditoría
    await query(
      `INSERT INTO messages (conversation_id, role, content, metadata) VALUES ($1, 'assistant', $2, $3)`,
      [conversationId, assistantReply, JSON.stringify(metadata)]
    );
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[Orchestrator] Error persistiendo mensajes en DB:', err);
    }
  }
}
