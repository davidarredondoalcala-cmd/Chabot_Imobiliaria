# -*- coding: utf-8 -*-
"""Suite de pruebas unitarias y de integración para el servidor y cliente MCP de Habitat Capital.

Verifica:
1. Registro de herramientas en el servidor MCPServer.
2. Formato y esquema de datos devueltos por cada herramienta.
3. Validación criptográfica bajo Ley 527 de 1999.
4. Conexión e integración end-to-end del cliente stdio.
"""

from __future__ import annotations

import asyncio
import json
import pytest

pytest.importorskip("mcp")

from mcp_inmobiliaria.client import ejecutar_cliente_mcp
from mcp_inmobiliaria.server import server
from mcp_inmobiliaria.tools_inmobiliaria import (
    calcular_canon_sugerido,
    consultar_estado_contrato,
    consultar_inmuebles,
    obtener_detalle_inmueble,
    verificar_integridad_contrato,
)


def _obtener_nombres_herramientas() -> set[str]:
    """Obtiene el conjunto de nombres de herramientas registradas en el MCPServer."""
    herramientas = asyncio.run(server.list_tools())
    return {t.name for t in herramientas}


def test_todas_las_herramientas_estan_registradas():
    """Verifica que las 5 herramientas principales estén expuestas en el servidor."""
    herramientas_esperadas = {
        "consultar_inmuebles",
        "obtener_detalle_inmueble",
        "consultar_estado_contrato",
        "verificar_integridad_contrato",
        "calcular_canon_sugerido",
    }
    nombres_registrados = _obtener_nombres_herramientas()
    assert herramientas_esperadas.issubset(nombres_registrados)


def test_consultar_inmuebles_filtro_tipo():
    """Comprueba el filtrado de inmuebles por tipo y formato JSON válido."""
    res_str = consultar_inmuebles(tipo="apartamento")
    data = json.loads(res_str)

    assert "total_encontrados" in data
    assert "inmuebles" in data
    assert isinstance(data["inmuebles"], list)
    assert len(data["inmuebles"]) >= 1

    for inm in data["inmuebles"]:
        assert "apartamento" in inm["tipo"].lower()


def test_obtener_detalle_inmueble_existente():
    """Valida la consulta de ficha técnica para un código existente."""
    res_str = obtener_detalle_inmueble("INM-001")
    data = json.loads(res_str)

    assert data["status"] == "exito"
    assert data["inmueble"]["id"] == "INM-001"
    assert "El Poblado" in data["inmueble"]["barrio"]
    assert "propietario" in data["inmueble"]


def test_obtener_detalle_inmueble_inexistente():
    """Valida manejo defensivo para códigos de inmuebles inexistentes."""
    res_str = obtener_detalle_inmueble("INM-INEXISTENTE-999")
    data = json.loads(res_str)

    assert data["status"] == "no_encontrado"
    assert "No se encontró ningún inmueble" in data["mensaje"]


def test_consultar_estado_contrato_existente():
    """Comprueba el estado de firmas de un contrato vigente."""
    res_str = consultar_estado_contrato("CTR-2026-001")
    data = json.loads(res_str)

    assert data["status"] == "exito"
    assert data["id_contrato"] == "CTR-2026-001"
    assert data["progreso_firmas"]["firmas_completadas"] == 3
    assert data["progreso_firmas"]["listo_para_entrega"] is True
    assert data["firmantes"]["arrendador_inmobiliaria"]["firmado"] is True
    assert data["firmantes"]["arrendatario"]["firmado"] is True


def test_verificar_integridad_contrato_ley_527():
    """Valida la auditoría pericial criptográfica SHA-256 según Ley 527 de 1999."""
    res_str = verificar_integridad_contrato("CTR-2026-001")
    data = json.loads(res_str)

    assert data["status"] == "exito"
    assert data["integridad_confirmada"] is True
    assert data["algoritmo"] == "SHA-256"
    assert "Ley 527" in data["marco_legal"]
    assert len(data["hash_documento"]) == 64


def test_calcular_canon_sugerido():
    """Verifica el algoritmo de estimación financiera de canon."""
    res_str = calcular_canon_sugerido(
        area_m2=80.0, estrato=4, tipo="apartamento", barrio="Laureles"
    )
    data = json.loads(res_str)

    assert "canon_sugerido_cop" in data
    assert data["canon_sugerido_cop"] > 0
    assert "rango_mercado_cop" in data
    assert data["rango_mercado_cop"]["minimo"] < data["canon_sugerido_cop"]
    assert data["rango_mercado_cop"]["maximo"] > data["canon_sugerido_cop"]
    assert "Ley 820" in data["normativa_aplicable"]


def test_invocacion_directa_server_call_tool():
    """Verifica que el servidor MCPServer responda invocaciones mediante call_tool."""
    res = asyncio.run(
        server.call_tool(
            "calcular_canon_sugerido",
            {"area_m2": 50.0, "estrato": 3, "tipo": "apartaestudio", "barrio": "Laureles"},
        )
    )
    assert res.content and len(res.content) > 0
    texto = getattr(res.content[0], "text", str(res.content[0]))
    data = json.loads(texto)
    assert data["parametros"]["area_m2"] == 50.0


def test_cliente_mcp_integracion_stdio():
    """Prueba de integración end-to-end: Cliente stdio conecta y recibe herramientas."""
    res = asyncio.run(ejecutar_cliente_mcp(verbose=False))
    assert len(res["herramientas_descubiertas"]) == 5
    assert "consultar_inmuebles" in res["invocaciones"]
    assert "verificar_integridad_contrato" in res["invocaciones"]
