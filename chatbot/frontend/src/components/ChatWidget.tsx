import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, RotateCcw, Sparkles } from 'lucide-react';
import { ChatMessage, ChatMessageItem } from './ChatMessage.js';
import { SuggestionChips } from './SuggestionChips.js';

export const ChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [conversationId, setConversationId] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Inicializar o recuperar conversationId desde localStorage
  useEffect(() => {
    const savedId = localStorage.getItem('inmobiliaria_conversation_id');
    if (savedId) {
      setConversationId(savedId);
      // Opcional: cargar historial previo
      fetch(`/api/conversations/${savedId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.messages && data.messages.length > 0) {
            const mapped: ChatMessageItem[] = data.messages.map((m: any) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              properties: m.metadata?.properties,
              whatsappUrl: m.metadata?.whatsappUrl,
              timestamp: m.created_at,
            }));
            setMessages(mapped);
          } else {
            addWelcomeMessage();
          }
        })
        .catch(() => addWelcomeMessage());
    } else {
      const newId = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('inmobiliaria_conversation_id', newId);
      setConversationId(newId);
      addWelcomeMessage();
    }
  }, []);

  const addWelcomeMessage = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: '¡Hola! Bienvenido a nuestra inmobiliaria en Ibagué. 🏡\n\nEstoy aquí para ayudarte a encontrar la casa o apartamento perfecto (en arriendo o en venta). Cuéntame qué estás buscando o selecciona una opción:',
      },
    ]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen, messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
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
      const botMsg: ChatMessageItem = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        properties: data.properties,
        whatsappUrl: data.whatsappUrl,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Qué pena, ocurrió un error de conexión al consultar el catálogo. Por favor inténtalo de nuevo.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    const newId = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('inmobiliaria_conversation_id', newId);
    setConversationId(newId);
    addWelcomeMessage();
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Ventana de Chat */}
      {isOpen && (
        <div className="w-[92vw] sm:w-[420px] h-[82vh] sm:h-[620px] max-h-[700px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden mb-3.5 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-4 py-3.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-white">
                  🏠
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-300 border-2 border-emerald-700 rounded-full"></span>
              </div>
              <div>
                <h3 className="font-semibold text-sm leading-tight">Asesor Virtual Inmobiliario</h3>
                <p className="text-[11px] text-emerald-100 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-200" />
                  Ibagué, Tolima • En línea
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                title="Reiniciar conversación"
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-emerald-100 hover:text-white"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Cerrar chat"
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-emerald-100 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Área de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50/70">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {/* Indicador de Escribiendo */}
            {isLoading && (
              <div className="flex gap-2 items-center text-xs text-gray-500 mb-3 bg-white border border-gray-200 p-2.5 rounded-xl w-fit shadow-2xs">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
                <span>Buscando en el catálogo...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chips de Sugerencia */}
          <SuggestionChips onSelect={(text) => handleSendMessage(text)} disabled={isLoading} />

          {/* Input de Mensaje */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white border-t border-gray-200 flex gap-2 items-center"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Escribe lo que buscas (ej. apto en arriendo El Vergel)..."
              disabled={isLoading}
              className="flex-1 bg-gray-100 hover:bg-gray-100/80 focus:bg-white border border-transparent focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs sm:text-sm focus:outline-none transition-all placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Botón Burbuja Flotante */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0"
      >
        <MessageCircle className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span className="font-semibold text-xs sm:text-sm">¿Buscas vivienda en Ibagué?</span>
      </button>
    </div>
  );
};
