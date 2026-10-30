export const fmt = (n) => '$ ' + Number(n || 0).toLocaleString('es-CO');
export const fd = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('es-CO') : '—');
// Clase CSS según el estado (colores de la etiqueta)
export const cls = (e) => (e === 'Arrendada' ? 'Arrendada' : e === 'Para la venta' ? 'Venta' : e === 'Vendida' ? 'Vendida' : e === 'Por vencer' ? 'PorVencer' : 'Sin');
export const icono = (i) => (i.tipo === 'Casa' ? 'Casa' : 'Apartamento');
export const porVencer = (i) => i.venc && (new Date(i.venc) - new Date()) / 864e5 <= 90;
// Estado extra (calculado, no se guarda): inmueble arrendado cuyo contrato vence en 90 días o menos
export const estaPorVencer = (i) => i.estado === 'Arrendada' && !!porVencer(i);
// El valor es mensual salvo que el inmueble esté en venta o vendido
export const sufijo = (i) => (i.estado === 'Para la venta' || i.estado === 'Vendida' ? '' : ' / mes');

// Calcula el tiempo en meses que lleva arrendada la propiedad (para control de historiales)
export function mesesArrendada(i) {
  if (i.estado !== 'Arrendada' && !i.contratos?.some((c) => c.vig)) return 0;
  const vig = i.contratos?.find((c) => c.vig);
  if (vig?.fecha) {
    const inicio = new Date(vig.fecha.includes('T') ? vig.fecha : vig.fecha + 'T00:00:00').getTime();
    const diff = Date.now() - inicio;
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 30.4375)));
  }
  if (i.venc) {
    // Estimación sobre contrato estándar de 12 meses
    const vencMs = new Date(i.venc.includes('T') ? i.venc : i.venc + 'T00:00:00').getTime();
    const inicioEstimado = vencMs - (365 * 24 * 60 * 60 * 1000);
    const diff = Date.now() - inicioEstimado;
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 30.4375)));
  }
  return 0;
}

export function tiempoArrendadaTexto(i) {
  const m = mesesArrendada(i);
  if (m < 1) return 'Menos de 1 mes';
  if (m < 12) return `${m} ${m === 1 ? 'mes' : 'meses'}`;
  const anos = Math.floor(m / 12);
  const resto = m % 12;
  return `${anos} ${anos === 1 ? 'año' : 'años'}${resto > 0 ? ` y ${resto} m` : ''}`;
}

// ===== Filtros de búsqueda =====
export const FILTROS0 = { hab: '', ban: '', areaMin: '', areaMax: '', pMin: '', pMax: '', estado: '', tiempoArriendo: '' };
export const hayFiltros = (f) => Object.values(f).some((v) => v !== '');
const num = (v) => (v === '' || v == null ? null : Number(v));

// Habitaciones y baños: "mínimo" (3 = 3 o más). Área y precio: rango mín-máx.
export function filtrar(lista, f) {
  const aMin = num(f.areaMin), aMax = num(f.areaMax), pMin = num(f.pMin), pMax = num(f.pMax);
  return lista.filter((i) => {
    if (f.hab && !(i.habitaciones >= Number(f.hab))) return false;
    if (f.ban && !(i.banos >= Number(f.ban))) return false;
    if (aMin != null && !(i.area >= aMin)) return false;
    if (aMax != null && !(i.area <= aMax)) return false;
    if (pMin != null && !(i.valor >= pMin)) return false;
    if (pMax != null && !(i.valor <= pMax)) return false;
    if (f.estado === 'Por vencer') { if (!estaPorVencer(i)) return false; }
    else if (f.estado && i.estado !== f.estado) return false;

    // Filtro por tiempo arrendada (para gestión de historiales de arrendamiento)
    if (f.tiempoArriendo) {
      if (i.estado !== 'Arrendada') return false;
      const meses = mesesArrendada(i);
      if (meses < Number(f.tiempoArriendo)) return false;
    }

    return true;
  });
}
