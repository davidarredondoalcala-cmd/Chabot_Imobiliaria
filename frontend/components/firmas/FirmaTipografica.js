'use client';
import { useEffect, useRef, useState } from 'react';
import { normalizar } from '../../lib/normalizar';

const FUENTES = [
  { id: 'caveat', nom: 'Caveat', css: '"Caveat", cursive' },
  { id: 'dancing', nom: 'Dancing Script', css: '"Dancing Script", cursive' },
  { id: 'greatvibes', nom: 'Great Vibes', css: '"Great Vibes", cursive' },
];

// Método 1: firma tipográfica — el nombre se pinta con una fuente manuscrita
// sobre un canvas transparente y se normaliza como los demás métodos.
export default function FirmaTipografica({ nombre, onFirma }) {
  const [fuente, setFuente] = useState(FUENTES[0]);
  const [prev, setPrev] = useState(null);
  const [err, setErr] = useState('');
  const [cargandoF, setCargandoF] = useState(true);

  useEffect(() => {
    if (document.querySelector('link[data-firmas-fuentes]')) { setCargandoF(false); return; }
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.setAttribute('data-firmas-fuentes', '1');
    l.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&family=Dancing+Script:wght@400;600&family=Great+Vibes&display=swap';
    l.onload = () => setCargandoF(false);
    l.onerror = () => setCargandoF(false);
    document.head.appendChild(l);
  }, []);

  useEffect(() => {
    let vivo = true;
    const pintar = async () => {
      const texto = String(nombre || '').trim();
      if (!texto) { setPrev(null); setErr(''); onFirma(null); return; }
      try {
        await document.fonts.load(`600 96px ${fuente.css}`);
        await document.fonts.ready;
      } catch { /* si las fuentes no cargan, usa la cursiva del sistema */ }
      if (!vivo) return;
      const c = document.createElement('canvas');
      c.width = 900;
      c.height = 360;
      const ctx = c.getContext('2d');
      let tam = 110;
      ctx.font = `600 ${tam}px ${fuente.css}`;
      while (ctx.measureText(texto).width > 840 && tam > 28) {
        tam -= 4;
        ctx.font = `600 ${tam}px ${fuente.css}`;
      }
      ctx.fillStyle = '#14201d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(texto, 450, 180);
      try {
        const png = await normalizar(c);
        if (!vivo) return;
        setPrev(png);
        setErr('');
        onFirma(png);
      } catch (e) {
        if (!vivo) return;
        setPrev(null);
        setErr(e.message);
        onFirma(null);
      }
    };
    pintar();
    return () => { vivo = false; };
  }, [nombre, fuente]);

  return (
    <div className="fm-metodo">
      <div className="fm-fuentes">
        {FUENTES.map((f) => (
          <button key={f.id} type="button" className={f.id === fuente.id ? 'on' : ''} onClick={() => setFuente(f)}>
            <span style={{ fontFamily: f.css, fontSize: '1.25rem' }}>Firma</span>
            <small>{f.nom}</small>
          </button>
        ))}
      </div>
      <div className="fm-caja fm-prev">
        {cargandoF && !prev ? <span className="mut">Cargando fuentes…</span>
          : prev ? <img src={prev} alt="Vista previa de la firma" />
            : <span className="mut">Escribe tu nombre arriba para ver la firma</span>}
      </div>
      {err && <p className="fm-err">{err}</p>}
    </div>
  );
}
