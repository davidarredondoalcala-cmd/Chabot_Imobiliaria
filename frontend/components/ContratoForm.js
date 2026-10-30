'use client';
import { useEffect, useState } from 'react';
import Hoja from './Hoja';
import { crearAcuerdo, descargarPdfBorrador, obtenerAcuerdo } from '../lib/apiFirmas';
import { IcoImprimir, IcoDescargar, IcoMail, IcoCheck, IcoMas, IcoBasura, IcoEditar, IcoDocumento } from './Iconos';
import { INMOBILIARIA_INFO, FIRMA_INMOBILIARIA_DATA_URL } from '../lib/firmaInmobiliaria';

const CLAUSULAS_ARRIENDO_DEF = [
  { pre: 'PRIMERA – Objeto.', resto: 'EL ARRENDADOR entrega a título de arrendamiento el inmueble ubicado en la dirección indicada.' },
  { pre: 'SEGUNDA – Canon.', resto: 'El canon mensual acordado, pagadero dentro de los primeros días de cada mes.' },
  { pre: 'TERCERA – Duración.', resto: 'El contrato tendrá la duración pactada en meses, contados desde la fecha de firma, prorrogable por acuerdo escrito.' },
  { pre: 'CUARTA – Destinación.', resto: 'El inmueble se destinará exclusivamente a vivienda urbana. No podrá subarrendarse ni cederse sin autorización escrita.' },
  { pre: 'QUINTA – Servicios y reparaciones.', resto: 'Los servicios públicos y las reparaciones locativas estarán a cargo del ARRENDATARIO.' },
  { pre: 'SEXTA – Restitución.', resto: 'Al terminar, EL ARRENDATARIO restituirá el inmueble en el estado en que lo recibió, salvo el desgaste natural.' },
  { pre: 'SÉPTIMA – Terminación.', resto: 'El incumplimiento de cualquier obligación faculta a la parte cumplida para terminar el contrato conforme a la ley.' },
];

const CLAUSULAS_VENTA_DEF = [
  { pre: 'PRIMERA – Objeto.', resto: 'EL VENDEDOR transfiere a título de venta el inmueble ubicado en la dirección descrita.' },
  { pre: 'SEGUNDA – Precio.', resto: 'El precio total acordado por la compraventa del inmueble.' },
  { pre: 'TERCERA – Forma de pago.', resto: 'EL COMPRADOR pagará el precio en la forma de pago estipulada en este documento.' },
  { pre: 'CUARTA – Tradición y libertad.', resto: 'EL VENDEDOR garantiza que el inmueble es de su propiedad y se encuentra libre de gravámenes, embargos y limitaciones de dominio.' },
  { pre: 'QUINTA – Entrega.', resto: 'El inmueble se entregará a paz y salvo por impuestos y servicios públicos a la fecha de la escritura pública.' },
  { pre: 'SEXTA – Gastos.', resto: 'Los gastos notariales y de registro serán asumidos por las partes en la proporción que la ley establece.' },
];

