# Reglas de inventario

## Invariantes

1. Supabase PostgreSQL es la única fuente oficial.
2. Todo stock pertenece a una variante, almacén y ubicación.
3. `stock_available = stock_physical - stock_reserved`.
4. `stock_physical >= 0`, `stock_reserved >= 0` y `stock_available >= 0` siempre.
5. Ningún balance cambia sin movimiento inmutable en la misma transacción.
6. Cada movimiento guarda antes, cambio y después para físico y/o reservado, tipo, motivo, actor, fecha y referencia relacionada.
7. Los movimientos no se editan ni eliminan desde la interfaz; se compensan.
8. Cada variante tiene SKU único y cada recepción conserva costo histórico.
9. Las operaciones críticas usan bloqueo de filas y transacciones PostgreSQL.

## Tres cantidades separadas

- **Stock físico:** unidades realmente presentes en una ubicación.
- **Stock reservado:** parte del físico comprometida con pedidos confirmados aún no despachados.
- **Stock disponible:** unidades que todavía pueden prometerse; es un valor derivado, no editable.

Ejemplo: físico 10 y reservado 3 producen disponible 7. Una reserva de 8 se rechaza incluso si el físico es 10.

## Efecto de operaciones

| Operación / tipo | Físico | Reservado | Disponible |
| --- | ---: | ---: | ---: |
| Recepción `purchase_entry` | `+q` | — | `+q` |
| Reserva `sale_reservation` | — | `+q` | `-q` |
| Despacho `sale_dispatch` | `-q` | `-q` | — |
| Liberación `reservation_release` | — | `-q` | `+q` |
| Devolución cliente apta `customer_return` | `+q` | — | `+q` |
| Devolución a proveedor `supplier_return` | `-q` | — | `-q` |
| Salida transferencia `transfer_out` | `-q` | — | `-q` |
| Entrada transferencia `transfer_in` | `+q` | — | `+q` |
| Ajuste positivo / stock inicial | `+q` | — | `+q` |
| Ajuste negativo / dañado / perdido | `-q` | — | `-q` |

No se puede retirar stock reservado con una operación distinta del despacho o liberación vinculada, salvo un procedimiento administrativo compensatorio explícito.

## Granularidad y balances

`inventory_balances` mantiene una fila por `(variant_id, warehouse_id, location_id)`. La suma de ubicaciones produce el stock del almacén; la suma de almacenes produce el stock total de la variante. Los totales de producto agregan variantes y son informativos: las decisiones siempre se validan en la granularidad real.

## Compras y costo promedio ponderado

Confirmar una compra congela sus datos comerciales, pero no aumenta stock. Recibir una cantidad crea `purchase_entry`, aumenta físico y recalcula:

`nuevo_costo_promedio = ((físico_anterior × costo_promedio_anterior) + (cantidad_recibida × costo_unitario_neto)) / (físico_anterior + cantidad_recibida)`

El costo de cada `purchase_item` se conserva. Salidas no recalculan el promedio; guardan un snapshot del costo aplicado. Devoluciones y correcciones requieren reglas contables explícitas y movimientos compensatorios.

## Reservas y pedidos

- Un borrador no reserva.
- Confirmar un pedido reserva cada línea en una sola transacción.
- Se bloquean balances en orden determinista y se comprueba disponible antes de cambiar nada.
- Despachar consume físico y la reserva correspondiente.
- Cancelar antes del despacho libera reserva; después exige devolución, no un cambio retroactivo.
- Operaciones repetidas usan clave idempotente para no duplicar reservas o despachos.

## Transferencias

1. Crear borrador con origen y destino diferentes.
2. Al despachar, validar stock disponible y registrar `transfer_out` en origen.
3. El stock puede quedar en tránsito en la transferencia; no aparece en destino hasta recepción.
4. Al recibir, registrar `transfer_in` por cantidad aceptada y ubicación destino.
5. Salida y entrada se enlazan con transferencia e ítem. Diferencias exigen incidencia/ajuste documentado.
6. La operación completa nunca es una edición directa entre dos balances.

