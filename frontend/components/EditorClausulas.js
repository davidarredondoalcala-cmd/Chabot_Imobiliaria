'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  IcoCerrar,
  IcoCheck,
  IcoMas,
  IcoBasura,
  IcoEditar,
  IcoNegrita,
  IcoCursiva,
  IcoSubrayado,
  IcoLista,
  IcoListaNum,
  IcoDeshacer,
  IcoRehacer,
} from './Iconos';
import {
  MAX_CLAUSULAS,
  normalizarClausulas,
  normalizarHtmlInline,
  htmlDeTexto,
  sanitizarHtml,
} from '../lib/clausulas';

const FORMATOS = [
  { cmd: 'bold', Icono: IcoNegrita, label: 'Negrita' },
  { cmd: 'italic', Icono: IcoCursiva, label: 'Cursiva' },
  { cmd: 'underline', Icono: IcoSubrayado, label: 'Subrayado' },
  { cmd: 'insertUnorderedList', Icono: IcoLista, label: 'Lista con viñetas' },
  { cmd: 'insertOrderedList', Icono: IcoListaNum, label: 'Lista numerada' },
  { cmd: 'undo', Icono: IcoDeshacer, label: 'Deshacer' },
  { cmd: 'redo', Icono: IcoRehacer, label: 'Rehacer' },
];

