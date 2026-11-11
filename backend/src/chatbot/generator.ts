import { Property, SearchResultItem } from './types';
import { generateText, LLMMessage } from './llm';

export function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(value);
}

const SYSTEM_PROMPT_TEXT = `Eres Jarvis, asesor inmobiliario personal de Habitat Capital en Colombia.
Tu tono es humano, cálido, conversacional y empático, como si hablaras directamente con una persona querida que busca su próximo hogar.
Usa expresiones colombianas amables y respetuosas ("¡con muchísimo gusto!", "qué buena elección", "un sector maravilloso y muy tranquilo", "con gusto te cuento").
Sé proactivo y cercano. Conoce las ciudades principales de Colombia (Cali, Medellín, Bogotá, Manizales, Pereira, Barranquilla, Bucaramanga, Ibagué, etc.).
Respuestas directas, ordenadas y amables (máximo ~130 palabras).
SOLO debes recomendar inmuebles que estén explícitamente en el catálogo.
NUNCA inventes códigos de inmuebles ni precios.`;

/**
 * Respuesta cuando el usuario busca en una ciudad fuera de cobertura.
 */
export function respuestaCiudadNoSoportada(ciudad: string): string {
  const ciudadBonita = (ciudad || '').trim() || 'esa ciudad';
  return `Actualmente nuestro catálogo cuenta con cobertura en ciudades principales de Colombia como **Cali**, **Medellín**, **Bogotá**, **Barranquilla**, **Bucaramanga**, **Manizales**, **Pereira** e **Ibagué**, pero aún no tenemos inmuebles disponibles en ${ciudadBonita}.\n\n¿Te gustaría que busquemos opciones en alguna de las ciudades donde tenemos catálogo disponible?`;
}

/**
 * Respuesta para preguntas ajenas al negocio inmobiliario
 * (matemáticas, clima, noticias, chistes, cultura general, etc.).
 */
export function respuestaFueraDeTema(): string {
  return `No puedo responder a ese tipo de peticiones. Como asistente virtual de **Habitat Capital**, mi labor se enfoca exclusivamente en la asesoría inmobiliaria y en los inmuebles de nuestro catálogo en Colombia.

Para colaborarte de la mejor manera, te recomiendo realizar consultas sobre:
• **Inmuebles en catálogo:** Casas o apartamentos disponibles para arriendo o venta.
• **Zonas y sectores:** Opciones en ciudades como Cali, Medellín, Bogotá, Barranquilla, Bucaramanga, Manizales, Pereira o Ibagué.
• **Precios y características:** Consulta por número de habitaciones, baños, áreas o rangos de presupuesto.
• **Trámites y visitas:** Coordinación de visitas presenciales o contacto directo con un asesor comercial.

¿Te gustaría que busquemos una casa o un apartamento en arriendo o venta?`;
}

/**
 * Respuesta cuando el usuario menciona un presupuesto con algo que no es una
 * cifra válida en pesos (ej. "tengo una mandarina como presupuesto").
 * Pide aclaración sin celebrar ni aceptar el dato como válido.
 */
export function respuestaPresupuestoInvalido(): string {
  return `Esa me da curiosidad, pero para poder ayudarte de verdad necesito tu presupuesto en **pesos colombianos**.

Dime algo como: "**arriendo con 2.5 millones**", "**comprar con 150 millones**" o solo "**1.2 millones**".

¿De cuánto estamos hablando?`;
}

/**
 * Disculpa formal cuando el usuario reclama por una respuesta incorrecta.
 * Reintenta con los criterios del último pedido registrado.
 */
export function respuestaDisculpaFormal(criterios?: Record<string, any> | null): string {
  const detalles: string[] = [];
  if (criterios) {
    if (criterios.operacion === 'arriendo') detalles.push('en arriendo');
    else if (criterios.operacion === 'venta') detalles.push('en venta');
    if (Array.isArray(criterios.barrios) && criterios.barrios.length > 0) {
      detalles.push(`en la zona de **${criterios.barrios.join(', ')}**`);
    }
    if (criterios.precio_min != null && criterios.precio_max != null) {
      detalles.push(`con presupuesto entre **${formatCOP(criterios.precio_min)}** y **${formatCOP(criterios.precio_max)}**`);
    } else if (criterios.precio_max != null) {
      detalles.push(`con presupuesto hasta **${formatCOP(criterios.precio_max)}**`);
    }
  }
  const reiteracion = detalles.length > 0
    ? `De inmediato retomo tu solicitud de un inmueble ${detalles.join(', ')}.`
    : 'De inmediato retomo tu solicitud con los criterios que me indicaste anteriormente.';
  return `Le ofrezco una sincera disculpa: cometí un error al no atenderle bien y no es la experiencia que usted merece de **Habitat Capital**.

${reiteracion} ¿Desea que le muestre ahora mismo las opciones disponibles con esos criterios?`;
}

