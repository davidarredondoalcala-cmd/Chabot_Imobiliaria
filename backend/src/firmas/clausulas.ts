// Plantillas del contrato en texto — ESPEJO EXACTO de frontend/components/Hoja.js.
// Si se cambia una cláusula allá, cambiarla aquí (checklist del README_FIRMAS.md).

const fmt = (n: any) => '$ ' + Number(n || 0).toLocaleString('es-CO');
const campo = (v: any, def?: string) => (v && String(v).trim() ? String(v) : def || '__________');

// ===== Cláusulas editables: saneamiento y runs con formato =====
export type Run = { t?: string; br?: boolean; b?: boolean; i?: boolean; u?: boolean };

export const MAX_CLAUSULAS = 40;
export const MAX_PRE = 200;
export const MAX_TEXTO = 2000;
export const MAX_HTML = 8000;

const ETIQUETAS = new Set(['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'p', 'div', 'span']);

const ENTIDADES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

function escaparHtml(texto: any) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodificar(texto: any) {
  return String(texto || '')
    .replace(/&#(\d+);/g, (_: string, n: string) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (e: string) => ENTIDADES[e] || e);
}

// Deja solo etiquetas de formato permitidas y elimina todos los atributos.
export function sanearHtml(html: any) {
  if (!html) return '';
  let limpio = String(html).slice(0, MAX_HTML * 2);
  limpio = limpio.replace(/<!--[\s\S]*?-->/g, '');
  // Cualquier construcción tipo etiqueta se descarta si no está en la lista blanca.
  // Esto también cubre etiquetas mal formadas como <svg/onload=...>.
  limpio = limpio.replace(/<[^>]*>/g, (match: string) => {
    const m = match.match(/^<\s*\/?\s*([a-zA-Z0-9]+)/);
    if (!m) return '';
    const tag = m[1].toLowerCase();
    if (!ETIQUETAS.has(tag)) return '';
    const cierre = /^<\s*\//.test(match);
    if (cierre) return `</${tag}>`;
    return tag === 'br' ? '<br>' : `<${tag}>`;
  });
  return limpio.slice(0, MAX_HTML);
}

// Convierte los bloques del editor (p/div) en saltos de línea para que el
// título de la cláusula y su contenido fluyan en la misma línea.
export function normalizarHtmlInline(html: any) {
  let limpio = sanearHtml(html);
  limpio = limpio
    .replace(/<\/(p|div)>/gi, '<br>')
    .replace(/<(p|div)(\s[^>]*)?>/gi, '')
    .replace(/^(<br>)+/i, '')
    .replace(/(<br>)+$/i, '')
    .replace(/(<br>){3,}/gi, '<br><br>');
  return limpio;
}

export function htmlDeTexto(texto: any) {
  return escaparHtml(texto).replace(/\r?\n/g, '<br>').slice(0, MAX_HTML);
}

export function textoDeHtml(html: any) {
  if (!html) return '';
  let texto = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/?(p|div|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  texto = decodificar(texto);
  return texto
    .split('\n')
    .map((linea) => linea.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXTO);
}

function empujar(out: Run[], run: Run) {
  if (run.br) {
    if (out.length && !out[out.length - 1].br) out.push({ br: true });
    return;
  }
  const t = run.t || '';
  if (!t) return;
  const ultimo = out[out.length - 1];
  if (ultimo && !ultimo.br && !!ultimo.b === !!run.b && !!ultimo.i === !!run.i && !!ultimo.u === !!run.u) {
    ultimo.t = (ultimo.t || '') + t;
    return;
  }
  out.push({ t, ...(run.b ? { b: true } : {}), ...(run.i ? { i: true } : {}), ...(run.u ? { u: true } : {}) });
}

type Marco = { tag: string; b: boolean; i: boolean; u: boolean; lista?: { tag: string; idx: number } };

export function htmlARuns(html: any): Run[] {
  const limpio = normalizarHtmlInline(html);
  if (!limpio) return [];

  const out: Run[] = [];
  const pila: Marco[] = [];
  let i = 0;

  const estilo = () => pila.reduce(
    (acc, f) => ({ b: acc.b || f.b, i: acc.i || f.i, u: acc.u || f.u }),
    { b: false, i: false, u: false },
  );

  while (i < limpio.length && out.length < 800) {
    if (limpio[i] === '<') {
      const fin = limpio.indexOf('>', i);
      if (fin < 0) break;
      const raw = limpio.slice(i + 1, fin).trim();
      i = fin + 1;
      const cierre = raw.startsWith('/');
      const tag = raw.replace(/^\//, '').toLowerCase();

      if (tag === 'br') { out.push({ br: true }); continue; }

      if (tag === 'ul' || tag === 'ol') {
        if (cierre) {
          for (let j = pila.length - 1; j >= 0; j--) {
            if (pila[j].tag === tag) { pila.splice(j, 1); break; }
          }
          empujar(out, { br: true });
        } else {
          if (out.length && !out[out.length - 1].br) out.push({ br: true });
          pila.push({ tag, b: false, i: false, u: false, lista: { tag, idx: 0 } });
        }
        continue;
      }

      if (tag === 'li') {
        if (cierre) { empujar(out, { br: true }); continue; }
        const lista = [...pila].reverse().find((f) => f.lista);
        if (lista?.lista) lista.lista.idx += 1;
        const pre = lista?.lista?.tag === 'ol' ? `${lista.lista.idx}. ` : '• ';
        const est = estilo();
        empujar(out, { t: pre, ...(est.b ? { b: true } : {}), ...(est.i ? { i: true } : {}), ...(est.u ? { u: true } : {}) });
        continue;
      }

      if (tag === 'b' || tag === 'strong' || tag === 'i' || tag === 'em' || tag === 'u' || tag === 'span') {
        if (cierre) {
          for (let j = pila.length - 1; j >= 0; j--) {
            if (pila[j].tag === tag) { pila.splice(j, 1); break; }
          }
        } else {
          pila.push({
            tag,
            b: tag === 'b' || tag === 'strong',
            i: tag === 'i' || tag === 'em',
            u: tag === 'u',
          });
        }
      }
      continue;
    }

    let fin = limpio.indexOf('<', i);
    if (fin < 0) fin = limpio.length;
    const texto = decodificar(limpio.slice(i, fin)).replace(/\s+/g, ' ');
    i = fin;
    if (texto) {
      const est = estilo();
      empujar(out, { t: texto, ...(est.b ? { b: true } : {}), ...(est.i ? { i: true } : {}), ...(est.u ? { u: true } : {}) });
    }
  }

  while (out.length && out[0].br) out.shift();
  while (out.length && out[out.length - 1].br) out.pop();

  let total = 0;
  const recortado: Run[] = [];
  for (const run of out) {
    if (run.br) { recortado.push(run); continue; }
    const t = String(run.t || '').slice(0, Math.max(0, 12000 - total));
    if (!t) continue;
    total += t.length;
    recortado.push({ ...run, t });
    if (total >= 12000) break;
  }
  return recortado;
}

export function normalizarClausula(c: any) {
  const pre = String(c?.pre || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PRE);

  let html = normalizarHtmlInline(c?.html || '');
  let resto = textoDeHtml(html);

  if (!resto) {
    resto = String(c?.resto || '')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, MAX_TEXTO);
    html = resto ? htmlDeTexto(resto) : '';
  }

  return { pre, resto, html, runs: htmlARuns(html) };
}

export function normalizarClausulas(lista: any) {
  return (Array.isArray(lista) ? lista : [])
    .slice(0, MAX_CLAUSULAS)
    .map(normalizarClausula)
    .filter((c) => c.pre || c.resto);
}

// Devuelve { titulo, parrafos: [{ pre, resto }], firmas: [{ nombre, rol }] }
// pre = cláusula en negrita ("PRIMERA – Objeto."), resto = cuerpo del párrafo.
export function construir(tipo: string, d: any) {
  const ciudad = campo(d.ciu, '__________');
  const dir = campo(d.dir, '__________');
  const barrio = campo(d.bar, '__________');
  const linderos = campo(d.lin, '____________________');
  const inmueble = `${dir}, barrio ${barrio}, de la ciudad de ${ciudad}, cuyos linderos son: ${linderos}`;

  if (tipo === 'arriendo') {
    const cods = (d.cods || []).filter(Boolean);
    const codsCed = Array.isArray(d.codsCedula) ? d.codsCedula : [];
    const codsEm = Array.isArray(d.codsEmail) ? d.codsEmail : [];

    const arr = campo(d.arr, 'EL ARRENDADOR');
    const arrCed = d.arrCedula ? `, identificado(a) con C.C. No. ${d.arrCedula}` : '';
    const arrEm = d.arrEmail ? `, correo electrónico ${d.arrEmail}` : '';

    const ate = campo(d.ate, 'EL ARRENDATARIO');
    const ateCed = d.ateCedula ? `, identificado(a) con C.C. No. ${d.ateCedula}` : '';
    const ateEm = d.ateEmail ? `, correo electrónico ${d.ateEmail}` : '';

    const co = cods.length
      ? `, con la coarrendación y fianza solidaria de ${cods.map((c: string, idx: number) => {
          const cCed = codsCed[idx] ? ` (C.C. No. ${codsCed[idx]})` : '';
          const cEm = codsEm[idx] ? ` (correo: ${codsEm[idx]})` : '';
          return `${c}${cCed}${cEm}`;
        }).join(', ')}`
      : '';

    // Si el usuario modificó o añadió cláusulas personalizadas en d.clausulas, se usan directamente
    let clausulasTexto: Array<{ pre: string; resto: string; html?: string; runs?: Run[] }> = [];
    if (Array.isArray(d.clausulas) && d.clausulas.length > 0) {
      clausulasTexto = d.clausulas.map((c: any) => ({
        pre: c.pre ? String(c.pre).trim() : '',
        resto: c.resto ? String(c.resto).trim() : '',
        html: c.html ? String(c.html) : '',
        runs: Array.isArray(c.runs) && c.runs.length ? c.runs : (c.html ? htmlARuns(c.html) : []),
      }));
    } else {
      clausulasTexto = [
        { pre: 'PRIMERA – Objeto.', resto: `EL ARRENDADOR entrega a título de arrendamiento el inmueble ubicado en ${inmueble}.` },
        { pre: 'SEGUNDA – Canon.', resto: `El canon mensual es de ${fmt(d.val)}, pagadero dentro de los primeros ${campo(d.dia, '__')} días de cada mes.` },
        { pre: 'TERCERA – Duración.', resto: `El contrato tendrá una duración de ${campo(d.dur, '__')} meses, contados desde la fecha de firma, prorrogable por acuerdo escrito.` },
        { pre: 'CUARTA – Destinación.', resto: 'El inmueble se destinará exclusivamente a vivienda. No podrá subarrendarse ni cederse sin autorización escrita del ARRENDADOR.' },
        { pre: 'QUINTA – Servicios y reparaciones.', resto: 'Los servicios públicos y las reparaciones locativas estarán a cargo del ARRENDATARIO.' },
        { pre: 'SEXTA – Restitución.', resto: 'Al terminar, EL ARRENDATARIO restituirá el inmueble en el estado en que lo recibió, salvo el desgaste natural.' },
        { pre: 'SÉPTIMA – Terminación.', resto: 'El incumplimiento de cualquier obligación faculta a la parte cumplida para terminar el contrato conforme a la ley.' },
      ];
    }

    const parrafos: Array<{ pre: string; resto: string; html?: string; runs?: Run[] }> = [
      { pre: '', resto: `En ${ciudad}, a ${d.fecha}, entre ${arr}${arrCed}${arrEm}, en adelante EL ARRENDADOR, y ${ate}${ateCed}${ateEm}, en adelante EL ARRENDATARIO${co}, se celebra el presente contrato:` },
      ...clausulasTexto,
      { pre: '', resto: 'Para constancia, se firma en dos ejemplares del mismo tenor.' },
    ];

    return {
      titulo: 'CONTRATO DE ARRENDAMIENTO DE VIVIENDA URBANA',
      parrafos,
      firmas: [
        { nombre: arr, rol: 'Arrendador', cedula: d.arrCedula || '', email: d.arrEmail || '' },
        { nombre: ate, rol: 'Arrendatario', cedula: d.ateCedula || '', email: d.ateEmail || '' },
        ...cods.map((c: string, idx: number) => ({
          nombre: c,
          rol: 'Codeudor',
          cedula: codsCed[idx] || '',
          email: codsEm[idx] || '',
        })),
      ],
    };
  }

  const vend = campo(d.vend, 'EL VENDEDOR');
  const vendCed = d.vendCedula ? `, identificado(a) con C.C./NIT No. ${d.vendCedula}` : '';
  const vendEm = d.vendEmail ? `, correo electrónico ${d.vendEmail}` : '';

  const comp = campo(d.comp, 'EL COMPRADOR');
  const compCed = d.compCedula ? `, identificado(a) con C.C./NIT No. ${d.compCedula}` : '';
  const compEm = d.compEmail ? `, correo electrónico ${d.compEmail}` : '';

  let clausulasVenta: Array<{ pre: string; resto: string; html?: string; runs?: Run[] }> = [];
  if (Array.isArray(d.clausulas) && d.clausulas.length > 0) {
    clausulasVenta = d.clausulas.map((c: any) => ({
      pre: c.pre ? String(c.pre).trim() : '',
      resto: c.resto ? String(c.resto).trim() : '',
      html: c.html ? String(c.html) : '',
      runs: Array.isArray(c.runs) && c.runs.length ? c.runs : (c.html ? htmlARuns(c.html) : []),
    }));
  } else {
    clausulasVenta = [
      { pre: 'PRIMERA – Objeto.', resto: `EL VENDEDOR transfiere a título de venta el inmueble ubicado en ${inmueble}.` },
      { pre: 'SEGUNDA – Precio.', resto: `El precio de la venta es de ${fmt(d.val)}.` },
      { pre: 'TERCERA – Forma de pago.', resto: `EL COMPRADOR pagará el precio así: ${campo(d.pago, '____________')}.` },
      { pre: 'CUARTA – Tradición y libertad.', resto: 'EL VENDEDOR garantiza que el inmueble es de su propiedad y se encuentra libre de gravámenes, embargos y limitaciones de dominio.' },
      { pre: 'QUINTA – Entrega.', resto: 'El inmueble se entregará a paz y salvo por impuestos y servicios públicos a la fecha de la escritura pública.' },
      { pre: 'SEXTA – Gastos.', resto: 'Los gastos notariales de registro serán asumidos por las partes en la proporción que la ley establece.' },
    ];
  }

  const parrafos: Array<{ pre: string; resto: string; html?: string; runs?: Run[] }> = [
    { pre: '', resto: `En ${ciudad}, a ${d.fecha}, entre ${vend}${vendCed}${vendEm}, en adelante EL VENDEDOR, y ${comp}${compCed}${compEm}, en adelante EL COMPRADOR, se celebra el presente contrato:` },
    ...clausulasVenta,
    { pre: '', resto: 'Para constancia, se firma en dos ejemplares del mismo tenor.' },
  ];

  return {
    titulo: 'CONTRATO DE COMPRAVENTA DE INMUEBLE',
    parrafos,
    firmas: [
      { nombre: vend, rol: 'Vendedor', cedula: d.vendCedula || '', email: d.vendEmail || '' },
      { nombre: comp, rol: 'Comprador', cedula: d.compCedula || '', email: d.compEmail || '' },
    ],
  };
}
