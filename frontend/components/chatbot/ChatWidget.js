'use client';
import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import SuggestionChips from './SuggestionChips';
import { IcoChatBubble, IcoChatClose, IcoChatSend, IcoChatBot } from './IconosChat';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState('');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Inicializar conversación
  useEffect(() => {
    let savedId = '';
    try {
      savedId = localStorage.getItem('hc_chatbot_conv_id');
    } catch (e) {}

    if (savedId) {
      setConversationId(savedId);
      // Intentar cargar mensajes previos
      fetch(`${API_BASE}/api/conversations/${savedId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.messages && data.messages.length > 0) {
            setMessages(
              data.messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                properties: m.metadata?.properties,
                whatsappUrl: m.metadata?.whatsappUrl,
              }))
            );
          } else {
            addWelcome();
          }
        })
        .catch(() => addWelcome());
    } else {
      const newId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        localStorage.setItem('hc_chatbot_conv_id', newId);
      } catch (e) {}
      setConversationId(newId);
      addWelcome();
    }
  }, []);

  const addWelcome = () => {
    const hora = new Date().getHours();
    const saludo = hora < 12 ? '¡Buenos días!' : hora < 18 ? '¡Buenas tardes!' : '¡Buenas noches!';
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `${saludo} Qué alegría saludarte. Soy **Valentina**, asesora de Habitat Capital en Ibagué. 🏡✨\n\nEstoy aquí para acompañarte a encontrar tu próximo hogar o inversión ideal (casas y apartamentos en arriendo o en venta).\n\nCuéntame qué estás buscando o elige una de estas opciones rápidas:`,
      },
    ]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen, messages, isLoading]);

  const handleSend = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: text,
        }),
      });

      if (!res.ok) {
        throw new Error('Error en el servidor');
      }

      const data = await res.json();
      const botMsg = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'No obtuve respuesta en este momento.',
        properties: data.properties || [],
        whatsappUrl: data.whatsappUrl,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: 'assistant',
          content: 'Qué pena contigo, ocurrió un inconveniente momentáneo. Por favor intenta de nuevo o comunícate directamente por WhatsApp.',
          whatsappUrl: 'https://wa.me/573100000000?text=Hola,%20solicito%20asesoria%20inmobiliaria%20en%20Ibague',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const reiniciarChat = () => {
    const newId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      localStorage.setItem('hc_chatbot_conv_id', newId);
    } catch (e) {}
    setConversationId(newId);
    addWelcome();
  };

  return (
    <div className="hc-chat-widget">
      {/* Botón flotante */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="hc-chat-trigger-btn"
          aria-label="Abrir asistente inmobiliario"
        >
          <IcoChatBubble size={24} />
          <span className="hc-trigger-badge">Valentina • Asesora IA</span>
        </button>
      )}

      {/* Ventana de chat */}
      {isOpen && (
        <div className="hc-chat-window">
          {/* Encabezado */}
          <div className="hc-chat-header">
            <div className="hc-header-brand">
              <div className="hc-bot-avatar-badge">
                <IcoChatBot size={20} />
              </div>
              <div className="hc-bot-info">
                <h3>Valentina • Habitat Capital</h3>
                <span className="hc-bot-status">
                  <span className="hc-status-dot" /> En línea • Ibagué, Tolima
                </span>
              </div>
            </div>
            <div className="hc-header-actions">
              <button
                type="button"
                onClick={reiniciarChat}
                className="hc-btn-icon-subtle"
                title="Reiniciar conversación"
              >
                ↺
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="hc-btn-icon-close"
                title="Cerrar chat"
              >
                <IcoChatClose size={18} />
              </button>
            </div>
          </div>

          {/* Lista de mensajes */}
          <div className="hc-chat-messages">
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} />
            ))}

            {isLoading && (
              <div className="hc-chat-msg-row bot">
                <div className="hc-avatar bot">
                  <IcoChatBot size={18} />
                </div>
                <div className="hc-msg-bubble bot hc-loading-bubble">
                  <span className="hc-dot" />
                  <span className="hc-dot" />
                  <span className="hc-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Sugerencias rápidas */}
          <SuggestionChips onSelect={(chip) => handleSend(chip)} disabled={isLoading} />

          {/* Formulario de entrada */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="hc-chat-input-form"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Pregunta por casas, arriendos o zonas..."
              disabled={isLoading}
              className="hc-chat-input"
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="hc-chat-send-btn"
              aria-label="Enviar mensaje"
            >
              <IcoChatSend size={18} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
