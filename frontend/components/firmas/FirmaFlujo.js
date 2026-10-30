'use client';
import { useState } from 'react';
import FirmaTipografica from './FirmaTipografica';
import FirmaCanvas from './FirmaCanvas';
import FirmaImagen from './FirmaImagen';
import { firmar } from '../../lib/apiFirmas';
import { soloLetras, esNombreValido } from '../../lib/validadores';

const METODOS = [
  { id: 'tipografica', nom: 'Teclado', desc: 'Escribe tu nombre y elige una fuente manuscrita' },
  { id: 'canvas', nom: 'A pulso', desc: 'Dibuja con el mouse, touchpad o el dedo' },
  { id: 'imagen', nom: 'Imagen', desc: 'Sube una foto o escaneo de tu firma' },
];

// Orquestador del acto de firmar: identidad previamente registrada + método + condiciones.
// No se vuelven a pedir cédula ni correo porque ya fueron validados en el contrato.
export default function FirmaFlujo({ vista, token, avisar, firmado }) {
  const [metodo, setMetodo] = useState('tipografica');
  const [imagen, setImagen] = useState(null);
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [nombre, setNombre] = useState(vista.miNombre || '');

  const nombreValido = esNombreValido(nombre);
  const listo = !!imagen && acepta && nombreValido;

  const cambiarMetodo = (m) => {
    setMetodo(m);
    setImagen(null);
  };

  const enviar = async () => {
    if (!nombreValido) {
      return avisar('Por favor escribe tu nombre completo (mínimo 3 letras válidas)');
    }
    setEnviando(true);
    try {
      const r = await firmar(token, {
        datos: {
          nombre: nombre.trim(),
          cedula: vista.miCedula || '',
          email: vista.miEmail || '',
        },
        metodo,
        imagen,
        condiciones: true,
      });
      avisar('Firma registrada exitosamente');
      firmado(r);
    } catch (e) {
      avisar(e.message);
    }
    setEnviando(false);
  };

  return (
    <div className="card noprint">
      <h3 className="form-t">Firmar como {vista.miRol}</h3>

      {/* Identidad previamente vinculada al contrato (sin re-pedir cédula ni correo) */}
      <div
        style={{
          background: 'var(--bg)',
          padding: '12px 16px',
          borderRadius: 10,
          border: '1.5px solid var(--bd)',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ac)' }}>
            Identidad vinculada al contrato
          </span>
          <span className="tag Arrendada" style={{ fontSize: '0.74rem', padding: '2px 8px' }}>
            Datos precargados
          </span>
        </div>
        <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--fg)' }}>
          {nombre || vista.miNombre || 'Firmante'}
        </div>
        {(vista.miCedula || vista.miEmail) && (
          <div className="mut" style={{ fontSize: '0.82rem', marginTop: 3 }}>
            {vista.miCedula && <span>C.C. <b>{vista.miCedula}</b></span>}
            {vista.miCedula && vista.miEmail && <span> · </span>}
            {vista.miEmail && <span>Correo: <b>{vista.miEmail}</b></span>}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: '0.88rem' }}>
          Nombre completo que aparecerá en la firma
        </label>
        <input
          value={nombre}
          onChange={(e) => setNombre(soloLetras(e.target.value, 60))}
          placeholder="Tu nombre completo como aparece en el documento"
          maxLength={60}
        />
        {nombre && !nombreValido && (
          <p className="mut" style={{ color: 'var(--red)', fontSize: '0.78rem', margin: '4px 0 0' }}>
            El nombre debe contener al menos 3 letras y no incluir caracteres inválidos.
          </p>
        )}
      </div>

      <div className="fm-tabs">
        {METODOS.map((m) => (
          <button key={m.id} type="button" className={metodo === m.id ? 'on' : ''} onClick={() => cambiarMetodo(m.id)}>
            <b>{m.nom}</b>
            <small>{m.desc}</small>
          </button>
        ))}
      </div>

      {metodo === 'tipografica' && <FirmaTipografica nombre={nombre} onFirma={setImagen} />}
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
        {!listo && <span className="mut">Genera tu firma y acepta las condiciones para estamparla</span>}
      </div>
    </div>
  );
}
