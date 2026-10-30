import React from 'react';
import { Bot, User, MessageCircle } from 'lucide-react';
import { PropertyCard, PropertyData } from './PropertyCard.js';

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  properties?: PropertyData[];
  whatsappUrl?: string;
  timestamp?: string;
}

interface ChatMessageProps {
  message: ChatMessageItem;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2.5 mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
          <Bot className="w-4 h-4" />
        </div>
      )}

      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Burbuja de Texto */}
        <div
          className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-emerald-600 text-white rounded-br-none shadow-sm'
              : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none shadow-xs'
          }`}
        >
          {message.content}
        </div>

        {/* Tarjetas de Inmuebles Si Hay Resultados */}
        {!isUser && message.properties && message.properties.length > 0 && (
          <div className="w-full mt-3 space-y-2">
            {message.properties.map((prop) => (
              <PropertyCard
                key={prop.id || prop.codigo}
                property={prop}
                whatsappUrl={message.whatsappUrl}
              />
            ))}
          </div>
        )}

        {/* Botón WhatsApp si solicita asesor y no hay inmuebles */}
        {!isUser && message.whatsappUrl && (!message.properties || message.properties.length === 0) && (
          <a
            href={message.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Contactar Asesor por WhatsApp
          </a>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center shrink-0 mt-0.5">
          <User className="w-4 h-4" />
        </div>
      )}
    </div>
  );
};
