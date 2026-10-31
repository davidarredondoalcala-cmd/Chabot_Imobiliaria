'use client';
import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import SuggestionChips from './SuggestionChips';
import { IcoChatBubble, IcoChatSend, IcoChatBot, IcoChatChevronDown } from './IconosChat';
import { waUrl } from '../../lib/contacto';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState('');
  const [showResumePrompt, setShowResumePrompt] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const getSaludo = () => {
    const hora = new Date().getHours();
    return hora < 12 ? '¡Buenos días!' : hora < 18 ? '¡Buenas tardes!' : '¡Buenas noches!';
  };

  const getWelcomeMessage = () => ({
    id: 'welcome',
    role: 'assistant',
    content: `${getSaludo()} Un gusto saludarte. Soy **Jarvis**, asesor inmobiliario de Habitat Capital en Ibagué.\n\nEstoy aquí para orientarte en la búsqueda de tu próximo inmueble (casas y apartamentos en arriendo o en venta).\n\nCuéntame qué estás buscando o selecciona una opción rápida:`,
  });

  const getResumePromptMessage = () => ({
    id: 'resume-prompt',
    role: 'assistant',
    content: `${getSaludo()} Veo que dejamos una conversación anterior guardada con **Jarvis**.\n\n¿Deseas **retomar la conversación** donde la dejamos o **empezar una nueva**?`,
    isResumePrompt: true,
  });

  // Inicializar conversación al montar
  useEffect(() => {
    let savedConv = null;
    try {
      const raw = localStorage.getItem('hc_chatbot_saved_conv');
      if (raw) savedConv = JSON.parse(raw);
    } catch (e) {}

    if (savedConv && savedConv.messages && savedConv.messages.length > 0) {
      setConversationId(savedConv.id || `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      setMessages([getResumePromptMessage()]);
      setShowResumePrompt(true);
    } else {
      const newId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        localStorage.setItem('hc_chatbot_conv_id', newId);
      } catch (e) {}
      setConversationId(newId);
      setMessages([getWelcomeMessage()]);
      setShowResumePrompt(false);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen, messages, isLoading]);

  useEffect(() => {
    const onAbrir = () => {
      if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        setIsOpen(false);
      }
    };
    window.addEventListener('habitat-abrir-inmueble', onAbrir);
    return () => window.removeEventListener('habitat-abrir-inmueble', onAbrir);
  }, []);

  /**
   * Cierra el chat al hacer clic en la barra dorada, refresca el chat automáticamente
   * y prepara la opción para retomar la conversación o empezar una nueva.
   */
  const handleCloseChat = () => {
    // 1. Guardar la conversación actual si el usuario envió algún mensaje
    const hasUserMessages = messages.some((m) => m.role === 'user');
    if (hasUserMessages) {
      const convData = {
        id: conversationId,
        messages: messages.filter((m) => !m.isResumePrompt),
        savedAt: Date.now(),
      };
      try {
        localStorage.setItem('hc_chatbot_saved_conv', JSON.stringify(convData));
      } catch (e) {}
    }

    // 2. Cerrar la ventana del chat
    setIsOpen(false);

    // 3. Refrescar el estado interno automáticamente
    let savedConv = null;
    try {
      const raw = localStorage.getItem('hc_chatbot_saved_conv');
      if (raw) savedConv = JSON.parse(raw);
    } catch (e) {}

    const freshId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setConversationId(freshId);

    if (savedConv && savedConv.messages && savedConv.messages.length > 0) {
      setMessages([getResumePromptMessage()]);
      setShowResumePrompt(true);
    } else {
      setMessages([getWelcomeMessage()]);
      setShowResumePrompt(false);
    }
  };

  /**
   * Retoma la conversación guardada previamente
   */
  const handleRetomarConversacion = () => {
    let savedConv = null;
    try {
      const raw = localStorage.getItem('hc_chatbot_saved_conv');
      if (raw) savedConv = JSON.parse(raw);
    } catch (e) {}

    if (savedConv && savedConv.messages && savedConv.messages.length > 0) {
      setConversationId(savedConv.id);
      setShowResumePrompt(false);

      const restoredMessages = savedConv.messages.map((m) => ({
        ...m,
        content: (m.content || '').replace(/Valentina/gi, 'Jarvis'),
      }));

      restoredMessages.push({
        id: `sys-resume-${Date.now()}`,
        role: 'assistant',
        content: '¡Conversación retomada con éxito! ¿En qué más te puedo orientar hoy?',
      });

      setMessages(restoredMessages);
    } else {
      handleEmpezarNueva();
    }
  };

  /**
   * Inicia una nueva conversación desde cero
   */
  const handleEmpezarNueva = () => {
    try {
      localStorage.removeItem('hc_chatbot_saved_conv');
    } catch (e) {}
    setShowResumePrompt(false);
    const newId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      localStorage.setItem('hc_chatbot_conv_id', newId);
    } catch (e) {}
    setConversationId(newId);
    setMessages([getWelcomeMessage()]);
  };

  const handleChipSelect = (chipText) => {
    if (showResumePrompt) {
      if (chipText.includes('Retomar')) {
        handleRetomarConversacion();
        return;
      }
      if (chipText.includes('nueva') || chipText.includes('Nueva')) {
        handleEmpezarNueva();
        return;
      }
    }
    handleSend(chipText);
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    let targetConvId = conversationId;

    // Si el usuario escribe una pregunta mientras está en el prompt de retomar, inicia automáticamente como nueva consulta
    if (showResumePrompt) {
      try {
        localStorage.removeItem('hc_chatbot_saved_conv');
      } catch (e) {}
      setShowResumePrompt(false);
      targetConvId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setConversationId(targetConvId);
      try {
        localStorage.setItem('hc_chatbot_conv_id', targetConvId);
      } catch (e) {}
      setMessages([]);
    }

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
          conversationId: targetConvId,
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
        suggestionChips: data.suggestionChips,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: 'assistant',
          content: 'Qué pena contigo, ocurrió un inconveniente momentáneo. Por favor intenta de nuevo o comunícate directamente por WhatsApp.',
          whatsappUrl: waUrl('Hola, solicito asesoría inmobiliaria en Ibagué'),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const lastBotMsg = messages.length > 0 ? [...messages].reverse().find(m => m.role === 'assistant') : null;
  const currentChips = showResumePrompt
    ? ['💬 Retomar conversación', '✨ Empezar una nueva']
    : (lastBotMsg?.suggestionChips || undefined);

  return (
    <div className="hc-chat-widget">
      {/* Botón flotante para abrir */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="hc-chat-trigger-btn"
          aria-label="Abrir asistente inmobiliario"
        >
          <IcoChatBubble size={24} />
          <span className="hc-trigger-badge">
            <strong>Jarvis</strong> • Asesor IA
          </span>
        </button>
      )}

      {/* Ventana de chat */}
      {isOpen && (
        <div className="hc-chat-window">
          {/* Encabezado dorado interactivo: cierra al hacer clic en cualquier parte de la barra */}
          <div
            className="hc-chat-header"
            onClick={handleCloseChat}
            role="button"
            tabIndex={0}
            title="Haz clic en la barra dorada para cerrar el chat"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCloseChat();
              }
            }}
          >
            <div className="hc-header-brand">
              <div className="hc-bot-avatar-badge">
                <IcoChatBot size={20} />
              </div>
              <div className="hc-bot-info">
                <h3>
                  <strong style={{ fontWeight: 800 }}>Jarvis</strong> • Habitat Capital
                </h3>
                <span className="hc-bot-status">
                  <span className="hc-status-dot" /> En línea • Ibagué, Tolima
                </span>
              </div>
            </div>
            <div className="hc-header-actions">
              <div
                className="hc-header-collapse-btn"
                title="Cerrar chat"
                aria-label="Cerrar chat"
              >
                <IcoChatChevronDown size={20} />
              </div>
            </div>
          </div>

          {/* Lista de mensajes */}
          <div className="hc-chat-messages">
            {messages.map((m) => (
              <ChatMessage
                key={m.id}
                message={m}
                onRetomar={handleRetomarConversacion}
                onNueva={handleEmpezarNueva}
              />
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
          <SuggestionChips
            onSelect={handleChipSelect}
            disabled={isLoading}
            chips={currentChips}
          />

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
