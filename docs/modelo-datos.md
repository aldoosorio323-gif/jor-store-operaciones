# Modelo relacional

## Convenciones generales

- PostgreSQL en Supabase; claves primarias UUID con `gen_random_uuid()` salvo catálogos pequeños.
- Nombres en `snake_case`; importes `numeric(14,2)` y costos unitarios `numeric(14,4)`, nunca `float`.
- Cantidades `numeric(14,3)` para admitir futuras unidades fraccionables, con validación adicional según unidad.
- Instantes `timestamptz` guardados en UTC y presentados en `America/Lima`; fechas comerciales sin hora usan `date`.
- Moneda predeterminada y permitida inicialmente: `PEN`.
- Borrado lógico mediante `is_active`/estado cuando haya historial. Movimientos y auditoría son append-only.
- Todas las tablas expuestas tendrán RLS y denegarán acceso anónimo.
- Campos de auditoría estándar cuando corresponda: `created_at`, `updated_at`, `created_by`, `updated_by`. Los actores referencian `profiles.id`; triggers de servidor gestionan `updated_at`.

## Estados y tipos cerrados

Se implementarán como enums PostgreSQL o tablas catálogo cuando se necesite configuración. Toda transición se valida en funciones, no solo mediante pertenencia al enum.

- `role_code`: `administrator`, `operator`.
- `purchase_status`: `draft`, `confirmed`, `partially_received`, `received`, `cancelled`.
- `order_status`: `draft`, `new`, `confirmed`, `preparing`, `shipped`, `delivered`, `cancelled`, `returned`.
- `order_payment_status`: `pending`, `partial`, `paid`, `refunded`, `cancelled`.
- `payment_status`: `pending`, `paid`, `refunded`, `cancelled`; `partial` es el estado agregado del pedido cuando los pagos netos no cubren el total.
- `shipment_status`: `pending`, `preparing`, `dispatched`, `in_transit`, `delivered`, `failed`, `returned`.
- `transfer_status`: `draft`, `confirmed`, `in_transit`, `partially_received`, `received`, `cancelled`.
- `movement_type`: `purchase_entry`, `sale_reservation`, `sale_dispatch`, `reservation_release`, `customer_return`, `supplier_return`, `transfer_out`, `transfer_in`, `positive_adjustment`, `negative_adjustment`, `damaged`, `lost`, `initial_stock`.
- `payment_method`: `cash`, `bank_transfer`, `card`, `digital_wallet`, `other`.
- `expense_status`: `draft`, `confirmed`, `cancelled`.
- `location_type`: `storage`, `picking`, `quarantine`, `in_transit` (implementado en Etapa 2).

Pedido, pago y envío son estados independientes. Por ejemplo, un pedido `delivered` puede conservar `order_payment_status = partial`, mientras su envío está `delivered`.

## Entidades

### `roles`

- **Propósito:** catálogo de roles autorizables.
- **PK:** `id uuid`.
- **Campos:** `code text`, `name text`, `description text`, `is_active boolean`.
- **FK:** auditoría a `profiles` cuando ya exista; durante bootstrap puede ser nula.
- **Restricciones:** `code` único, no vacío e inmutable una vez usado; solo códigos aprobados inicialmente.
- **Índices:** único `roles(code)`; parcial por `is_active` si el volumen lo justifica.
- **Auditoría:** campos estándar.
- **Relaciones:** uno a muchos con `profiles`.

### `profiles`

- **Propósito:** datos operativos y rol de cada identidad Supabase.
- **PK:** `id uuid`, igual a `auth.users.id`.
- **Campos:** `role_id`, `display_name`, `is_active`, `last_login_at`.
- **FK:** `id → auth.users(id) ON DELETE RESTRICT`; `role_id → roles(id) RESTRICT`; actores → `profiles(id) SET NULL`. Se usa `RESTRICT` porque retirar acceso se hace con `is_active`, no borrando identidades con historial.
- **Restricciones:** nombre no vacío; un usuario inactivo no puede operar aunque su sesión aún exista. Los perfiles creados desde Auth nacen inactivos y con rol operador hasta una activación controlada.
- **Índices:** `role_id`, parcial `is_active = true`.
- **Auditoría:** campos estándar; no duplicar contraseña, token ni datos internos de Auth.
- **Relaciones:** actor/creador de la mayoría de entidades y movimientos.

