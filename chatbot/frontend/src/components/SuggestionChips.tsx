import React from 'react';

interface SuggestionChipsProps {
  onSelect: (text: string) => void;
  disabled?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  'Busco apartamento en arriendo',
  'Quiero comprar una casa en Calambeo',
  'Apartamento en El Vergel',
  'Hablar con un asesor',
];

export const SuggestionChips: React.FC<SuggestionChipsProps> = ({ onSelect, disabled }) => {
  return (
    <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50/80 border-t border-gray-100">
      {DEFAULT_SUGGESTIONS.map((chip, idx) => (
        <button
          key={idx}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(chip)}
          className="text-xs bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-300 transition-colors rounded-full px-3 py-1 font-medium shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {chip}
        </button>
      ))}
    </div>
  );
};
