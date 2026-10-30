# -*- coding: utf-8 -*-
"""Cliente MCP (Model Context Protocol) para Habitat Capital.

Este cliente se conecta mediante el protocolo MCP estándar (transporte stdio)
al servidor `mcp_inmobiliaria.server` y realiza:
1. Negociación e inicialización de sesión (`session.initialize()`).
2. Descubrimiento dinámico del catálogo de herramientas (`session.list_tools()`).
3. Invocación controlada de herramientas con paso de argumentos tipados (`session.call_tool()`).
4. Presentación estructurada de los resultados periciales y de negocio.

Ejecución:
    py -m mcp_inmobiliaria.client
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import Any, Dict, Optional

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


def _separador(titulo: str = "", caracter: str = "=", ancho: int = 70) -> str:
    """Genera una barra divisoria estética para consola."""
    if not titulo:
        return caracter * ancho
    mitad = (ancho - len(titulo) - 2) // 2
    return f"{caracter * max(mitad, 2)} {titulo} {caracter * max(mitad, 2)}"


async def ejecutar_cliente_mcp(verbose: bool = True) -> Dict[str, Any]:
    """Inicia el cliente MCP, descubre las herramientas y ejecuta pruebas de demostración.

    Args:
        verbose: Si es True, imprime resultados formateados en consola.

    Returns:
        Diccionario con el resumen de herramientas y respuestas obtenidas.
    """
    # Configurar parámetros del subproceso servidor usando el mismo ejecutable de Python
    ruta_modulo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env = dict(os.environ)
    # Asegurar que PYTHONPATH incluya la raíz del proyecto para importar mcp_inmobiliaria
    env["PYTHONPATH"] = (
        f"{ruta_modulo}{os.pathsep}{env.get('PYTHONPATH', '')}"
        if "PYTHONPATH" in env
        else ruta_modulo
    )

    parametros = StdioServerParameters(
        command=sys.executable,
        args=["-m", "mcp_inmobiliaria.server"],
        env=env,
    )

    resultados_ejecucion: Dict[str, Any] = {
        "herramientas_descubiertas": [],
        "invocaciones": {},
    }

    if verbose:
        print(_separador("HABITAT CAPITAL · MODEL CONTEXT PROTOCOL (MCP CLIENT)"))
        print(f"[*] Conectando con servidor MCP vía stdio...")
        print(f"[*] Intérprete: {sys.executable}")
        print(f"[*] Servidor: mcp_inmobiliaria.server\n")

    async with stdio_client(parametros) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            # 1. Inicializar sesión MCP
            await session.initialize()
            if verbose:
                print("[+] Sesión MCP inicializada exitosamente.\n")

            # 2. Descubrir catálogo de herramientas
            herramientas_resp = await session.list_tools()
            herramientas = herramientas_resp.tools
            resultados_ejecucion["herramientas_descubiertas"] = [
                {"name": t.name, "description": t.description} for t in herramientas
            ]

            if verbose:
                print(_separador("1. CATÁLOGO DE HERRAMIENTAS DESCUBIERTAS"))
                print(f"Total de herramientas disponibles: {len(herramientas)}\n")
                for i, tool in enumerate(herramientas, start=1):
                    desc = tool.description or "Sin descripción"
                    print(f"  {i}. {tool.name}")
                    print(f"     Descripción: {desc}")
                print()

            # 3. Demostración de Invocaciones de Negocio
            pruebas = [
                (
                    "consultar_inmuebles",
                    {
                        "tipo": "apartamento",
                        "ciudad": "Medellín",
                        "max_precio": 4500000.0,
                        "estado": "disponible",
                    },
                    "Consulta filtrada de apartamentos en arriendo en Medellín",
                ),
                (
                    "obtener_detalle_inmueble",
                    {"codigo_inmueble": "INM-001"},
                    "Ficha técnica detallada del inmueble 'INM-001' (El Poblado)",
                ),
                (
                    "consultar_estado_contrato",
                    {"id_contrato": "CTR-2026-001"},
                    "Auditoría del contrato CTR-2026-001 (Firmas arrendador y codeudores)",
                ),
                (
                    "verificar_integridad_contrato",
                    {"id_contrato": "CTR-2026-001"},
                    "Certificación de integridad criptográfica SHA-256 (Ley 527 de 1999)",
                ),
                (
                    "calcular_canon_sugerido",
                    {
                        "area_m2": 110.0,
                        "estrato": 5,
                        "tipo": "apartamento",
                        "barrio": "Ciudad del Río",
                    },
                    "Cálculo de canon sugerido y rentabilidad para 110 m2 en Ciudad del Río",
                ),
            ]

            if verbose:
                print(_separador("2. DEMOSTRACIÓN DE INVOCACIONES (CALL TOOL)"))

            for nombre_herramienta, argumentos, titulo_prueba in pruebas:
                if verbose:
                    print(f"\n---> Invocando '{nombre_herramienta}'")
                    print(f"     Propósito : {titulo_prueba}")
                    print(f"     Argumentos: {json.dumps(argumentos, ensure_ascii=False)}")

                respuesta = await session.call_tool(nombre_herramienta, argumentos)
                contenido_texto = ""
                if respuesta.content and len(respuesta.content) > 0:
                    contenido_texto = getattr(respuesta.content[0], "text", str(respuesta.content[0]))

                # Intentar parsear como JSON para reporte limpio
                try:
                    parsed = json.loads(contenido_texto)
                except Exception:
                    parsed = contenido_texto

                resultados_ejecucion["invocaciones"][nombre_herramienta] = parsed

                if verbose:
                    print("     Resultado:")
                    if isinstance(parsed, dict) or isinstance(parsed, list):
                        formateado = json.dumps(parsed, ensure_ascii=False, indent=2)
                        for linea in formateado.splitlines()[:15]:
                            print(f"       {linea}")
                        if len(formateado.splitlines()) > 15:
                            print(f"       ... [se omitieron {len(formateado.splitlines()) - 15} líneas]")
                    else:
                        print(f"       {contenido_texto}")

            if verbose:
                print("\n" + _separador("DEMOSTRACIÓN FINALIZADA CON ÉXITO"))

    return resultados_ejecucion


def main() -> None:
    """Función de arranque para CLI."""
    try:
        asyncio.run(ejecutar_cliente_mcp(verbose=True))
    except KeyboardInterrupt:
        print("\n[!] Cliente interrumpido por el usuario.")
    except Exception as exc:
        print(f"\n[X] Error durante la ejecución del cliente MCP: {exc}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
