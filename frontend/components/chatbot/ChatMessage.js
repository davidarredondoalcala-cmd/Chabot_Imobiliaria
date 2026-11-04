'use client';
import React from 'react';
import PropertyCard from './PropertyCard';
import { IcoChatBot, IcoChatUser, IcoChatWhatsApp } from './IconosChat';
import { abrirWhatsApp } from '../../lib/contacto';

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

export default function ChatMessage({ message, onRetomar, onNueva }) {
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

        {/* Opciones interactivas para retomar o iniciar nueva conversación */}
        {message.isResumePrompt && (
          <div className="hc-resume-card">
            <div className="hc-resume-card-title">¿Cómo deseas continuar?</div>
            <button
              type="button"
              onClick={onRetomar}
              className="hc-resume-btn-primary"
            >
              <span className="hc-resume-btn-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
              <div className="hc-resume-btn-content">
                <strong>Retomar conversación</strong>
                <small>Continuar donde quedaste con Jarvis</small>
              </div>
            </button>
            <button
              type="button"
              onClick={onNueva}
              className="hc-resume-btn-secondary"
            >
              <span className="hc-resume-btn-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></span>
              <div className="hc-resume-btn-content">
                <strong>Empezar una nueva</strong>
                <small>Iniciar una nueva consulta desde cero</small>
              </div>
            </button>
          </div>
        )}

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
            onClick={abrirWhatsApp}
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