### `products`

- **Propósito:** producto comercial común a sus variantes.
- **PK:** `id uuid`.
- **Campos:** `name`, `description`, `brand`, `category`, `unit_code`, `is_active`.
- **FK:** actores de auditoría → `profiles`.
- **Restricciones:** `name` y `unit_code` no vacíos; unidad normalizada en mayúsculas; sin DELETE; no puede desactivarse mientras tenga variantes activas.
- **Índices:** búsqueda normalizada por nombre; `category`; parcial por activos.
- **Auditoría:** campos estándar.
- **Relaciones:** uno a muchos con `product_variants`.

### `product_variants`

- **Propósito:** unidad vendible/inventariable, como color o presentación.
- **PK:** `id uuid`.
- **Campos:** `product_id`, `sku`, `name`, `color`, `attributes jsonb`, `barcode`, `sale_price numeric(14,2)`, `is_active`.
- **FK:** `product_id → products(id) RESTRICT`; actores → `profiles`.
- **Restricciones:** `sku` único sin distinguir mayúsculas, normalizado en mayúsculas y no vacío; precio no negativo; `attributes` debe ser objeto; barcode único cuando exista; `product_id` inmutable; una variante activa exige producto activo; sin DELETE.
- **Índices:** únicos por `upper(sku)` y barcode no nulo; `product_id`; búsqueda por nombre/color.
- **Auditoría:** campos estándar.
- **Relaciones:** muchos balances, movimientos, ítems de compra/pedido/transferencia.

### `warehouses`

- **Propósito:** almacén físico o lógico autorizado.
- **PK:** `id uuid`.
- **Campos:** `code`, `name`, `description`, `address`, `is_active`.
- **FK:** actores → `profiles`.
- **Restricciones:** código único sin distinguir mayúsculas, normalizado en mayúsculas y no vacío; sin DELETE; no puede desactivarse mientras tenga ubicaciones activas.
- **Índices:** único `upper(code)`; parcial por activos.
- **Auditoría:** campos estándar.
- **Relaciones:** uno a muchos con ubicaciones, balances, movimientos y transferencias.

### `warehouse_locations`

- **Propósito:** posición interna inventariable dentro de un almacén.
- **PK:** `id uuid`.
- **Campos:** `warehouse_id`, `code`, `name`, `location_type` (`storage`, `picking`, `quarantine`, `in_transit`), `is_active`.
- **FK:** `warehouse_id → warehouses(id) RESTRICT`; actores → `profiles`.
- **Restricciones:** único `(warehouse_id, upper(code))`; el mismo código puede existir en almacenes distintos; ubicación activa solo dentro de almacén activo; `warehouse_id` inmutable; sin DELETE.
- **Índices:** `warehouse_id`; único compuesto; parcial por activos.
- **Auditoría:** campos estándar.
- **Relaciones:** balances/movimientos y origen/destino de transferencias.

### `suppliers`

- **Propósito:** proveedores de compras y devoluciones.
- **PK:** `id uuid`.
- **Campos:** `code`, `business_name`, `tax_id`, `contact_name`, `email`, `phone`, `notes`, `is_active`.
- **FK:** actores → `profiles`.
- **Restricciones:** razón social no vacía; código único sin distinguir mayúsculas y normalizado; `tax_id` único cuando exista; correo validado cuando exista; sin DELETE.
- **Índices:** `upper(code)`, `tax_id` parcial, búsqueda por razón social.
- **Auditoría:** campos estándar.
- **Relaciones:** uno a muchos con `purchases`.

### `purchases`

