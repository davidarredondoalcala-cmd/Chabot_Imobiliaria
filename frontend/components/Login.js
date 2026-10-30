'use client';
import { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID, cargarGoogle, loginGoogle } from '../lib/auth';
import { Logo, IcoCasa, IcoEdificio } from './Iconos';
import TemaBtn from './TemaBtn';


export default function Login({ onEntrar }) {
  const div = useRef(null);

  const entrar = useRef(onEntrar);
  entrar.current = onEntrar;
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        await cargarGoogle();
        if (!vivo || !div.current || !window.google?.accounts?.id) {
          if (vivo) setError('No se pudo cargar el botón de Google. Revisa tu conexión.');
          return;
        }
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (res) => {
            try {
              const sesion = await loginGoogle(res.credential);
              entrar.current(sesion);
            } catch (e) {
              setError(e.message || 'No se pudo iniciar sesión');
            }
          },
        });
        window.google.accounts.id.renderButton(div.current, {
          theme: 'filled_blue',
          size: 'large',
          shape: 'pill',
          text: 'signin_with',
          locale: 'es',
          width: 300,
        });
        setCargando(false);
      } catch (e) {
        if (vivo) setError('No se pudo cargar el botón de Google.');
      }
    })();
    return () => { vivo = false; };
  }, []);

  return (
    <main className="login-main">
      <div className="login-fondo" aria-hidden="true" />
      <TemaBtn />
      <div className="card login-card">
        <div className="marca login-marca"><Logo /><h1>Habitat Capital</h1></div>
        <h2 className="login-t">Inicia sesión</h2>
        <p className="mut login-sub">
          Plataforma privada de gestión de inmuebles y contratos. Entra con la cuenta de
          Google autorizada como administrador.
        </p>

        <div className="login-btn" ref={div} />
        {cargando && !error && <p className="mut login-espera">Cargando el inicio de sesión…</p>}
        {error && <div className="login-error">{error}</div>}

        <div className="login-pie">
          <span><IcoCasa /> Catálogo de casas</span>
          <span><IcoEdificio /> Apartamentos y contratos</span>
        </div>
      </div>
    </main>
  );
}