'use client';
import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Caract from './Caract';
import Ilustra from './Ilustra';
import Hoja from './Hoja';
import { fd, fmt, cls, porVencer, estaPorVencer } from '../lib/utils';
import { subirImagen, urlImagen } from '../lib/apiImagenes';
import { setFotoInmueble } from '../lib/api';
import { INMOBILIARIA_INFO } from '../lib/firmaInmobiliaria';
import { descargarPdfBorrador, descargarPdfFinal, obtenerAcuerdo, obtenerAcuerdoPorInmueble } from '../lib/apiFirmas';
import { IcoOjo, IcoDescargar, IcoImprimir, IcoCerrar, IcoDocumento, IcoSparkle, IcoWhatsApp, IcoCamara, IcoCheck } from './Iconos';

// Tarjeta del contrato con acciones de ver, descargar y renovar (exclusivo para administradores)
const Pdf = ({ c, renovar, porVencer: vence, onVer, onDescargar, descargando, esAdmin }) => {
  if (!esAdmin) return null;
  return (
    <div className="pdf">
      <div className="pdfico">PDF</div>
      <div className="pdf-info">
        <b>{c.tipo}</b>
        <div className="mut">Firmado el {fd(c.fecha)} · Firmantes: {c.firm?.join(', ')}</div>
      </div>
      <div className="pdf-acciones">
        {vence && <span className="tag pulse">Por vencer</span>}
        <button type="button" className="s" onClick={() => onVer(c)} title="Ver contrato">
          <IcoOjo /> Ver contrato
        </button>
        <button
          type="button"
          className="s"
          onClick={() => onDescargar(c)}
          disabled={descargando}
          title="Descargar contrato en PDF"
        >
          <IcoDescargar /> {descargando ? 'Generando…' : 'Descargar PDF'}
        </button>
        {renovar && (
          <button className="o" onClick={renovar}>Renovar contrato</button>
        )}
      </div>
    </div>
  );
};

