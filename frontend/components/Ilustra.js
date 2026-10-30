// Ilustración de cada inmueble (reemplaza los emojis). Se dibuja con SVG, en paleta Azul Rey Neón.
const LUCES = [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0];

function Casa() {
  return (<>
    <circle cx="262" cy="40" r="19" fill="#00f0ff" opacity=".92" filter="drop-shadow(0 0 8px rgba(0,240,255,0.8))" />
    <rect x="0" y="136" width="320" height="40" fill="#06122c" opacity=".5" />
    <circle cx="46" cy="106" r="24" fill="#08183a" opacity=".7" /><rect x="44" y="122" width="5" height="16" fill="#050e24" opacity=".8" />
    <circle cx="284" cy="116" r="17" fill="#08183a" opacity=".7" /><rect x="282" y="128" width="4" height="10" fill="#050e24" opacity=".8" />
    <rect x="196" y="44" width="14" height="28" fill="#0f2b66" />
    <rect x="96" y="80" width="128" height="58" fill="#dbeafe" />
    <polygon points="84,83 160,36 236,83" fill="#0c1d42" />
    <rect x="106" y="96" width="26" height="22" rx="2" fill="#00f0ff" opacity=".9" /><rect x="188" y="96" width="26" height="22" rx="2" fill="#00f0ff" opacity=".9" />
    <rect x="148" y="100" width="24" height="38" rx="2" fill="#1d4ed8" />
    <circle cx="167" cy="120" r="1.8" fill="#00f0ff" />
  </>);
}

function Edificio() {
  const ventanas = (x0, y0, cols, filas, dx, dy, off = 0) => {
    const v = [];
    for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
      const on = LUCES[(f * cols + c + off) % LUCES.length];
      v.push(<rect key={`${x0}-${f}-${c}`} x={x0 + c * dx} y={y0 + f * dy} width="12" height="11" rx="1.5" fill={on ? '#00f0ff' : '#2563eb'} opacity={on ? 1 : 0.6} />);
    }
    return v;
  };
  return (<>
    <circle cx="48" cy="38" r="17" fill="#38bdf8" opacity=".95" filter="drop-shadow(0 0 10px rgba(56,189,248,0.8))" />
    <rect x="0" y="136" width="320" height="40" fill="#06122c" opacity=".6" />
    <rect x="48" y="74" width="62" height="64" fill="#162e6e" />{ventanas(60, 84, 2, 4, 26, 14, 3)}
    <rect x="212" y="58" width="62" height="80" fill="#0f2354" />{ventanas(224, 68, 2, 5, 26, 14, 7)}
    <rect x="112" y="18" width="98" height="120" fill="#09183d" />{ventanas(124, 30, 4, 7, 22, 15, 0).slice(0, 24)}
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
