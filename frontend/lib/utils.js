export const fmt = (n) => '$ ' + Number(n || 0).toLocaleString('es-CO');
export const fd = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('es-CO') : '—');
// Clase CSS según el estado (colores de la etiqueta)
export const cls = (e) => (e === 'Arrendada' ? 'Arrendada' : e === 'Para la venta' ? 'Venta' : e === 'Vendida' ? 'Vendida' : e === 'Por vencer' ? 'PorVencer' : 'Sin');
export const icono = (i) => (i.tipo === 'Casa' ? '🏠' : '🏢');
export const porVencer = (i) => i.venc && (new Date(i.venc) - new Date()) / 864e5 <= 90;
// Estado extra (calculado, no se guarda): inmueble arrendado cuyo contrato vence en 90 días o menos
export const estaPorVencer = (i) => i.estado === 'Arrendada' && !!porVencer(i);
// El valor es mensual salvo que el inmueble esté en venta o vendido
export const sufijo = (i) => (i.estado === 'Para la venta' || i.estado === 'Vendida' ? '' : ' / mes');

// ===== Filtros de búsqueda =====
export const FILTROS0 = { hab: '', ban: '', areaMin: '', areaMax: '', pMin: '', pMax: '', estado: '' };
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
    return true;
  });
}
