import React from 'react';
import { ChatWidget } from './components/ChatWidget.js';
import { Building2, MapPin, ShieldCheck, Phone, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Barra de Navegación */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 text-white p-2 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-gray-900 tracking-tight">Inmobiliaria Ibagué</span>
              <span className="text-[10px] block text-emerald-600 font-semibold uppercase tracking-wider">Tolima, Colombia</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <a href="#destacados" className="hover:text-emerald-600 transition-colors">Propiedades</a>
            <a href="#barrios" className="hover:text-emerald-600 transition-colors">Barrios Principales</a>
            <a href="#servicios" className="hover:text-emerald-600 transition-colors">Servicios</a>
          </nav>

          <a
            href="https://wa.me/573229001080?text=Hola,%20deseo%20asesor%C3%ADa%20inmobiliaria%20en%20Ibagu%C3%A9"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold px-3.5 py-2 rounded-xl transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Atención Directa</span>
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900 text-white py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-medium px-3.5 py-1.5 rounded-full mb-6">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Catálogo 100% verificado en la Capital Musical de Colombia</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Encuentra tu próximo hogar o inversión en <span className="text-emerald-400">Ibagué</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-emerald-100/90 max-w-2xl mx-auto">
            Explora casas campestres, apartamentos modernos y locales comerciales en El Vergel, Calambeo, Piedra Pintada, La Pola y más.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs font-medium text-emerald-200">
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Cero inmuebles inventados
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Precios oficiales en COP
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Asistente con IA y WhatsApp directo
            </span>
          </div>
        </div>
      </section>

      {/* Barrios Destacados */}
      <section id="barrios" className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Zonas Destacadas de Ibagué</h2>
            <p className="text-xs text-gray-500">Sectores residenciales y comerciales de mayor demanda</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { nombre: 'El Vergel', estrato: 'Estrato 6', desc: 'Exclusividad y cordillera' },
            { nombre: 'Calambeo', estrato: 'Estrato 5-6', desc: 'Clima fresco campestre' },
            { nombre: 'Cádiz', estrato: 'Estrato 4', desc: 'Zona médica y comercial' },
            { nombre: 'Piedra Pintada', estrato: 'Estrato 4', desc: 'Central y residencial' },
            { nombre: 'La Pola', estrato: 'Estrato 4', desc: 'Histórico y bohemio' },
            { nombre: 'El Salado', estrato: 'Estrato 3', desc: 'Expansión y valorización' },
          ].map((barrio, idx) => (
            <div
              key={idx}
              className="bg-white border border-gray-200 hover:border-emerald-500 p-4 rounded-xl shadow-2xs hover:shadow-sm transition-all text-left"
            >
              <div className="flex items-center gap-1 text-emerald-600 mb-1">
                <MapPin className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase">{barrio.estrato}</span>
              </div>
              <h3 className="font-semibold text-sm text-gray-900">{barrio.nombre}</h3>
              <p className="text-[11px] text-gray-500 mt-1">{barrio.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-gray-900 text-gray-400 py-6 border-t border-gray-800 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 Inmobiliaria Ibagué - Agente Conversacional Inteligente con LLM y pgvector.</p>
        </div>
      </footer>

      {/* Widget Flotante del Chatbot */}
      <ChatWidget />
    </div>
  );
};

export default App;
