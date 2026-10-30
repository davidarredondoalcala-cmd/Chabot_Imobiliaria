'use client';
import React from 'react';
import { IcoChatPin, IcoChatBed, IcoChatBath, IcoChatArea, IcoChatWhatsApp } from './IconosChat';

export default function PropertyCard({ property, whatsappUrl }) {
  if (!property) return null;

  const formattedPrice = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(property.precio || 0);

  const fallbackWa = `https://wa.me/573100000000?text=${encodeURIComponent(
    `Hola, me interesa información sobre el inmueble ${property.codigo}: ${property.titulo}`
  )}`;
  const waTarget = whatsappUrl || fallbackWa;

  const isArriendo = property.operacion === 'arriendo';

  const abrirEnPlataforma = () => {
    window.dispatchEvent(
      new CustomEvent('habitat-abrir-inmueble', {
        detail: property,
      })
    );
  };

  return (
    <div className="hc-prop-card">
      {property.foto && (
        <div className="hc-prop-img-wrap">
          <img src={property.foto} alt={property.titulo} className="hc-prop-thumb" loading="lazy" />
        </div>
      )}
      <div className="hc-prop-header">
        <div className="hc-prop-badges">
          <span className="hc-badge-op">
            {isArriendo ? 'En Arriendo' : 'En Venta'}
          </span>
          <span className="hc-badge-code">{property.codigo}</span>
        </div>
        <h4 className="hc-prop-title">{property.titulo}</h4>
        <div className="hc-prop-price">
          {formattedPrice} {isArriendo && <small>/mes</small>}
        </div>
      </div>

      <div className="hc-prop-body">
        <div className="hc-prop-loc">
          <IcoChatPin />
          <span>Barrio {property.barrio || 'Ibagué'}, Estrato {property.estrato || 4}</span>
        </div>

        <div className="hc-prop-specs">
          {property.area_m2 > 0 && (
            <div className="hc-spec-item">
              <IcoChatArea />
              <span>{property.area_m2} m²</span>
            </div>
          )}
          {property.habitaciones > 0 && (
            <div className="hc-spec-item">
              <IcoChatBed />
              <span>{property.habitaciones} hab</span>
            </div>
          )}
          {property.banos > 0 && (
            <div className="hc-spec-item">
              <IcoChatBath />
              <span>{property.banos} bñ</span>
            </div>
          )}
        </div>

        {property.amenidades && property.amenidades.length > 0 && (
          <div className="hc-prop-amenities">
            {property.amenidades.slice(0, 3).map((a, idx) => (
              <span key={idx} className="hc-amenity-chip">{a}</span>
            ))}
            {property.amenidades.length > 3 && (
              <span className="hc-amenity-more">+{property.amenidades.length - 3}</span>
            )}
          </div>
        )}

        <div className="hc-prop-actions">
          <button
            type="button"
            className="hc-prop-btn-view"
            onClick={abrirEnPlataforma}
            title="Abrir detalles de la propiedad en la plataforma"
          >
            🏠 Ver en la plataforma
          </button>

          <a
            href={waTarget}
            target="_blank"
            rel="noopener noreferrer"
            className="hc-prop-btn-wa"
          >
            <IcoChatWhatsApp size={15} />
            <span>Preguntar por WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
}