- **Propósito:** cabecera comercial de una compra/reposición.
- **PK:** `id uuid`.
- **Campos:** `supplier_id`, `purchase_number`, `supplier_reference`, `status`, `ordered_at`, `confirmed_at`, `expected_at`, `currency_code`, `subtotal`, `tax_amount`, `total_amount`, `notes`.
- **FK:** proveedor → `suppliers`; actores y `confirmed_by` → `profiles`.
- **Restricciones:** importes no negativos; total consistente con subtotal/impuesto según regla aprobada; moneda `PEN`; referencia única por proveedor cuando exista; solo `draft` es editable comercialmente.
- **Índices:** `supplier_id`, `status`, `ordered_at desc`, único parcial `(supplier_id, supplier_reference)`.
- **Auditoría:** campos estándar más `confirmed_at/by`.
- **Relaciones:** uno a muchos con `purchase_items` y movimientos `purchase_entry`/`supplier_return`.

### `purchase_items`

- **Propósito:** variantes, cantidades y costo histórico de una compra.
- **PK:** `id uuid`.
- **Campos:** `purchase_id`, `variant_id`, `ordered_quantity`, `received_quantity`, `unit_cost`, `tax_amount`, `line_total`.
- **FK:** compra → `purchases`; variante → `product_variants`; actores → `profiles`.
- **Restricciones:** cantidades pedidas positivas; recibida entre cero y pedida salvo tolerancia explícita; costo/impuesto no negativos; único `(purchase_id, variant_id, unit_cost)` o número de línea único para permitir costos distintos.
- **Índices:** `purchase_id`, `variant_id`.
- **Auditoría:** campos estándar.
- **Relaciones:** movimientos de recepción referencian ítem y preservan costo.

### `inventory_balances`

- **Propósito:** agregado actual para acceso rápido; el libro mayor sigue siendo `inventory_movements`.
- **PK:** `id uuid`.
- **Campos:** `variant_id`, `warehouse_id`, `location_id`, `physical_stock`, `reserved_stock`, `available_stock` generado como diferencia, `average_unit_cost`, `version bigint`.
- **FK:** variante, almacén y ubicación; actores → `profiles`.
- **Restricciones:** único `(variant_id, warehouse_id, location_id)`; la ubicación debe pertenecer al almacén; físico/reservado/costo no negativos; `reserved_stock <= physical_stock`; no se escribe por API pública.
- **Índices:** único de granularidad; `(warehouse_id, location_id)`; `variant_id`; parciales para stock disponible positivo.
- **Auditoría:** campos estándar; `version` aumenta en cada mutación.
- **Relaciones:** cada cambio tiene uno o más movimientos; se agrega por ubicación → almacén → variante.

### `inventory_movements`

- **Propósito:** libro mayor inmutable de todo cambio físico o reservado.
- **PK:** `id uuid`.
- **Campos:** `movement_type`, `variant_id`, `warehouse_id`, `location_id`, `previous_physical`, `physical_delta`, `resulting_physical`, `previous_reserved`, `reserved_delta`, `resulting_reserved`, `unit_cost_snapshot`, `reason`, `occurred_at`, `idempotency_key`, `metadata jsonb`.
- **FK:** balance; variante/almacén/ubicación; `purchase_id`/`purchase_item_id`; `order_id`/`order_item_id`; `transfer_id`/`transfer_item_id`; `related_movement_id`; `responsible_user_id` → `profiles`.
- **Restricciones:** al menos un delta no cero; ecuaciones antes + delta = después; resultados no negativos y reservado ≤ físico; motivo obligatorio para ajustes/dañado/perdido; referencia compatible con tipo; idempotency key única por operación.
- **Índices:** `(variant_id, occurred_at desc)`, `(warehouse_id, location_id, occurred_at desc)`, tipo/fecha, cada FK de negocio, único `idempotency_key`.
- **Auditoría:** `created_at`, `created_by`; no `updated_at` ni políticas de update/delete.
- **Relaciones:** muchos a un balance y documento origen; correcciones apuntan al movimiento compensado.

