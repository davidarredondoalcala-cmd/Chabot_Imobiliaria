// Iconos de línea (SVG en línea, heredan el color del texto)
const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const IcoCama = () => (<svg {...base}><path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 15h18M7 9V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" /></svg>);
export const IcoBano = () => (<svg {...base}><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3zM6 12V6a2 2 0 0 1 3.4-1.4M7 19l-1 2M17 19l1 2" /></svg>);
export const IcoArea = () => (<svg {...base}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>);
export const IcoBuscar = () => (<svg {...base}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>);
export const IcoCasa = () => (<svg {...base}><path d="M3 11.5 12 4l9 7.5M5 10v10h14V10M10 20v-6h4v6" /></svg>);
export const IcoEdificio = () => (<svg {...base}><path d="M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M15 9h3a1 1 0 0 1 1 1v11M3 21h18M9 7h2M9 11h2M9 15h2" /></svg>);
export const IcoSol = () => (<svg {...base}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
export const IcoLuna = () => (<svg {...base}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>);

// Isotipo: casas modernas con techos a dos aguas enmarcadas en un cuadrado.
// Azul marino sobre blanco hueso (identidad "Habitat Capital").
export const Logo = () => (
  <svg width="36" height="36" viewBox="0 0 36 36" role="img" aria-label="Habitat Capital">
    <rect width="36" height="36" rx="9" fill="#faf8f3" />
    <rect x="1.4" y="1.4" width="33.2" height="33.2" rx="7.8" fill="none" stroke="#13294b" strokeWidth="1.4" opacity="0.18" />
    <g fill="none" stroke="#13294b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* casa principal */}
      <path d="M7.5 16.6 13.8 11l6.3 5.6V26h-12.6z" />
      <path d="M11.6 26v-5.2h4.4V26" />
      {/* casa secundaria */}
      <path d="M20.4 17.4 25 13.6l4.6 3.8V26H20.4z" />
      <path d="M22.9 26v-3.6h4.2V26" />
      {/* linea de suelo */}
      <path d="M6 26.4h24" />
    </g>
  </svg>
);
