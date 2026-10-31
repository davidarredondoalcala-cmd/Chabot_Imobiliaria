// Datos de contacto comercial de Habitat Capital.
// El número se configura en frontend/.env.local (NEXT_PUBLIC_WHATSAPP_NUMBER).
const NUMERO = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '573229001080';

export const WHATSAPP_NUMERO = String(NUMERO).replace(/\D/g, '');

// Arma un enlace de WhatsApp con mensaje prellenado.
export function waUrl(mensaje) {
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';
  return `https://wa.me/${WHATSAPP_NUMERO}${texto}`;
}

const ES_MOVIL = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i;

// Convierte un enlace wa.me/api.whatsapp en el acceso directo al chat de WhatsApp Web.
export function urlWhatsAppDirecta(url) {
  try {
    const destino = new URL(url, 'https://wa.me');
    const telefono = (destino.searchParams.get('phone') || destino.pathname).replace(/\D/g, '');
    if (!telefono) return url;
    const texto = destino.searchParams.get('text');
    const consulta = texto ? `&text=${encodeURIComponent(texto)}` : '';
    return `https://web.whatsapp.com/send?phone=${telefono}${consulta}`;
  } catch {
    return url;
  }
}

// En celular deja el enlace normal (abre la app); en computador salta directo al chat web.
export function abrirWhatsApp(evento) {
  if (typeof window === 'undefined') return;
  if (ES_MOVIL.test(window.navigator.userAgent)) return;
  const href = evento?.currentTarget?.href;
  if (!href) return;
  evento.preventDefault();
  window.open(urlWhatsAppDirecta(href), '_blank', 'noopener,noreferrer');
}
