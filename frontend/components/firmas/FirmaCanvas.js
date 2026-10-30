'use client';
import { useEffect, useRef, useState } from 'react';
import { normalizar } from '../../lib/normalizar';

// Método 2: firma a pulso — dibujo con Pointer Events (mouse, touchpad y
// pantalla táctil) sobre un canvas transparente, con trazo suave y rehacer.
export default function FirmaCanvas({ onFirma }) {
  const ref = useRef(null);
  const trazando = useRef(false);
  const pts = useRef([]);
  const trazos = useRef([]); // array de trazos (cada uno = array de puntos)
  const [nTrazos, setNTrazos] = useState(0);
  const [err, setErr] = useState('');

  const ctx2d = () => {
    const c = ref.current;
    const ctx = c.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14201d';
    return ctx;
  };

  const configurar = () => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const r = c.getBoundingClientRect();
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redibujar();
  };

  const dibujarTrazo = (ctx, arr) => {
    if (arr.length === 1) {
      ctx.beginPath();
      ctx.arc(arr[0].x, arr[0].y, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = '#14201d';
      ctx.fill();
      return;
    }
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(arr[0].x, arr[0].y);
    for (let i = 1; i < arr.length - 1; i++) {
      const mx = (arr[i].x + arr[i + 1].x) / 2;
      const my = (arr[i].y + arr[i + 1].y) / 2;
      ctx.quadraticCurveTo(arr[i].x, arr[i].y, mx, my);
    }
    const u = arr[arr.length - 1];
    ctx.lineTo(u.x, u.y);
    ctx.stroke();
  };

  const redibujar = () => {
    const c = ref.current;
    if (!c) return;
    const ctx = ctx2d();
    ctx.clearRect(0, 0, c.width, c.height);
    for (const t of trazos.current) dibujarTrazo(ctx, t);
  };

  useEffect(() => {
    configurar();
    const f = () => configurar();
    addEventListener('resize', f);
    return () => removeEventListener('resize', f);
  }, []);

  const pos = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, p: e.pressure || 0 };
  };

  const emitir = async () => {
    if (!trazos.current.length) { setErr(''); onFirma(null); return; }
    try {
      const png = await normalizar(ref.current);
      setErr('');
      onFirma(png);
    } catch (e) {
      setErr(e.message);
      onFirma(null);
    }
  };

  const abajo = (e) => {
    e.preventDefault();
    ref.current.setPointerCapture(e.pointerId);
    trazando.current = true;
    pts.current = [pos(e)];
  };

  const mover = (e) => {
    if (!trazando.current) return;
    e.preventDefault();
    const p = pos(e);
    const arr = pts.current;
    arr.push(p);
    const ctx = ctx2d();
    // ancho variable sutil según presión táctil
    ctx.lineWidth = 2.5 + (p.p > 0 && p.p !== 0.5 ? Math.min(p.p, 1) * 1.5 : 0);
    if (arr.length >= 3) {
      const a = arr[arr.length - 3], b = arr[arr.length - 2], c = arr[arr.length - 1];
      ctx.beginPath();
      ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
      ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
      ctx.stroke();
    }
  };

  const arriba = (e) => {
    if (!trazando.current) return;
    trazando.current = false;
    const arr = pts.current;
    if (arr.length === 1) dibujarTrazo(ctx2d(), arr);
    if (arr.length) {
      trazos.current = [...trazos.current, arr];
      setNTrazos(trazos.current.length);
    }
    pts.current = [];
    emitir();
  };

  const limpiar = () => {
    trazos.current = [];
    setNTrazos(0);
    redibujar();
    setErr('');
    onFirma(null);
  };

  const rehacer = () => {
    trazos.current = trazos.current.slice(0, -1);
    setNTrazos(trazos.current.length);
    redibujar();
    emitir();
  };

  return (
    <div className="fm-metodo">
      <canvas
        ref={ref} className="fm-lienzo"
        onPointerDown={abajo} onPointerMove={mover} onPointerUp={arriba} onPointerCancel={arriba}
      />
      <div className="row">
        <button type="button" onClick={limpiar} disabled={!nTrazos}>Limpiar</button>
        <button type="button" onClick={rehacer} disabled={!nTrazos}>Rehacer</button>
        <span className="mut">{nTrazos ? `${nTrazos} trazo${nTrazos > 1 ? 's' : ''}` : 'Dibuja tu firma dentro del recuadro'}</span>
      </div>
      {err && <p className="fm-err">{err}</p>}
    </div>
  );
}
