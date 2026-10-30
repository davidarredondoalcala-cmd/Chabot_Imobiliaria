'use client';
import React from 'react';
import PropertyCard from './PropertyCard';
import { IcoChatBot, IcoChatUser, IcoChatWhatsApp } from './IconosChat';

/**
 * Parsea el texto del mensaje para renderizar en negrita (**texto**) sin mostrar asteriscos,
 * garantizando que el nombre del asistente virtual y términos destacados se vean en negrilla limpia.
 */
function renderizarContenido(texto) {
  if (!texto || typeof texto !== 'string') return texto;

  // Divide por delimitadores **texto**
  const partes = texto.split(/(\*\*.*?\*\*)/g);

  return partes.map((parte, index) => {
    if (parte.startsWith('**') && parte.endsWith('**') && parte.length >= 4) {
      const textoNegrita = parte.slice(2, -2);
      return (
        <strong key={index} style={{ fontWeight: 700, color: 'inherit' }}>
          {textoNegrita}
        </strong>
      );
    }
    return parte;
  });
}

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`hc-chat-msg-row ${isUser ? 'user' : 'bot'}`}>
      {!isUser && (
        <div className="hc-avatar bot">
          <IcoChatBot size={18} />
        </div>
      )}

      <div className={`hc-msg-bubble-wrap ${isUser ? 'user' : 'bot'}`}>
        <div className={`hc-msg-bubble ${isUser ? 'user' : 'bot'}`}>
          {renderizarContenido(message.content)}
        </div>

        {/* Tarjetas de propiedades */}
        {!isUser && message.properties && message.properties.length > 0 && (
          <div className="hc-msg-properties-list">
            {message.properties.map((prop) => (
              <PropertyCard
                key={prop.id || prop.codigo}
                property={prop}
                whatsappUrl={message.whatsappUrl}
              />
            ))}
          </div>
        )}

        {/* Botón WhatsApp si solicita asesor y no hay tarjetas */}
        {!isUser && message.whatsappUrl && (!message.properties || message.properties.length === 0) && (
          <a
            href={message.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hc-direct-wa-btn"
          >
            <IcoChatWhatsApp size={16} />
            <span>Contactar Asesor por WhatsApp</span>
          </a>
        )}
      </div>

      {isUser && (
        <div className="hc-avatar user">
          <IcoChatUser size={18} />
        </div>
      )}
    </div>
  );
}
