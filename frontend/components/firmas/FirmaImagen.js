'use client';
import { useRef, useState } from 'react';
import { normalizar, cargarImagen, quitarFondo } from '../../lib/normalizar';

const MAX = 5 * 1024 * 1024; // 5 MB
const TIPOS = ['image/png', 'image/jpeg'];

// Método 3: firma por imagen — se sube una foto o escaneo, se quita/aclara el
// fondo, se recorta y centra, y se normaliza igual que los otros métodos.
export default function FirmaImagen({ onFirma }) {
  const input = useRef(null);
  const original = useRef(null); // canvas de trabajo (imagen cargada)
  const [prev, setPrev] = useState(null);
  const [quitar, setQuitar] = useState(true);
  const [tol, setTol] = useState(40);
  const [err, setErr] = useState('');
  const [nomArchivo, setNomArchivo] = useState('');

  const procesar = async () => {
    if (!original.current) { setPrev(null); onFirma(null); return; }
    const c = document.createElement('canvas');
    c.width = original.current.width;
    c.height = original.current.height;
    c.getContext('2d').drawImage(original.current, 0, 0);
    if (quitar) quitarFondo(c, 255 - tol);
    try {
      const png = await normalizar(c);
      setPrev(png);
      setErr('');
      onFirma(png);
    } catch (e) {
      setPrev(null);
      setErr(e.message);
      onFirma(null);
    }
  };

  const archivo = async (f) => {
    setErr('');
    if (!f) return;
    if (!TIPOS.includes(f.type)) { setErr('Formato no permitido: usa PNG o JPG'); return; }
    if (f.size > MAX) { setErr('La imagen supera el máximo de 5 MB'); return; }
    const dataURL = await new Promise((ok, mal) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = () => mal(new Error('No se pudo leer el archivo'));
      r.readAsDataURL(f);
    });
    try {
      const img = await cargarImagen(dataURL);
      const max = 1600;
      const esc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * esc);
      c.height = Math.round(img.naturalHeight * esc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      original.current = c;
      setNomArchivo(f.name);
      await procesar();
    } catch (e) {
      setErr(e.message);
      setPrev(null);
      onFirma(null);
    }
  };

  const cambiarFondo = async (v) => {
    setQuitar(v);
    await new Promise((r) => setTimeout(r, 0));
    if (original.current) {
      const c = document.createElement('canvas');
      c.width = original.current.width;
      c.height = original.current.height;
      c.getContext('2d').drawImage(original.current, 0, 0);
      if (v) quitarFondo(c, 255 - tol);
      try {
        const png = await normalizar(c);
        setPrev(png);
        onFirma(png);
      } catch (e) { setErr(e.message); onFirma(null); }
    }
  };

  const cambiarTol = (v) => {
    setTol(v);
    if (original.current && quitar) {
      const c = document.createElement('canvas');
      c.width = original.current.width;
      c.height = original.current.height;
      c.getContext('2d').drawImage(original.current, 0, 0);
      quitarFondo(c, 255 - v);
      normalizar(c).then((png) => { setPrev(png); onFirma(png); }).catch((e) => setErr(e.message));
    }
  };

  const reemplazar = () => { input.current?.click(); };

  return (
    <div className="fm-metodo">
      <input
        ref={input} type="file" accept="image/png,image/jpeg" hidden
        onChange={(e) => { archivo(e.target.files?.[0]); e.target.value = ''; }}
      />
      {!prev && !err && (
        <button type="button" className="g" onClick={() => input.current?.click()}>
          Subir foto o escaneo de la firma
        </button>
      )}
      {prev && (
        <div className="fm-caja fm-prev"><img src={prev} alt="Vista previa de la firma" /></div>
      )}
      {nomArchivo && <p className="mut">Archivo: {nomArchivo}</p>}
      {prev && (
        <div className="row">
          <button type="button" onClick={reemplazar}>Reemplazar imagen</button>
          <label className="fm-inline">
            <input type="checkbox" checked={quitar} onChange={(e) => cambiarFondo(e.target.checked)} />
            Quitar fondo
          </label>
          {quitar && (
            <label className="fm-inline fm-tol">
              Tolerancia
              <input type="range" min="10" max="90" value={tol} onChange={(e) => cambiarTol(Number(e.target.value))} />
            </label>
          )}
        </div>
      )}
      {err && <p className="fm-err">{err}</p>}
    </div>
  );
}
