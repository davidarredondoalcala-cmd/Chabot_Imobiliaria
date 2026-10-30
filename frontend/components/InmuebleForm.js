'use client';
import { useState, useRef } from 'react';
import { crearInmueble } from '../lib/api';
import { subirImagen, urlImagen } from '../lib/apiImagenes';
import Tarjeta from './Tarjeta';
import Ilustra from './Ilustra';
import { IcoCamara, IcoCerrar, IcoCheck } from './Iconos';
import {
  soloNumeros,
  limpiarDireccion,
  limpiarTexto,
  esNombreValido,
} from '../lib/validadores';

export default function InmuebleForm({ tipo0, volver, creado, avisar }) {
  const [S, setS] = useState({ tipo: tipo0 || 'Casa', nombre: '', descripcion: '', estado: 'Sin arrendar', dir: '', barrio: '', lind: '', habitaciones: '', banos: '', area: '', valor: '', venc: '', dia: 5, foto: '' });
  const [fotoArchivo, setFotoArchivo] = useState(null);
  const [fotoPreviewLocal, setFotoPreviewLocal] = useState('');
  const [env, setEnv] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fileRef = useRef(null);

  const actualizarCampo = (k, valorRaw) => {
    let valor = valorRaw;
    if (k === 'nombre') valor = limpiarTexto(valorRaw, 60);
    else if (k === 'dir') valor = limpiarDireccion(valorRaw, 80);
    else if (k === 'barrio') valor = limpiarTexto(valorRaw, 50);
    else if (k === 'descripcion') valor = limpiarTexto(valorRaw, 300);
    else if (k === 'lind') valor = limpiarTexto(valorRaw, 500);
    else if (k === 'habitaciones' || k === 'banos') valor = soloNumeros(valorRaw, 2);
    else if (k === 'area') valor = soloNumeros(valorRaw, 5);
    else if (k === 'valor') valor = soloNumeros(valorRaw, 12);
    else if (k === 'dia') valor = soloNumeros(valorRaw, 2);
    setS((prev) => ({ ...prev, [k]: valor }));
  };

  const campo = (k, l, t, p, maxLen) => (
    <>
      <label>{l}</label>
      <input
        type={t || 'text'}
        placeholder={p}
        maxLength={maxLen}
        value={S[k] || ''}
        onChange={(e) => actualizarCampo(k, e.target.value)}
      />
    </>
  );

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
    if (!esNombreValido(S.nombre)) {
      return avisar?.('El nombre del inmueble debe tener al menos 3 letras válidas');
    }
    if (!S.dir.trim() || S.dir.trim().length < 5) {
      return avisar?.('Ingresa una dirección válida para el inmueble (mínimo 5 caracteres)');
    }
    const valNum = Number(S.valor);
    if (isNaN(valNum) || valNum <= 0) {
      return avisar?.('Ingresa un valor económico válido mayor a cero');
    }
    if (S.estado === 'Arrendada') {
      const diaNum = Number(S.dia);
      if (isNaN(diaNum) || diaNum < 1 || diaNum > 31) {
        return avisar?.('El día de pago debe ser un número entre 1 y 31');
      }
    }

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
          {campo('nombre', 'Nombre *', 'text', 'Ej: Casa Piedra Pintada', 60)}
          <label>Descripción del inmueble</label>
          <textarea
            rows="3"
            placeholder="Resumen del inmueble, iluminación, distribución y entorno..."
            maxLength={300}
            value={S.descripcion}
            onChange={(e) => actualizarCampo('descripcion', e.target.value)}
          />
          <label>Estado</label>
          <select value={S.estado} onChange={(e) => setS({ ...S, estado: e.target.value })}>
            <option>Sin arrendar</option>
            <option>Para la venta</option>
            <option>Arrendada</option>
          </select>
          {campo('dir', 'Dirección *', 'text', 'Ej: Cll 10 # 5 - 20', 80)}
          {campo('barrio', 'Barrio', 'text', 'Ej: Piedra Pintada', 50)}
          <label>Linderos</label>
          <textarea
            rows="3"
            value={S.lind}
            maxLength={500}
            onChange={(e) => actualizarCampo('lind', e.target.value)}
          />
          <div className="grid3">
            <div>{campo('habitaciones', 'Habitaciones', 'text', '0', 2)}</div>
            <div>{campo('banos', 'Baños', 'text', '0', 2)}</div>
            <div>{campo('area', 'Área (m²)', 'text', '0', 5)}</div>
          </div>
          {campo('valor', S.estado === 'Para la venta' ? 'Precio de venta *' : 'Valor mensual *', 'text', 'Ej: 1500000', 12)}
          {arrendada && (
            <>
              {campo('venc', 'Vencimiento del contrato', 'date')}
              {campo('dia', 'Día de pago de cada mes (1-31)', 'text', '5', 2)}
            </>
          )}
          
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
