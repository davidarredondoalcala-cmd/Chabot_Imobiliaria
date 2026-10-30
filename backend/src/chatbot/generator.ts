import { Property, SearchResultItem } from './types';
import { generateText, LLMMessage } from './llm';

export function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(value);
}

const SYSTEM_PROMPT_TEXT = `Eres Valentina, asesora inmobiliaria personal de Habitat Capital en Ibagué, Tolima, Colombia.
Tu tono es humano, cálido, conversacional y empático, como si hablaras directamente con una persona querida que busca su próximo hogar.
Usa expresiones colombianas amables y respetuosas ("¡con muchísimo gusto!", "qué buena elección", "un sector maravilloso y muy tranquilo", "con gusto te cuento").
Sé proactiva y cercana. Conoce bien la ciudad de Ibagué (sectores como La Pola, Piedra Pintada, El Vergel, Calambeo, Interlaken, Cádiz).
Respuestas directas, ordenadas y amables (máximo ~130 palabras).
SOLO debes recomendar inmuebles que estén explícitamente en el catálogo.
NUNCA inventes códigos de inmuebles ni precios.`;

/**
 * Genera una respuesta determinista anclada sin riesgo de alucinación (plantilla nativa)
 */
export function generateDeterministicSearchReply(
  items: SearchResultItem[],
  criterioRelajado?: string | null,
  criterios?: { barrios?: string[]; tipo?: string }
): string {
  if (items.length === 0) {
    if (criterioRelajado) {
      return criterioRelajado;
    }
    const sector = (criterios?.barrios && criterios.barrios.length > 0)
      ? ` en ${criterios.barrios.join(', ')}`
      : ' en Ibagué';
    return `Revisé con detalle nuestro inventario y en este momento no encontré propiedades disponibles con esas características exactas${sector}. 🏡\n\n¿Te gustaría que miremos en un sector cercano o con un rango de presupuesto un poco más amplio? ¡Con gusto te busco más alternativas!`;
  }

  const lines: string[] = [];
  if (criterioRelajado) {
    lines.push(criterioRelajado);
  }
  const sector = (criterios?.barrios && criterios.barrios.length > 0)
    ? ` en ${criterios.barrios.join(', ')}`
    : '';
  const tipoInm = criterios?.tipo === 'casa'
    ? 'casas'
    : criterios?.tipo === 'apartamento'
      ? 'apartamentos'
      : 'propiedades';
  lines.push(`¡Qué alegría! Encontré estas excelentes opciones de ${tipoInm} que te van a encantar${sector}:`);

  items.slice(0, 3).forEach((item, idx) => {
    const p = item.inmueble;
    const habText = p.habitaciones > 0 ? `${p.habitaciones} hab` : '';
    const banText = p.banos > 0 ? `${p.banos} baños` : '';
    const details = [habText, banText, `${p.area_m2} m²`].filter(Boolean).join(' • ');

    lines.push(
      `${idx + 1}. **${p.titulo}** (${p.codigo})\n   📍 Barrio ${p.barrio} | 💰 ${formatCOP(p.precio)}\n   📐 ${details}${item.razon ? `\n   ✨ ${item.razon}` : ''}`
    );
  });

  lines.push('💡 Puedes hacer clic en el botón **"🏠 Ver en la plataforma"** de cualquier tarjeta para ver su ficha completa, o si prefieres, podemos coordinar una visita presencial por WhatsApp. ¿Cuál te llama más la atención?');
  return lines.join('\n\n');
}

/**
 * Genera respuesta para detalle de un inmueble
 */
export function generateDeterministicDetailReply(p: Property): string {
  const amenidadesStr = p.amenidades && p.amenidades.length > 0
    ? p.amenidades.join(', ')
    : 'Servicios completos y excelente iluminación';

  return `¡Con todo el gusto! Aquí tienes todos los detalles de **${p.titulo}** (${p.codigo}):

• **Ubicación:** Barrio ${p.barrio}, Ibagué (${p.direccion_aproximada || 'sector residencial muy tranquilo'})
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
  criterios?: { barrios?: string[]; tipo?: string }
): Promise<string> {
  if (items.length === 0) {
    return generateDeterministicSearchReply([], criterioRelajado, criterios);
  }

  const catalogContext = items.slice(0, 3).map(item => {
    const p = item.inmueble;
    return `Código: ${p.codigo}
Título: ${p.titulo}
Operación: ${p.operacion}
Tipo: ${p.tipo}
Barrio: ${p.barrio}
Precio: ${p.precio} COP (${formatCOP(p.precio)})
Área: ${p.area_m2} m2
Habitaciones: ${p.habitaciones}
Baños: ${p.banos}
Parqueaderos: ${p.parqueaderos}
Amenidades: ${p.amenidades.join(', ')}
Razón de encaje: ${item.razon || 'Buena ubicación'}`;
  }).join('\n---\n');

  const sectorMencionado = criterios?.barrios && criterios.barrios.length > 0 ? criterios.barrios.join(', ') : null;

  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `${SYSTEM_PROMPT_TEXT}

INSTRUCCIÓN CRÍTICA DE GENERACIÓN ANCLADA:
Debes redactar una respuesta cálida en español colombiano basada ÚNICAMENTE en los siguientes ${items.length} inmuebles devueltos por el catálogo.
${sectorMencionado ? `El usuario preguntó específicamente por el sector "${sectorMencionado}". Confirma y menciona explícitamente ese sector (${sectorMencionado}) en la respuesta.` : ''}
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
