// Datos de contacto comercial de Habitat Capital.
// El número se configura en frontend/.env.local (NEXT_PUBLIC_WHATSAPP_NUMBER).
const NUMERO = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '573229001080';

export const WHATSAPP_NUMERO = String(NUMERO).replace(/\D/g, '');

// Arma un enlace de WhatsApp con mensaje prellenado.
export function waUrl(mensaje) {
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';
  return `https://wa.me/${WHATSAPP_NUMERO}${texto}`;
}
