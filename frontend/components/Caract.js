import { IcoCama, IcoBano, IcoArea } from './Iconos';

// Habitaciones, baños y área de un inmueble
export default function Caract({ i }) {
  const v = (x, u = '') => (x === undefined || x === null || x === '' ? '—' : `${x}${u}`);
  return (
    <p className="caract">
      <span><IcoCama /> {v(i.habitaciones)} hab.</span>
      <span><IcoBano /> {v(i.banos)} baños</span>
      <span><IcoArea /> {v(i.area, ' m²')}</span>
    </p>
  );
}
