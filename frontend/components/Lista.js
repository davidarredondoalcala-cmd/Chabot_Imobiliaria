import { filtrar, porVencer } from '../lib/utils';
import Filtros from './Filtros';
import Tarjeta from './Tarjeta';
import { IcoCasa, IcoEdificio, IcoTodos, IcoCheck, IcoDocumento, IcoReloj } from './Iconos';

const Skyline = () => (
  <svg className="skyline" viewBox="0 0 400 200" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M10 200V130h46v70M56 200V96h58v104M114 200V60h70v140M184 200V112h50v140M234 200V80h60v120M294 200V138h40v62M334 200V108h56v92" />
      <path d="M126 80h46M126 100h46M126 120h46M126 140h46M126 160h46M244 100h40M244 120h40M244 140h40M244 160h40M68 116h34M68 136h34M68 156h34" opacity=".55" />
    </g>
  </svg>
);

const Sparkline = ({ strokeColor = '#3b82f6' }) => (
  <svg className="stat-sparkline" viewBox="0 0 76 26" fill="none" aria-hidden="true">
    <path
      d="M2 22 C 16 20, 24 10, 38 14 C 52 18, 60 4, 74 3"
      stroke={strokeColor}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Lista({ data, tab, setTab, abrir, filtros, setFiltros, nuevo, esAdmin }) {
  const base = filtrar(data, filtros);
  const n = (t) => base.filter((i) => i.tipo === t).length;
  const items = tab === 'Todos' ? base : base.filter((i) => i.tipo === tab);
  const idx = tab === 'Todos' ? 0 : tab === 'Casa' ? 1 : 2;

  const stats = esAdmin
    ? [
        {
          label: 'Inmuebles',
          val: data.length,
          tipo: 'blue',
          tag: '↑ 12%',
          spark: '#3b82f6',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
            </svg>
          ),
        },
        {
          label: 'Arrendados',
          val: data.filter((i) => i.estado === 'Arrendada').length,
          tipo: 'purple',
          tag: '↑ 8%',
          spark: '#8b5cf6',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          ),
        },
        {
          label: 'En venta',
          val: data.filter((i) => i.estado === 'Para la venta').length,
          tipo: 'emerald',
          tag: '↑ 15%',
          spark: '#10b981',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
        {
          label: 'Contratos por vencer',
          val: data.filter((i) => i.estado === 'Arrendada' && porVencer(i)).length,
          tipo: 'amber',
          tag: 'Al día',
          spark: '#f59e0b',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          ),
        },
      ]
    : [
        {
          label: 'Inmuebles',
          val: data.length,
          tipo: 'blue',
          tag: '↑ 12%',
          spark: '#3b82f6',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" />
            </svg>
          ),
        },
        {
          label: 'Disponibles',
          val: data.filter((i) => i.estado === 'Sin arrendar').length,
          tipo: 'emerald',
          tag: '↑ 15%',
          spark: '#10b981',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ),
        },
        {
          label: 'En arriendo',
          val: data.filter((i) => i.estado === 'Sin arrendar' || i.estado === 'Arrendada').length,
          tipo: 'purple',
          tag: '↑ 8%',
          spark: '#8b5cf6',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
          ),
        },
        {
          label: 'En venta',
          val: data.filter((i) => i.estado === 'Para la venta').length,
          tipo: 'amber',
          tag: '↑ 18%',
          spark: '#f59e0b',
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="m16 12-4-4-4 4M12 16V8" />
            </svg>
          ),
        },
      ];

  return (
    <div className="view">
      {/* Portada con estética Glassy Dashboard V2 */}
      <section className="portada noprint">
        {/* Cubos de cristal 3D decorativos flotantes como en el video */}
        <div className="glass-cube-floating cube-1" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </div>
        <div className="glass-cube-floating cube-2" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <div className="glass-cube-floating cube-3" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </div>

        <Skyline />
        
        <div className="portada-header-wrap">
          <h2>Habitat Capital, siempre al día</h2>
          <p>
            {esAdmin
              ? 'Consulta el estado de cada casa y apartamento, controla los vencimientos y genera contratos listos para firmar.'
              : 'Explora casas y apartamentos disponibles, revisa características detalladas y contacta con nuestros asesores.'}
          </p>
        </div>

        {/* Tarjetas KPI de Cristal translúcido estilo Glassy Dashboard V2 */}
        <div className="glassy-kpi-grid">
          {stats.map((s, i) => (
            <div key={s.label} className={`glassy-kpi-card kpi-${s.tipo}`} style={{ '--kpi-idx': i }}>
              <div className="kpi-top">
                <div className={`kpi-icon-wrap icon-${s.tipo}`}>
                  {s.icon}
                </div>
                <span className={`kpi-trend-pill trend-${s.tipo}`}>
                  {s.tag}
                </span>
              </div>
              <div className="kpi-body">
                <span className="kpi-label">{s.label}</span>
                <span className="kpi-value">{s.val}</span>
              </div>
              <div className="kpi-bottom">
                <Sparkline strokeColor={s.spark} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pestañas de cristal líquido */}
      <div className="tabs tabs-tres" role="tablist">
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

      <Filtros f={filtros} setF={setFiltros} total={data.length} mostrados={base.length} />

      <div className="toolbar">
        <h2>{tab === 'Todos' ? 'Todos los inmuebles' : tab === 'Casa' ? 'Casas' : 'Apartamentos'}</h2>
      </div>

      {items.length === 0 && <div className="card vacio">Ningún inmueble coincide con los filtros. Amplía los rangos o cambia de pestaña.</div>}

      <div className="lista">
        {items.map((i) => <Tarjeta key={i._id} i={i} esAdmin={esAdmin} abrir={() => abrir(i._id)} />)}
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
    </div>
  );
}