export default function Detalle({ inm: i, volver, crear, actualizar, avisar, esAdmin }) {
  const vig = i.contratos.find((c) => c.vig);
  const ven = i.contratos.filter((c) => !c.vig);
  const fileRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const [contratoVer, setContratoVer] = useState(null);
  const [descargandoId, setDescargandoId] = useState(null);
  const [fotoPrevia, setFotoPrevia] = useState(null); // { file, previewUrl }
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  // Cierra el visor de contrato con Escape y bloquea el scroll de fondo
  useEffect(() => {
    if (!contratoVer) return;
    const onTecla = (e) => { if (e.key === 'Escape') setContratoVer(null); };
    window.addEventListener('keydown', onTecla);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onTecla);
      document.body.style.overflow = '';
    };
  }, [contratoVer]);

  const prepararContratoS = (c) => {
    const modo = (c.tipo || '').toLowerCase().includes('compra') || (c.tipo || '').toLowerCase().includes('venta')
      ? 'venta'
      : 'arriendo';

    if (c.datos && typeof c.datos === 'object') {
      const S = { ...c.datos };
      if (modo === 'arriendo') S.arr = INMOBILIARIA_INFO.nombre;
      else S.vend = INMOBILIARIA_INFO.nombre;
      return { modo, S, firmas: c.firmas || null, acuerdoId: c.acuerdoId };
    }

    const firmantes = Array.isArray(c.firm) ? c.firm : [];
    const fecha = c.fecha
      ? new Date(c.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';

    // Si firmantes[0] es la Inmobiliaria, la contraparte (arrendatario/comprador) es firmantes[1]
    let arr = INMOBILIARIA_INFO.nombre;
    let vend = INMOBILIARIA_INFO.nombre;
    let contraparte = modo === 'venta' ? 'Comprador' : 'Arrendatario';
    let cods = [];

    if (firmantes.length > 0) {
      const p = (firmantes[0] || '').toLowerCase();
      const primerFirmanteEsInm = p.includes('habitat capital') || p.includes('inmobiliaria');
      if (primerFirmanteEsInm) {
        contraparte = firmantes[1] || (modo === 'venta' ? 'Comprador' : 'Arrendatario');
        cods = firmantes.slice(2);
      } else {
        contraparte = firmantes[0];
        cods = firmantes.slice(1);
      }
    }

    const S = {
      arr,
      ate: contraparte,
      vend,
      comp: contraparte,
      ciu: 'Ibagué',
      dir: i.dir || '',
      bar: i.barrio || '',
      lin: i.lind || 'Al norte con predio vecino, al sur con vía pública, al oriente y occidente con propiedad privada.',
      val: i.valor || '',
      dur: 12,
      dia: i.diaPago || 5,
      pago: 'De contado',
      fecha,
      cods,
    };
    return { modo, S, firmas: c.firmas || null, acuerdoId: c.acuerdoId };
  };

  const verContrato = async (c) => {
    if (!esAdmin) return;
    const { modo, S, firmas, acuerdoId } = prepararContratoS(c);
    setContratoVer({ c, modo, S, firmas: firmas || null, acuerdoId });

    // Carga en segundo plano el acuerdo para traer las firmas gráficas reales del arrendatario / codeudores
    try {
      let acuerdo = null;
      if (c.acuerdoId) {
        acuerdo = await obtenerAcuerdo(c.acuerdoId);
      } else if (i._id) {
        acuerdo = await obtenerAcuerdoPorInmueble(i._id);
      }

      if (acuerdo && acuerdo.firmantes) {
        const firmasObj = { codeudores: [] };
        let ateNombre = '';
        let ateCedula = '';
        let ateEmail = '';
        const codsNombres = [];

        for (const f of acuerdo.firmantes) {
          if (f.rol === 'arrendatario' || f.rol === 'comprador') {
            if (f.imagen) firmasObj[f.rol] = f.imagen;
            ateNombre = f.nombre || f.datos?.nombre || '';
            ateCedula = f.cedula || f.datos?.cedula || '';
            ateEmail = f.email || f.datos?.email || '';
          } else if (f.rol === 'arrendador' || f.rol === 'vendedor') {
            if (f.imagen) firmasObj[f.rol] = f.imagen;
          } else if (f.rol === 'codeudor') {
            if (f.imagen) firmasObj.codeudores.push(f.imagen);
            codsNombres.push(f.nombre || f.datos?.nombre || '');
          }
        }

        setContratoVer((prev) => {
          if (!prev) return null;
          const datosAcuerdo = acuerdo.datos || {};
          const nuevoS = {
            ...prev.S,
            ...datosAcuerdo,
            arr: INMOBILIARIA_INFO.nombre,
            vend: INMOBILIARIA_INFO.nombre,
            ate: ateNombre || datosAcuerdo.ate || prev.S.ate,
            ateCedula: ateCedula || datosAcuerdo.ateCedula || prev.S.ateCedula,
            ateEmail: ateEmail || datosAcuerdo.ateEmail || prev.S.ateEmail,
            comp: ateNombre || datosAcuerdo.comp || prev.S.comp,
            cods: codsNombres.length > 0 ? codsNombres : (datosAcuerdo.cods || prev.S.cods),
          };
          return {
            ...prev,
            S: nuevoS,
            acuerdoId: acuerdo.id || prev.acuerdoId,
            firmas: {
              arrendador: firmasObj.arrendador || prev.firmas?.arrendador,
              arrendatario: firmasObj.arrendatario || prev.firmas?.arrendatario,
              vendedor: firmasObj.vendedor || prev.firmas?.vendedor,
              comprador: firmasObj.comprador || prev.firmas?.comprador,
              codeudores: firmasObj.codeudores?.length > 0 ? firmasObj.codeudores : (prev.firmas?.codeudores || []),
            },
          };
        });
      }
    } catch (err) {
      console.warn('No se pudieron obtener firmas remotas del acuerdo:', err);
    }
  };

  const descargarContrato = async (c) => {
    if (!esAdmin) {
      avisar?.('Acceso restringido: solo los administradores pueden descargar contratos.');
      return;
    }
    const { modo, S, acuerdoId } = prepararContratoS(c);
    const targetAcuerdoId = contratoVer?.acuerdoId || acuerdoId || c.acuerdoId;
    const descId = c.fecha || c.tipo;
    setDescargandoId(descId);
    avisar?.('Descargando contrato en PDF…');
    try {
      if (targetAcuerdoId) {
        await descargarPdfFinal(targetAcuerdoId);
      } else {
        await descargarPdfBorrador(modo, S);
      }
      avisar?.('Contrato descargado en PDF');
    } catch (err) {
      try {
        await descargarPdfBorrador(modo, S);
        avisar?.('Contrato descargado en PDF');
      } catch (e2) {
        avisar?.(err.message || 'No se pudo descargar el contrato');
      }
    } finally {
      setDescargandoId(null);
    }
  };

  // Previsualización antes de subir: primero muestra la foto en pantalla para confirmación
  const elegirFoto = (e) => {
    if (!esAdmin) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setFotoPrevia({ file, previewUrl });
  };

  const confirmarSubidaFoto = async () => {
    if (!fotoPrevia?.file) return;
    setSubiendo(true);
    avisar?.('Subiendo imagen al servidor…');
    try {
      const { url } = await subirImagen(fotoPrevia.file, i.tipo === 'Casa' ? 'casa' : 'apartamento');
      const act = await setFotoInmueble(i._id, url);
      actualizar?.(act);
      avisar?.('Foto del inmueble actualizada con éxito');
      if (fotoPrevia.previewUrl) URL.revokeObjectURL(fotoPrevia.previewUrl);
      setFotoPrevia(null);
    } catch (er) {
      avisar?.(er.message || 'No se pudo subir la foto');
    } finally {
      setSubiendo(false);
    }
  };

  const cancelarFotoPrevia = () => {
    if (fotoPrevia?.previewUrl) URL.revokeObjectURL(fotoPrevia.previewUrl);
    setFotoPrevia(null);
  };

  // La foto es clicable para administradores: abre el selector y sube/cambia la imagen.
  const abrirSelector = () => { if (esAdmin && !subiendo) fileRef.current?.click(); };
  const alTeclado = (e) => { if (esAdmin && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirSelector(); } };

  return (
    <div className="view">
      <button className="l" onClick={volver}>← Volver a {i.tipo === 'Casa' ? 'casas' : 'apartamentos'}</button>
      <div className="card ficha">
        <div
          className={`thumb grande ${i.tipo} ${esAdmin ? 'editable' : ''}`}
          role={esAdmin ? 'button' : undefined}
          tabIndex={esAdmin ? 0 : undefined}
          aria-label={esAdmin ? (i.foto ? 'Cambiar foto del inmueble' : 'Agregar foto al inmueble') : undefined}
          onClick={esAdmin ? abrirSelector : undefined}
          onKeyDown={esAdmin ? alTeclado : undefined}
        >
          {i.foto && !imgErr ? <img className="foto-thumb" src={urlImagen(i.foto)} alt={i.nombre} onError={() => setImgErr(true)} /> : <Ilustra tipo={i.tipo} />}
          {esAdmin && !i.foto && <span className="foto-mas" aria-hidden="true">{subiendo ? '…' : '+'}</span>}
          {esAdmin && i.foto && subiendo && <span className="foto-cap subiendo">Subiendo…</span>}
        </div>
        {esAdmin && (
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={elegirFoto} />
        )}
        <div className="ficha-body">
          <h2 className="titulo">{i.nombre}</h2>
          <p className="dir">{i.dir} · {i.barrio}</p>
          <Caract i={i} />
          {(() => {
            const desc = (i.descripcion && i.descripcion.trim()) ||
              `${i.tipo === 'Casa' ? 'Acogedora casa' : 'Excelente apartamento'} en el sector de ${i.barrio || 'la ciudad'}, cuenta con ${i.habitaciones ? i.habitaciones + ' habitaciones' : 'amplios espacios'}, ${i.banos ? i.banos + ' baños' : 'buena distribución'} y ${i.area ? i.area + ' m² construidos' : 'área cómoda'}, con excelente iluminación natural, ventilación y fácil acceso a vías principales.`;
            return (
              <div className="ficha-desc">
                <h3>Descripción del inmueble</h3>
                <p>{desc}</p>
              </div>
            );
          })()}
          <div className="datos">
            <div className="dato precio-dato">
              <span>{i.estado === 'Para la venta' || i.estado === 'Vendida' ? 'Precio de venta' : 'Valor mensual'}</span>
              <b className="precio-val">{fmt(i.valor)}</b>
              <span className={`tag grande ${cls(i.estado)}`}>{i.estado}</span>
              {esAdmin && estaPorVencer(i) && <span className="tag grande PorVencer">Por vencer</span>}
            </div>
            {esAdmin && i.venc && <div className="dato"><span>Vencimiento del contrato</span><b>{fd(i.venc)}</b></div>}
            {esAdmin && i.venc && <div className="dato"><span>Día de pago</span><b>El {i.diaPago} de cada mes</b></div>}
          </div>
          {esAdmin && i.estado !== 'Arrendada' && (
            <div className="row">
              <button className="g" onClick={() => crear(i.estado === 'Para la venta' ? 'venta' : 'arriendo')}>Crear contrato</button>
              <button onClick={() => crear('venta')}>Descargar formato de compraventa</button>
            </div>
          )}
          {esAdmin ? (
            <>
              {vig && (
                <>
                  <h3>Contrato vigente</h3>
                  <Pdf
                    c={vig}
                    esAdmin={esAdmin}
                    vence={!!porVencer(i)}
                    renovar={() => crear('arriendo')}
                    onVer={verContrato}
                    onDescargar={descargarContrato}
                    descargando={descargandoId === (vig.fecha || vig.tipo)}
                  />
                </>
              )}
              <h3>Historial de contratos</h3>
              {ven.length ? (
                ven.map((c, k) => (
                  <Pdf
                    key={k}
                    c={c}
                    esAdmin={esAdmin}
                    onVer={verContrato}
                    onDescargar={descargarContrato}
                    descargando={descargandoId === (c.fecha || c.tipo)}
                  />
                ))
              ) : (
                <p className="mut">Sin contratos vencidos.</p>
              )}
            </>
          ) : (
            <div className="ficha-cliente-box">
              <div className="ficha-cliente-header">
                <span className="ficha-cliente-icono"><IcoSparkle /></span>
                <div>
                  <h4>¿Te interesa este inmueble?</h4>
                  <p>Consulta especificaciones, disponibilidad y agenda tu cita con un asesor de Habitat Capital.</p>
                </div>
              </div>
              <div className="ficha-cliente-acciones">
                <a
                  href={`https://wa.me/573100000000?text=${encodeURIComponent(`Hola Habitat Capital, me interesa el inmueble "${i.nombre}" (${i.tipo} en ${i.barrio || 'Ibagué'}). ¿Está disponible para visita?`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="g btn-cliente-wa"
                >
                  <IcoWhatsApp /> Contactar por WhatsApp
                </a>
                <span className="ficha-cliente-disponibilidad">
                  Disponibilidad: <strong>{i.estado}</strong> · {i.tipo} en {i.barrio || 'Ibagué'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Previsualización antes de subir la foto */}
      {fotoPrevia && montado && typeof document !== 'undefined' && createPortal(
        <div className="modal-contrato-backdrop" onClick={cancelarFotoPrevia}>
          <div className="card modal-previa-foto" onClick={(e) => e.stopPropagation()}>
            <div className="modal-contrato-header">
              <h3><IcoCamara /> Previsualización antes de subir foto</h3>
              <button type="button" className="l" onClick={cancelarFotoPrevia} title="Cancelar">
                <IcoCerrar />
              </button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p className="mut" style={{ margin: '0 0 14px' }}>Revisa la calidad y encuadre antes de confirmar y subirla al catálogo:</p>
              <div className="previa-foto-wrap">
                <img src={fotoPrevia.previewUrl} alt="Previsualización" className="previa-foto-img" />
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
                <button type="button" onClick={cancelarFotoPrevia} disabled={subiendo}>
                  <IcoCerrar /> Cancelar
                </button>
                <button type="button" className="g" onClick={confirmarSubidaFoto} disabled={subiendo}>
                  <IcoCheck /> {subiendo ? 'Subiendo imagen…' : 'Confirmar y subir foto'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Visor de Contrato: perspectiva natural tipo documento en escritorio, se sale al hacer clic en cualquier lugar fuera del papel */}
      {esAdmin && contratoVer && montado && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-contrato-visor-overlay"
          onClick={() => setContratoVer(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Visor de contrato de ${contratoVer.c.tipo}`}
        >
          {/* Barra superior flotante de acciones */}
          <div className="modal-contrato-toolbar" onClick={(e) => e.stopPropagation()}>
            <div className="modal-contrato-toolbar-info">
              <span className="modal-contrato-toolbar-ico"><IcoDocumento /></span>
              <span className="modal-contrato-toolbar-txt">
                Contrato de {contratoVer.c.tipo} — <strong>{i.nombre}</strong>
              </span>
            </div>
            <div className="modal-contrato-toolbar-btns">
              <button
                type="button"
                className="s"
                onClick={() => descargarContrato(contratoVer.c)}
                title="Descargar documento en PDF"
              >
                <IcoDescargar /> Descargar PDF
              </button>
              <button
                type="button"
                className="s"
                onClick={() => window.print()}
                title="Imprimir contrato"
              >
                <IcoImprimir /> Imprimir
              </button>
              <button
                type="button"
                className="l btn-cerrar-perspectiva"
                onClick={() => setContratoVer(null)}
                title="Salir de la perspectiva (Esc)"
              >
                <IcoCerrar /> Cerrar
              </button>
            </div>
          </div>

          {/* Escenario de lectura: solo el papel detiene el click; cualquier espacio exterior sale de la perspectiva */}
          <div className="modal-contrato-escenario">
            <div
              className="modal-contrato-papel"
              onClick={(e) => e.stopPropagation()}
            >
              <Hoja modo={contratoVer.modo} S={contratoVer.S} firmas={contratoVer.firmas} />
            </div>

            <div className="modal-contrato-hint-exterior noprint">
              <span>Haz clic en cualquier área fuera del contrato o presiona Esc para salir de la perspectiva</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
