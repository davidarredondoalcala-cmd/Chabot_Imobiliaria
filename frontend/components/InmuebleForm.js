'use client';
import { useState, useRef } from 'react';
import { crearInmueble } from '../lib/api';
import { subirImagen, urlImagen } from '../lib/apiImagenes';
import Tarjeta from './Tarjeta';
import Ilustra from './Ilustra';
import { IcoCamara, IcoCerrar, IcoCheck } from './Iconos';

export default function InmuebleForm({ tipo0, volver, creado, avisar }) {
  const [S, setS] = useState({ tipo: tipo0 || 'Casa', nombre: '', descripcion: '', estado: 'Sin arrendar', dir: '', barrio: '', lind: '', habitaciones: '', banos: '', area: '', valor: '', venc: '', dia: 5, foto: '' });
  const [fotoArchivo, setFotoArchivo] = useState(null);
  const [fotoPreviewLocal, setFotoPreviewLocal] = useState('');
  const [env, setEnv] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fileRef = useRef(null);
  const set = (k) => (e) => setS({ ...S, [k]: e.target.value });
  // Función (no componente) para que el input no pierda el foco al escribir
  const campo = (k, l, t, p, min) => (<><label>{l}</label><input type={t || 'text'} min={min} placeholder={p} value={S[k]} onChange={set(k)} /></>);

  // Previsualización local inmediata antes de subir
  const elegirFoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (fotoPreviewLocal) URL.revokeObjectURL(fotoPreviewLocal);
    const localUrl = URL.createObjectURL(file);
    setFotoArchivo(file);
    setFotoPreviewLocal(localUrl);
    avisar?.('Foto cargada en previsualización');
  };

  const subirFotoAhora = async () => {
    if (!fotoArchivo) return;
    setSubiendoFoto(true);
    avisar?.('Subiendo imagen al servidor…');
    try {
      const { url } = await subirImagen(fotoArchivo, S.tipo === 'Casa' ? 'casa' : 'apartamento');
      setS((p) => ({ ...p, foto: url }));
      setFotoArchivo(null);
      if (fotoPreviewLocal) URL.revokeObjectURL(fotoPreviewLocal);
      setFotoPreviewLocal('');
      avisar?.('Foto confirmada y subida con éxito');
    } catch (er) {
      avisar?.(er.message || 'No se pudo subir la foto');
    } finally {
      setSubiendoFoto(false);
    }
  };

  const quitarFoto = (e) => {
    e?.stopPropagation();
    if (fotoPreviewLocal) URL.revokeObjectURL(fotoPreviewLocal);
    setFotoArchivo(null);
    setFotoPreviewLocal('');
    setS((p) => ({ ...p, foto: '' }));
  };

  const guardar = async () => {
    if (!S.nombre.trim() || !S.dir.trim() || S.valor === '') return avisar?.('Completa nombre, dirección y valor');
    setEnv(true);
    try {
      let urlFotoFinal = S.foto;
      if (fotoArchivo) {
        avisar?.('Subiendo foto del inmueble…');
        const { url } = await subirImagen(fotoArchivo, S.tipo === 'Casa' ? 'casa' : 'apartamento');
        urlFotoFinal = url;
      }
      const nuevo = await crearInmueble({ ...S, foto: urlFotoFinal });
      creado(nuevo);
    } catch {
      avisar?.('No se pudo guardar el inmueble');
      setEnv(false);
    }
  };

  const fotoEfectiva = fotoPreviewLocal || (S.foto ? urlImagen(S.foto) : '');
  const p = {
    ...S,
    foto: fotoEfectiva,
    nombre: S.nombre || 'Nombre del inmueble',
    valor: Number(S.valor) || 0,
    diaPago: S.dia,
    habitaciones: S.habitaciones === '' ? undefined : Number(S.habitaciones),
    banos: S.banos === '' ? undefined : Number(S.banos),
    area: S.area === '' ? undefined : Number(S.area),
  };
  const arrendada = S.estado === 'Arrendada';

  return (
    <div className="view">
      <button className="l" onClick={volver}>← Volver a la lista</button>
      <div className="grid">
        <div className="card">
          <h2 className="form-t">Agregar inmueble</h2>
          <div className="modo">
            <button className={S.tipo === 'Casa' ? 'on' : ''} onClick={() => setS({ ...S, tipo: 'Casa' })}>Casa</button>
            <button className={S.tipo === 'Apartamento' ? 'on' : ''} onClick={() => setS({ ...S, tipo: 'Apartamento' })}>Apartamento</button>
          </div>
          {campo('nombre', 'Nombre *', 'text', 'Ej: Casa Piedra Pintada')}
          <label>Descripción del inmueble</label>
          <textarea rows="3" placeholder="Resumen del inmueble, iluminación, distribución y entorno..." value={S.descripcion} onChange={set('descripcion')} />
          <label>Estado</label>
          <select value={S.estado} onChange={set('estado')}><option>Sin arrendar</option><option>Para la venta</option><option>Arrendada</option></select>
          {campo('dir', 'Dirección *', 'text', 'Ej: Cll 10 # 5 - 20')}
          {campo('barrio', 'Barrio')}
          <label>Linderos</label><textarea rows="3" value={S.lind} onChange={set('lind')} />
          <div className="grid3">
            <div>{campo('habitaciones', 'Habitaciones', 'number', '0', 0)}</div>
            <div>{campo('banos', 'Baños', 'number', '0', 0)}</div>
            <div>{campo('area', 'Área (m²)', 'number', '0', 0)}</div>
          </div>
          {campo('valor', S.estado === 'Para la venta' ? 'Precio de venta *' : 'Valor mensual *', 'number', '', 0)}
          {arrendada && <>{campo('venc', 'Vencimiento del contrato', 'date')}{campo('dia', 'Día de pago de cada mes', 'number', '', 1)}</>}
          
          <label>Foto del inmueble con previsualización</label>
          <div
            className={`foto-picker ${S.tipo}`}
            role="button"
            tabIndex={0}
            aria-label={fotoEfectiva ? 'Cambiar foto del inmueble' : 'Agregar foto al inmueble'}
            onClick={() => { if (!subiendoFoto) fileRef.current?.click(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!subiendoFoto) fileRef.current?.click(); } }}
          >
            {fotoEfectiva ? (
              <img src={fotoEfectiva} alt="Previsualización de la foto" />
            ) : (
              <Ilustra tipo={S.tipo} />
            )}

            {!fotoEfectiva && <span className="foto-mas" aria-hidden="true">{subiendoFoto ? '…' : '+'}</span>}
            {fotoEfectiva && <span className="foto-cap subiendo">{subiendoFoto ? 'Subiendo…' : 'Clic para cambiar'}</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={elegirFoto} />

          {fotoPreviewLocal && (
            <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="tag pulse"><IcoCamara /> Previsualización activa</span>
              <button type="button" className="s" onClick={subirFotoAhora} disabled={subiendoFoto}>
                <IcoCheck /> {subiendoFoto ? 'Subiendo…' : 'Confirmar y subir ahora'}
              </button>
              <button type="button" className="l" onClick={quitarFoto}>
                <IcoCerrar /> Quitar
              </button>
            </div>
          )}

          <div className="row" style={{ marginTop: 22 }}>
            <button className="g" disabled={env || subiendoFoto} onClick={guardar}>
              {env ? 'Guardando…' : 'Guardar inmueble'}
            </button>
          </div>
        </div>
        <div>
          <div className="visor"><span className="tag pulse" style={{ margin: 0 }}>En vivo</span> Así se verá en la lista</div>
          <Tarjeta i={{ ...p, venc: arrendada ? p.venc : '' }} />
        </div>
      </div>
    </div>
  );
}