export default function EditorClausulas({
  abierto,
  clausulas,
  onGuardar,
  onCerrar,
  soloLectura = false,
  guardando = false,
  titulo = 'Cláusulas del contrato',
}) {
  const [items, setItems] = useState([]);
  const [activo, setActivo] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [montado, setMontado] = useState(false);
  const editores = useRef(new Map());
  const titulos = useRef(new Map());
  const idRef = useRef(0);

  const crearItem = (c) => ({
    id: `cl-${++idRef.current}`,
    pre: c?.pre || '',
    html: normalizarHtmlInline(c?.html || htmlDeTexto(c?.resto || '')),
  });

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    idRef.current = 0;
    const base = Array.isArray(clausulas) && clausulas.length
      ? clausulas
      : [{ pre: 'PRIMERA – Objeto.', resto: '' }];
    const iniciales = base.slice(0, MAX_CLAUSULAS).map(crearItem);
    editores.current.clear();
    titulos.current.clear();
    setItems(iniciales);
    setActivo(iniciales[0]?.id || null);
    setDirty(false);
    setError('');
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  const cerrar = () => {
    if (guardando) return;
    if (!soloLectura && dirty && !window.confirm('¿Descartar los cambios sin guardar?')) return;
    onCerrar?.();
  };

  useEffect(() => {
    if (!abierto) return;
    const alPresionar = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      cerrar();
    };
    window.addEventListener('keydown', alPresionar, true);
    return () => window.removeEventListener('keydown', alPresionar, true);
  });

  const capturar = () =>
    items.map((it) => {
      const cuerpo = editores.current.get(it.id);
      const titulo = titulos.current.get(it.id);
      const pre = titulo
        ? (titulo.innerText || titulo.textContent || '').replace(/\s+/g, ' ').trim()
        : it.pre;
      return { ...it, pre, html: cuerpo ? cuerpo.innerHTML : it.html };
    });

  const agregar = () => {
    if (items.length >= MAX_CLAUSULAS) {
      setError(`Máximo ${MAX_CLAUSULAS} cláusulas por contrato`);
      return;
    }
    const base = capturar();
    const nueva = {
      id: `cl-${++idRef.current}`,
      pre: `CLÁUSULA ${base.length + 1} – Estipulación adicional.`,
      html: '',
    };
    setItems([...base, nueva]);
    setActivo(nueva.id);
    setDirty(true);
    setError('');
    setTimeout(() => document.getElementById(`cl-pre-${nueva.id}`)?.focus(), 60);
  };

  const eliminar = (idx) => {
    if (items.length <= 1) {
      setError('El contrato debe conservar al menos una cláusula');
      return;
    }
    const base = capturar();
    base.splice(idx, 1);
    setItems(base);
    setDirty(true);
    setError('');
  };

  const mover = (idx, direccion) => {
    const destino = idx + direccion;
    if (destino < 0 || destino >= items.length) return;
    const base = capturar();
    const [movida] = base.splice(idx, 1);
    base.splice(destino, 0, movida);
    setItems(base);
    setDirty(true);
    setError('');
  };

  const aplicarFormato = (cmd) => {
    const el = editores.current.get(activo) || editores.current.values().next().value;
    if (!el) return;
    el.focus();
    try {
      document.execCommand('styleWithCSS', false, false);
      document.execCommand(cmd, false, null);
    } catch {
      /* el navegador puede bloquear comandos no soportados */
    }
    setDirty(true);
  };

  const guardar = () => {
    const capturadas = capturar().map((it) => ({ pre: it.pre, html: it.html }));
    const limpias = normalizarClausulas(capturadas);
    if (!limpias.length) {
      setError('Agrega al menos una cláusula con contenido antes de guardar');
      return;
    }
    setError('');
    onGuardar?.(limpias);
  };

  if (!abierto || !montado) return null;

  return createPortal(
    <div className="editor-clausulas-overlay" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="editor-clausulas-shell" onClick={(e) => e.stopPropagation()}>
        <div className="editor-clausulas-header">
          <div className="editor-clausulas-title">
            <span className="editor-clausulas-ico"><IcoEditar /></span>
            <div className="editor-clausulas-title-txt">
              <strong>{titulo}</strong>
              <span>{soloLectura ? 'Solo lectura' : `Documento completo · ${items.length} cláusula${items.length === 1 ? '' : 's'} · los cambios se aplican al guardar`}</span>
            </div>
          </div>
          <div className="editor-clausulas-header-btns">
            {!soloLectura && (
              <button type="button" className="s" onClick={cerrar} disabled={guardando}>
                Cancelar
              </button>
            )}
            {!soloLectura && (
              <button type="button" className="g" onClick={guardar} disabled={guardando}>
                <IcoCheck /> {guardando ? 'Guardando…' : 'Guardar cambios'}
              </button>
            )}
            <button type="button" className="l editor-clausulas-cerrar" onClick={cerrar} title="Cerrar editor">
              <IcoCerrar />
            </button>
          </div>
        </div>

        {!soloLectura && (
          <div className="editor-clausulas-toolbar" role="toolbar" aria-label="Formato de texto">
            <div className="editor-clausulas-grupo">
              {FORMATOS.map(({ cmd, Icono, label }) => (
                <button
                  key={cmd}
                  type="button"
                  className="editor-clausulas-tool"
                  title={label}
                  aria-label={label}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => aplicarFormato(cmd)}
                >
                  <Icono />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="s editor-clausulas-add-top"
              onClick={agregar}
              disabled={items.length >= MAX_CLAUSULAS}
            >
              <IcoMas /> Agregar cláusula
            </button>
          </div>
        )}

        <div className="editor-clausulas-scroll">
          <div className="editor-clausulas-paper">
            {items.map((it, idx) => (
              <section
                className={`editor-clausula${activo === it.id ? ' activa' : ''}`}
                key={it.id}
              >
                <div className="editor-clausula-barra">
                  <span className="editor-clausula-num">{String(idx + 1).padStart(2, '0')}</span>
                  {!soloLectura && (
                    <div className="editor-clausula-barra-btns">
                      <button
                        type="button"
                        className="l"
                        onClick={() => mover(idx, -1)}
                        disabled={idx === 0}
                        title="Subir cláusula"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="l"
                        onClick={() => mover(idx, 1)}
                        disabled={idx === items.length - 1}
                        title="Bajar cláusula"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="l editor-clausulas-eliminar"
                        onClick={() => eliminar(idx)}
                        disabled={items.length <= 1}
                        title="Eliminar cláusula"
                      >
                        <IcoBasura />
                      </button>
                    </div>
                  )}
                </div>

                <div className="editor-clausula-contenido">
                  {soloLectura ? (
                    <>
                      {it.pre && <div className="editor-clausula-pre-texto">{it.pre}</div>}
                      <div
                        className="editor-clausula-cuerpo"
                        dangerouslySetInnerHTML={{ __html: sanitizarHtml(it.html) }}
                      />
                    </>
                  ) : (
                    <>
                      <div
                        id={`cl-pre-${it.id}`}
                        ref={(el) => {
                          if (!el) {
                            titulos.current.delete(it.id);
                            return;
                          }
                          titulos.current.set(it.id, el);
                          if (el.dataset.clTituloInicializado !== it.id) {
                            el.textContent = it.pre;
                            el.dataset.clTituloInicializado = it.id;
                          }
                        }}
                        className="editor-clausula-pre"
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck
                        role="textbox"
                        aria-label={`Título de la cláusula ${idx + 1}`}
                        data-placeholder="Título de la cláusula (ej: PRIMERA – Objeto.)"
                        onFocus={() => setActivo(it.id)}
                        onInput={() => {
                          setActivo(it.id);
                          setDirty(true);
                        }}
                      />
                      <div
                        ref={(el) => {
                          if (!el) {
                            editores.current.delete(it.id);
                            return;
                          }
                          editores.current.set(it.id, el);
                          if (el.dataset.clInicializada !== it.id) {
                            el.innerHTML = it.html;
                            el.dataset.clInicializada = it.id;
                          }
                        }}
                        className="editor-clausula-cuerpo"
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck
                        role="textbox"
                        aria-label={`Contenido de la cláusula ${idx + 1}`}
                        data-placeholder="Escribe aquí el contenido de la cláusula…"
                        onFocus={() => setActivo(it.id)}
                        onInput={() => {
                          setActivo(it.id);
                          setDirty(true);
                        }}
                      />
                    </>
                  )}
                </div>
              </section>
            ))}

            {!soloLectura && (
              <button
                type="button"
                className="editor-clausulas-add"
                onClick={agregar}
                disabled={items.length >= MAX_CLAUSULAS}
              >
                <IcoMas /> Agregar otra cláusula
              </button>
            )}
          </div>
        </div>

        <div className="editor-clausulas-footer">
          <span>
            {error || (soloLectura
              ? 'Este contrato ya no se puede editar porque tiene firmas registradas.'
              : 'Negrita, cursiva, subrayado y listas se reflejan en la vista previa y en el PDF.')}
          </span>
          {!soloLectura && <strong>{items.length}/{MAX_CLAUSULAS}</strong>}
        </div>
      </div>
    </div>,
    document.body
  );
}
