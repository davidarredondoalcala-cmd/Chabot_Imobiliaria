import Caract from './Caract';
import Ilustra from './Ilustra';
import { fd, fmt, cls, sufijo, estaPorVencer } from '../lib/utils';
import { urlImagen } from '../lib/apiImagenes';

// Tarjeta de un inmueble (la usan la lista y la vista previa del formulario)
export default function Tarjeta({ i, abrir }) {
  const ir = abrir ? { role: 'button', tabIndex: 0, onClick: abrir, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } } } : { style: { cursor: 'default' } };
  return (
    <article className={`card item${abrir ? '' : ' estatica'}`} {...ir}>
      <div className={`thumb ${i.tipo}`}>
        {i.foto ? <img className="foto-thumb" src={urlImagen(i.foto)} alt={i.nombre} loading="lazy" /> : <Ilustra tipo={i.tipo} />}
      </div>
      <div className="info">
        <h3 className="nom">{i.nombre}</h3>
        {(i.dir || i.barrio) && <p className="dir">{[i.dir, i.barrio].filter(Boolean).join(' · ')}</p>}
        <Caract i={i} />
        {i.venc && <p className="meta">Contrato vence el {fd(i.venc)} · pago el día {i.diaPago}{estaPorVencer(i) && <span className="tag PorVencer">Por vencer</span>}</p>}
        <p className="precio">{fmt(i.valor)}<small>{sufijo(i)}</small><span className={`tag grande ${cls(i.estado)}`}>{i.estado}</span></p>
      </div>
    </article>
  );
}
