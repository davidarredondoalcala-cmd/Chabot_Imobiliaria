import { fmt } from '../lib/utils';
import FirmaEspacio from './firmas/FirmaEspacio';
import { INMOBILIARIA_INFO, FIRMA_INMOBILIARIA_DATA_URL } from '../lib/firmaInmobiliaria';

const V = ({ x, d }) => (x && String(x).trim() ? <b>{x}</b> : <b className="bl">{d || '__________'}</b>);

// Plantilla del contrato (vista previa en vivo, se imprime como PDF).
// `firmas` es OPCIONAL: si no se pasa, renderiza solo espacios con nombres.
export default function Hoja({ modo, S = {}, firmas }) {
  const f = S.fecha || new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  const cs = Array.isArray(S.cods) ? S.cods.filter(Boolean) : [];
  const inm = <>{<V x={S.dir} />}, barrio <V x={S.bar} />, de la ciudad de <V x={S.ciu} />, cuyos linderos son: <V x={S.lin} d="____________________" /></>;
  
  const Membrete = () => (
    <div className="mem">
      <div className="mem-h">
        <div>
          <h3 className="mem-t">Habitat Capital</h3>
          <p className="mem-sub">Gestión inmobiliaria y contratos electrónicos</p>
        </div>
        <div className="mem-l">Documento generado electrónicamente<br />Referencia: {modo === 'arriendo' ? 'ARR' : 'CV'}-{f.replace(/[^0-9]/g, '').slice(-8).padStart(8, '0')}</div>
      </div>
      <hr />
    </div>
  );

  if (modo === 'arriendo') {
    const arrCed = S.arrCedula ? <>, identificado(a) con C.C./NIT No. <V x={S.arrCedula} /></> : null;
    const arrEm = S.arrEmail ? <>, correo electrónico <V x={S.arrEmail} /></> : null;
    const ateCed = S.ateCedula ? <>, identificado(a) con C.C. No. <V x={S.ateCedula} /></> : null;
    const ateEm = S.ateEmail ? <>, correo electrónico <V x={S.ateEmail} /></> : null;

    return (
      <div className="hoja">
        <Membrete />
        <h3>CONTRATO DE ARRENDAMIENTO DE VIVIENDA URBANA</h3>
        <p>
          En <V x={S.ciu} />, a {f}, entre <b>{S.arr || 'EL ARRENDADOR'}</b>{arrCed}{arrEm}, en adelante EL ARRENDADOR, y <V x={S.ate} d="EL ARRENDATARIO" />{ateCed}{ateEm}, en adelante EL ARRENDATARIO{cs.length ? `, con la coarrendación y fianza solidaria de ${cs.map((c, k) => `${c}${S.codsCedula?.[k] ? ` (C.C. ${S.codsCedula[k]})` : ''}${S.codsEmail?.[k] ? ` (correo: ${S.codsEmail[k]})` : ''}`).join(', ')}` : ''}, se celebra el presente contrato:
        </p>

        {Array.isArray(S.clausulas) && S.clausulas.length > 0 ? (
          S.clausulas.map((cl, idx) => (
            <p key={idx}>
              {cl.pre && <b>{cl.pre} </b>}
              {cl.resto}
            </p>
          ))
        ) : (
          <>
            <p><b>PRIMERA – Objeto.</b> EL ARRENDADOR entrega a título de arrendamiento el inmueble ubicado en {inm}.</p>
            <p><b>SEGUNDA – Canon.</b> El canon mensual es de <V x={S.val ? fmt(S.val) : ''} />, pagadero dentro de los primeros <V x={S.dia} d="__" /> días de cada mes.</p>
            <p><b>TERCERA – Duración.</b> El contrato tendrá una duración de <V x={S.dur} d="__" /> meses, contados desde la fecha de firma, prorrogable por acuerdo escrito.</p>
            <p><b>CUARTA – Destinación.</b> El inmueble se destinará exclusivamente a vivienda. No podrá subarrendarse ni cederse sin autorización escrita del ARRENDADOR.</p>
            <p><b>QUINTA – Servicios y reparaciones.</b> Los servicios públicos y las reparaciones locativas estarán a cargo del ARRENDATARIO.</p>
            <p><b>SEXTA – Restitución.</b> Al terminar, EL ARRENDATARIO restituirá el inmueble en el estado en que lo recibió, salvo el desgaste natural.</p>
            <p><b>SÉPTIMA – Terminación.</b> El incumplimiento de cualquier obligación faculta a la parte cumplida para terminar el contrato conforme a la ley.</p>
          </>
        )}

        <p>Para constancia, se firma en dos ejemplares del mismo tenor.</p>
        <div className="sig">
          <FirmaEspacio
            nombre={S.arr || INMOBILIARIA_INFO.nombre}
            rol="Arrendador (Propietario)"
            imagen={firmas?.arrendador || FIRMA_INMOBILIARIA_DATA_URL}
          />
          <FirmaEspacio
            nombre={S.ate || 'Arrendatario'}
            rol="Arrendatario"
            imagen={firmas?.arrendatario}
          />
          {cs.map((c, k) => (
            <FirmaEspacio
              key={k}
              nombre={c}
              rol={`Codeudor ${cs.length > 1 ? `#${k + 1}` : ''}`}
              imagen={firmas?.codeudores?.[k]}
            />
          ))}
        </div>
      </div>
    );
  }

  const vendCed = S.vendCedula ? <>, identificado(a) con C.C./NIT No. <V x={S.vendCedula} /></> : null;
  const vendEm = S.vendEmail ? <>, correo electrónico <V x={S.vendEmail} /></> : null;
  const compCed = S.compCedula ? <>, identificado(a) con C.C./NIT No. <V x={S.compCedula} /></> : null;
  const compEm = S.compEmail ? <>, correo electrónico <V x={S.compEmail} /></> : null;

  return (
    <div className="hoja">
      <Membrete />
      <h3>CONTRATO DE COMPRAVENTA DE INMUEBLE</h3>
      <p>
        En <V x={S.ciu} />, a {f}, entre <V x={S.vend} d="EL VENDEDOR" />{vendCed}{vendEm}, en adelante EL VENDEDOR, y <V x={S.comp} d="EL COMPRADOR" />{compCed}{compEm}, en adelante EL COMPRADOR, se celebra el presente contrato:
      </p>

      {Array.isArray(S.clausulas) && S.clausulas.length > 0 ? (
        S.clausulas.map((cl, idx) => (
          <p key={idx}>
            {cl.pre && <b>{cl.pre} </b>}
            {cl.resto}
          </p>
        ))
      ) : (
        <>
          <p><b>PRIMERA – Objeto.</b> EL VENDEDOR transfiere a título de venta el inmueble ubicado en {inm}.</p>
          <p><b>SEGUNDA – Precio.</b> El precio de la venta es de <V x={S.val ? fmt(S.val) : ''} />.</p>
          <p><b>TERCERA – Forma de pago.</b> EL COMPRADOR pagará el precio así: <V x={S.pago} d="____________" />.</p>
          <p><b>CUARTA – Tradición y libertad.</b> EL VENDEDOR garantiza que el inmueble es de su propiedad y se encuentra libre de gravámenes, embargos y limitaciones de dominio.</p>
          <p><b>QUINTA – Entrega.</b> El inmueble se entregará a paz y salvo por impuestos y servicios públicos a la fecha de la escritura pública.</p>
          <p><b>SEXTA – Gastos.</b> Los gastos notariales y de registro serán asumidos por las partes en la proporción que la ley establece.</p>
        </>
      )}

      <p>Para constancia, se firma en dos ejemplares del mismo tenor.</p>
      <div className="sig">
        <FirmaEspacio
          nombre={S.vend || INMOBILIARIA_INFO.nombre}
          rol="Vendedor (Propietario)"
          imagen={firmas?.vendedor || FIRMA_INMOBILIARIA_DATA_URL}
        />
        <FirmaEspacio
          nombre={S.comp || 'Comprador'}
          rol="Comprador"
          imagen={firmas?.comprador}
        />
      </div>
    </div>
  );
}