/**
 * Reclamo del usuario sin un pedido anterior registrado: disculpa formal y
 * solicitud amable de los criterios para atender correctamente.
 */
export function respuestaReclamoSinRegistro(): string {
  return `Le ofrezco una sincera disculpa: cometí un error al no atenderle bien y no es la experiencia que usted merece de **Habitat Capital**.

Para atenderle correctamente, ¿me confirma qué busca? Por ejemplo: casa o apartamento, en arriendo o en venta, la zona de su interés y su presupuesto aproximado.`;
}

/**
 * Genera una respuesta determinista anclada sin riesgo de alucinación (plantilla nativa)
 */
export function generateDeterministicSearchReply(
  items: SearchResultItem[],
  criterioRelajado?: string | null,
  criterios?: { barrios?: string[]; tipo?: string; ciudad?: string; operacion?: string; ambas_operaciones?: boolean; acepta_otras_zonas?: boolean; amenidades?: string[]; correccion?: any }
): string {
  const corr = (criterios as any)?.correccion;
  const prefijoCorr = corr?.ciudad
    ? `¿Te referías a **${corr.ciudad.corregida}**? Entendí que buscas en ${corr.ciudad.corregida}.\n\n`
    : corr?.barrio
      ? `¿Te referías a **${corr.barrio.corregida}**? Entendí que buscas en el sector de ${corr.barrio.corregida}.\n\n`
      : '';

  if (items.length === 0) {
    if (criterioRelajado) {
      return `${prefijoCorr}${criterioRelajado}`;
    }
    const sector = (criterios?.barrios && criterios.barrios.length > 0)
      ? ` en ${criterios.barrios.join(', ')}`
      : (criterios as any)?.ciudad
        ? ` en ${(criterios as any).ciudad}`
        : '';
    return `${prefijoCorr}Revisé con detalle nuestro inventario y en este momento no encontré propiedades disponibles con esas características exactas${sector}.\n\n¿Te gustaría que miremos en un sector cercano o con un rango de presupuesto un poco más amplio? Con gusto te busco más alternativas.`;
  }

  const lines: string[] = [];
  if (corr?.ciudad) {
    lines.push(`¿Te referías a **${corr.ciudad.corregida}**? Entendí que buscas en ${corr.ciudad.corregida}.`);
  } else if (corr?.barrio) {
    lines.push(`¿Te referías a **${corr.barrio.corregida}**? Entendí que buscas en el sector de ${corr.barrio.corregida}.`);
  }

  if (criterioRelajado) {
    lines.push(criterioRelajado);
  }
  const sector = (criterios?.barrios && criterios.barrios.length > 0)
    ? ` en ${criterios.barrios.join(', ')}`
    : (criterios as any)?.ciudad
      ? ` en ${(criterios as any).ciudad}`
      : '';
  const tipoInm = criterios?.tipo === 'casa'
    ? 'casas'
    : criterios?.tipo === 'apartamento'
      ? 'apartamentos'
      : 'propiedades';

  const arriendos = items.filter(it => it.inmueble.operacion === 'arriendo');
  const ventas = items.filter(it => it.inmueble.operacion === 'venta');
  const tieneAmbas = arriendos.length > 0 && ventas.length > 0;

  if (tieneAmbas) {
    const headerText = (criterios as any)?.acepta_otras_zonas
      ? `¡Con mucho gusto! Encontré estas excelentes opciones de ${tipoInm} disponibles en otras zonas, tanto en **arriendo** como en **venta**:`
      : `Encontré estas excelentes opciones de ${tipoInm} disponibles${sector}, tanto en **arriendo** como en **venta**:`;
    lines.push(headerText);

    lines.push('**Opciones en arriendo:**');
    arriendos.forEach((item, idx) => {
      const p = item.inmueble;
      const habText = p.habitaciones > 0 ? `${p.habitaciones} hab` : '';
      const banText = p.banos > 0 ? `${p.banos} baños` : '';
      const details = [habText, banText, `${p.area_m2} m²`].filter(Boolean).join(' • ');
      const ubicacion = [p.barrio, p.ciudad].filter(Boolean).join(', ');
      lines.push(
        `${idx + 1}. **${p.titulo}** (${p.codigo})\n   • Ubicación: ${ubicacion} | Canon: ${formatCOP(p.precio)}/mes\n   • Detalles: ${details}${item.razon ? `\n   • Destacado: ${item.razon}` : ''}`
      );
    });

    lines.push('**Opciones en venta:**');
    ventas.forEach((item, idx) => {
      const p = item.inmueble;
      const habText = p.habitaciones > 0 ? `${p.habitaciones} hab` : '';
      const banText = p.banos > 0 ? `${p.banos} baños` : '';
      const details = [habText, banText, `${p.area_m2} m²`].filter(Boolean).join(' • ');
      const ubicacion = [p.barrio, p.ciudad].filter(Boolean).join(', ');
      lines.push(
        `${arriendos.length + idx + 1}. **${p.titulo}** (${p.codigo})\n   • Ubicación: ${ubicacion} | Valor: ${formatCOP(p.precio)}\n   • Detalles: ${details}${item.razon ? `\n   • Destacado: ${item.razon}` : ''}`
      );
    });

    if ((criterios as any)?.ambas_operaciones) {
      lines.push('¿Cuál de las dos modalidades se adapta mejor a lo que buscas? También podemos coordinar una visita presencial si alguna te llama la atención.');
    } else {
      lines.push('¿Estás buscando en **arriendo o para comprar**? Si tienes un presupuesto estimado o número de habitaciones deseado, indícamelo y con gusto afinamos los resultados.');
    }
  } else {
    const accion = (criterios as any)?.operacion === 'venta' ? 'en venta' : (criterios as any)?.operacion === 'arriendo' ? 'en arriendo' : '';
    const amensText = (criterios as any)?.amenidades && (criterios as any).amenidades.length > 0
      ? ` con ${(criterios as any).amenidades.join(', ')}`
      : '';
    const headerText = (criterios as any)?.acepta_otras_zonas
      ? `¡Con mucho gusto! Encontré estas excelentes opciones de ${tipoInm} ${accion}${amensText} disponibles en otras zonas:`
      : `Encontré estas excelentes opciones de ${tipoInm} ${accion}${amensText} disponibles${sector}:`;
    lines.push(headerText);

    items.slice(0, 3).forEach((item, idx) => {
      const p = item.inmueble;
      const habText = p.habitaciones > 0 ? `${p.habitaciones} hab` : '';
      const banText = p.banos > 0 ? `${p.banos} baños` : '';
      const details = [habText, banText, `${p.area_m2} m²`].filter(Boolean).join(' • ');
      const ubicacion = [p.barrio, p.ciudad].filter(Boolean).join(', ');

      lines.push(
        `${idx + 1}. **${p.titulo}** (${p.codigo})\n   • Ubicación: ${ubicacion} | Valor: ${formatCOP(p.precio)}\n   • Detalles: ${details}${item.razon ? `\n   • Destacado: ${item.razon}` : ''}`
      );
    });

    const sinOperacion = !(criterios as any)?.operacion;
    if (sinOperacion) {
      lines.push('¿Estás buscando en **arriendo o para comprar**? Si tienes un presupuesto estimado o número de habitaciones deseado, indícamelo y con gusto afinamos los resultados.');
    } else {
      lines.push('Puedes hacer clic en el botón **"Ver en la plataforma"** de cualquier tarjeta para ver su ficha completa, o si prefieres, podemos coordinar una visita presencial. ¿Cuál te llama más la atención?');
    }
  }
  return lines.join('\n\n');
}

