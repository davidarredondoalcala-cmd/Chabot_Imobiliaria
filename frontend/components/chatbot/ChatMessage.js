'use client';
import React from 'react';
import PropertyCard from './PropertyCard';
import { IcoChatBot, IcoChatUser, IcoChatWhatsApp } from './IconosChat';

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
          {message.content}
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
