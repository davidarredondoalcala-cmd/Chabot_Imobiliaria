// Ilustración de cada inmueble. Se dibuja con SVG, en paleta Glassy Dashboard V2 (Azul Real, Cian y Blanco Cristalino).
const LUCES = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0];

function Casa() {
  return (<>
    <defs>
      <radialGradient id="casa-sol" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#60a5fa" />
        <stop offset="100%" stopColor="#2563eb" />
      </radialGradient>
      <linearGradient id="casa-techo" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1e40af" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <linearGradient id="casa-muro" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#e0f2fe" />
        <stop offset="100%" stopColor="#bae6fd" />
      </linearGradient>
    </defs>
    <circle cx="262" cy="40" r="19" fill="url(#casa-sol)" opacity=".95" filter="drop-shadow(0 0 14px rgba(56,189,248,0.75))" />
    <rect x="0" y="136" width="320" height="40" fill="#0f172a" opacity=".55" />
    <circle cx="46" cy="106" r="24" fill="#1e293b" opacity=".7" /><rect x="44" y="122" width="5" height="16" fill="#0f172a" opacity=".8" />
    <circle cx="284" cy="116" r="17" fill="#1e293b" opacity=".7" /><rect x="282" y="128" width="4" height="10" fill="#0f172a" opacity=".8" />
    <rect x="196" y="44" width="14" height="28" fill="#1e3a8a" />
    <rect x="96" y="80" width="128" height="58" fill="url(#casa-muro)" rx="3" />
    <polygon points="84,83 160,36 236,83" fill="url(#casa-techo)" />
    <rect x="106" y="96" width="26" height="22" rx="3" fill="#38bdf8" opacity=".95" filter="drop-shadow(0 0 6px rgba(56,189,248,0.6))" />
    <rect x="188" y="96" width="26" height="22" rx="3" fill="#38bdf8" opacity=".95" filter="drop-shadow(0 0 6px rgba(56,189,248,0.6))" />
    <rect x="148" y="100" width="24" height="38" rx="3" fill="#2563eb" />
    <circle cx="167" cy="120" r="2" fill="#ffffff" />
  </>);
}

function Edificio() {
  const ventanas = (x0, y0, cols, filas, dx, dy, off = 0) => {
    const v = [];
    for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
      const on = LUCES[(f * cols + c + off) % LUCES.length];
      v.push(
        <rect
          key={`${x0}-${f}-${c}`}
          x={x0 + c * dx}
          y={y0 + f * dy}
          width="12"
          height="11"
          rx="2"
          fill={on ? '#38bdf8' : '#1e3a8a'}
          opacity={on ? 1 : 0.65}
          filter={on ? 'drop-shadow(0 0 4px rgba(56,189,248,0.7))' : 'none'}
        />
      );
    }
    return v;
  };
  return (<>
    <defs>
      <radialGradient id="edif-luna" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="100%" stopColor="#1d4ed8" />
      </radialGradient>
      <linearGradient id="edif-torre-1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <linearGradient id="edif-torre-central" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1e3a8a" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
    </defs>
    <circle cx="48" cy="38" r="17" fill="url(#edif-luna)" opacity=".95" filter="drop-shadow(0 0 16px rgba(56,189,248,0.85))" />
    <rect x="0" y="136" width="320" height="40" fill="#0f172a" opacity=".55" />
    <rect x="48" y="74" width="62" height="64" rx="3" fill="url(#edif-torre-1)" />{ventanas(60, 84, 2, 4, 26, 14, 3)}
    <rect x="212" y="58" width="62" height="80" rx="3" fill="url(#edif-torre-1)" />{ventanas(224, 68, 2, 5, 26, 14, 7)}
    <rect x="112" y="18" width="98" height="120" rx="3" fill="url(#edif-torre-central)" />{ventanas(124, 30, 4, 7, 22, 15, 0).slice(0, 24)}
    <rect x="149" y="118" width="24" height="20" rx="2" fill="#2563eb" />
  </>);
}

export default function Ilustra({ tipo }) {
  return (
    <svg viewBox="0 0 320 168" preserveAspectRatio="xMidYMax slice" role="img" aria-label={tipo === 'Casa' ? 'Ilustración de una casa' : 'Ilustración de un edificio de apartamentos'}>
      {tipo === 'Casa' ? <Casa /> : <Edificio />}
    </svg>
  );
}