/**
 * Genera respuesta para detalle de un inmueble
 */
export function generateDeterministicDetailReply(p: Property): string {
  const amenidadesStr = p.amenidades && p.amenidades.length > 0
    ? p.amenidades.join(', ')
    : 'Servicios completos y excelente iluminación';

  const ubicacion = [p.barrio, p.ciudad].filter(Boolean).join(', ');

  return `¡Con todo el gusto! Aquí tienes todos los detalles de **${p.titulo}** (${p.codigo}):

• **Ubicación:** ${ubicacion} (${p.direccion_aproximada || 'sector residencial muy tranquilo'})
• **Modalidad:** ${p.operacion.toUpperCase()}
• **Valor:** ${formatCOP(p.precio)}
• **Área:** ${p.area_m2} m² (Estrato ${p.estrato})
• **Comodidades:** ${p.habitaciones} habitaciones, ${p.banos} baños, ${p.parqueaderos} parqueaderos
• **Características:** ${amenidadesStr}

${p.descripcion}

¿Te gustaría que coordinemos una visita presencial para conocerla o deseas verla en la plataforma?`;
}

/**
 * Genera la respuesta conversacional anclada utilizando el LLM cuando está disponible
 */
export async function generateGroundedSearchReply(
  items: SearchResultItem[],
  userMessage: string,
  criterioRelajado?: string | null,
  criterios?: { barrios?: string[]; tipo?: string; ambas_operaciones?: boolean; correccion?: any }
): Promise<string> {
  if (items.length === 0) {
    return generateDeterministicSearchReply([], criterioRelajado, criterios);
  }

  const catalogContext = items.slice(0, 4).map(item => {
    const p = item.inmueble;
    return `Código: ${p.codigo}
Título: ${p.titulo}
Operación: ${p.operacion}
Tipo: ${p.tipo}
Barrio: ${p.barrio}
Ciudad: ${p.ciudad}
Precio: ${p.precio} COP (${formatCOP(p.precio)})
Área: ${p.area_m2} m2
Habitaciones: ${p.habitaciones}
Baños: ${p.banos}
Parqueaderos: ${p.parqueaderos}
Amenidades: ${p.amenidades.join(', ')}
Razón de encaje: ${item.razon || 'Buena ubicación'}`;
  }).join('\n---\n');

  const sectorMencionado = criterios?.barrios && criterios.barrios.length > 0 ? criterios.barrios.join(', ') : null;
  const tieneAmbasModalidades = items.some(i => i.inmueble.operacion === 'arriendo') && items.some(i => i.inmueble.operacion === 'venta');

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT_TEXT}

