'use client';
import { useEffect, useState } from 'react';
import { getInmuebles } from '../lib/api';
import Lista from '../components/Lista';
import Detalle from '../components/Detalle';
import ContratoForm from '../components/ContratoForm';
import InmuebleForm from '../components/InmuebleForm';
import Login from '../components/Login';
import { FILTROS0 } from '../lib/utils';
import { getSesion, salir, yo, esAdminEmail } from '../lib/auth';
import { Logo } from '../components/Iconos';
import TemaBtn from '../components/TemaBtn';

export default function Home() {
  const [sesion, setSesion] = useState(null);
  const [listo, setListo] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('Casa');
  const [filtros, setFiltros] = useState(FILTROS0);
  const [vista, setVista] = useState({ n: 'lista' });
  const [oculto, setOculto] = useState(false);
  const [toast, setToast] = useState('');


  useEffect(() => {
    const s = getSesion();
    if (!s?.token) { setListo(true); return; }
    yo()
      .then((u) => {
        if (u) {
          const act = { ...s, usuario: u };
          setSesion(act);
        } else {
          setSesion(s);
        }
      })
      .catch(() => setSesion(s))
      .finally(() => setListo(true));
  }, []);


  useEffect(() => {
    const f = () => { const s = getSesion(); if (!s?.token) { setSesion(null); setData(null); } };
    addEventListener('habitat-sesion', f);
    return () => removeEventListener('habitat-sesion', f);
  }, []);

  const cargar = () => getInmuebles().then(setData).catch((e) => setErr(e.message || 'No se pudo conectar con el backend. Revisa que NestJS esté corriendo y que NEXT_PUBLIC_API_URL sea correcta.'));
  useEffect(() => { if (sesion) cargar(); }, [sesion]);


  useEffect(() => {
    let u = 0;
    const f = () => { const y = scrollY; if (y > u && y > 80) setOculto(true); else if (y < u) setOculto(false); u = Math.max(y, 0); };
    addEventListener('scroll', f, { passive: true });
    return () => removeEventListener('scroll', f);
  }, []);

  const avisar = (t) => { setToast(t); setTimeout(() => setToast(''), 2200); };
  const sel = data?.find((i) => i._id === vista.id);
  const emailUsuario = (sesion?.usuario?.email || '').trim().toLowerCase();
  const esAdmin = esAdminEmail(emailUsuario);

  // Abre un inmueble directamente cuando el usuario hace clic en una recomendación del chatbot
  useEffect(() => {
    const handler = (e) => {
      const prop = e.detail;
      if (!prop) return;

      const list = data || [];

      // 1. Coincidencia por ID directo de MongoDB o código
      let match = list.find(
        (i) => i._id === prop.id || String(i._id) === String(prop.id) || (prop.codigo && i._id === prop.codigo)
      );

      // 2. Coincidencia por título o nombre (exacto o aproximado)
      if (!match && (prop.titulo || prop.nombre)) {
        const cleanTitle = (prop.titulo || prop.nombre).toLowerCase().trim();
        match = list.find((i) => {
          const nom = (i.nombre || '').toLowerCase().trim();
          return nom === cleanTitle || nom.includes(cleanTitle) || cleanTitle.includes(nom);
        });
      }

      // 3. Coincidencia por barrio y tipo
      if (!match && prop.barrio) {
        const propTipo = (prop.tipo || '').toLowerCase() === 'apartamento' ? 'Apartamento' : 'Casa';
        match = list.find(
          (i) => (i.barrio || '').toLowerCase() === prop.barrio.toLowerCase() && i.tipo === propTipo
        );
      }

      if (match) {
        setTab(match.tipo);
        setVista({ n: 'detalle', id: match._id });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        avisar(`Abriendo: ${match.nombre}`);
      } else {
        // Si no existe aún en el catálogo local, se construye la ficha para mostrarla directamente
        const nuevoInm = {
          _id: prop.id || prop.codigo || `prop-${Date.now()}`,
          tipo: (prop.tipo || 'Casa').toLowerCase() === 'apartamento' ? 'Apartamento' : 'Casa',
          nombre: prop.titulo || prop.nombre || 'Inmueble seleccionado',
          dir: prop.direccion_aproximada || prop.dir || `Sector ${prop.barrio || 'Ibagué'}`,
          barrio: prop.barrio || 'Ibagué',
          lind: 'Al norte con predio vecino, al sur con vía pública, al oriente y occidente con propiedad privada.',
          habitaciones: Number(prop.habitaciones) || 2,
          banos: Number(prop.banos) || 2,
          area: Number(prop.area_m2) || Number(prop.area) || 75,
          estado: prop.operacion === 'venta' ? 'Para la venta' : (prop.disponible === false ? 'Arrendada' : 'Sin arrendar'),
          valor: Number(prop.precio) || Number(prop.valor) || 0,
          diaPago: 5,
          foto: prop.foto,
          contratos: [],
        };
        setData((prev) => (prev ? [...prev, nuevoInm] : [nuevoInm]));
        setTab(nuevoInm.tipo);
        setVista({ n: 'detalle', id: nuevoInm._id });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        avisar(`Abriendo: ${nuevoInm.nombre}`);
      }
    };

    window.addEventListener('habitat-abrir-inmueble', handler);
    return () => window.removeEventListener('habitat-abrir-inmueble', handler);
  }, [data]);

  const cerrarSesion = async () => { await salir(); setSesion(null); setData(null); setVista({ n: 'lista' }); setErr(''); };

  if (!listo) return <main><p className="mut">Cargando…</p></main>;
  if (!sesion) return <Login onEntrar={(s) => setSesion(s)} />;

  return (
    <>
      <header className={oculto ? 'oculto' : ''}>
        <button
          type="button"
          className="marca"
          onClick={() => {
            setVista({ n: 'lista' });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          title="Ir a inicio de Habitat Capital"
        >
          <Logo />
          <h1>Habitat Capital</h1>
        </button>
        <div className="header-der">
          <span className={`tag-rol ${esAdmin ? 'tag-admin' : 'tag-usuario'}`}>
            {esAdmin ? 'Administrador' : 'Modo Cliente'}
          </span>
          <p>Gestión de inmuebles y contratos</p>
          <TemaBtn />
          <div className="usuario">
            {sesion.usuario?.foto ? <img src={sesion.usuario.foto} alt="" referrerPolicy="no-referrer" /> : null}
            <span className="usuario-nom">{sesion.usuario?.nombre || sesion.usuario?.email}</span>
            <button className="l" onClick={cerrarSesion}>Salir</button>
          </div>
        </div>
      </header>
      <main>
        {err && <div className="card">{err}</div>}
        {!data && !err && <p className="mut">Cargando inmuebles…</p>}
        {data && vista.n === 'lista' && (
          <Lista
            data={data}
            tab={tab}
            setTab={setTab}
            filtros={filtros}
            setFiltros={setFiltros}
            esAdmin={esAdmin}
            nuevo={() => {
              if (!esAdmin) return;
              scrollTo(0, 0);
              setVista({ n: 'nuevo' });
            }}
            abrir={(id) => setVista({ n: 'detalle', id })}
          />
        )}
        {data && vista.n === 'nuevo' && (
          esAdmin ? (
            <InmuebleForm
              tipo0={tab}
              avisar={avisar}
              volver={() => setVista({ n: 'lista' })}
              creado={(nuevo) => {
                avisar('Inmueble agregado');
                cargar();
                setTab(nuevo.tipo);
                setFiltros(FILTROS0);
                setVista({ n: 'lista' });
              }}
            />
          ) : (
            setVista({ n: 'lista' }), null
          )
        )}
        {data && vista.n === 'detalle' && sel && (
          <Detalle
            inm={sel}
            esAdmin={esAdmin}
            avisar={avisar}
            actualizar={(act) => setData((d) => d.map((x) => (x._id === act._id ? act : x)))}
            volver={() => setVista({ n: 'lista' })}
            crear={(modo) => {
              if (!esAdmin) return;
              scrollTo(0, 0);
              setVista({ n: 'form', id: sel._id, modo });
            }}
          />
        )}
        {data && vista.n === 'form' && sel && (
          esAdmin ? (
            <ContratoForm
              inm={sel}
              modo0={vista.modo}
              avisar={avisar}
              volver={() => setVista({ n: 'detalle', id: sel._id })}
              terminado={() => {
                cargar();
                setVista({ n: 'detalle', id: sel._id });
              }}
            />
          ) : (
            setVista({ n: 'detalle', id: sel._id }), null
          )
        )}
      </main>
      {toast && <div id="toast">{toast}</div>}
    </>
  );
}