## Devoluciones

- Cliente: validar pedido, línea, cantidad previamente despachada y cantidad ya devuelta. Inspeccionar condición. Solo unidades aptas vuelven a físico vendible; dañadas ingresan a ubicación de cuarentena y se clasifican con movimiento apropiado.
- Proveedor: exige referencia a compra/recepción, cantidad disponible no reservada y autorización; genera `supplier_return`.
- Dinero, estado de pedido y stock se coordinan, pero siguen siendo conceptos separados.

## Ajustes físicos

- Un conteo registra cantidad contada y evidencia; no sobrescribe silenciosamente el balance.
- La diferencia genera `positive_adjustment` o `negative_adjustment`.
- Exige motivo, actor, fecha, antes, cambio y después.
- Un ajuste negativo no puede invadir reservas. Primero se resuelve la discrepancia o se liberan/reasignan reservas mediante procedimiento autorizado.
- Ajustes de alto impacto pueden requerir aprobación administrativa en una etapa futura.

## Prevención de negativos y doble venta

- Restricciones `CHECK` impiden físicos/reservados negativos y `reserved > physical`.
- Funciones críticas usan `SELECT ... FOR UPDATE` sobre balances, siempre en orden estable.
- Cada transacción vuelve a comprobar disponible después de adquirir el bloqueo.
- Índice único garantiza una sola fila de balance por granularidad.
- Idempotency key única evita procesar dos veces el mismo comando.
- Un fallo revierte balance, movimientos, referencias y auditoría en conjunto.

## Historial

`inventory_movements` es un libro mayor append-only. Guarda snapshots de cantidades y costo, referencias a compra/pedido/transferencia, usuario, motivo, metadatos mínimos y `occurred_at`. Un saldo puede reconstruirse sumando movimientos y compararse con el balance agregado. Correcciones posteriores referencian el movimiento original y nunca alteran su evidencia.

## Alcance implementado en Etapa 3

- La migración 004 está implementada en código y pendiente de aplicación remota.
- `private.apply_inventory_movement` es el único punto que cambia físico, preserva reservado, incrementa versión y escribe el movimiento.
- Recepciones de compra, despacho/recepción de transferencia y ajustes usan claves idempotentes; el mismo actor, operación y payload recuperan el resultado, mientras un payload distinto se rechaza.
- Los bloqueos se toman después de bloquear documento/línea; operaciones multilínea ordenan ubicación, variante e ítem. Cualquier fallo revierte documento, balances, movimientos y auditoría.
- Antes de modificar un balance se bloquean con `FOR SHARE`, en orden fijo, producto, variante, almacén y ubicación. Así una desactivación concurrente espera a que el movimiento confirme o revierta.
- Una variante o ubicación no puede desactivarse si conserva stock físico/reservado o participa en una transferencia abierta; una variante tampoco puede desactivarse con recepción de compra pendiente. El almacén conserva la regla de desactivar primero sus ubicaciones y añade protección defensiva ante stock o transferencias abiertas.
- El libro mayor enlaza de forma compuesta cada movimiento con la identidad completa de su balance y, cuando corresponde, con la compra/línea o transferencia/línea exactas.
- El costo promedio se redondea a cuatro decimales. Entradas de compra, transferencia, stock inicial y ajustes positivos recalculan; las salidas conservan el promedio y guardan snapshot.
- `reserved_stock` existe, inicia en cero y no tiene operación pública en esta etapa. Reservas y ventas pertenecen a Etapa 4.
- `supplier_return` está reservado en el enum, sin flujo ni interfaz hasta definir su regla contable.
- `admin_inventory_reconciliation()` compara saldos con sumas de movimientos y reporta balances inválidos o movimientos huérfanos; solo un administrador activo puede ejecutarla.

`supabase/tests/rls_inventory.sql` usa perfiles y datos ficticios y termina en `ROLLBACK`. No se ejecutó en remoto porque la migración 004 aún no está aplicada; tampoco se declara concurrencia real sin dos conexiones SQL independientes.
