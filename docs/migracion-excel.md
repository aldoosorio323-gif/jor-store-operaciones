# Estrategia futura de migración desde Excel

Excel será una fuente de importación controlada y nunca la base de datos. La migración real pertenece a la Etapa 6 y no se ejecuta durante la Etapa 0.

## Principios

- Trabajar con una copia privada, de solo lectura y fuera de Git.
- Conservar el archivo original sin modificar y registrar su hash, fecha de recepción y responsable.
- No inventar fechas, estados, cantidades, clientes ni valores faltantes.
- Toda transformación debe ser reproducible, trazable y conciliable.
- Ejecutar primero en un entorno aislado con datos anonimizados cuando sea posible.

## 1. Perfilado del archivo

1. Inventariar hojas, encabezados, tipos aparentes, fórmulas, celdas combinadas y filas vacías.
2. Contar filas y totales monetarios por hoja sin exportar datos a logs.
3. Detectar columnas ambiguas, fechas serializadas, monedas mezcladas y números almacenados como texto.
4. Crear un diccionario de mapeo origen → tabla/campo y clasificar cada columna como obligatoria, opcional o descartada.
5. Acordar reglas antes de transformar; ningún supuesto silencioso.

## 2. Normalización

### Productos y colores

- Separar producto base de variante/presentación/color.
- Normalizar espacios, mayúsculas y caracteres para comparar, preservando el texto original como evidencia de importación.
- Mapear sinónimos de color mediante catálogo aprobado; no fusionar colores dudosos automáticamente.
- Crear o validar un SKU único por variante; los faltantes se rechazan o pasan a resolución administrativa.

### Almacenes y ubicaciones

- Crear catálogos canónicos de almacén y ubicación.
- Exigir una ubicación válida para cada balance inicial.
- No convertir una etiqueta desconocida a un almacén existente por semejanza sin aprobación.

### Estados

- Mapear textos históricos a estados cerrados de pedido, pago, envío, compra y transferencia.
- Separar estados que en Excel estén combinados.
- Valores sin correspondencia pasan al reporte de rechazo.

## 3. Calidad y duplicados

- Detectar duplicados exactos y candidatos por SKU, documento, fecha/importe y referencias externas.
- Nunca deduplicar solo por nombre de cliente.
- Marcar ventas sin fecha como rechazadas; no usar fecha de archivo, importación o fila vecina.
- Detectar totales que no coinciden con detalles, pagos mayores al pedido, stock negativo, cantidades cero, SKU inexistente y almacenes desconocidos.
- Separar inconsistencia reparable con regla aprobada de inconsistencia que requiere decisión humana.

## 4. Orden de importación

1. Catálogos: roles técnicos, productos, variantes, almacenes, ubicaciones y proveedores.
2. Compras históricas y sus detalles, conservando costo y moneda originales permitidos.
3. Ventas/pedidos históricos y detalles.
4. Pagos, envíos, ingresos derivados y gastos como entidades separadas.
5. Stock inicial mediante movimientos `initial_stock`, nunca escribiendo balances sin movimiento.

Las ventas históricas no deben reservar ni descontar nuevamente stock actual. Se definirá un modo de importación histórica explícito, auditado y probado.

## 5. Stock inicial

- Elegir una fecha de corte documentada.
- Exigir variante, almacén, ubicación, cantidad física y fuente.
- Crear una operación de apertura idempotente por lote, con movimiento `initial_stock` y balance resultante.
- El stock reservado inicial solo se importa si existe evidencia fiable y se vincula a pedidos abiertos; de lo contrario se rechaza para resolución.
- No permitir resultados negativos ni duplicar un lote reejecutado.

## 6. Compras, ventas, ingresos y gastos

- Compras: conservar proveedor, referencia, fecha conocida, cantidades, costo unitario y total; una fecha ausente no se infiere.
- Ventas: importar pedido, detalle, estado de pedido, pago y envío por separado.
- Ingresos: preferir pagos vinculados a pedidos; conceptos no atribuibles se documentan y modelan antes de importar.
- Gastos: categoría, importe, fecha, descripción y comprobante privado cuando exista; filas incompletas se rechazan.
- Usar `source_system`, `source_file_id`, `source_sheet`, `source_row` e `import_batch_id` para idempotencia y trazabilidad, sin guardar el archivo en Git.

## 7. Validación y conciliación

- Ejecutar en modo simulación y mostrar conteos: aceptadas, rechazadas y advertencias.
- Comparar conteos y sumas por período/hoja entre origen y staging.
- Conciliar unidades compradas, vendidas, devueltas, ajustadas y stock de corte.
- Conciliar total de pedidos, pagos, saldos y gastos en PEN.
- Muestrear registros de cada tipo con una segunda persona.
- Solo promover un lote mediante una transacción controlada después de aprobar la conciliación.

## Reporte de filas rechazadas

El reporte debe incluir identificador de lote, hoja, número de fila, campo, código de error, descripción, valor problemático enmascarado cuando contenga PII y acción sugerida. No debe incluir contraseñas, tokens ni datos innecesarios. Corregir el origen o generar un archivo de corrección privado; no editar directamente la evidencia importada.

## Reejecución y reversión

Cada lote tendrá clave idempotente y estado. Una reejecución no duplica entidades. Antes de producción se probará una reversión lógica mediante movimientos compensatorios y eliminación controlada de staging; los movimientos confirmados nunca se borran desde la interfaz.
