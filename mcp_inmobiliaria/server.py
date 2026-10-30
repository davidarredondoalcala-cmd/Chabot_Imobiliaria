# -*- coding: utf-8 -*-
"""Servidor MCP (Model Context Protocol) para Habitat Capital.

Expone herramientas especializadas de la plataforma inmobiliaria:
- `consultar_inmuebles`: Búsqueda y filtrado de inmuebles en arriendo y venta.
- `obtener_detalle_inmueble`: Consulta de ficha técnica y características.
- `consultar_estado_contrato`: Auditoría de firmas de arrendador, arrendatario y codeudores.
- `verificar_integridad_contrato`: Validación criptográfica SHA-256 bajo Ley 527 de 1999.
- `calcular_canon_sugerido`: Estimación financiera de canon por m2, estrato y zona.

Ejecución directa (stdio):
    py -m mcp_inmobiliaria.server
"""

from __future__ import annotations

import sys
from mcp.server.mcpserver import MCPServer

from mcp_inmobiliaria.tools_inmobiliaria import (
    calcular_canon_sugerido as _calcular_canon_sugerido,
    consultar_estado_contrato as _consultar_estado_contrato,
    consultar_inmuebles as _consultar_inmuebles,
    obtener_detalle_inmueble as _obtener_detalle_inmueble,
    verificar_integridad_contrato as _verificar_integridad_contrato,
)

# Inicializar servidor MCP con metadatos del dominio inmobiliario
server = MCPServer(
    name="habitat-capital-mcp",
    description=(
        "Servidor MCP oficial de Habitat Capital S.A.S. para consulta de portafolio "
        "inmobiliario, ciclo de vida de contratos de arrendamiento/venta y "
        "certificación probatoria digital según la Ley 527 de 1999."
    ),
)


@server.tool()
def consultar_inmuebles(
    tipo: str = "todos",
    ciudad: str = "todos",
    max_precio: float = 0.0,
    estado: str = "disponible",
) -> str:
    """Busca inmuebles en el portafolio de Habitat Capital con filtros avanzados.

    Parámetros:
    - tipo: 'apartamento', 'casa', 'apartaestudio', 'penthouse' o 'todos'.
    - ciudad: 'Medellín', 'Envigado', 'Itagüí' o 'todos'.
    - max_precio: Canon o precio tope en COP (0 para omitir filtro).
    - estado: 'disponible', 'alquilado', 'vendido' o 'todos'.
    """
    return _consultar_inmuebles(
        tipo=tipo, ciudad=ciudad, max_precio=max_precio, estado=estado
    )


@server.tool()
def obtener_detalle_inmueble(codigo_inmueble: str) -> str:
    """Obtiene la ficha técnica detallada de una propiedad específica.

    Parámetros:
    - codigo_inmueble: Código del inmueble (ej: 'INM-001', 'INM-002', 'INM-003').
    """
    return _obtener_detalle_inmueble(codigo_inmueble=codigo_inmueble)


@server.tool()
def consultar_estado_contrato(id_contrato: str) -> str:
    """Consulta el estado del contrato, avance de firmas digitales y condiciones económicas.

    Verifica la estampa de firma de Habitat Capital como arrendador/vendedor,
    del arrendatario/comprador y de los codeudores registrados.

    Parámetros:
    - id_contrato: Identificador del contrato (ej: 'CTR-2026-001', 'CTR-2026-002').
    """
    return _consultar_estado_contrato(id_contrato=id_contrato)


@server.tool()
def verificar_integridad_contrato(id_contrato: str) -> str:
    """Valida la integridad criptográfica SHA-256 y cumplimiento de la Ley 527 de 1999 (Colombia).

    Comprueba que el documento digital, sus cláusulas y las firmas electrónicas no han
    sido alterados ni vulnerados después de su expedición.

    Parámetros:
    - id_contrato: Identificador del contrato a auditar (ej: 'CTR-2026-001').
    """
    return _verificar_integridad_contrato(id_contrato=id_contrato)


@server.tool()
def calcular_canon_sugerido(
    area_m2: float,
    estrato: int = 4,
    tipo: str = "apartamento",
    barrio: str = "Laureles",
) -> str:
    """Estima el canon mensual sugerido y parámetros de rentabilidad de una propiedad.

    Aplica la Ley 820 de 2003 (límite del 1% del valor comercial) e índices de mercado
    por metro cuadrado para el Valle de Aburrá.

    Parámetros:
    - area_m2: Superficie en m2 (ej: 85.5).
    - estrato: Estrato socioeconómico (1 al 6).
    - tipo: 'apartamento', 'casa', 'apartaestudio' u 'oficina'.
    - barrio: Sector o barrio de referencia (ej: 'El Poblado', 'Laureles', 'Envigado').
    """
    return _calcular_canon_sugerido(
        area_m2=area_m2, estrato=estrato, tipo=tipo, barrio=barrio
    )


def main() -> None:
    """Punto de entrada para ejecución como proceso stdio."""
    # server.run() utiliza transporte stdio por defecto en mcp 2.x
    server.run()


if __name__ == "__main__":
    main()
