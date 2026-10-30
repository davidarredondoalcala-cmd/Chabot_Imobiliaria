'use client';
import React from 'react';

export const SUGERENCIAS_DEFAULT = [
  'Busco apartamento en arriendo',
  'Casas en venta en El Vergel',
  'Arriendo en Piedra Pintada',
  'Hablar con un asesor',
];

export default function SuggestionChips({ onSelect, disabled, chips = SUGERENCIAS_DEFAULT }) {
  const listaChips = chips && chips.length > 0 ? chips : SUGERENCIAS_DEFAULT;

  return (
    <div className="hc-chips-container">
      {listaChips.map((chip, idx) => (
        <button
          key={idx}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(chip)}
          className="hc-chip-btn"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