### `inventory_transfers`

- **Propósito:** coordinar traslado entre almacenes sin ocultar tránsito.
- **PK:** `id uuid`.
- **Campos:** `transfer_number`, `origin_warehouse_id`, `destination_warehouse_id`, `status`, `confirmed_at`, `dispatched_at`, `received_at`, `notes`.
- **FK:** almacenes origen/destino; actores estándar más `confirmed_by`, `dispatched_by`, `received_by`.
- **Restricciones:** origen distinto de destino; número único; transiciones válidas; recepción no anterior al despacho.
- **Índices:** número único; estado; cada almacén; fechas descendentes.
- **Auditoría:** campos estándar y actores/instantes de hitos.
- **Relaciones:** uno a muchos con ítems y movimientos enlazados de salida/entrada.

### `inventory_transfer_items`

- **Propósito:** detalle por variante y ubicaciones de un traslado.
- **PK:** `id uuid`.
- **Campos:** `transfer_id`, `variant_id`, `origin_location_id`, `destination_location_id`, `requested_quantity`, `dispatched_quantity`, `received_quantity`.
- **FK:** transferencia, variante, ubicaciones; actores → `profiles`.
- **Restricciones:** solicitada positiva; despachada/recibida no negativas y dentro de lo permitido; ubicaciones pertenecen a almacenes de cabecera; número de línea único.
- **Índices:** `transfer_id`, `variant_id`, ubicaciones.
- **Auditoría:** campos estándar.
- **Relaciones:** movimientos `transfer_out` y `transfer_in`; admite recepción parcial.

### `customers`

- **Propósito:** datos mínimos del cliente para venta, cobro y envío.
- **PK:** `id uuid`.
- **Campos:** `customer_code`, `full_name`, `document_type`, `document_number`, `email`, `phone`, `default_address`, `notes`, `is_active`.
- **FK:** actores → `profiles`.
- **Restricciones:** nombre no vacío; documento único por tipo cuando exista; código único; validaciones de formato; evitar duplicados candidatos antes de crear.
- **Índices:** código, documento parcial, búsqueda normalizada por nombre/teléfono con acceso restringido.
- **Auditoría:** campos estándar.
- **Relaciones:** uno a muchos con pedidos; PII protegida por RLS y minimización.

### `orders`

- **Propósito:** cabecera comercial de venta, independiente de pagos y envíos.
- **PK:** `id uuid`.
- **Campos:** `order_number`, `customer_id`, `status`, `payment_status`, `currency_code`, `ordered_at`, `confirmed_at`, `cancelled_at`, `subtotal`, `discount_amount`, `tax_amount`, `total_amount`, `paid_amount`, `balance_due`, `notes`.
- **FK:** cliente; actores estándar y `confirmed_by`/`cancelled_by` → `profiles`.
- **Restricciones:** importes no negativos; total consistente; `paid_amount` derivado de pagos netos y no editable por cliente; saldo `greatest(total-paid,0)`; moneda PEN; número único; transiciones válidas.
- **Índices:** número único; `(status, ordered_at desc)`; `(payment_status, ordered_at desc)`; `customer_id`.
- **Auditoría:** campos estándar y hitos.
- **Relaciones:** ítems, pagos, envíos y movimientos de reserva/despacho/devolución.

### `order_items`

- **Propósito:** líneas vendidas con precio/costo históricos y estado de cumplimiento.
- **PK:** `id uuid`.
- **Campos:** `order_id`, `variant_id`, `warehouse_id`, `location_id`, `quantity`, `reserved_quantity`, `dispatched_quantity`, `returned_quantity`, `unit_price`, `discount_amount`, `tax_amount`, `line_total`, `unit_cost_snapshot`.
- **FK:** pedido, variante, almacén, ubicación; actores → `profiles`.
- **Restricciones:** cantidad positiva; acumulados entre cero y cantidad; precio/descuento/impuesto no negativos; ubicación pertenece al almacén; número de línea único.
- **Índices:** `order_id`, `variant_id`, `(warehouse_id, location_id)`.
- **Auditoría:** campos estándar.
- **Relaciones:** movimientos de reserva/liberación/despacho/devolución.

