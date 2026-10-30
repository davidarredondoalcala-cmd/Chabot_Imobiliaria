'use client';
import { useState } from 'react';
import FirmaTipografica from './FirmaTipografica';
import FirmaCanvas from './FirmaCanvas';
import FirmaImagen from './FirmaImagen';
import { firmar } from '../../lib/apiFirmas';

const METODOS = [
  { id: 'tipografica', nom: 'Teclado', desc: 'Escribe tu nombre y elige una fuente manuscrita' },
  { id: 'canvas', nom: 'A pulso', desc: 'Dibuja con el mouse, touchpad o el dedo' },
  { id: 'imagen', nom: 'Imagen', desc: 'Sube una foto o escaneo de tu firma' },
];

// Orquestador del acto de firmar: identidad + método + preview + condiciones.
// El TURNO lo decide el servidor; este componente solo pinta y envía.
export default function FirmaFlujo({ vista, token, avisar, firmado }) {
  const [metodo, setMetodo] = useState('tipografica');
  const [imagen, setImagen] = useState(null);
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [idn, setIdn] = useState({ nombre: vista.miNombre || '', cedula: '', email: '' });
  const set = (k) => (e) => setIdn({ ...idn, [k]: e.target.value });

  const listo = !!imagen && acepta && idn.nombre.trim().length >= 3 && idn.cedula.trim().length >= 5;

  const cambiarMetodo = (m) => { setMetodo(m); setImagen(null); };

  const enviar = async () => {
    setEnviando(true);
    try {
      const r = await firmar(token, { datos: idn, metodo, imagen, condiciones: true });
      avisar('Firma registrada');
      firmado(r);
    } catch (e) {
      avisar(e.message);
    }
    setEnviando(false);
  };

  return (
    <div className="card noprint">
      <h3 className="form-t">Firmar como {vista.miRol}</h3>

      <div className="fm-id">
        <div>
          <label>Nombre completo</label>
          <input value={idn.nombre} onChange={set('nombre')} placeholder="Tu nombre como aparece en el documento" />
        </div>
        <div>
          <label>Cédula de ciudadanía</label>
          <input value={idn.cedula} onChange={set('cedula')} inputMode="numeric" placeholder="Sin puntos ni espacios" />
        </div>
        <div>
          <label>Correo electrónico</label>
          <input value={idn.email} onChange={set('email')} type="email" placeholder="opcional@correo.com" />
        </div>
      </div>

      <div className="fm-tabs">
        {METODOS.map((m) => (
          <button key={m.id} type="button" className={metodo === m.id ? 'on' : ''} onClick={() => cambiarMetodo(m.id)}>
            <b>{m.nom}</b><small>{m.desc}</small>
          </button>
        ))}
      </div>

      {metodo === 'tipografica' && <FirmaTipografica nombre={idn.nombre} onFirma={setImagen} />}
      {metodo === 'canvas' && <FirmaCanvas onFirma={setImagen} />}
      {metodo === 'imagen' && <FirmaImagen onFirma={setImagen} />}

      <div className="fm-cond">
        <label>
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)} />
          <span>
            Acepto las condiciones de firma electrónica: declaración de voluntad conforme a la
            Ley 527 de 1999, con registro de fecha, hora, IP y huella digital del documento.
          </span>
        </label>
      </div>

      <div className="row">
        <button type="button" className="g" disabled={!listo || enviando} onClick={enviar}>
          {enviando ? 'Firmando…' : 'Firmar'}
        </button>
        {!listo && <span className="mut">Completa tus datos, genera la firma y acepta las condiciones</span>}
      </div>
    </div>
  );
}
