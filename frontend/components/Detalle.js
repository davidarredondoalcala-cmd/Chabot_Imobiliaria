'use client';
import { useRef, useState } from 'react';
import Caract from './Caract';
import Ilustra from './Ilustra';
import { fd, fmt, cls, porVencer, estaPorVencer } from '../lib/utils';
import { subirImagen, urlImagen } from '../lib/apiImagenes';
import { setFotoInmueble } from '../lib/api';

// Tarjeta del contrato: incluye el botón de renovación y el aviso «Por vencer»
// DENTRO de la tarjeta, para que la acción quede dentro de la sección del contrato.
const Pdf = ({ c, renovar, porVencer: vence }) => (
  <div className="pdf">
    <div className="pdfico">PDF</div>
    <div className="pdf-info">
      <b>{c.tipo}</b>
      <div className="mut">Firmado el {fd(c.fecha)} · Firmantes: {c.firm.join(', ')}</div>
    </div>
    {(renovar || vence) && (
      <div className="pdf-acciones">
        {vence && <span className="tag pulse">Por vencer</span>}
        {renovar && <button className="o" onClick={renovar}>Renovar contrato</button>}
      </div>
    )}
  </div>
);

export default function Detalle({ inm: i, volver, crear, actualizar, avisar }) {
  const vig = i.contratos.find((c) => c.vig);
  const ven = i.contratos.filter((c) => !c.vig);
  const fileRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);

  const elegirFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSubiendo(true);
    try {
      const { url } = await subirImagen(file, i.tipo === 'Casa' ? 'casa' : 'apartamento');
      const act = await setFotoInmueble(i._id, url);
      actualizar?.(act);
      avisar?.('Foto actualizada');
    } catch (er) {
      avisar?.(er.message || 'No se pudo subir la foto');
    } finally {
      setSubiendo(false);
    }
  };

  // La foto es clicable: abre el selector y sube/cambia la imagen.
  const abrirSelector = () => { if (!subiendo) fileRef.current?.click(); };
  const alTeclado = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirSelector(); } };

  return (
    <div className="view">
      <button className="l" onClick={volver}>← Volver a {i.tipo === 'Casa' ? 'casas' : 'apartamentos'}</button>
      <div className="card ficha">
        <div
          className={`thumb grande ${i.tipo} editable`}
          role="button"
          tabIndex={0}
          aria-label={i.foto ? 'Cambiar foto del inmueble' : 'Agregar foto al inmueble'}
          onClick={abrirSelector}
          onKeyDown={alTeclado}
        >
          {i.foto ? <img className="foto-thumb" src={urlImagen(i.foto)} alt={i.nombre} /> : <Ilustra tipo={i.tipo} />}
          {!i.foto && <span className="foto-mas" aria-hidden="true">{subiendo ? '…' : '+'}</span>}
          {i.foto && subiendo && <span className="foto-cap subiendo">Subiendo…</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={elegirFoto} />
        <div className="ficha-body">
          <h2 className="titulo">{i.nombre}</h2>
          <p className="dir">{i.dir} · {i.barrio}</p>
          <Caract i={i} />
          <div className="datos">
            <div className="dato precio-dato">
              <span>{i.estado === 'Para la venta' || i.estado === 'Vendida' ? 'Precio de venta' : 'Valor mensual'}</span>
              <b className="precio-val">{fmt(i.valor)}</b>
              <span className={`tag grande ${cls(i.estado)}`}>{i.estado}</span>
              {estaPorVencer(i) && <span className="tag grande PorVencer">Por vencer</span>}
            </div>
            {i.venc && <div className="dato"><span>Vencimiento del contrato</span><b>{fd(i.venc)}</b></div>}
            {i.venc && <div className="dato"><span>Día de pago</span><b>El {i.diaPago} de cada mes</b></div>}
          </div>
          {i.estado !== 'Arrendada' && (
            <div className="row">
              <button className="g" onClick={() => crear(i.estado === 'Para la venta' ? 'venta' : 'arriendo')}>Crear contrato</button>
              <button onClick={() => crear('venta')}>Descargar formato de compraventa</button>
            </div>
          )}
          {vig && <>
            <h3>Contrato vigente</h3>
            <Pdf c={vig} vence={!!porVencer(i)} renovar={() => crear('arriendo')} />
          </>}
          <h3>Contratos vencidos</h3>
          {ven.length ? ven.map((c, k) => <Pdf key={k} c={c} />) : <p className="mut">Sin contratos vencidos.</p>}
        </div>
      </div>
    </div>
  );
}