### `payments`

- **Propósito:** transacciones financieras aplicadas a pedidos, separadas de entrega.
- **PK:** `id uuid`.
- **Campos:** `order_id`, `payment_number`, `status`, `method`, `amount`, `paid_at`, `external_reference`, `notes`, `refunded_payment_id`.
- **FK:** pedido; pago original para reembolso; actores → `profiles`.
- **Restricciones:** importe positivo; número único; referencia externa única por método cuando exista; reembolso no excede pago neto; no borrar confirmados; `paid_at` obligatorio al pagar.
- **Índices:** `order_id`, `(status, paid_at desc)`, referencia externa parcial, pago original.
- **Auditoría:** campos estándar.
- **Relaciones:** muchos pagos por pedido; trigger/función recalcula `orders.paid_amount`, saldo y estado agregado.

### `shipments`

- **Propósito:** uno o más envíos logísticos de un pedido.
- **PK:** `id uuid`.
- **Campos:** `order_id`, `shipment_number`, `status`, `carrier`, `tracking_number`, `recipient_name`, `shipping_address`, `shipping_cost`, `prepared_at`, `dispatched_at`, `delivered_at`, `failed_at`, `notes`.
- **FK:** pedido; actores estándar y responsables de hitos → `profiles`.
- **Restricciones:** número único; costo no negativo; secuencia temporal válida; tracking único por carrier cuando exista; dirección protegida; transiciones cerradas.
- **Índices:** `order_id`, `(status, created_at desc)`, tracking parcial.
- **Auditoría:** campos estándar e hitos.
- **Relaciones:** muchos envíos por pedido; no cambia estado de pago; el despacho de stock se vincula al pedido y puede guardar shipment id en metadata/referencia futura.

### `expenses`

- **Propósito:** egresos operativos distintos de compras de inventario.
- **PK:** `id uuid`.
- **Campos:** `expense_number`, `status`, `category`, `description`, `amount`, `currency_code`, `expense_date`, `payment_method`, `supplier_id` opcional, `receipt_storage_path` opcional, `confirmed_at`.
- **FK:** proveedor opcional; actores estándar y `confirmed_by` → `profiles`.
- **Restricciones:** importe positivo; moneda PEN; descripción/categoría no vacías; ruta solo a bucket privado; confirmados se compensan/cancelan, no se eliminan.
- **Índices:** número único; `(expense_date desc, category)`; estado; proveedor.
- **Auditoría:** campos estándar y confirmación.
- **Relaciones:** proveedor opcional; cambios sensibles generan auditoría.

### `audit_logs`

- **Propósito:** evidencia append-only de operaciones sensibles y cambios de estado.
- **PK:** `id uuid`.
- **Campos:** `actor_user_id`, `action`, `entity_type`, `entity_id`, `occurred_at`, `request_id`, `ip_hash`, `user_agent_summary`, `before_data jsonb`, `after_data jsonb`, `metadata jsonb`.
- **FK:** actor → `profiles(id) SET NULL`; entidad es referencia lógica para preservar evidencia aunque cambie el esquema.
- **Restricciones:** acción/tipo no vacíos; JSON redactado sin secretos ni PII innecesaria; request ID para correlación; sin update/delete desde API.
- **Índices:** `(entity_type, entity_id, occurred_at desc)`, `(actor_user_id, occurred_at desc)`, `request_id`, `occurred_at desc`.
- **Auditoría:** `created_at`; el registro mismo es auditoría e inmutable.
- **Relaciones:** referencia lógica a cualquier entidad; se inserta en la misma transacción sensible.

