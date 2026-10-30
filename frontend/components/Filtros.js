'use client';

import { useEffect, useRef, useState } from 'react';
import { FILTROS0, hayFiltros } from '../lib/utils';
import { IcoBuscar } from './Iconos';

const MIN = [['', 'Cualquiera'], ['1', '1+'], ['2', '2+'], ['3', '3+'], ['4', '4+'], ['5', '5+']];

const ESTADOS = [['', 'Todos'], ['Arrendada', 'Arrendada'], ['Por vencer', 'Por vencer'], ['Sin arrendar', 'Sin arrendar'], ['Para la venta', 'Para la venta'], ['Vendida', 'Vendida']];

// Selector desplegable: un botón que, al pulsarlo, despliega las opciones como píldoras.
function Desplegable({ valor, opciones, onChange, etiqueta, otro = false }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  // Con "Otro…" el valor puede ser un número libre que no está en la lista
  const esOtro = otro && valor !== '' && !opciones.some(([v]) => v === valor);
  const actual = opciones.find(([v]) => v === valor);
  const texto = esOtro ? `${valor}+` : (actual ? actual[1] : opciones[0][1]);

  // Se cierra al hacer clic fuera o al pulsar Escape
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    const tecla = (e) => { if (e.key === 'Escape') { setAbierto(false); ref.current?.querySelector('.dd-btn')?.focus(); } };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
  }, [abierto]);

  // Flechas para moverse entre las opciones
  const mover = (e) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    if (!abierto) { setAbierto(true); return; }
    const ops = [...ref.current.querySelectorAll('.dd-panel .chip')];
    const i = ops.indexOf(document.activeElement);
    const avanza = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    ops[avanza ? Math.min(i + 1, ops.length - 1) : Math.max(i - 1, 0)]?.focus();
  };

  return (
    <div className={`dd ${abierto ? 'abierto' : ''}`} ref={ref} onKeyDown={mover}>
      <button type="button" className="dd-btn" aria-haspopup="true" aria-expanded={abierto} aria-label={etiqueta} onClick={() => setAbierto(!abierto)}>
        <span>{texto}</span>
        <svg className="dd-flecha" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {abierto && (
        <div className="dd-panel" role="group" aria-label={etiqueta}>
          <div className="chips">
            {opciones.map(([v, t], n) => (
              <button key={v} type="button" style={{ '--n': n }} className={`chip ${valor === v ? 'on' : ''}`} aria-pressed={valor === v} onClick={() => { onChange(v); setAbierto(false); }}>{t}</button>
            ))}
            {otro && (
              <button type="button" style={{ '--n': opciones.length }} className={`chip ${esOtro ? 'on' : ''}`} aria-pressed={esOtro} onClick={() => onChange(esOtro ? '' : '6')}>Otro…</button>
            )}
            {esOtro && (
              <input
                type="number" min="0" autoFocus
                className="chip-num" value={valor}
                onChange={(e) => onChange(e.target.value)}
                aria-label={`${etiqueta}: número exacto o más`}
                placeholder="N°"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Filtros({ f, setF, total, mostrados }) {
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const rango = (a, b, u) => (
    <div className="rango">
      <input type="number" min="0" placeholder="Mín." value={f[a]} onChange={set(a)} aria-label={`${u} mínimo`} />
      <input type="number" min="0" placeholder="Máx." value={f[b]} onChange={set(b)} aria-label={`${u} máximo`} />
    </div>
  );

  // Desplegables: al hacer clic se abren las opciones como píldoras.
  const lista = (k, opciones, etiqueta, otro = false) => (
    <Desplegable valor={f[k]} opciones={opciones} etiqueta={etiqueta} otro={otro} onChange={(v) => setF({ ...f, [k]: v })} />
  );
  return (
    <div className="card filtros noprint">
      <div className="filtros-top"><b className="ft"><IcoBuscar /> Filtrar inmuebles</b><span className="mut">Mostrando {mostrados} de {total}</span></div>
      <div className="filtros-grid">
        <div><label className="filtro-lbl">Habitaciones<span className="chips-hint"> (o más)</span></label>{lista('hab', MIN, 'Habitaciones', true)}</div>
        <div><label className="filtro-lbl">Baños<span className="chips-hint"> (o más)</span></label>{lista('ban', MIN, 'Baños', true)}</div>
        <div><label className="filtro-lbl">Tamaño (m²)</label>{rango('areaMin', 'areaMax', 'Área')}</div>
        <div><label className="filtro-lbl">Rango de precio ($)</label>{rango('pMin', 'pMax', 'Precio')}</div>
        <div><label className="filtro-lbl">Estado</label>{lista('estado', ESTADOS, 'Estado')}</div>
      </div>
      {hayFiltros(f) && <div className="row"><button className="l" onClick={() => setF(FILTROS0)}>Limpiar filtros</button></div>}
    </div>
  );
}
