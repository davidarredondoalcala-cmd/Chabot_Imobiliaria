import { Property, ChatResponse } from './types';
import { getConversationState, saveConversationState, mergeConversationCriterios, recordMessage } from './state';
import { understandUserMessage } from './nlu';
import { evaluateClarificationPolicy } from './clarification';
import { buscarInmuebles } from './search';
import { obtenerDetalleInmueble } from './detail';
import {
  generateGroundedSearchReply,
  generateDeterministicSearchReply,
  generateDeterministicDetailReply
} from './generator';
import { verifyReplyIntegrity } from './verifier';
import { buildWhatsAppLink } from './whatsapp';

export async function processUserMessage(
  conversationId: string,
  userMessage: string,
  extraProperties?: Property[]
): Promise<ChatResponse> {
  const meta: Record<string, any> = {
    received_at: new Date().toISOString(),
  };

  // 1. Obtener estado previo
  const state = await getConversationState(conversationId);

  // 2. Comprensión (NLU estructurada)
  const understanding = await understandUserMessage(userMessage);
  meta.understanding = understanding;

  // Detección de reinicio o saludo puro
  const isPureGreetingOrReset =
    /^\s*(hola|buen[oa]s?|buenos d[ií]as|buenas tardes|buenas noches|quiubo|qu[eé] tal|c[oó]mo est[aá]s|reiniciar|inicio|empezar|comenzar)[\s\.,!¡?¿]*$/i.test(userMessage.trim()) ||
    (/^\s*(hola|buenas|reiniciar|inicio)\b/i.test(userMessage.trim()) &&
      !understanding.operacion &&
      !understanding.criterios_duros.tipo &&
      !understanding.criterios_duros.barrios &&
      !understanding.criterios_duros.precio_max &&
      !understanding.codigo_inmueble_mencionado);

  if (isPureGreetingOrReset) {
    state.criterios = { turnos_aclaracion: 1 };
    state.ultimo_listado_ids = [];
    await saveConversationState(state);

    const greetingReply =
      '¡Hola! Qué gusto saludarte. Soy tu asesor virtual inmobiliario de Habitat Capital en Ibagué. 🏡\n\nPara ayudarte a encontrar la mejor opción en nuestro catálogo, cuéntame:\n\n1. **¿Estás buscando inmueble en arriendo o para comprar?**\n2. **¿Qué tipo de propiedad prefieres** (casa o apartamento)?\n3. **¿Tienes algún presupuesto aproximado o barrio de preferencia** (como El Vergel, Calambeo, Cádiz o Piedra Pintada)?';

    await recordMessage(conversationId, 'user', userMessage);
    await recordMessage(conversationId, 'assistant', greetingReply, meta);

    return {
      conversationId,
      reply: greetingReply,
      properties: [],
      needsHuman: false,
      metadata: meta,
    };
  }

  // Solicitud no residencial
  if (understanding.tipo_no_soportado && !understanding.criterios_duros.tipo) {
    const waLink = buildWhatsAppLink({
      criterios: state.criterios,
      motivo: 'asesor'
    });

    const reply = `Actualmente nuestro catálogo se especializa única y exclusivamente en **casas y apartamentos** en Ibagué. 🏡🏢\n\n¿Te gustaría que busquemos una casa o un apartamento residencial? O si requieres asesoría comercial para un ${understanding.tipo_no_soportado}, con gusto te puedo comunicar con un asesor por WhatsApp.`;

    await recordMessage(conversationId, 'user', userMessage);
    await recordMessage(conversationId, 'assistant', reply, meta);

    return {
      conversationId,
      reply,
      properties: [],
      needsHuman: false,
      whatsappUrl: waLink,
      metadata: meta,
    };
  }

  // Solicitud explícita de asesor
  if (understanding.solicita_asesor || understanding.intencion === 'hablar_con_asesor') {
    const waLink = buildWhatsAppLink({
      criterios: state.criterios,
      codigoInmueble: understanding.codigo_inmueble_mencionado || state.ultimo_listado_ids[0],
      motivo: /visita/i.test(userMessage) ? 'visita' : (/negociar|descuento/i.test(userMessage) ? 'negociacion' : 'asesor')
    });

    const reply = '¡Con mucho gusto! Para trámites notariales, visitas presenciales o negociación comercial, te comunico directamente con nuestro asesor especializado en Ibagué. Haz clic en el siguiente enlace para chatear por WhatsApp.';

    await recordMessage(conversationId, 'user', userMessage);
    await recordMessage(conversationId, 'assistant', reply, meta);

    return {
      conversationId,
      reply,
      properties: [],
      needsHuman: true,
      whatsappUrl: waLink,
      metadata: meta,
    };
  }

  // Detalle de inmueble
  if (understanding.intencion === 'detalle_inmueble' && understanding.codigo_inmueble_mencionado) {
    const prop = await obtenerDetalleInmueble(understanding.codigo_inmueble_mencionado, extraProperties);
    if (prop) {
      const reply = generateDeterministicDetailReply(prop);
      const waLink = buildWhatsAppLink({
        propiedad: prop,
        codigoInmueble: prop.codigo,
        motivo: 'visita'
      });

      await recordMessage(conversationId, 'user', userMessage);
      await recordMessage(conversationId, 'assistant', reply, meta);

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

  // Fusión de estado
  state.criterios = mergeConversationCriterios(state.criterios, understanding, userMessage);

  // Política de aclaración
  const clarification = evaluateClarificationPolicy(state.criterios);
  if (clarification.needsClarification && clarification.question) {
    state.criterios.turnos_aclaracion = (state.criterios.turnos_aclaracion || 0) + 1;
    if (clarification.fieldNeeded === 'presupuesto_venta') {
      state.criterios.turnos_presupuesto = (state.criterios.turnos_presupuesto || 0) + 1;
    }
    await saveConversationState(state);

    const reply = clarification.question;
    await recordMessage(conversationId, 'user', userMessage);
    await recordMessage(conversationId, 'assistant', reply, meta);

    return {
      conversationId,
      reply,
      properties: [],
      needsHuman: false,
      metadata: meta,
    };
  }

  // Búsqueda en catálogo
  const searchResult = await buscarInmuebles({
    ...state.criterios,
    excluir_codigos: state.criterios.orden_precio ? undefined : state.ultimo_listado_ids,
  }, extraProperties);

  const propertiesToReturn = searchResult.inmuebles.map(i => i.inmueble);

  // Generación anclada
  let rawReply = await generateGroundedSearchReply(
    searchResult.inmuebles,
    userMessage,
    searchResult.criterio_relajado,
    state.criterios
  );

  // Verificación determinista
  let verification = await verifyReplyIntegrity(rawReply, extraProperties);
  meta.verification_attempt_1 = verification;

  if (!verification.isValid) {
    rawReply = generateDeterministicSearchReply(searchResult.inmuebles, searchResult.criterio_relajado, state.criterios);
    verification = await verifyReplyIntegrity(rawReply, extraProperties);
    meta.verification_attempt_2 = verification;

    if (!verification.isValid) {
      meta.verification_failed = true;
      meta.discrepancies = verification.discrepancies;

      const safeWaLink = buildWhatsAppLink({
        criterios: state.criterios,
        motivo: 'verificacion_dudosa'
      });

      const safeReply = 'Déjame confirmar esos datos con un asesor para garantizarte la información exacta y vigente de nuestro catálogo. Puedes escribirnos directamente por WhatsApp.';

      await recordMessage(conversationId, 'user', userMessage);
      await recordMessage(conversationId, 'assistant', safeReply, meta);

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

  if (propertiesToReturn.length > 0) {
    state.ultimo_listado_ids = [
      ...state.ultimo_listado_ids,
      ...propertiesToReturn.map(p => p.codigo)
    ];
  }

  state.criterios.turnos_aclaracion = 0;
  await saveConversationState(state);

  const waLink = propertiesToReturn.length > 0
    ? buildWhatsAppLink({
        criterios: state.criterios,
        codigoInmueble: propertiesToReturn[0].codigo,
        motivo: 'visita'
      })
    : undefined;

  await recordMessage(conversationId, 'user', userMessage);
  await recordMessage(conversationId, 'assistant', rawReply, meta);

  return {
    conversationId,
    reply: rawReply,
    properties: propertiesToReturn,
    needsHuman: false,
    whatsappUrl: waLink,
    metadata: meta,
  };
}
