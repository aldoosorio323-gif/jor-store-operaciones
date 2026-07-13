# Instrucciones para agentes y colaboradores

Estas reglas aplican a todo el repositorio. Antes de modificar código o documentación, leer este archivo y los documentos de `docs/` relacionados con la etapa activa.

## Arquitectura

- Usar Next.js con App Router, TypeScript estricto, Tailwind CSS y ESLint.
- Mantener rutas y composición en `src/app`; componentes reutilizables en `src/components`; módulos de dominio en `src/features`; configuración en `src/lib`; casos de uso e integraciones en `src/services`.
- Supabase PostgreSQL es la única fuente oficial y persistente de datos.
- Separar código cliente, código de servidor y lógica PostgreSQL. Los componentes cliente no acceden a secretos ni ejecutan reglas críticas de negocio.
- Las operaciones críticas de inventario se implementan como funciones/transacciones PostgreSQL, no como secuencias de llamadas desde el navegador.
- Mantener la arquitectura preparada para PWA, sin activar PWA hasta la etapa correspondiente.

## Tecnologías permitidas

- Next.js, React, TypeScript, Tailwind CSS y ESLint.
- Supabase para PostgreSQL, Auth y Storage.
- React Hook Form y Zod.
- ExcelJS para importación/exportación de Excel, nunca como almacenamiento principal.
- Vitest y herramientas de prueba compatibles con Next.js.
- Netlify solo cuando una etapa futura autorice despliegue.
- No introducir otro framework, ORM, proveedor de autenticación o base de datos sin una decisión documentada.

## Convenciones

- Interfaz, mensajes y documentación de negocio en español.
- Identificadores de código y columnas SQL en inglés, usando `snake_case` en PostgreSQL y nombres claros en TypeScript.
- Moneda PEN; importes con `numeric`, nunca `float`.
- Zona de negocio `America/Lima`; persistir instantes como `timestamptz` en UTC y convertir al presentar.
- TypeScript debe permanecer en `strict: true`; no usar `any` salvo justificación puntual documentada.
- Validar entradas externas con Zod y volver a validar invariantes críticas en PostgreSQL.
- Preferir componentes de servidor; usar `"use client"` solo cuando haya interacción real.
- Añadir pruebas para reglas de negocio y correcciones de defectos.

## Reglas de Git

- Trabajar únicamente en la rama solicitada para la etapa; nunca directamente en `main`.
- No hacer merge a `main`, no abrir PR y no desplegar salvo solicitud expresa.
- Revisar `git status` y el diff antes de añadir cambios.
- No mezclar etapas ni cambios no relacionados en un commit.
- Usar el mensaje exacto solicitado cuando la tarea lo especifique.
- Trabajar por etapas y detenerse inmediatamente al completar la etapa solicitada.

## Seguridad y privacidad

- Inicio de sesión obligatorio; registro público desactivado.
- Roles iniciales: `administrator` y `operator`; denegar por defecto.
- Habilitar RLS en todas las tablas expuestas y probar políticas por rol.
- Nunca enviar `SUPABASE_SERVICE_ROLE_KEY` al navegador ni usar prefijo `NEXT_PUBLIC_` para secretos.
- Secretos solo en `.env.local` o en el gestor seguro del hosting.
- **Prohibido subir secretos, contraseñas, tokens, claves privadas, credenciales o archivos de servicio.**
- **Prohibido subir datos reales de clientes**, Excel, CSV, respaldos, bases locales, comprobantes, imágenes privadas o logs con información sensible.
- Usar únicamente datos ficticios y reconocibles como tales en pruebas y seeds.
- Buckets con comprobantes e imágenes privadas deben ser privados y usar URLs firmadas de corta duración.
- No registrar contraseñas, tokens, documentos, direcciones ni payloads sensibles en logs.

## Reglas de inventario

- Nunca modificar stock sin insertar un movimiento de inventario en la misma transacción.
- Separar stock físico, reservado y disponible; `available = physical - reserved`.
- Nunca permitir stock físico, reservado o disponible negativo, ni reservas mayores al físico.
- El stock se identifica por variante, almacén y ubicación.
- Cada variante tiene un SKU único y cada compra conserva su costo histórico.
- El costo inicial se calcula por promedio ponderado al recibir compras.
- Los movimientos son inmutables desde la interfaz; las correcciones se hacen con movimientos compensatorios.
- Una transferencia confirmada genera salida y entrada enlazadas.
- Los ajustes requieren motivo, responsable, fecha, cantidad anterior y cantidad resultante.
- Usar bloqueos de fila, restricciones y transacciones PostgreSQL para impedir doble venta y carreras.

## Reglas de validación

- Validar forma y mensajes de interfaz con Zod; validar autorización e invariantes nuevamente en servidor/PostgreSQL.
- Rechazar cantidades no enteras cuando la unidad no admita fracciones, importes negativos, SKU vacíos o duplicados y estados inválidos.
- No confiar en totales, precios, rol, usuario ni almacén enviados por el navegador.
- Las transiciones de estado deben estar permitidas explícitamente y ser idempotentes cuando corresponda.
- No inventar fechas ni completar datos faltantes durante importaciones; rechazar y reportar la fila.

## Comprobaciones obligatorias

Antes de cada commit ejecutar y corregir completamente:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Un commit está prohibido si alguna comprobación falla. Revisar además secretos y archivos privados con `git status` y el diff staged.
