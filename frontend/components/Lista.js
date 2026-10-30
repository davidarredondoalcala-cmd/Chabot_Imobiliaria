import { filtrar, porVencer } from '../lib/utils';
import Filtros from './Filtros';
import Tarjeta from './Tarjeta';
import { IcoCasa, IcoEdificio } from './Iconos';

const Skyline = () => (
  <svg className="skyline" viewBox="0 0 400 200" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M10 200V130h46v70M56 200V96h58v104M114 200V60h70v140M184 200V112h50v140M234 200V80h60v120M294 200V138h40v62M334 200V108h56v92" />
      <path d="M126 80h46M126 100h46M126 120h46M126 140h46M126 160h46M244 100h40M244 120h40M244 140h40M244 160h40M68 116h34M68 136h34M68 156h34" opacity=".55" />
    </g>
  </svg>
);

export default function Lista({ data, tab, setTab, abrir, filtros, setFiltros, nuevo }) {
  const base = filtrar(data, filtros);
  const n = (t) => base.filter((i) => i.tipo === t).length;
  const items = base.filter((i) => i.tipo === tab);
  const idx = tab === 'Casa' ? 0 : 1;
  const stats = [
    ['Inmuebles', data.length],
    ['Arrendados', data.filter((i) => i.estado === 'Arrendada').length],
    ['En venta', data.filter((i) => i.estado === 'Para la venta').length],
    ['Contratos por vencer', data.filter((i) => i.estado === 'Arrendada' && porVencer(i)).length],
  ];
  return (
    <div className="view">
      <section className="portada noprint">
        <Skyline />
        <h2>Tu portafolio inmobiliario, siempre al día</h2>
        <p>Consulta el estado de cada casa y apartamento, controla los vencimientos y genera contratos listos para firmar.</p>
        <dl className="stats">
          {stats.map(([t, v]) => (<div key={t}><dd>{v}</dd><dt>{t}</dt></div>))}
        </dl>
      </section>
      <div className="tabs" role="tablist">
        <span className="pill" style={{ transform: `translateX(${idx * 100}%)` }} />
        <button role="tab" aria-selected={idx === 0} className={idx === 0 ? 'on' : ''} onClick={() => setTab('Casa')}><IcoCasa /> Casas ({n('Casa')})</button>
        <button role="tab" aria-selected={idx === 1} className={idx === 1 ? 'on' : ''} onClick={() => setTab('Apartamento')}><IcoEdificio /> Apartamentos ({n('Apartamento')})</button>
      </div>
      <Filtros f={filtros} setF={setFiltros} total={data.length} mostrados={base.length} />
      <div className="toolbar">
        <h2>{tab === 'Casa' ? 'Casas' : 'Apartamentos'}</h2>
      </div>
      {items.length === 0 && <div className="card vacio">Ningún inmueble coincide con los filtros. Amplía los rangos o cambia de pestaña.</div>}
      <div className="lista">
        <article
          className="card item nuevo-item"
          role="button"
          tabIndex={0}
          aria-label="Agregar inmueble"
          title="Agregar inmueble"
          onClick={nuevo}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nuevo(); } }}
        >
          <span className="nuevo-mas" aria-hidden="true">+</span>
        </article>
        {items.map((i) => <Tarjeta key={i._id} i={i} abrir={() => abrir(i._id)} />)}
      </div>
    </div>
  );
}
