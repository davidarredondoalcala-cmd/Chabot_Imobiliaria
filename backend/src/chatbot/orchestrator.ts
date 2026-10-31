import { Property, ChatResponse } from './types';
import { getConversationState, saveConversationState, mergeConversationCriterios, recordMessage } from './state';
import { understandUserMessage, tieneContextoInmobiliario } from './nlu';
import { evaluateClarificationPolicy } from './clarification';
import { buscarInmuebles } from './search';
import { obtenerDetalleInmueble } from './detail';
import {
  generateGroundedSearchReply,
  generateDeterministicSearchReply,
  generateDeterministicDetailReply,
  respuestaCiudadNoSoportada,
  respuestaFueraDeTema,
  respuestaPresupuestoInvalido
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

  // Agradecimiento o cortesía
  const isThankYou = /^\s*(gracias|muchas gracias|mil gracias|gracias vale|excelente gracias|vale gracias|perfecto gracias|todo claro|ok gracias|listo gracias)[\s\.,!¡?¿]*$/i.test(userMessage.trim());
  if (isThankYou) {
    const thankReply = 'Con el mayor gusto. En Habitat Capital estamos a tu completa disposición para orientarte en Ibagué. Si deseas conocer otra zona o agendar una visita a cualquier inmueble, estaré atenta para apoyarte.';
    await recordMessage(conversationId, 'user', userMessage);
    await recordMessage(conversationId, 'assistant', thankReply, meta);
    return {
      conversationId,
      reply: thankReply,
      properties: [],
      needsHuman: false,
      metadata: meta,
    };
  }

  // Preguntas sobre el asistente o cómo está
  const isSmallTalk = /^\s*(c[oó]mo est[aá]s|c[oó]mo te va|qu[eé] tal|quiubo|c[oó]mo andas|qui[eé]n eres)[\s\.,!¡?¿]*$/i.test(userMessage.trim());
  if (isSmallTalk) {
    const talkReply = 'Hola, un gusto saludarte. Soy Jarvis, asesor inmobiliario de Habitat Capital en Ibagué. ¿Estás buscando arrendar o comprar casa o apartamento? Con gusto te orientaré.';
    await recordMessage(conversationId, 'user', userMessage);
    await recordMessage(conversationId, 'assistant', talkReply, meta);
    return {
      conversationId,
      reply: talkReply,
      properties: [],
      needsHuman: false,
      metadata: meta,
    };
  }

  // Detección de reinicio o saludo puro
  const isPureGreetingOrReset =
    /^\s*(hola|buen[oa]s?|buenos d[ií]as|buenas tardes|buenas noches|quiubo|qu[eé] tal|reiniciar|inicio|empezar|comenzar)[\s\.,!¡?¿]*$/i.test(userMessage.trim()) ||
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

    const hora = new Date().getUTCHours() - 5; // Hora de Colombia (UTC-5)
    const saludoHora = (hora >= 5 && hora < 12) ? '¡Buenos días!' : (hora >= 12 && hora < 18) ? '¡Buenas tardes!' : '¡Buenas noches!';

    const greetingReply =
      `${saludoHora} Qué alegría saludarte. Soy **Jarvis**, tu asesor inmobiliario personal de Habitat Capital en Ibagué. 🏡✨\n\nCuéntame un poco sobre lo que buscas para guiarte de la mejor manera:\n\n1. **¿Prefieres en arriendo o para comprar?**\n2. **¿Casa o apartamento?**\n3. **¿Tienes algún barrio favorito** (como El Vergel, La Pola, Calambeo, Cádiz o Piedra Pintada) o presupuesto estimado?`;

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

  // Ayuda y capacidades de Habitat Capital
  const isHelpOrCapabilities = /^\s*(ayuda|qu[eé] puedes hacer|qu[eé] haces|c[oó]mo funciona|servicios|qu[eé] me recomiendas)[\s\.,!¡?¿]*$/i.test(userMessage.trim());
  if (isHelpOrCapabilities) {
    const helpReply = 'Con muchísimo gusto. Como asistente virtual de **Habitat Capital** en Ibagué, puedo orientarte en:\n\n• **Búsqueda en catálogo:** Encontrar casas y apartamentos disponibles en arriendo o para comprar en Ibagué.\n• **Filtros por zona:** Opciones en sectores como El Vergel, Piedra Pintada, La Pola, Calambeo, Cádiz o Centro.\n• **Presupuesto y características:** Filtrar por precio mensual, valor de compra, habitaciones o baños.\n• **Atención personalizada:** Brindarte fichas de inmuebles o comunicarte con un asesor comercial por WhatsApp.\n\n¿Qué tipo de inmueble te gustaría consultar hoy?';
    await recordMessage(conversationId, 'user', userMessage);
    await recordMessage(conversationId, 'assistant', helpReply, meta);
    return {
      conversationId,
      reply: helpReply,
      properties: [],
      needsHuman: false,
      suggestionChips: [
        'Apartamentos en arriendo',
        'Casas en venta en Ibagué',
        'Propiedades en El Vergel',
        'Hablar con un asesor'
      ],
      metadata: meta,
    };
  }

  // Preguntas fuera del tema inmobiliario (matemáticas, clima, recetas, deportes, noticias, cultura, etc.)
  const esFueraDeTema =
    (understanding.fuera_de_tema === true ||
      understanding.intencion === 'fuera_de_tema' ||
      (!tieneContextoInmobiliario(userMessage, understanding) && !isPureGreetingOrReset && !isSmallTalk && !isThankYou && !isHelpOrCapabilities)) &&
    !understanding.operacion &&
    !understanding.criterios_duros.tipo &&
    !understanding.criterios_duros.barrios &&
    !understanding.criterios_duros.precio_max &&
    !understanding.tipo_no_soportado &&
    !understanding.codigo_inmueble_mencionado;

  if (esFueraDeTema) {
    const reply = respuestaFueraDeTema();
    const suggestionChips = [
      'Apartamentos en arriendo',
      'Casas en venta en Ibagué',
      'Propiedades en El Vergel',
      'Hablar con un asesor'
    ];
    await recordMessage(conversationId, 'user', userMessage);
    await recordMessage(conversationId, 'assistant', reply, meta);
    return {
      conversationId,
      reply,
      properties: [],
      needsHuman: false,
      suggestionChips,
      metadata: meta,
    };
  }

  // Búsqueda en una ciudad fuera de la cobertura del catálogo (solo Ibagué)
  const ciudadMencionada = understanding.criterios_duros?.ciudad || null;
  const hayCriteriosBusqueda =
    understanding.operacion ||
    understanding.criterios_duros.tipo ||
    understanding.criterios_duros.barrios ||
    understanding.criterios_duros.precio_max ||
    understanding.criterios_duros.habitaciones_min;
  // Ampliamos el gatillo: cualquier señal de intención inmobiliaria en el mensaje
  // (no solo la intención exacta "buscar") + no es asesoría ni detalle de un código
  const hayIntencionInmobiliaria =
    hayCriteriosBusqueda ||
    understanding.intencion === 'buscar' ||
    /arriendo|arrendar|alquil|comprar?|vender|ventas?|casas?|apartamento|apto|inmueble|busco|buscando|disponible|ofertas?\b/i.test(
      userMessage
    );
  const esCiudadNoCubierta =
    ciudadMencionada &&
    !/ibagu[ée\u00fc]/i.test(ciudadMencionada) &&
    hayIntencionInmobiliaria &&
    !understanding.codigo_inmueble_mencionado &&
    !understanding.solicita_asesor &&
    understanding.intencion !== 'hablar_con_asesor' &&
    understanding.intencion !== 'fuera_de_tema';
  if (esCiudadNoCubierta) {
    const reply = respuestaCiudadNoSoportada(ciudadMencionada);
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

  // Presupuesto mencionado con algo que no es una cifra válida (ej. "una mandarina como presupuesto"):
  // pedir un presupuesto real en pesos, sin celebrar ni aceptar el dato como válido
  const esPresupuestoInvalido =
    understanding.presupuesto_invalido &&
    !understanding.criterios_duros.precio_min &&
    !understanding.criterios_duros.precio_max &&
    !understanding.codigo_inmueble_mencionado &&
    !understanding.solicita_asesor &&
    understanding.intencion !== 'hablar_con_asesor' &&
    understanding.intencion !== 'fuera_de_tema';
  if (esPresupuestoInvalido) {
    const reply = respuestaPresupuestoInvalido();
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
