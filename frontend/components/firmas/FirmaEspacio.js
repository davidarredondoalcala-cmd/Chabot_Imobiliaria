// Slot de firma dentro del contrato: muestra la imagen normalizada si existe
// y exactamente UNA sola línea horizontal para la firma con el nombre y rol debajo.
export default function FirmaEspacio({ nombre, rol, imagen }) {
  return (
    <div className="firma-slot-wrapper">
      <div className="firma-img-area">
        {imagen ? (
          <img className="firma-img" src={imagen} alt={`Firma de ${nombre || rol}`} />
        ) : null}
      </div>
      <div className="firma-linea-firmante">
        <span className="firma-nombre-txt">{nombre || '__________'}</span>
        <br />
        <small className="firma-rol-txt">{rol}</small>
      </div>
    </div>
  );
}