Etapa 1 implementó `actor_user_id`, `action`, `target_profile_id`, `metadata` y `occurred_at`. Etapa 2 añade `entity_type` y `entity_id` sin reemplazar el historial y registra creación, actualización y cambio de estado de los cinco catálogos con resúmenes sin PII. Request/IP permanecen pendientes para una infraestructura futura.

## Implementación de Etapa 2

La migración `202607130003_catalogs.sql`, aplicada local y remotamente, crea las cinco tablas anteriores con auditoría estándar referenciada a `profiles`. Triggers privados asignan fechas y actor desde `auth.uid()`, mantienen los identificadores estables, normalizan SKU/códigos/correo y convierten opcionales vacíos a `null`. RLS permite al administrador activo leer todo y escribir; el operador activo solo lee filas activas, con producto/almacén padre activo; inactivos y anónimos no leen. No crea balances, existencias, movimientos, compras ni pedidos.

## Implementación de Etapa 3

`202607130004_purchases_inventory.sql`, pendiente de revisión y aplicación remota, materializa `purchases`, `purchase_items`, `inventory_balances`, `inventory_movements`, `inventory_transfers` e `inventory_transfer_items`. Añade secuencias privadas para `CMP-AAAA-NNNNNN` y `TRF-AAAA-NNNNNN`, y `private.inventory_commands` como estructura auxiliar no expuesta para idempotencia.

Las cantidades usan `numeric(14,3)`, los costos `numeric(14,4)` y los importes `numeric(14,2)`. Los totales de compra y línea se recalculan en PostgreSQL. El balance es único por variante/almacén/ubicación y valida mediante FK compuesta que la ubicación pertenezca al almacén. `available_stock` es generado. Los movimientos no tienen `updated_at`, rechazan UPDATE/DELETE y conservan ecuaciones de antes + delta = después.

Transiciones implementadas: compra `draft → confirmed → partially_received/received` y cancelación solo sin recepciones; transferencia `draft → confirmed → in_transit → partially_received/received` y cancelación solo antes del despacho. `supplier_return` queda reservado como tipo sin RPC ni interfaz. No existen tipos ni operaciones de venta en la migración 004.

## Relaciones principales

```text
auth.users 1—1 profiles N—1 roles
products 1—N product_variants
warehouses 1—N warehouse_locations
suppliers 1—N purchases 1—N purchase_items N—1 product_variants
product_variants × warehouses × warehouse_locations 1—1 inventory_balances
inventory_balances 1—N inventory_movements
inventory_transfers 1—N inventory_transfer_items 1—N inventory_movements
customers 1—N orders 1—N order_items
orders 1—N payments
orders 1—N shipments
orders/order_items 1—N inventory_movements
profiles 1—N entidades creadas/movimientos/audit_logs
```

## Stock y costo

- **Por variante:** todos los balances con el mismo `variant_id`.
- **Por almacén:** balances agrupados por `variant_id, warehouse_id`.
- **Por ubicación:** fila única de `inventory_balances`; es la granularidad de bloqueo.
- **Físico:** `sum(physical_stock)`; **reservado:** `sum(reserved_stock)`; **disponible:** suma de `physical - reserved`.
- **Costo promedio ponderado:** al recibir compra, por balance o política de valoración aprobada para la variante/almacén. Fórmula: `((físico_previo × costo_promedio_previo) + (entrada × costo_entrada)) / (físico_previo + entrada)`. La división por cero se evita porque una recepción es positiva. Las salidas conservan snapshot y no recalculan el promedio.
- Las vistas agregadas nunca sustituyen la validación de la ubicación bloqueada.

## Funciones y transacciones PostgreSQL

Todas reciben `idempotency_key`, obtienen `auth.uid()`, verifican rol/RLS, bloquean filas en orden determinista, escriben auditoría y revierten completamente ante error.

### Confirmar una compra

`confirm_purchase(purchase_id)` bloquea cabecera/ítems; exige estado `draft`, proveedor/variantes activas, al menos un ítem y totales consistentes. Cambia a `confirmed`, fija actor/fecha y congela datos comerciales. **No modifica stock.**

