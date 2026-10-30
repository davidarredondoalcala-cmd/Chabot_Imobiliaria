// Plantillas del contrato en texto — ESPEJO EXACTO de frontend/components/Hoja.js.
// Si se cambia una cláusula allá, cambiarla aquí (checklist del README_FIRMAS.md).

const fmt = (n: any) => '$ ' + Number(n || 0).toLocaleString('es-CO');
const campo = (v: any, def?: string) => (v && String(v).trim() ? String(v) : def || '__________');

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
    const arr = campo(d.arr, 'EL ARRENDADOR');
    const ate = campo(d.ate, 'EL ARRENDATARIO');
    const co = cods.length ? `, con la coarrendación/codeudoría de ${cods.join(', ')}` : '';
    const parrafos = [
      { pre: '', resto: `En ${ciudad}, a ${d.fecha}, entre ${arr}, en adelante EL ARRENDADOR, y ${ate}, en adelante EL ARRENDATARIO${co}, se celebra el presente contrato:` },
      { pre: 'PRIMERA – Objeto.', resto: `EL ARRENDADOR entrega a título de arrendamiento el inmueble ubicado en ${inmueble}.` },
      { pre: 'SEGUNDA – Canon.', resto: `El canon mensual es de ${fmt(d.val)}, pagadero dentro de los primeros ${campo(d.dia, '__')} días de cada mes.` },
      { pre: 'TERCERA – Duración.', resto: `El contrato tendrá una duración de ${campo(d.dur, '__')} meses, contados desde la fecha de firma, prorrogable por acuerdo escrito.` },
      { pre: 'CUARTA – Destinación.', resto: 'El inmueble se destinará exclusivamente a vivienda. No podrá subarrendarse ni cederse sin autorización escrita del ARRENDADOR.' },
      { pre: 'QUINTA – Servicios y reparaciones.', resto: 'Los servicios públicos y las reparaciones locativas estarán a cargo del ARRENDATARIO.' },
      { pre: 'SEXTA – Restitución.', resto: 'Al terminar, EL ARRENDATARIO restituirá el inmueble en el estado en que lo recibió, salvo el desgaste natural.' },
      { pre: 'SÉPTIMA – Terminación.', resto: 'El incumplimiento de cualquier obligación faculta a la parte cumplida para terminar el contrato conforme a la ley.' },
      { pre: '', resto: 'Para constancia, se firma en dos ejemplares del mismo tenor.' },
    ];
    return {
      titulo: 'CONTRATO DE ARRENDAMIENTO DE VIVIENDA URBANA',
      parrafos,
      firmas: [{ nombre: arr, rol: 'Arrendador' }, { nombre: ate, rol: 'Arrendatario' }, ...cods.map((c: string) => ({ nombre: c, rol: 'Codeudor' }))],
    };
  }

  const vend = campo(d.vend, 'EL VENDEDOR');
  const comp = campo(d.comp, 'EL COMPRADOR');
  const parrafos = [
    { pre: '', resto: `En ${ciudad}, a ${d.fecha}, entre ${vend}, en adelante EL VENDEDOR, y ${comp}, en adelante EL COMPRADOR, se celebra el presente contrato:` },
    { pre: 'PRIMERA – Objeto.', resto: `EL VENDEDOR transfiere a título de venta el inmueble ubicado en ${inmueble}.` },
    { pre: 'SEGUNDA – Precio.', resto: `El precio de la venta es de ${fmt(d.val)}.` },
    { pre: 'TERCERA – Forma de pago.', resto: `EL COMPRADOR pagará el precio así: ${campo(d.pago, '____________')}.` },
    { pre: 'CUARTA – Tradición y libertad.', resto: 'EL VENDEDOR garantiza que el inmueble es de su propiedad y se encuentra libre de gravámenes, embargos y limitaciones de dominio.' },
    { pre: 'QUINTA – Entrega.', resto: 'El inmueble se entregará a paz y salvo por impuestos y servicios públicos a la fecha de la escritura pública.' },
    { pre: 'SEXTA – Gastos.', resto: 'Los gastos notariales de registro serán asumidos por las partes en la proporción que la ley establece.' },
    { pre: '', resto: 'Para constancia, se firma en dos ejemplares del mismo tenor.' },
  ];
  return {
    titulo: 'CONTRATO DE COMPRAVENTA DE INMUEBLE',
    parrafos,
    firmas: [{ nombre: vend, rol: 'Vendedor' }, { nombre: comp, rol: 'Comprador' }],
  };
}
