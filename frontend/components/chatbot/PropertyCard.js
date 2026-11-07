'use client';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IcoChatPin, IcoChatBed, IcoChatBath, IcoChatArea, IcoChatWhatsApp, IcoChatExternal } from './IconosChat';
import { waUrl, abrirWhatsApp } from '../../lib/contacto';

export default function PropertyCard({ property, whatsappUrl }) {
  const [verFoto, setVerFoto] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    if (!verFoto) return;
    const onTecla = (e) => { if (e.key === 'Escape') setVerFoto(false); };
    window.addEventListener('keydown', onTecla);
    return () => window.removeEventListener('keydown', onTecla);
  }, [verFoto]);

  if (!property) return null;

  const formattedPrice = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(property.precio || 0);

  const fallbackWa = waUrl(
    `Hola, me interesa información sobre el inmueble ${property.codigo}: ${property.titulo}`
  );
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
        <div
          className="hc-prop-img-wrap hc-prop-img-clicable"
          role="button"
          tabIndex={0}
          aria-label={`Ver foto del inmueble ${property.titulo} en grande`}
          onClick={(e) => { e.stopPropagation(); setVerFoto(true); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setVerFoto(true); } }}
        >
          <img src={property.foto} alt={property.titulo} className="hc-prop-thumb" loading="lazy" />
          <span className="hc-prop-zoom-hint">Ver foto</span>
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
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <IcoChatExternal size={14} />
            <span>Ver en la plataforma</span>
          </button>

          <a
            href={waTarget}
            target="_blank"
            rel="noopener noreferrer"
            onClick={abrirWhatsApp}
            className="hc-prop-btn-wa"
          >
            <IcoChatWhatsApp size={15} />
            <span>Preguntar por WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Vista previa de la foto: solo lectura, se cierra con clic fuera, el botón o Esc */}
      {property.foto && verFoto && montado && createPortal(
        <div className="hc-foto-lightbox" onClick={() => setVerFoto(false)}>
          <div className="hc-foto-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="hc-foto-lightbox-close"
              aria-label="Cerrar vista previa"
              onClick={() => setVerFoto(false)}
            >
              ✕
            </button>
            <img src={property.foto} alt={property.titulo} className="hc-foto-lightbox-img" />
            <span className="hc-foto-lightbox-cap">{property.titulo} ({property.codigo})</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
