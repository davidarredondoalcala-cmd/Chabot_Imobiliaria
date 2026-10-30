// Slot de firma dentro del contrato: muestra la imagen normalizada si existe
// y un placeholder en caso contrario. Se usa en Hoja.js (pantalla e impresión).
export default function FirmaEspacio({ nombre, rol, imagen }) {
  return (
    <div>
      {imagen && <img className="firma-img" src={imagen} alt={`Firma de ${nombre || rol}`} />}
      <div>{nombre || '__________'}<br /><small>{rol}</small></div>
    </div>
  );
}
