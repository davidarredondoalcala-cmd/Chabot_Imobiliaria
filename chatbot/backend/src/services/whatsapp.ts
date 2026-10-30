import dotenv from 'dotenv';
import { ConversationCriterios, Property } from '../types/index.js';

dotenv.config();

const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '573229001080';

export interface WhatsAppContext {
  codigoInmueble?: string;
  propiedad?: Property | null;
  criterios?: ConversationCriterios;
  motivo?: 'visita' | 'negociacion' | 'legal' | 'asesor' | 'verificacion_dudosa';
}

/**
 * Genera el enlace de WhatsApp prellenado según las especificaciones del proyecto:
 * https://wa.me/<WHATSAPP_NUMBER>?text=<mensaje prellenado con el código del inmueble y el resumen de criterios>
 */
export function buildWhatsAppLink(ctx: WhatsAppContext): string {
  const parts: string[] = ['¡Hola! Me gustaría comunicarme con un asesor de la inmobiliaria en Ibagué.'];

  if (ctx.codigoInmueble || ctx.propiedad?.codigo) {
    const code = ctx.codigoInmueble || ctx.propiedad?.codigo;
    parts.push(`Estoy interesado(a) en el inmueble con código: *${code}*`);
    if (ctx.propiedad?.titulo) {
      parts.push(`(${ctx.propiedad.titulo})`);
    }
  }

  if (ctx.criterios) {
    const critSummary: string[] = [];
    if (ctx.criterios.operacion) critSummary.push(`Operación: ${ctx.criterios.operacion}`);
    if (ctx.criterios.tipo) critSummary.push(`Tipo: ${ctx.criterios.tipo}`);
    if (ctx.criterios.barrios && ctx.criterios.barrios.length > 0) {
      critSummary.push(`Zona: ${ctx.criterios.barrios.join(', ')}`);
    }
    if (ctx.criterios.precio_max) {
      critSummary.push(`Presupuesto: COP $${ctx.criterios.precio_max.toLocaleString('es-CO')}`);
    }
    if (critSummary.length > 0) {
      parts.push(`\nMis criterios de búsqueda:\n• ${critSummary.join('\n• ')}`);
    }
  }

  if (ctx.motivo === 'visita') {
    parts.push('\nMotivo: Deseo agendar una visita presencial.');
  } else if (ctx.motivo === 'negociacion') {
    parts.push('\nMotivo: Deseo consultar posibilidades de negociación y condiciones.');
  } else if (ctx.motivo === 'legal') {
    parts.push('\nMotivo: Consulta sobre documentación, trámites notariales o requisitos.');
  }

  const fullText = parts.join('\n');
  const encoded = encodeURIComponent(fullText);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encoded}`;
}
