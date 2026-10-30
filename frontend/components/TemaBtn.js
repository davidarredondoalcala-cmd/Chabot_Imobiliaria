'use client';
import { useEffect, useState } from 'react';
import { IcoSol, IcoLuna } from './Iconos';

// Botón para alternar el tema claro/oscuro. Guarda la preferencia en localStorage
// y la aplica como data-theme en <html> (globals.css define ambos temas).
const CLAVE = 'habitat_tema';

function aplica(t) {
  const el = document.documentElement;
  if (t === 'light' || t === 'dark') el.setAttribute('data-theme', t);
  else el.removeAttribute('data-theme');
}

export default function TemaBtn() {
  const [oscuro, setOscuro] = useState(false);

  useEffect(() => {
    const guardado = localStorage.getItem(CLAVE);
    const sistema = window.matchMedia('(prefers-color-scheme:dark)').matches;
    const esOscuro = guardado ? guardado === 'dark' : sistema;
    aplica(guardado || (esOscuro ? 'dark' : 'light'));
    setOscuro(esOscuro);
  }, []);

  const alternar = () => {
    const nuevo = oscuro ? 'light' : 'dark';
    localStorage.setItem(CLAVE, nuevo);
    aplica(nuevo);
    setOscuro(!oscuro);
  };

  return (
    <button
      type="button"
      className="tema-btn"
      onClick={alternar}
      title={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      aria-label={oscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
    >
      {oscuro ? <IcoSol /> : <IcoLuna />}
    </button>
  );
}
