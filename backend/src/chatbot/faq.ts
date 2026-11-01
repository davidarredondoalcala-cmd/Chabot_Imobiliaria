import { Property, ConversationCriterios, ChatResponse } from './types';
import { getCatalogMinPrice } from './search';
import { formatCOP } from './generator';
import { buildWhatsAppLink } from './whatsapp';

export type PreguntaInformativaTipo =
  | 'requisitos_arriendo'
  | 'requisitos_compra'
  | 'consignar_inmueble'
  | 'mascotas'
  | 'ubicacion_contacto'
  | 'barrios_disponibles'
  | 'extremos_precio'
  | 'visitas_citas';

export interface FAQResult {
  reply: string;
  properties: Property[];
  suggestionChips?: string[];
  whatsappUrl?: string;
  needsHuman?: boolean;
}

/**
 * Detecta si el mensaje del usuario corresponde a una consulta informativa frecuente
 */
export function detectarPreguntaInformativa(userMessage: string): PreguntaInformativaTipo | null {
  const lower = userMessage.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // 1. Requisitos y proceso de arriendo
  const esRequisitosArriendo =
    /\b(requisitos?|documentos?|papeles?|qu[eé]\s+(?:piden|necesito|exigen|se\s+necesita)|c[oó]mo\s+(?:es\s+el\s+proceso|se\s+hace|arriendo|alquilo))\b.*\b(arriend|arrendar|alquiler|alquilar|canon)\b/i.test(lower) ||
    /\b(codeudor|fiador|estudio\s+de\s+arrendatario|p[oó]liza\s+de\s+arriendo)\b/i.test(lower) ||
    /\b(c[oó]mo\s+arrendar|requisitos\s+para\s+arrendar|qu[eé]\s+se\s+necesita\s+para\s+arrendar)\b/i.test(lower);
  if (esRequisitosArriendo) return 'requisitos_arriendo';

  // 2. Requisitos y proceso de compra
  const esRequisitosCompra =
    /\b(requisitos?|pasos?|c[oó]mo\s+es\s+el\s+proceso|qu[eé]\s+(?:necesito|piden|se\s+necesita))\b.*\b(compr|comprar|compraventa|adquirir|adquisici[oó]n|escrituraci[oó]n)\b/i.test(lower) ||
    /\b(cr[eé]dito\s+hipotecario|leasing\s+habitacional|subsidio(?:s)?|separaci[oó]n\s+de\s+inmueble)\b/i.test(lower) ||
    /\b(c[oó]mo\s+comprar|requisitos\s+para\s+comprar|qu[eé]\s+se\s+necesita\s+para\s+comprar)\b/i.test(lower);
  if (esRequisitosCompra) return 'requisitos_compra';

  // 3. Propietarios que desean consignar o publicar
  const esConsignar =
    /\b(consignar|publicar|poner\s+en\s+(?:arriendo|venta)|quiero\s+(?:arrendar|vender)\s+mi|soy\s+propietario|administrar\s+mi\s+inmueble|comisi[oó]n\s+(?:inmobiliaria|por\s+venta|por\s+arriendo))\b/i.test(lower) ||
    /\b(ofrecer\s+mi\s+(?:casa|apartamento|inmueble)|entregar\s+en\s+consignaci[oó]n)\b/i.test(lower);
  if (esConsignar) return 'consignar_inmueble';

  // 4. Políticas de mascotas
  const esMascotas =
    /\b(mascotas?|perros?|gatos?|animales?|pet\s*friendly)\b/i.test(lower) &&
    /\b(aceptan|permiten|admiten|reciben|dejan|se\s+puede|pol[ií]tica)\b/i.test(lower);
  if (esMascotas) return 'mascotas';

  // 5. Ubicación física, horarios y contacto de Habitat Capital
  const esUbicacionContacto =
    /\b(d[oó]nde\s+(?:est[aá]n?|quedan?|se\s+ubican?|tienen\s+la\s+oficina|es\s+la\s+sede)|direcci[oó]n\s+de\s+(?:la\s+inmobiliaria|habitat)|horario\s+de\s+atenci[oó]n|n[uú]mero\s+de\s+tel[eé]fono|tel[eé]fono\s+de\s+contacto)\b/i.test(lower) ||
    /\b(d[oó]nde\s+(?:queda|est[aá]).*oficina|oficina\s+de\s+(?:la\s+inmobiliaria|habitat))\b/i.test(lower) ||
    /^\s*(d[oó]nde\s+est[aá]n?\s+ubicados?|d[oó]nde\s+quedan?|horarios?|tel[eé]fono|contacto)[\s\.,!¡?¿]*$/i.test(lower);
  if (esUbicacionContacto) return 'ubicacion_contacto';

  // 6. Barrios y sectores disponibles
  const esBarrios =
    /\b(?:qu[eé]|cu[aá]les)\s+(?:barrios|zonas|sectores)\s+(?:tienen|manejan|hay|est[aá]n\s+disponibles)/i.test(lower) ||
    /\b(?:en\s+d[oó]nde|d[oó]nde)\s+tienen\s+(?:inmuebles|casas|apartamentos)\b/i.test(lower) ||
    /^\s*(qu[eé]\s+barrios\s+tienen|qu[eé]\s+zonas\s+manejan)[\s\.,!¡?¿]*$/i.test(lower);
  if (esBarrios) return 'barrios_disponibles';

  // 7. Extremos de precios (el más barato, el más caro, precios mínimos)
  const esExtremosPrecio =
    /\b(?:cu[aá]l\s+es\s+(?:el|la)\s+)?(?:inmueble|casa|apartamento|apto)?\s*(?:m[aá]s\s+(?:barat[oa]|econ[oó]mic[oa]|costos[oa]|car[oa]|accesible)|de\s+menor\s+precio|de\s+mayor\s+precio)\b/i.test(lower) ||
    /\bcu[aá]nto\s+es\s+lo\s+m[ií]nimo\s+(?:para|en)\b/i.test(lower) ||
    /\bdesde\s+cu[aá]nto\s+(?:empiezan|parten|inician)\b/i.test(lower);
  if (esExtremosPrecio) return 'extremos_precio';

  // 8. Visitas y citas presenciales
  const esVisitas =
    /\b(c[oó]mo\s+(?:agendar|coordinar|pedir|solicitar)\s+(?:una\s+)?(?:visita|cita)|se\s+puede\s+visitar|quiero\s+visitar|horarios?\s+para\s+visitas?)\b/i.test(lower);
  if (esVisitas) return 'visitas_citas';

  return null;
}

