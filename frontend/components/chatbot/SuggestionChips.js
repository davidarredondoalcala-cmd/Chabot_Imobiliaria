'use client';
import React from 'react';

const SUGERENCIAS = [
  'Busco apartamento en arriendo',
  'Casas en venta en El Vergel',
  'Arriendo en Piedra Pintada',
  'Hablar con un asesor',
];

export default function SuggestionChips({ onSelect, disabled }) {
  return (
    <div className="hc-chips-container">
      {SUGERENCIAS.map((chip, idx) => (
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
