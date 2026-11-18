const METODOS = { tipografica: 'Tipográfica (teclado)', canvas: 'A pulso (canvas)', imagen: 'Imagen subida' };

const hora = (f) => new Date(f).toLocaleString('es-CO', {
  timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'medium',
});

// Tabla de evidencia técnica por firmante (fecha/hora Bogotá, IP, hash SHA-256).
export default function EvidenciaTabla({ firmantes, contratoHash }) {
  const conEv = firmantes.filter((f) => f.evidencia);
  if (!conEv.length) return null;
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Evidencia de firmas electrónicas</h3>
      <p className="mut">Huella SHA-256 del contrato: <code className="fm-hash">{contratoHash}</code></p>
      <div className="fm-tabla-env">
        <table className="fm-tabla">
          <thead>
            <tr><th>Firmante</th><th>Rol</th><th>Método</th><th>Fecha y hora (Bogotá)</th><th>IP</th><th>Hash de cadena</th></tr>
          </thead>
          <tbody>
            {conEv.map((f) => (
              <tr key={f.orden}>
                <td data-label="Firmante">{f.evidencia.usuario?.nombre || f.nombre}</td>
                <td data-label="Rol">{f.rol}</td>
                <td data-label="Método">{METODOS[f.evidencia.metodo] || f.evidencia.metodo}</td>
                <td data-label="Fecha y hora (Bogotá)">{hora(f.evidencia.fecha)}</td>
                <td data-label="IP">{f.evidencia.ip}</td>
                <td data-label="Hash de cadena"><code className="fm-hash" title={f.evidencia.hashCadena}>{f.evidencia.hashCadena.slice(0, 16)}…</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mut">
        Conforme a la Ley 527 de 1999: cada firma quedó asociada a la identidad del firmante,
        el método, la fecha y hora, la IP y la huella del documento; las huellas están encadenadas
        y la integridad es verificable contra el hash del contrato.
      </p>
    </div>
  );
}