/**
 * Responde de forma precisa, oportuna y contextualizada a la consulta informativa
 */
export function responderPreguntaInformativa(
  tipo: PreguntaInformativaTipo,
  userMessage: string,
  catalog: Property[],
  criterios: ConversationCriterios
): FAQResult {
  const waLink = buildWhatsAppLink({
    criterios,
    motivo: 'asesor'
  });

  switch (tipo) {
    case 'requisitos_arriendo': {
      return {
        reply: `¡Con muchísimo gusto te explico los requisitos para arrendar con **Habitat Capital**! 📝🏡\n\nEl proceso es muy ágil, 100% digital y sin papeleos innecesarios:\n\n1. **Formulario de solicitud:** Se diligencia en línea para estudio de la aseguradora.\n2. **Documento de identidad:** Cédula de ciudadanía del solicitante y codeudor.\n3. **Comprobantes de ingresos:** Extractos bancarios de los últimos 3 meses o desprendibles de nómina (ingresos mínimos del doble del valor del canon).\n4. **Codeudor solvente:** Una persona con estabilidad laboral o finca raíz.\n\nLa respuesta del estudio se entrega en menos de 24 horas hábiles. ¿Te gustaría ver las opciones en arriendo que tenemos disponibles o prefieres contactar a un asesor por WhatsApp?`,
        properties: [],
        suggestionChips: [
          'Apartamentos en arriendo',
          'Casas en arriendo',
          'Hablar con un asesor'
        ],
        whatsappUrl: waLink,
      };
    }

    case 'requisitos_compra': {
      return {
        reply: `¡Excelente iniciativa invertir en tu patrimonio con **Habitat Capital**! 🔑🏢\n\nComprar con nosotros es un proceso seguro y transparente en cada paso:\n\n1. **Elección y visita:** Conoces el inmueble de manera presencial junto a un asesor comercial.\n2. **Estudio de títulos:** Nuestro equipo jurídico revisa la tradición y libertad del inmueble para total tranquilidad.\n3. **Promesa de compraventa:** Se fijan plazos, valor pactado y forma de pago.\n4. **Financiación:** Aceptamos recursos propios, créditos hipotecarios preaprobados o leasing habitacional de cualquier entidad bancaria.\n5. **Escrituración:** Firma en notaría y entrega material del inmueble con llaves y paz y salvos.\n\n¿Te gustaría que te muestre casas o apartamentos en venta disponibles en Ibagué?`,
        properties: [],
        suggestionChips: [
          'Casas en venta en Ibagué',
          'Apartamentos en venta',
          'Hablar con un asesor'
        ],
        whatsappUrl: waLink,
      };
    }

    case 'consignar_inmueble': {
      return {
        reply: `¡Qué gran noticia! En **Habitat Capital** nos encargamos de todo para que arriendes o vendas tu inmueble en Ibagué sin preocupaciones y con total respaldo legal. 🤝🏘️\n\n**Beneficios para propietarios:**\n• **Publicidad profesional:** Fotografías de alta calidad y promoción destacada en portal web y redes.\n• **Filtro riguroso:** Verificación de capacidad financiera y antecedentes de los prospectos.\n• **Garantía total de canon (Arriendos):** Póliza de arrendamiento que te asegura el pago puntual de tu canon mensual.\n• **Elaboración de contratos:** Documentación jurídica blindada bajo la Ley 820 de 2003.\n\nNuestro equipo comercial puede agendar la visita a tu predio hoy mismo. ¿Deseas comunicarte por WhatsApp con el área de consignaciones?`,
        properties: [],
        suggestionChips: [
          'Hablar con un asesor',
          'Apartamentos en venta',
          'Casas en arriendo'
        ],
        whatsappUrl: waLink,
        needsHuman: true,
      };
    }

    case 'mascotas': {
      return {
        reply: `¡Entiendo perfectamente! Las mascotas son miembros esenciales del hogar. 🐾🐶🐱\n\nEn **Habitat Capital**, la gran mayoría de nuestras casas y apartamentos residenciales en Ibagué permiten mascotas sin inconvenientes. En el caso de apartamentos en conjuntos cerrados o edificios, se rige por el manual de convivencia de propiedad horizontal.\n\nSi te interesa un inmueble en específico o un sector (como El Vergel, Calambeo, La Pola o Cádiz), cuéntame cuál buscas y te confirmo al instante las condiciones de ese inmueble.`,
        properties: [],
        suggestionChips: [
          'Apartamentos en arriendo',
          'Casas en arriendo',
          'Hablar con un asesor'
        ],
        whatsappUrl: waLink,
      };
    }

    case 'ubicacion_contacto': {
      return {
        reply: `¡Con mucho gusto! **Habitat Capital** opera con sede en la ciudad de **Ibagué, Tolima**, brindando cobertura en los mejores sectores de la ciudad. 📍🏢\n\n• **Ciudad:** Ibagué, Tolima, Colombia.\n• **Horario de atención:** Lunes a Viernes de 8:00 a.m. a 6:00 p.m. y Sábados de 9:00 a.m. a 1:00 p.m.\n• **Canal digital:** Atención personalizada por chat web y WhatsApp inmediato para visitas o consultas comerciales.\n\n¿En qué tipo de inmueble te gustaría que te oriente hoy?`,
        properties: [],
        suggestionChips: [
          'Apartamentos en arriendo',
          'Casas en venta en Ibagué',
          'Hablar con un asesor'
        ],
        whatsappUrl: waLink,
      };
    }

    case 'barrios_disponibles': {
      const barriosSet = new Set(catalog.filter(p => p.disponible !== false).map(p => p.barrio));
      const listaBarrios = Array.from(barriosSet).slice(0, 10).join(', ');

      return {
        reply: `¡Contamos con opciones en los sectores más estratégicos y acogedores de **Ibagué**! 🏡✨\n\nActualmente tenemos inmuebles registrados en sectores como:\n• **${listaBarrios || 'El Vergel, Cádiz, La Pola, Calambeo, Piedra Pintada, Jordán, El Salado, Santa Helena, Campestre'}**.\n\n¿Hay algún barrio en especial que prefieras, o te gustaría ver opciones en arriendo o compra?`,
        properties: [],
        suggestionChips: [
          'Propiedades en El Vergel',
          'Apartamentos en La Pola',
          'Casas en venta en Ibagué',
          'Hablar con un asesor'
        ],
        whatsappUrl: waLink,
      };
    }

    case 'extremos_precio': {
      const lower = userMessage.toLowerCase();
      const esArriendo = /arriend|alquil|mes|canon/i.test(lower) || (!/venta|compr/i.test(lower) && criterios.operacion === 'arriendo');
      const esVenta = /venta|compr/i.test(lower) || criterios.operacion === 'venta';
      const esCasa = /casa/i.test(lower) || criterios.tipo === 'casa';
      const esApto = /apto|apartamento/i.test(lower) || criterios.tipo === 'apartamento';
      const buscaMasCaro = /m[aá]s\s+(?:caro|costoso|alto|exclusivo)/i.test(lower);

      let filtrados = catalog.filter(p => p.disponible !== false);
      if (esVenta) filtrados = filtrados.filter(p => p.operacion === 'venta');
      else if (esArriendo) filtrados = filtrados.filter(p => p.operacion === 'arriendo');

      if (esCasa) filtrados = filtrados.filter(p => p.tipo === 'casa');
      else if (esApto) filtrados = filtrados.filter(p => p.tipo === 'apartamento');

      filtrados.sort((a, b) => buscaMasCaro ? b.precio - a.precio : a.precio - b.precio);

      if (filtrados.length > 0) {
        const top = filtrados[0];
        const adjetivo = buscaMasCaro ? 'más exclusivo y de mayor valor' : 'más económico y accesible';
        const periodo = top.operacion === 'arriendo' ? ' al mes' : '';
        const reply = `El inmueble ${adjetivo} registrado en nuestro catálogo para esa categoría es **${top.titulo}** (${top.codigo}), ubicado en el barrio **${top.barrio}** de Ibagué, con un valor de **${formatCOP(top.precio)}${periodo}** (${top.habitaciones} hab, ${top.banos} baños, ${top.area_m2} m²).\n\nAquí tienes su tarjeta para ver todos los detalles o agendar una visita:`;

        return {
          reply,
          properties: [top],
          suggestionChips: [
            `Ver más en ${top.operacion}`,
            'Hablar con un asesor'
          ],
          whatsappUrl: buildWhatsAppLink({ propiedad: top, codigoInmueble: top.codigo, motivo: 'visita' }),
        };
      }

      const minGeneral = getCatalogMinPrice(esVenta ? 'venta' : 'arriendo', esCasa ? 'casa' : esApto ? 'apartamento' : null, catalog);
      const minTxt = minGeneral ? formatCOP(minGeneral.precio) : '$850.000 COP';
      return {
        reply: `En nuestro catálogo actual en Ibagué, las opciones parten desde **${minTxt}**. Cuéntame si buscas casa o apartamento en arriendo o venta para mostrarte exactamente las mejores opciones.`,
        properties: [],
        suggestionChips: [
          'Apartamentos en arriendo',
          'Casas en venta en Ibagué',
          'Hablar con un asesor'
        ],
        whatsappUrl: waLink,
      };
    }

    case 'visitas_citas': {
      return {
        reply: `¡Claro que sí! Puedes programar una visita presencial para conocer cualquier propiedad de nuestro catálogo en Ibagué. 🗓️🏡\n\nLas visitas se realizan de **Lunes a Sábado** en compañía de un asesor comercial de Habitat Capital. Solo debes indicarme el código del inmueble (por ejemplo: IBG-0001) o hacer clic en el botón de WhatsApp a continuación para coordinar día y hora con nuestro asesor comercial.`,
        properties: [],
        suggestionChips: [
          'Hablar con un asesor',
          'Apartamentos en arriendo',
          'Casas en venta en Ibagué'
        ],
        whatsappUrl: waLink,
        needsHuman: true,
      };
    }
  }
}
