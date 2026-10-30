// Utilidades para las cláusulas editables: saneamiento, texto plano y "runs"
// (fragmentos con formato) que usa el generador de PDF del backend.

export const MAX_CLAUSULAS = 40;
export const MAX_PRE = 200;
export const MAX_TEXTO = 2000;
export const MAX_HTML = 8000;

const ETIQUETAS = new Set(['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'p', 'div', 'span']);

const ENTIDADES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

export function escaparHtml(texto) {
  return String(texto || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodificar(texto) {
  return String(texto || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (e) => ENTIDADES[e] ?? e);
}

// Deja solo etiquetas de formato permitidas y elimina todos los atributos.
export function sanitizarHtml(html) {
  if (!html) return '';
  let limpio = String(html).slice(0, MAX_HTML * 2);
  limpio = limpio.replace(/<!--[\s\S]*?-->/g, '');
  // Cualquier construcción tipo etiqueta se descarta si no está en la lista blanca.
  // Esto también cubre etiquetas mal formadas como <svg/onload=...>.
  limpio = limpio.replace(/<[^>]*>/g, (match) => {
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
export function normalizarHtmlInline(html) {
  let limpio = sanitizarHtml(html);
  limpio = limpio
    .replace(/<\/(p|div)>/gi, '<br>')
    .replace(/<(p|div)(\s[^>]*)?>/gi, '')
    .replace(/^(<br>)+/i, '')
    .replace(/(<br>)+$/i, '')
    .replace(/(<br>){3,}/gi, '<br><br>');
  return limpio;
}

export function htmlDeTexto(texto) {
  return escaparHtml(texto).replace(/\r?\n/g, '<br>').slice(0, MAX_HTML);
}

export function textoDeHtml(html) {
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

function empujar(out, run) {
  if (!run || (!run.br && !run.t)) return;
  const ultimo = out[out.length - 1];
  if (!run.br && ultimo && !ultimo.br && !!ultimo.b === !!run.b && !!ultimo.i === !!run.i && !!ultimo.u === !!run.u) {
    ultimo.t += run.t;
    return;
  }
  out.push(run);
}

function caminar(nodo, estilo, out) {
  for (const hijo of nodo.childNodes) {
    if (hijo.nodeType === 3) {
      const t = hijo.nodeValue.replace(/\s+/g, ' ');
      if (t) empujar(out, { t, ...estilo });
      continue;
    }
    if (hijo.nodeType !== 1) continue;

    const tag = hijo.tagName;
    if (tag === 'BR') {
      out.push({ br: true });
      continue;
    }
    if (tag === 'UL' || tag === 'OL') {
      out.push({ br: true });
      const items = Array.from(hijo.children).filter((c) => c.tagName === 'LI');
      items.forEach((li, idx) => {
        empujar(out, { t: tag === 'OL' ? `${idx + 1}. ` : '• ', ...estilo });
        caminar(li, estilo, out);
        out.push({ br: true });
      });
      out.push({ br: true });
      continue;
    }
    if (tag === 'LI') {
      empujar(out, { t: '• ', ...estilo });
      caminar(hijo, estilo, out);
      out.push({ br: true });
      continue;
    }
    if (tag === 'P' || tag === 'DIV') {
      out.push({ br: true });
      caminar(hijo, estilo, out);
      out.push({ br: true });
      continue;
    }

    const nuevo = { ...estilo };
    if (tag === 'B' || tag === 'STRONG') nuevo.b = true;
    if (tag === 'I' || tag === 'EM') nuevo.i = true;
    if (tag === 'U') nuevo.u = true;
    caminar(hijo, nuevo, out);
  }
}

function limpiarRuns(runs) {
  const out = [];
  let total = 0;
  for (const run of runs) {
    if (out.length >= 800 || total >= 12000) break;
    if (run.br) {
      if (out.length && !out[out.length - 1].br) out.push({ br: true });
      continue;
    }
    const t = String(run.t || '').slice(0, MAX_TEXTO);
    if (!t) continue;
    total += t.length;
    out.push({ t, ...(run.b ? { b: true } : {}), ...(run.i ? { i: true } : {}), ...(run.u ? { u: true } : {}) });
  }
  while (out.length && out[out.length - 1].br) out.pop();
  while (out.length && out[0].br) out.shift();
  return out;
}

// Convierte HTML con formato a fragmentos { t, b, i, u } / { br }.
export function htmlARuns(html) {
  const limpio = normalizarHtmlInline(html);
  if (!limpio) return [];

  if (typeof DOMParser === 'undefined') {
    const texto = textoDeHtml(limpio);
    return texto ? [{ t: texto }] : [];
  }

  const doc = new DOMParser().parseFromString(`<div>${limpio}</div>`, 'text/html');
  const raiz = doc.body.firstChild;
  if (!raiz) return [];
  const runs = [];
  caminar(raiz, {}, runs);
  return limpiarRuns(runs);
}

// Normaliza una cláusula a la forma que se guarda en el contrato.
export function normalizarClausula(c) {
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

  // Corregir posibles palabras pegadas típicas de contratos (ej: ARRENDATARIOrestituirá)
  html = html.replace(/(ARRENDATARIO|ARRENDADOR|INMOBILIARIA|COMPRADOR|VENDEDOR)([a-záéíóúñ])/gi, '$1 $2');
  resto = resto.replace(/(ARRENDATARIO|ARRENDADOR|INMOBILIARIA|COMPRADOR|VENDEDOR)([a-záéíóúñ])/gi, '$1 $2');

  return { pre, resto, html, runs: htmlARuns(html) };
}

export function normalizarClausulas(lista) {
  return (Array.isArray(lista) ? lista : [])
    .slice(0, MAX_CLAUSULAS)
    .map(normalizarClausula)
    .filter((c) => c.pre || c.resto);
}
