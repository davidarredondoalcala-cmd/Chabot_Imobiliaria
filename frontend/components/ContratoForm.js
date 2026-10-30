'use client';
import { useEffect, useState } from 'react';
import Hoja from './Hoja';
import { crearAcuerdo, descargarPdfBorrador, obtenerAcuerdo } from '../lib/apiFirmas';
import { IcoImprimir, IcoDescargar, IcoMail, IcoCheck, IcoMas, IcoBasura, IcoEditar, IcoDocumento } from './Iconos';

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
  const [links, setLinks] = useState([]);
  const [acuerdoId, setAcuerdoId] = useState(null);
  const [copiado, setCopiado] = useState(null);
  const [creando, setCreando] = useState(false);
  const [descargando, setDescargando] = useState(false);

  // Cláusulas dinámicas editables
  const [clausulas, setClausulas] = useState(
    (modo0 || 'arriendo') === 'arriendo' ? CLAUSULAS_ARRIENDO_DEF : CLAUSULAS_VENTA_DEF
  );

  const [S, setS] = useState({
    arr: 'Habitat Capital Inmobiliaria',
    arrCedula: '901234567-8',
    arrEmail: 'admin@habitatcapital.com',
    ate: '',
    ateCedula: '',
    ateEmail: '',
    vend: 'Habitat Capital Inmobiliaria',
    vendCedula: '901234567-8',
    vendEmail: 'admin@habitatcapital.com',
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

  // Monitoreo del acuerdo hasta completarse
  useEffect(() => {
    if (!acuerdoId) return;
    const t = setInterval(async () => {
      try {
        const a = await obtenerAcuerdo(acuerdoId);
        if (a.estado === 'firmado') {
          clearInterval(t);
          avisar?.('Firmas completas: el contrato ha sido firmado y el inmueble fue actualizado');
          terminado?.();
        }
      } catch {
        /* reintenta */
      }
    }, 4000);
    return () => clearInterval(t);
  }, [acuerdoId, terminado, avisar]);

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
              { rol: 'arrendador', nombre: S.arr, cedula: S.arrCedula, email: S.arrEmail },
              { rol: 'arrendatario', nombre: S.ate, cedula: S.ateCedula, email: S.ateEmail },
              ...codsValidos.map((c, k) => ({
                rol: 'codeudor',
                nombre: c,
                cedula: S.codsCedula?.[k] || '',
                email: S.codsEmail?.[k] || '',
              })),
            ]
          : [
              { rol: 'vendedor', nombre: S.vend, cedula: S.vendCedula, email: S.vendEmail },
              { rol: 'comprador', nombre: S.comp, cedula: S.compCedula, email: S.compEmail },
            ];

      const r = await crearAcuerdo({
        inmueble: inm._id,
        tipo: modo,
        datos: { ...S, clausulas },
        firmantes,
      });

      setAcuerdoId(r.id);
      setLinks(r.links.map((l) => ({ ...l, full: `${window.location.origin}${l.url}` })));
      avisar?.('Contrato generado y correos enviados automáticamente a las partes y codeudores.');
    } catch (err) {
      avisar?.(err.message || 'No se pudo crear el acuerdo de firma');
    } finally {
      setCreando(false);
    }
  };

  const copiar = (l) => {
    navigator.clipboard?.writeText(l.full);
    setCopiado(l.token);
    setTimeout(() => setCopiado(null), 1800);
    avisar?.('Enlace copiado al portapapeles');
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
              {campo('arr', 'Nombre del Arrendador')}
              <div className="grid3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>{campo('arrCedula', 'Cédula / NIT')}</div>
                <div>{campo('arrEmail', 'Correo electrónico', 'email')}</div>
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
              {campo('vend', 'Nombre del Vendedor')}
              <div className="grid3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>{campo('vendCedula', 'Cédula / NIT Vendedor')}</div>
                <div>{campo('vendEmail', 'Correo Vendedor', 'email')}</div>
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
          <Hoja modo={modo} S={{ ...S, clausulas }} />
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

          {links.length > 0 && (
            <div className="card view noprint" style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="tag Arrendada"><IcoCheck /> Correos enviados automáticamente</span>
                <b>Enlaces directos de firma</b>
              </div>
              <p className="mut" style={{ margin: '0 0 12px', fontSize: '0.85rem' }}>
                Se enviaron los enlaces a los correos de las partes y codeudores registrados. También puedes copiar los enlaces si deseas compartirlos por WhatsApp:
              </p>
              <div className="enlaces">
                {links.map((l, k) => (
                  <div key={l.token} className="enlace" style={{ '--n': k }}>
                    <div className="enlace-rol">
                      <span className="enlace-n">{k + 1}</span>
                      {l.rol}
                    </div>
                    {l.nombre && <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{l.nombre}</div>}
                    {l.email && <div className="mut" style={{ fontSize: '0.78rem' }}><IcoMail /> {l.email}</div>}
                    <div className="link">{l.full}</div>
                    <button className={copiado === l.token ? 'g' : ''} onClick={() => copiar(l)}>
                      {copiado === l.token ? <><IcoCheck /> ¡Copiado!</> : 'Copiar enlace'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
