# Habitat Capital · Servidor y Cliente MCP (Model Context Protocol)

Este módulo implementa la arquitectura oficial de **Model Context Protocol (MCP)** para el sistema de **Habitat Capital / Inmobiliaria Software**, siguiendo el estándar de la especificación MCP v2 y el patrón de diseño del módulo de referencia de software engineering (`aras-main`).

---

## 1. ¿Qué es MCP y por qué se implementa?

**Model Context Protocol (MCP)** es un protocolo abierto estandarizado que permite a modelos de lenguaje (LLM), agentes de IA y clientes externos conectarse de manera segura y controlada a herramientas, datos y sistemas empresariales.

En **Habitat Capital**, MCP resuelve la necesidad de:
1. **Acceso Seguro con Mínimo Privilegio:** Exponer únicamente las herramientas inmobiliarias y contractuales necesarias sin dar acceso irrestricto a la base de datos o al sistema de archivos del servidor.
2. **Descubrimiento Dinámico:** Permitir que cualquier agente descubra automáticamente qué funciones están disponibles (`session.list_tools()`) junto con su documentación y esquema JSON de parámetros.
3. **Auditoría Pericial Digital:** Validar estados contractuales y firmas electrónicas bajo la **Ley 527 de 1999 de Colombia** con integridad SHA-256.

```
+--------------------------------------------------------------------------------+
|                         ARQUITECTURA MCP HABITAT CAPITAL                       |
+--------------------------------------------------------------------------------+
|                                                                                |
|   +-----------------------+                    +---------------------------+   |
|   |      HOST / AGENTE    |                    |     MCP SERVER            |   |
|   |  (Antigravity / LLM / |                    |  (mcp_inmobiliaria.server)|   |
|   |    Claude / Python)   |                    +-------------+-------------+   |
|   +-----------+-----------+                                  |                 |
|               |                                              |                 |
|               v                                              v                 |
|   +-----------------------+     stdio (JSON-RPC 2.0)   +-------------+---------+
|   |      MCP CLIENT       | <========================> | HERRAMIENTAS DE       |
|   | (mcp_inmobiliaria.    |  - initialize()            | NEGOCIO:              |
|   |         client)       |  - list_tools()            | 1. consultar_inmuebles|
|   +-----------------------+  - call_tool()             | 2. obtener_detalle    |
|                                                        | 3. estado_contrato    |
|                                                        | 4. verificar_ley_527  |
|                                                        | 5. calcular_canon     |
|                                                        +-------------+---------+
|                                                                      |         |
|                                                                      v         |
|                                                        +---------------------+ |
|                                                        | BACKEND REST / DB   | |
|                                                        | (Habitat Capital)   | |
|                                                        +---------------------+ |
+--------------------------------------------------------------------------------+
```

---

## 2. Catálogo de Herramientas Expuestas (Tools)

| Herramienta | Parámetros | Propósito |
| :--- | :--- | :--- |
| `consultar_inmuebles` | `tipo`, `ciudad`, `max_precio`, `estado` | Búsqueda y filtrado de inmuebles con datos de canon, área, estrato y ubicación. |
| `obtener_detalle_inmueble` | `codigo_inmueble` (ej: `'INM-001'`) | Ficha técnica completa, comodidades, amenidades y titularidad de Habitat Capital. |
| `consultar_estado_contrato` | `id_contrato` (ej: `'CTR-2026-001'`) | Estado de firmas de arrendador (inmobiliaria), arrendatario y codeudores, canon y día de pago. |
| `verificar_integridad_contrato`| `id_contrato` (ej: `'CTR-2026-001'`) | Verificación pericial de no repudio y cadena criptográfica SHA-256 bajo Ley 527 de 1999. |
| `calcular_canon_sugerido` | `area_m2`, `estrato`, `tipo`, `barrio` | Algoritmo financiero de canon por m2, administración y rentabilidad según Ley 820 de 2003. |

---

## 3. Requisitos e Instalación

Requiere **Python 3.10+** (probado y certificado en Python 3.14).

Instalar dependencias necesarias:
```bash
py -m pip install -r mcp_inmobiliaria/requirements.txt
```

---

## 4. Ejecución del Servidor MCP

El servidor se ejecuta a través de transporte estándar `stdio`:
```bash
py -m mcp_inmobiliaria.server
```
El servidor esperará comandos JSON-RPC 2.0 por su entrada estándar (`stdin`) y responderá por su salida estándar (`stdout`).

---

## 5. Ejecución del Cliente MCP de Demostración

El cliente lanza el servidor como subproceso, inicializa la sesión, descubre todas las herramientas y ejecuta un ciclo de prueba demostrativo con salida formateada:
```bash
py -m mcp_inmobiliaria.client
```

---

## 6. Ejecución de la Suite de Pruebas Automatizadas

El proyecto incluye 9 pruebas unitarias y de integración desarrolladas con `pytest`:
```bash
py -m pytest mcp_inmobiliaria/test_mcp.py -v
```

Resultado verificado:
```text
mcp_inmobiliaria/test_mcp.py::test_todas_las_herramientas_estan_registradas PASSED
mcp_inmobiliaria/test_mcp.py::test_consultar_inmuebles_filtro_tipo PASSED
mcp_inmobiliaria/test_mcp.py::test_obtener_detalle_inmueble_existente PASSED
mcp_inmobiliaria/test_mcp.py::test_obtener_detalle_inmueble_inexistente PASSED
mcp_inmobiliaria/test_mcp.py::test_consultar_estado_contrato_existente PASSED
mcp_inmobiliaria/test_mcp.py::test_verificar_integridad_contrato_ley_527 PASSED
mcp_inmobiliaria/test_mcp.py::test_calcular_canon_sugerido PASSED
mcp_inmobiliaria/test_mcp.py::test_invocacion_directa_server_call_tool PASSED
mcp_inmobiliaria/test_mcp.py::test_cliente_mcp_integracion_stdio PASSED
============================== 9 passed in 5.18s ==============================
```

---

## 7. Configuración en Clientes Externos (Claude Desktop / Cursor / Antigravity)

Para registrar este servidor en un cliente MCP compatible (por ejemplo, en el archivo de configuración `claude_desktop_config.json` o configuración de IDE):

```json
{
  "mcpServers": {
    "habitat-capital": {
      "command": "py",
      "args": [
        "-m",
        "mcp_inmobiliaria.server"
      ],
      "cwd": "c:\\Users\\david\\Documents\\Universidad\\6to smestre\\Ingenieria de Soft\\Proyecto\\Proyecto_Ing_Software-main\\Proyecto_Ing_Software-main\\Inombiliaria_Software"
    }
  }
}
```

---

## 8. Seguridad y Principio de Mínimo Privilegio

En cumplimiento con los estándares de ingeniería de software:
1. **Mínimo Privilegio:** Ninguna herramienta tiene permisos para ejecutar comandos arbitrarios de sistema o alterar archivos del servidor backend.
2. **Sanitización de Entradas:** Todas las herramientas validan y limpian parámetros contra inyecciones antes de consultar cualquier recurso.
3. **Resiliencia Operativa:** Las herramientas integran fallback local para garantizar disponibilidad ininterrumpida ante eventuales fallos de conectividad con APIs externas.