### Recibir una compra

`receive_purchase(purchase_id, lines[])` bloquea compra, ítems y balances ordenados por UUID; admite parcial sin superar lo pendiente. Por línea recalcula costo promedio, actualiza físico, inserta `purchase_entry` con antes/cambio/después y costo, incrementa recibido y actualiza estado `partially_received`/`received`.

### Crear una reserva

`reserve_order_stock(order_id)` bloquea pedido/líneas/balances. Para cada línea vuelve a calcular disponible y exige `available >= quantity_to_reserve`. Aumenta reservado, inserta `sale_reservation` y actualiza `reserved_quantity`. Es interna/idempotente; no deja reservas parciales si una línea falla.

### Confirmar un pedido

`confirm_order(order_id)` exige `draft` o `new`, cliente/variantes activas, precios/totales calculados en servidor y líneas válidas. Llama la lógica de reserva dentro de la misma transacción y pasa a `confirmed`. Pago y envío no se marcan como completados.

### Despachar un pedido

`dispatch_order(order_id, lines[])` exige reserva suficiente. Por balance reduce físico y reservado en igual cantidad, inserta `sale_dispatch` y aumenta `dispatched_quantity`; nunca descuenta solo físico. Actualiza pedido a `shipped` cuando corresponda, sin cambiar automáticamente el estado de pago.

### Cancelar un pedido

`cancel_order(order_id, reason)` bloquea pedido y balances. Si no hay despacho, reduce reservado e inserta `reservation_release`, luego cancela. Si existe despacho, rechaza la cancelación simple: debe usarse devolución. No borra pedido, pagos ni movimientos.

### Registrar una devolución

`register_customer_return(order_id, lines[], condition, reason)` verifica cantidades despachadas menos devueltas. Unidades aptas aumentan físico con `customer_return`; unidades dañadas entran a cuarentena y se clasifican sin estar disponibles. El reembolso, si existe, es una operación financiera enlazada pero separada.

### Transferir inventario

`dispatch_transfer(transfer_id)` bloquea origen, valida disponible y crea `transfer_out`; `receive_transfer(transfer_id, lines[])` bloquea destino y crea `transfer_in`. Ambas actualizan cantidades/estado e insertan auditoría. Una salida no crea entrada automática antes de confirmar recepción; la transferencia representa stock en tránsito.

### Realizar un ajuste físico

`adjust_inventory(balance_id, counted_quantity, reason)` bloquea balance, exige rol, motivo y conteo no negativo, calcula diferencia y crea `positive_adjustment` o `negative_adjustment`. Rechaza un resultado menor al reservado. Guarda antes, diferencia, resultado, actor y fecha.

### Evitar stock negativo y doble venta

- `CHECK (physical_stock >= 0 AND reserved_stock >= 0 AND reserved_stock <= physical_stock)` es la última barrera.
- `SELECT ... FOR UPDATE` serializa reservas/consumos concurrentes de la misma fila.
- Los balances se bloquean en el mismo orden global para reducir deadlocks.
- La disponibilidad se comprueba **después** del bloqueo.
- Unicidad de balance e idempotency key evita filas/comandos duplicados.
- Nivel `READ COMMITTED` con bloqueos explícitos es suficiente inicialmente; pruebas concurrentes validarán la decisión y se elevará aislamiento si aparece una invariante multi-fila no cubierta.

## Integridad, RLS y eliminación

- FKs de historial usan `RESTRICT` o `SET NULL`, nunca cascadas que borren movimientos.
- Solo datos sin historial pueden eliminarse físicamente; catálogos se desactivan.
- RPC críticas no aceptan `responsible_user_id` como autoridad: usan `auth.uid()`.
- `inventory_balances`, movimientos y totales financieros no admiten actualización directa desde clientes.
- Reconciliaciones periódicas compararán balances con suma de movimientos y pagos con saldos.