export default function ContratoForm({ inm, modo0, volver, terminado, avisar }) {
  const [modo, setModo] = useState(modo0 || 'arriendo');
  const [enviados, setEnviados] = useState([]);
  const [acuerdoId, setAcuerdoId] = useState(null);
  const [creando, setCreando] = useState(false);
  const [descargando, setDescargando] = useState(false);

  // Firmas en vivo para la vista previa interactiva del contrato
  const [firmasPreview, setFirmasPreview] = useState({
    arrendador: (modo0 || 'arriendo') === 'arriendo' ? FIRMA_INMOBILIARIA_DATA_URL : null,
    vendedor: (modo0 || 'arriendo') === 'venta' ? FIRMA_INMOBILIARIA_DATA_URL : null,
    codeudores: [],
  });

  // Cláusulas dinámicas editables
  const [clausulas, setClausulas] = useState(
    (modo0 || 'arriendo') === 'arriendo' ? CLAUSULAS_ARRIENDO_DEF : CLAUSULAS_VENTA_DEF
  );

  const [S, setS] = useState({
    arr: INMOBILIARIA_INFO.nombre,
    arrCedula: INMOBILIARIA_INFO.cedula,
    arrEmail: INMOBILIARIA_INFO.email,
    ate: '',
    ateCedula: '',
    ateEmail: '',
    vend: INMOBILIARIA_INFO.nombre,
    vendCedula: INMOBILIARIA_INFO.cedula,
    vendEmail: INMOBILIARIA_INFO.email,
    comp: '',
    compCedula: '',
    compEmail: '',
    ciu: 'Ibagué',
    dir: inm.dir || '',
    bar: inm.barrio || '',
    lin: inm.lind || 'Al norte con predio vecino, al sur con vía pública, al oriente y occidente con propiedad privada.',
    val: inm.valor || '',
    dur: 12,
    dia: 5,
    pago: 'De contado contra firma de escritura pública',
    cods: [''],
    codsCedula: [''],
    codsEmail: [''],
    clausulas: (modo0 || 'arriendo') === 'arriendo' ? CLAUSULAS_ARRIENDO_DEF : CLAUSULAS_VENTA_DEF,
  });

  // Cambiar modo reinicia las cláusulas con la plantilla correspondiente
  const cambiarModo = (m) => {
    setModo(m);
    const def = m === 'arriendo' ? CLAUSULAS_ARRIENDO_DEF : CLAUSULAS_VENTA_DEF;
    setClausulas(def);
    setS((prev) => ({ ...prev, clausulas: def }));
    setFirmasPreview((prev) => ({
      ...prev,
      arrendador: m === 'arriendo' ? FIRMA_INMOBILIARIA_DATA_URL : null,
      vendedor: m === 'venta' ? FIRMA_INMOBILIARIA_DATA_URL : null,
    }));
  };

  const set = (k) => (e) => setS({ ...S, [k]: e.target.value });

  const campo = (k, l, t, p) => (
    <>
      <label>{l}</label>
      <input type={t || 'text'} placeholder={p} value={S[k] || ''} onChange={set(k)} />
    </>
  );

  // Manejo de cláusulas dinámicas
  const modificarClausula = (idx, campoKey, valor) => {
    const act = clausulas.map((c, i) => (i === idx ? { ...c, [campoKey]: valor } : c));
    setClausulas(act);
    setS((prev) => ({ ...prev, clausulas: act }));
  };

  const agregarClausula = () => {
    const num = clausulas.length + 1;
    const nueva = {
      pre: `CLÁUSULA ${num} – Estipulación adicional.`,
      resto: 'Las partes acuerdan expresamente que…',
    };
    const act = [...clausulas, nueva];
    setClausulas(act);
    setS((prev) => ({ ...prev, clausulas: act }));
    avisar?.('Cláusula adicional agregada');
  };

  const eliminarClausula = (idx) => {
    const act = clausulas.filter((_, i) => i !== idx);
    setClausulas(act);
    setS((prev) => ({ ...prev, clausulas: act }));
    avisar?.('Cláusula eliminada');
  };

  // Manejo de codeudores múltiples con nombre, cédula y correo
  const agregarCodeudor = () => {
    setS((prev) => ({
      ...prev,
      cods: [...prev.cods, ''],
      codsCedula: [...(prev.codsCedula || []), ''],
      codsEmail: [...(prev.codsEmail || []), ''],
    }));
  };

  const actualizarCodeudor = (idx, campoArray, valor) => {
    setS((prev) => {
      const arr = Array.isArray(prev[campoArray]) ? [...prev[campoArray]] : [];
      arr[idx] = valor;
      return { ...prev, [campoArray]: arr };
    });
  };

  const eliminarCodeudor = (idx) => {
    setS((prev) => ({
      ...prev,
      cods: prev.cods.filter((_, i) => i !== idx),
      codsCedula: (prev.codsCedula || []).filter((_, i) => i !== idx),
      codsEmail: (prev.codsEmail || []).filter((_, i) => i !== idx),
    }));
  };

  // Monitoreo del acuerdo hasta completarse (actualiza firmas en vivo sin refrescar)
  useEffect(() => {
    if (!acuerdoId) return;
    const t = setInterval(async () => {
      try {
        const a = await obtenerAcuerdo(acuerdoId);
        if (Array.isArray(a.firmantes)) {
          const nuevasFirmas = {
            arrendador: modo === 'arriendo' ? FIRMA_INMOBILIARIA_DATA_URL : null,
            vendedor: modo === 'venta' ? FIRMA_INMOBILIARIA_DATA_URL : null,
            codeudores: [],
          };
          const codeudores = a.firmantes.filter((f) => f.rol === 'codeudor');
          a.firmantes.forEach((f) => {
            if (!f.imagen) return;
            if (f.rol === 'codeudor') {
              const idx = codeudores.indexOf(f);
              if (idx >= 0) nuevasFirmas.codeudores[idx] = f.imagen;
              else nuevasFirmas.codeudores.push(f.imagen);
            } else {
              nuevasFirmas[f.rol] = f.imagen;
            }
          });
          setFirmasPreview(nuevasFirmas);
        }

        if (a.estado === 'firmado') {
          clearInterval(t);
          avisar?.('Firmas completas: el contrato ha sido firmado y el inmueble fue actualizado');
          terminado?.();
        }
      } catch {
        /* reintenta */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [acuerdoId, modo, terminado, avisar]);

  // Crea el acuerdo de firma en el backend y envía automáticamente los correos
  const enviar = async () => {
    if (modo === 'arriendo' && !S.ate.trim()) {
      return avisar?.('Escribe el nombre del arrendatario');
    }
    if (modo === 'venta' && !S.comp.trim()) {
      return avisar?.('Escribe el nombre del comprador');
    }

    setCreando(true);
    try {
      const codsValidos = (S.cods || []).filter(Boolean);
      const firmantes =
        modo === 'arriendo'
          ? [
              {
                rol: 'arrendador',
                nombre: INMOBILIARIA_INFO.nombre,
                cedula: INMOBILIARIA_INFO.cedula,
                email: INMOBILIARIA_INFO.email,
              },
              { rol: 'arrendatario', nombre: S.ate.trim(), cedula: S.ateCedula.trim(), email: S.ateEmail.trim() },
              ...codsValidos.map((c, k) => ({
                rol: 'codeudor',
                nombre: c.trim(),
                cedula: (S.codsCedula?.[k] || '').trim(),
                email: (S.codsEmail?.[k] || '').trim(),
              })),
            ]
          : [
              {
                rol: 'vendedor',
                nombre: INMOBILIARIA_INFO.nombre,
                cedula: INMOBILIARIA_INFO.cedula,
                email: INMOBILIARIA_INFO.email,
              },
              { rol: 'comprador', nombre: S.comp.trim(), cedula: S.compCedula.trim(), email: S.compEmail.trim() },
            ];

      const r = await crearAcuerdo({
        inmueble: inm._id,
        tipo: modo,
        datos: {
          ...S,
          arr: INMOBILIARIA_INFO.nombre,
          arrCedula: INMOBILIARIA_INFO.cedula,
          arrEmail: INMOBILIARIA_INFO.email,
          vend: INMOBILIARIA_INFO.nombre,
          vendCedula: INMOBILIARIA_INFO.cedula,
          vendEmail: INMOBILIARIA_INFO.email,
          clausulas,
        },
        firmantes,
        frontendUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
      });

      setAcuerdoId(r.id);
      setEnviados(firmantes);
      avisar?.('¡Contrato generado y enviado con éxito a los correos registrados!');
    } catch (err) {
      avisar?.(err.message || 'No se pudo crear el acuerdo de firma');
    } finally {
      setCreando(false);
    }
  };

  const descargar = async () => {
    setDescargando(true);
    avisar?.('Generando PDF del borrador…');
    try {
      await descargarPdfBorrador(modo, { ...S, clausulas });
      avisar?.('PDF descargado con éxito');
    } catch (e) {
      avisar?.(e.message || 'No se pudo descargar el PDF');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="view">
      <div className="noprint"><button className="l" onClick={volver}>← Volver al inmueble</button></div>
      <div className="grid">
        <div className="card noprint">
          <div className="modo">
            <button className={modo === 'arriendo' ? 'on' : ''} onClick={() => cambiarModo('arriendo')}>Arriendo</button>
            <button className={modo === 'venta' ? 'on' : ''} onClick={() => cambiarModo('venta')}>Compraventa</button>
          </div>

          <h3 style={{ margin: '14px 0 6px', fontSize: '1.05rem' }}>Partes del contrato</h3>

          {modo === 'arriendo' ? (
            <>
              {/* Arrendador: Inmobiliaria propietaria fija por defecto */}
              <div style={{ background: 'var(--bg)', padding: '14px 16px', borderRadius: 12, border: '1.5px solid var(--bd)', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--ac)' }}>
                    Arrendador (Propietario del inmueble)
                  </span>
                  <span className="tag Arrendada" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                    <IcoCheck /> Firma corporativa autorizada
                  </span>
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--fg)' }}>
                  {INMOBILIARIA_INFO.nombre}
                </div>
                <div className="mut" style={{ fontSize: '0.82rem', marginTop: 3 }}>
                  NIT: <b>{INMOBILIARIA_INFO.cedula}</b> · Correo: <b>{INMOBILIARIA_INFO.email}</b>
                </div>
                <p className="mut" style={{ margin: '8px 0 0', fontSize: '0.76rem', lineHeight: 1.4, borderTop: '1px dashed var(--bd)', paddingTop: 6 }}>
                  La inmobiliaria es la propietaria legal del inmueble. Su firma digital institucional y datos están incorporados por defecto.
                </p>
              </div>

              {campo('ate', 'Nombre del Arrendatario *', 'text', 'Ej: Andrés Gómez')}
              <div className="grid3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>{campo('ateCedula', 'Cédula Arrendatario', 'text', 'Ej: 1110543210')}</div>
                <div>{campo('ateEmail', 'Correo Arrendatario', 'email', 'cliente@ejemplo.com')}</div>
              </div>

              <div style={{ marginTop: 14, borderTop: '1px solid var(--bd)', paddingTop: 10 }}>
                <label style={{ margin: '6px 0', fontWeight: 700 }}>Codeudores solidarios</label>
                {(S.cods || []).map((c, k) => (
                  <div key={k} style={{ background: 'var(--bg)', padding: 12, borderRadius: 10, marginBottom: 8, border: '1px solid var(--bd)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Codeudor #{k + 1}</span>
                      {S.cods.length > 1 && (
                        <button type="button" className="l" onClick={() => eliminarCodeudor(k)} style={{ color: 'var(--red)' }} title="Eliminar este codeudor">
                          <IcoBasura /> Quitar
                        </button>
                      )}
                    </div>
                    <input
                      style={{ marginTop: 6 }}
                      placeholder="Nombre completo del codeudor"
                      value={c}
                      onChange={(e) => actualizarCodeudor(k, 'cods', e.target.value)}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                      <input
                        placeholder="Cédula codeudor"
                        value={S.codsCedula?.[k] || ''}
                        onChange={(e) => actualizarCodeudor(k, 'codsCedula', e.target.value)}
                      />
                      <input
                        type="email"
                        placeholder="Correo para envío de firma"
                        value={S.codsEmail?.[k] || ''}
                        onChange={(e) => actualizarCodeudor(k, 'codsEmail', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
                <button type="button" style={{ marginTop: 6 }} onClick={agregarCodeudor}>
                  <IcoMas /> Agregar otro codeudor
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Vendedor: Inmobiliaria propietaria fija por defecto */}
              <div style={{ background: 'var(--bg)', padding: '14px 16px', borderRadius: 12, border: '1.5px solid var(--bd)', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--ac)' }}>
                    Vendedor (Propietario del inmueble)
                  </span>
                  <span className="tag Arrendada" style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                    <IcoCheck /> Firma corporativa autorizada
                  </span>
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--fg)' }}>
                  {INMOBILIARIA_INFO.nombre}
                </div>
                <div className="mut" style={{ fontSize: '0.82rem', marginTop: 3 }}>
                  NIT: <b>{INMOBILIARIA_INFO.cedula}</b> · Correo: <b>{INMOBILIARIA_INFO.email}</b>
                </div>
                <p className="mut" style={{ margin: '8px 0 0', fontSize: '0.76rem', lineHeight: 1.4, borderTop: '1px dashed var(--bd)', paddingTop: 6 }}>
                  La inmobiliaria es la propietaria legal del inmueble. Su firma digital institucional y datos están incorporados por defecto.
                </p>
              </div>

              {campo('comp', 'Nombre del Comprador *', 'text', 'Nombre completo')}
              <div className="grid3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>{campo('compCedula', 'Cédula Comprador', 'text', 'Cédula')}</div>
                <div>{campo('compEmail', 'Correo Comprador', 'email', 'comprador@ejemplo.com')}</div>
              </div>
            </>
          )}

          <h3 style={{ margin: '22px 0 6px', fontSize: '1.05rem' }}>Datos del inmueble y términos</h3>
          {campo('ciu', 'Ciudad')}
          {campo('dir', 'Dirección del inmueble')}
          {campo('bar', 'Barrio')}
          <label>Linderos</label>
          <textarea rows="3" value={S.lin} onChange={set('lin')} />
          {campo('val', modo === 'arriendo' ? 'Valor mensual ($)' : 'Precio de venta ($)', 'number')}
          {modo === 'arriendo' ? (
            <div className="grid3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div>{campo('dur', 'Duración (meses)', 'number')}</div>
              <div>{campo('dia', 'Día de pago de cada mes', 'number')}</div>
            </div>
          ) : (
            campo('pago', 'Forma de pago')
          )}

          {/* Editor de Cláusulas (Añadir y Modificar cláusulas) */}
          <div style={{ marginTop: 24, borderTop: '1px solid var(--bd)', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <IcoEditar /> Cláusulas del contrato ({clausulas.length})
              </h3>
              <button type="button" className="s" onClick={agregarClausula} title="Añadir una cláusula adicional">
                <IcoMas /> Añadir cláusula
              </button>
            </div>
            <p className="mut" style={{ margin: '0 0 12px', fontSize: '0.8rem' }}>
              Puedes editar el título y redacción de cada cláusula, agregar cláusulas especiales o eliminar las que no apliquen:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
              {clausulas.map((cl, idx) => (
                <div key={idx} style={{ background: 'var(--bg)', padding: 10, borderRadius: 10, border: '1px solid var(--bd)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <input
                      style={{ fontWeight: 700, fontSize: '0.85rem', padding: '6px 8px' }}
                      value={cl.pre}
                      onChange={(e) => modificarClausula(idx, 'pre', e.target.value)}
                      placeholder="Título de la cláusula (ej: PRIMERA – Objeto.)"
                    />
                    <button
                      type="button"
                      className="l"
                      style={{ color: 'var(--red)', padding: '2px 6px' }}
                      onClick={() => eliminarClausula(idx)}
                      title="Eliminar esta cláusula"
                    >
                      <IcoBasura />
                    </button>
                  </div>
                  <textarea
                    rows="2"
                    style={{ fontSize: '0.84rem', padding: '6px 8px', marginTop: 4 }}
                    value={cl.resto}
                    onChange={(e) => modificarClausula(idx, 'resto', e.target.value)}
                    placeholder="Contenido de la cláusula..."
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="visor noprint"><span className="tag pulse" style={{ margin: 0 }}>En vivo</span> Vista previa interactiva del contrato</div>
          <Hoja modo={modo} S={{ ...S, clausulas }} firmas={firmasPreview} />
          <div className="row noprint" style={{ justifyContent: 'center', marginTop: 18 }}>
            <button className="g" onClick={enviar} disabled={creando}>
              <IcoMail /> {creando ? 'Generando y enviando…' : 'Enviar contrato por correo para firma'}
            </button>
            <button type="button" onClick={() => window.print()}>
              <IcoImprimir /> Imprimir
            </button>
            <button type="button" onClick={descargar} disabled={descargando}>
              <IcoDescargar /> {descargando ? 'Generando PDF…' : 'Descargar PDF borrador'}
            </button>
          </div>

          {enviados.length > 0 && (
            <div className="card view noprint" style={{ marginTop: 24, padding: '24px 28px', border: '1.5px solid var(--bd)', borderRadius: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span className="tag Arrendada" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                  <IcoCheck /> Contrato despachado por correo
                </span>
                <b style={{ fontSize: '1.05rem' }}>Enviado exitosamente a cada firmante</b>
              </div>
              <p className="mut" style={{ margin: '0 0 16px', fontSize: '0.88rem', lineHeight: 1.5 }}>
                El contrato en formato PDF y el enlace seguro de firma fueron enviados a través de Brevo directamente a los correos registrados en el formulario:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {enviados.map((f, k) => {
                  const esInm = f.rol === 'arrendador' || f.rol === 'vendedor';
                  return (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--bd)' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--ac)' }}>
                            {f.rol}:
                          </span>
                          <strong style={{ fontSize: '0.95rem' }}>{f.nombre || 'Sin nombre'}</strong>
                        </div>
                        <div className="mut" style={{ fontSize: '0.82rem', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <IcoMail /> {f.email || 'Sin correo especificado'} {f.cedula ? ` · C.C./NIT ${f.cedula}` : ''}
                        </div>
                      </div>
                      <span className={`tag ${esInm ? 'Vendida' : 'Arrendada'}`} style={{ fontSize: '0.78rem' }}>
                        <IcoCheck /> {esInm ? 'Firma corporativa por defecto' : 'Enlace enviado al correo'}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 20, textAlign: 'right' }}>
                <button type="button" className="g" onClick={() => terminado?.()}>
                  Aceptar y volver al inmueble
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
