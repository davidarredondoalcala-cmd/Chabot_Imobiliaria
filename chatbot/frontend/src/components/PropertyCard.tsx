import React from 'react';
import { MapPin, Maximize2, Bed, Bath, ExternalLink, MessageCircle } from 'lucide-react';

export interface PropertyData {
  id: string;
  codigo: string;
  operacion: 'venta' | 'arriendo';
  tipo: string;
  titulo: string;
  descripcion: string;
  barrio: string;
  precio: number;
  area_m2: number;
  habitaciones: number;
  banos: number;
  parqueaderos: number;
  estrato: number;
  amenidades: string[];
  url_ficha?: string;
}

interface PropertyCardProps {
  property: PropertyData;
  whatsappUrl?: string;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({ property, whatsappUrl }) => {
  const formattedPrice = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(property.precio);

  const fallbackWa = `https://wa.me/573229001080?text=${encodeURIComponent(`Hola, me interesa información sobre el inmueble ${property.codigo}: ${property.titulo}`)}`;
  const waTarget = whatsappUrl || fallbackWa;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden text-left flex flex-col mb-3">
      {/* Encabezado de la Tarjeta */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-3">
        <div className="flex justify-between items-start">
          <span className="text-xs font-semibold uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded">
            {property.operacion === 'arriendo' ? 'En Arriendo' : 'En Venta'}
          </span>
          <span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded font-bold">
            {property.codigo}
          </span>
        </div>
        <h4 className="font-semibold text-sm mt-1.5 line-clamp-1 text-white">
          {property.titulo}
        </h4>
        <div className="text-lg font-bold mt-1 text-emerald-100">
          {formattedPrice} {property.operacion === 'arriendo' ? '<span class="text-xs font-normal">/mes</span>' : ''}
        </div>
      </div>

      {/* Contenido / Metadatos */}
      <div className="p-3.5 space-y-2.5 flex-1 text-xs text-gray-700">
        <div className="flex items-center gap-1.5 text-gray-600 font-medium">
          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Barrio {property.barrio}, Ibagué (Estrato {property.estrato})</span>
        </div>

        {/* Indicadores de Espacio */}
        <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2 rounded-lg text-center font-medium">
          <div className="flex items-center justify-center gap-1">
            <Maximize2 className="w-3 h-3 text-gray-400" />
            <span>{property.area_m2} m²</span>
          </div>
          {property.habitaciones > 0 && (
            <div className="flex items-center justify-center gap-1">
              <Bed className="w-3 h-3 text-gray-400" />
              <span>{property.habitaciones} hab</span>
            </div>
          )}
          {property.banos > 0 && (
            <div className="flex items-center justify-center gap-1">
              <Bath className="w-3 h-3 text-gray-400" />
              <span>{property.banos} bñ</span>
            </div>
          )}
        </div>

        {/* Amenidades */}
        {property.amenidades && property.amenidades.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {property.amenidades.slice(0, 3).map((a, idx) => (
              <span key={idx} className="bg-emerald-50 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full capitalize">
                {a}
              </span>
            ))}
            {property.amenidades.length > 3 && (
              <span className="text-[10px] text-gray-400 self-center">
                +{property.amenidades.length - 3} más
              </span>
            )}
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="p-3 bg-gray-50 border-t border-gray-100 flex gap-2">
        {property.url_ficha && (
          <a
            href={property.url_ficha}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 font-medium text-xs transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
            Ver ficha
          </a>
        )}
        <a
          href={waTarget}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs transition-colors shadow-sm"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Hablar con asesor
        </a>
      </div>
    </div>
  );
};
