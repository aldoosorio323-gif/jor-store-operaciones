# Plan de implementación

El proyecto avanza por etapas cerradas. Cada etapa empieza solo por solicitud expresa, ejecuta lint/typecheck/pruebas/build y se detiene al cumplir sus criterios.

## Etapa 0 — Arquitectura e inicialización

- **Objetivo:** crear la base Next.js y definir decisiones antes de implementar negocio.
- **Entregables:** proyecto compilable, estructura, `AGENTS.md`, README, modelo de datos, arquitectura, seguridad, reglas de inventario, migración Excel y este plan.
- **Dependencias:** repositorio y rama `desarrollo`; Node/npm.
- **Riesgos:** diseñar de más sin validar operación real; filtrar archivos privados; acoplarse prematuramente a producción.
- **Aceptación:** proyecto raíz con TypeScript estricto; comandos de calidad aprobados; un commit en `desarrollo`; sin Supabase/Netlify reales ni datos sensibles.

## Etapa 1 — Autenticación y roles

- **Objetivo:** acceso privado y autorización base.
- **Estado:** completada y validada con Supabase real; migraciones 001 y 002 aplicadas.
- **Entregables:** migraciones `roles`/`profiles`/auditoría mínima, sesión SSR, login, logout, recuperación, administración controlada de usuarios, RLS, pruebas unitarias/estáticas y guion reproducible de políticas.
- **Dependencias:** Etapa 0; credenciales de desarrollo entregadas fuera de Git.
- **Riesgos:** exponer `service_role`, signup público, bucles de sesión, políticas demasiado amplias.
- **Aceptación:** código y build aprobados sin secretos; migraciones aplicadas y conexión real verificada; pruebas SQL de roles disponibles para repetición controlada.

## Etapa 2 — Productos, variantes y almacenes

- **Objetivo:** administrar catálogos que definen la granularidad de inventario.
- **Estado:** implementada en código; migración 003 pendiente de revisión y aplicación remota manual. Las pruebas SQL de Etapa 2 no se ejecutan hasta aplicar esa migración.
- **Entregables:** productos, variantes/SKU, almacenes, ubicaciones y proveedores; validaciones Zod; UI móvil; migraciones/RLS/pruebas.
- **Dependencias:** autenticación/roles.
- **Riesgos:** SKU duplicados, desactivar catálogos usados, ubicaciones ambiguas.
- **Aceptación:** CRUD autorizado sin borrado destructivo; SKU/códigos/barcode/tax_id únicos según alcance; relaciones inmutables; padres no se desactivan con hijos activos; UI móvil, paginación, auditoría, RLS y pruebas estáticas implementadas.

## Etapa 3 — Compras, reposición y movimientos

- **Objetivo:** ingresar stock con costo histórico y establecer el libro mayor.
- **Entregables:** compras/detalles, confirmación y recepción transaccional, balances, movimientos inmutables, costo promedio, transferencias, ajustes y pruebas de concurrencia.
- **Dependencias:** Etapas 1–2.
- **Riesgos:** stock negativo, doble recepción, costo incorrecto, deadlocks, movimientos sin balance.
- **Aceptación:** ninguna escritura directa de stock; operaciones atómicas e idempotentes; transferencia con salida/entrada; reconstrucción de balance conciliada.

## Etapa 4 — Clientes, pedidos, pagos y reservas

- **Objetivo:** gestionar ventas sin mezclar estados comerciales, financieros y logísticos.
- **Entregables:** clientes, pedidos/detalles, reserva/liberación/despacho, pagos, saldos, devoluciones y vistas móviles.
- **Dependencias:** inventario transaccional de Etapa 3.
- **Riesgos:** doble venta, exceso de pago, PII expuesta, cancelación posterior al despacho.
- **Aceptación:** confirmación concurrente segura; estados independientes; pedido entregado puede conservar deuda; cancelaciones/devoluciones generan movimientos correctos.

## Etapa 5 — Envíos, gastos y dashboard

- **Objetivo:** completar seguimiento operativo y visibilidad gerencial.
- **Entregables:** envíos y eventos, gastos/categorías, indicadores y dashboard responsive con consultas agregadas autorizadas.
- **Dependencias:** pedidos/pagos; catálogos e inventario.
- **Riesgos:** métricas costosas, mezclar fecha UTC/local, revelar datos por agregados.
- **Aceptación:** estados de envío separados; gastos auditados; métricas conciliadas en PEN y `America/Lima`; rendimiento medido.

## Etapa 6 — Importación y exportación de Excel

- **Objetivo:** migrar y compartir datos de forma administrativa, sin convertir Excel en base de datos.
- **Entregables:** plantillas/versiones, staging, validación ExcelJS, simulación, idempotencia, reporte de rechazos, conciliación y exportaciones autorizadas.
- **Dependencias:** esquema estable y reglas de todas las áreas importadas.
- **Riesgos:** datos reales en Git/logs, fechas inventadas, duplicados, fórmulas maliciosas, archivos grandes.
- **Aceptación:** lote repetido no duplica; filas inválidas no contaminan datos; conciliación aprobada; archivos privados y temporales controlados.

## Etapa 7 — PWA, pruebas finales y despliegue

- **Objetivo:** robustecer la experiencia móvil y desplegar de manera segura.
- **Entregables:** manifest/iconos, estrategia de caché segura, pruebas E2E/carga/seguridad, observabilidad, backups, configuración Netlify y runbook de despliegue/rollback.
- **Dependencias:** módulos funcionales y entorno de producción aprobado.
- **Riesgos:** caché de PII, mutaciones offline, secretos de producción, migración irreversible.
- **Aceptación:** sin operaciones críticas offline; auditoría y restauración ensayadas; checklist de seguridad aprobado; despliegue reproducible y rollback documentado.

## Regla transversal de salida

Cada etapa debe incluir migraciones revisadas, RLS cuando aplique, pruebas del dominio, documentación actualizada, datos ficticios, revisión de secretos y los cuatro comandos de calidad aprobados. No se adelantan entregables de la siguiente etapa.