INSTRUCCIÓN CRÍTICA DE GENERACIÓN ANCLADA:
Debes redactar una respuesta cálida en español colombiano basada ÚNICAMENTE en los siguientes ${items.length} inmuebles devueltos por el catálogo.
${(criterios as any)?.correccion?.ciudad ? `El usuario escribió "${(criterios as any).correccion.ciudad.original}" con un posible error tipográfico. Debes abrir amablemente confirmando: "¿Te referías a ${(criterios as any).correccion.ciudad.corregida}? Entendí que buscas en ${(criterios as any).correccion.ciudad.corregida}."` : ''}
${(criterios as any)?.correccion?.barrio ? `El usuario escribió "${(criterios as any).correccion.barrio.original}" con un posible error tipográfico. Debes abrir amablemente confirmando: "¿Te referías a ${(criterios as any).correccion.barrio.corregida}? Entendí que buscas en el sector de ${(criterios as any).correccion.barrio.corregida}."` : ''}
${sectorMencionado ? `El usuario preguntó específicamente por el sector "${sectorMencionado}". Confirma y menciona explícitamente ese sector (${sectorMencionado}) en la respuesta.` : ''}
${tieneAmbasModalidades ? 'El inventario incluye opciones en arriendo y en venta. Debes presentarlas distinguiendo claramente cuáles están en arriendo y cuáles en venta.' : ''}
PROHIBIDO inventar cualquier dato, código, precio o amenidad. Cita exactamente el código entre paréntesis, ej. (IBG-0001).
${criterioRelajado ? `Menciona con amabilidad y transparencia este ajuste: "${criterioRelajado}".` : ''}
Máximo ~120 palabras. Cierra con una pregunta útil o llamado a la acción.

REGISTROS DEL CATÁLOGO PERMITIDOS:
${catalogContext}`
    },
    {
      role: 'user',
      content: userMessage
    }
  ];

  try {
    const response = await generateText(messages, 0.2);
    if (response && response.trim().length > 20 && !response.toLowerCase().includes('fallback')) {
      return response.trim();
    }
  } catch (err) {
    // fallback
  }

  return generateDeterministicSearchReply(items, criterioRelajado, criterios);
}
