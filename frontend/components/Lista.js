'use client';
import { useState, useEffect, useMemo } from 'react';
import { filtrar, porVencer } from '../lib/utils';
import Filtros from './Filtros';
import Tarjeta from './Tarjeta';
import { IcoCasa, IcoEdificio, IcoTodos } from './Iconos';

const Skyline = () => (
  <svg className="skyline" viewBox="0 0 400 200" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M10 200V130h46v70M56 200V96h58v104M114 200V60h70v140M184 200V112h50v140M234 200V80h60v120M294 200V138h40v62M334 200V108h56v92" />
      <path d="M126 80h46M126 100h46M126 120h46M126 140h46M126 160h46M244 100h40M244 120h40M244 140h40M244 160h40M68 116h34M68 136h34M68 156h34" opacity=".55" />
    </g>
  </svg>
);


export default function Lista({ data, tab, setTab, abrir, filtros, setFiltros, nuevo, esAdmin }) {
  const POR_PAGINA = 50;
  const [pagina, setPagina] = useState(1);

  const base = filtrar(data, filtros);
  const n = (t) => base.filter((i) => i.tipo === t).length;
  const items = tab === 'Todos' ? base : base.filter((i) => i.tipo === tab);
  const idx = tab === 'Todos' ? 0 : tab === 'Casa' ? 1 : 2;
  const total = data.length;

  // Extrae lista única de ciudades presentes en el catálogo
  const ciudades = useMemo(() => {
    const set = new Set();
    data.forEach((i) => {
      if (i.ciudad && i.ciudad.trim()) set.add(i.ciudad.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [data]);

  // Al cambiar pestaña de tipo o cualquier filtro, reiniciar a la página 1
  useEffect(() => {
    setPagina(1);
  }, [tab, filtros]);

  const totalPaginas = Math.max(1, Math.ceil(items.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * POR_PAGINA;
  const itemsPaginados = items.slice(inicio, inicio + POR_PAGINA);

  const irAPagina = (p) => {
    if (p < 1 || p > totalPaginas || p === paginaActual) return;
    setPagina(p);
    const elem = document.getElementById('catalogo-inmuebles');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const generarPestanas = () => {
    if (totalPaginas <= 7) {
      return Array.from({ length: totalPaginas }, (_, i) => i + 1);
    }
    const paginas = [];
    if (paginaActual <= 4) {
      for (let i = 1; i <= 5; i++) paginas.push(i);
      paginas.push('...');
      paginas.push(totalPaginas);
    } else if (paginaActual >= totalPaginas - 3) {
      paginas.push(1);
      paginas.push('...');
      for (let i = totalPaginas - 4; i <= totalPaginas; i++) paginas.push(i);
    } else {
      paginas.push(1);
      paginas.push('...');
      paginas.push(paginaActual - 1);
      paginas.push(paginaActual);
      paginas.push(paginaActual + 1);
      paginas.push('...');
      paginas.push(totalPaginas);
    }
    return paginas;
  };

  const stats = esAdmin
    ? [
        ['Inmuebles', total],
        ['Arrendados', data.filter((i) => i.estado === 'Arrendada').length],
        ['En venta', data.filter((i) => i.estado === 'Para la venta').length],
        ['Contratos por vencer', data.filter((i) => i.estado === 'Arrendada' && porVencer(i)).length],
      ]
    : [
        ['Inmuebles', total],
        ['Disponibles', data.filter((i) => i.estado === 'Sin arrendar').length],
        ['En arriendo', data.filter((i) => i.estado === 'Sin arrendar' || i.estado === 'Arrendada').length],
        ['En venta', data.filter((i) => i.estado === 'Para la venta').length],
      ];

  return (
    <div className="view">
      <section className="portada noprint">
        <Skyline />
        <div className="portada-header-wrap">
          <h2>Habitat Capital, siempre al día</h2>
          <p>
            {esAdmin
              ? 'Consulta el estado de cada casa y apartamento, controla los vencimientos y genera contratos listos para firmar.'
              : 'Explora casas y apartamentos disponibles, revisa características detalladas y contacta con nuestros asesores.'}
          </p>
        </div>
        <dl className="stats">
          {stats.map(([t, v]) => (
            <div key={t}>
              <dd>{v}</dd>
              <dt>{t}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* Pestañas de cristal líquido */}
      <div id="catalogo-inmuebles" className="tabs tabs-tres" role="tablist">
        <span className="pill" style={{ transform: `translateX(${idx * 100}%)` }} />
        <button role="tab" aria-selected={tab === 'Todos'} className={tab === 'Todos' ? 'on' : ''} onClick={() => setTab('Todos')}>
          <IcoTodos /> Todos ({base.length})
        </button>
        <button role="tab" aria-selected={tab === 'Casa'} className={tab === 'Casa' ? 'on' : ''} onClick={() => setTab('Casa')}>
          <IcoCasa /> Casas ({n('Casa')})
        </button>
        <button role="tab" aria-selected={tab === 'Apartamento'} className={tab === 'Apartamento' ? 'on' : ''} onClick={() => setTab('Apartamento')}>
          <IcoEdificio /> Apartamentos ({n('Apartamento')})
        </button>
      </div>

      <Filtros f={filtros} setF={setFiltros} total={data.length} mostrados={base.length} ciudades={ciudades} />

      <div className="toolbar">
        <h2>{tab === 'Todos' ? 'Todos los inmuebles' : tab === 'Casa' ? 'Casas' : 'Apartamentos'}</h2>
      </div>

      {items.length === 0 && <div className="card vacio">Ningún inmueble coincide con los filtros. Amplía los rangos o cambia de pestaña.</div>}

      <div className="lista">
        {itemsPaginados.map((i) => <Tarjeta key={i._id} i={i} esAdmin={esAdmin} abrir={() => abrir(i._id)} />)}
        {esAdmin && (
          <article
            className="card item nuevo-item"
            role="button"
            tabIndex={0}
            aria-label={`Agregar ${tab === 'Apartamento' ? 'apartamento' : tab === 'Casa' ? 'casa' : 'inmueble'}`}
            title={`Agregar ${tab === 'Apartamento' ? 'apartamento' : tab === 'Casa' ? 'casa' : 'inmueble'}`}
            onClick={nuevo}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nuevo(); } }}
          >
            <span className="nuevo-mas" aria-hidden="true">+</span>
            <span className="nuevo-txt">Agregar {tab === 'Apartamento' ? 'apartamento' : tab === 'Casa' ? 'casa' : 'inmueble'}</span>
          </article>
        )}
      </div>

      {/* Pestañas de paginación (Límite: 50 inmuebles por pestaña) */}
      {totalPaginas > 1 && (
        <div className="paginacion-pestanas-wrap" role="navigation" aria-label="Navegación de pestañas de inmuebles">
          <div className="paginacion-info">
            <span>
              Mostrando <b>{inicio + 1}</b> - <b>{Math.min(inicio + POR_PAGINA, items.length)}</b> de <b>{items.length}</b> inmuebles · Pestaña <b>{paginaActual}</b> de <b>{totalPaginas}</b>
            </span>
          </div>

          <div className="paginacion-pestanas">
            <button
              type="button"
              className="pag-btn pag-prev"
              disabled={paginaActual === 1}
              onClick={() => irAPagina(paginaActual - 1)}
              aria-label="Pestaña anterior"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              <span>Anterior</span>
            </button>

            <div className="pag-numeros">
              {generarPestanas().map((p, idx) =>
                p === '...' ? (
                  <span key={`p-dots-${idx}`} className="pag-ellipsis">…</span>
                ) : (
                  <button
                    key={`p-${p}`}
                    type="button"
                    className={`pag-num ${p === paginaActual ? 'on' : ''}`}
                    onClick={() => irAPagina(p)}
                    aria-current={p === paginaActual ? 'page' : undefined}
                    aria-label={`Ir a pestaña ${p}`}
                  >
                    Pestaña {p}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="pag-btn pag-next"
              disabled={paginaActual === totalPaginas}
              onClick={() => irAPagina(paginaActual + 1)}
              aria-label="Siguiente pestaña"
            >
              <span>Siguiente</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
