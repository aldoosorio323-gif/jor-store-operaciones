# JOR Store Operaciones

Aplicación web interna, privada y móvil primero para administrar las operaciones de JOR STORE. El proyecto avanza por etapas y usa Supabase PostgreSQL como única fuente oficial de datos.

> Estado actual: **Etapa 3 completada y validada con Supabase real**. Las migraciones `202607130001`, `202607130002`, `202607130003` y `202607130004` están aplicadas local y remotamente. Las pruebas reales de concurrencia con conexiones independientes continúan pendientes. La Etapa 4 todavía no ha sido iniciada.

## Tecnologías

- Next.js 16 con App Router y `proxy.ts`.
- React, TypeScript estricto, Tailwind CSS y ESLint.
- Supabase Auth/PostgreSQL/Storage y `@supabase/ssr` para cookies SSR.
- React Hook Form y Zod.
- ExcelJS reservado para etapas futuras de importación/exportación.
- Vitest y GitHub Actions.
- Netlify como hosting futuro; no está configurado.

La interfaz está en español, la moneda funcional es PEN y la zona de negocio es `America/Lima`.

## Funcionalidad implementada

- Inicio y cierre de sesión privados, sin registro público.
- Renovación SSR de sesión mediante cookies y `getClaims()`.
- Protección de `/app` en Proxy y nuevamente en Server Components.
- Verificación obligatoria de perfil activo.
- Roles `administrator` y `operator` aplicados con RLS.
- Perfil de usuario de solo lectura para rol/estado.
- Invitación administrativa, asignación de rol y activación/desactivación.
- Protección contra desactivar o degradar al último administrador activo.
- Recuperación y restablecimiento de contraseña con destinos permitidos.
- Auditoría mínima de invitación, rol, activación, desactivación y recuperación.
- Productos y variantes con SKU, precio, atributos y borrado lógico.
- Almacenes y ubicaciones internas controladas por tipo.
- Proveedores privados vinculables a compras.
- Búsqueda, filtros administrativos, paginación de 20 registros y vistas móviles.
- Mutaciones exclusivas para administradores; operadores activos consultan solo registros activos.
- RLS, restricciones relacionales y auditoría transaccional para los cinco catálogos.
- Compras en borrador, líneas con costo histórico, confirmación y recepción parcial o total.
- Balances por variante/almacén/ubicación y libro mayor inmutable de movimientos.
- Costo promedio ponderado con `numeric`, bloqueo de filas, versión e idempotencia.
- Transferencias con salida completa, stock en tránsito y recepción parcial/completa.
- Stock inicial y ajustes positivos/negativos, dañados o perdidos, solo para administrador.
- Conciliación administrativa entre balances y suma histórica de movimientos.

No se implementaron devoluciones a proveedor, clientes, pedidos, reservas de venta, pagos, envíos, gastos, dashboard, Excel ni PWA. `reserved_stock` existe y permanece en cero: no hay operación pública para modificarlo en esta etapa.

## Requisitos

- Node.js 22 o superior y npm 10 o superior.
- Git.
- Para integración real: proyecto Supabase de desarrollo.
- Opcional para RLS local: Supabase CLI, Docker y `psql`.

## Instalación

```bash
git clone https://github.com/aldoosorio323-gif/jor-store-operaciones.git
cd jor-store-operaciones
git switch desarrollo
npm install
copy .env.example .env.local
npm run dev
```

En macOS/Linux usar `cp` en lugar de `copy`. Seguir `docs/configuracion-supabase.md` antes de completar `.env.local` o aplicar migraciones.

## Variables de entorno

| Variable | Alcance |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública limitada por RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor; invitaciones administrativas. |
| `NEXT_PUBLIC_APP_URL` | Origen permitido para callbacks. |
| `APP_TIMEZONE` | Debe ser `America/Lima`. |

La validación es diferida: `npm run build` funciona sin credenciales, pero una acción real muestra un error claro hasta configurar `.env.local`. La clave `service_role` vive en un módulo `server-only` y nunca se importa en componentes cliente.

## Rutas

| Ruta | Acceso |
| --- | --- |
| `/` | Redirige según sesión. |
| `/login` | Pública; solo inicio de sesión. |
| `/forgot-password` | Solicitud neutral de recuperación. |
| `/reset-password` | Requiere sesión temporal de recuperación. |
| `/auth/callback` | Intercambia códigos/OTP con redirección permitida. |
| `/app` | Usuario autenticado y activo. |
| `/app/perfil` | Perfil propio activo. |
| `/app/usuarios` | Solo administrador activo. |
| `/app/productos` y `/app/productos/[id]` | Administrador u operador activo; operador en lectura. |
| `/app/productos/nuevo` | Solo administrador activo. |
| `/app/almacenes` y `/app/almacenes/[id]` | Administrador u operador activo; operador en lectura. |
| `/app/almacenes/nuevo` | Solo administrador activo. |
| `/app/proveedores` y `/app/proveedores/[id]` | Administrador u operador activo; operador en lectura. |
| `/app/proveedores/nuevo` | Solo administrador activo. |
| `/app/compras` y `/app/compras/[id]` | Administrador u operador activo; borradores, confirmación y recepción. |
| `/app/compras/nueva` | Administrador u operador activo. |
| `/app/inventario` | Balances paginados para administrador u operador activo. |
| `/app/inventario/movimientos` | Libro mayor paginado para administrador u operador activo. |
| `/app/transferencias`, `/app/transferencias/nueva` y `/app/transferencias/[id]` | Administrador u operador activo. |
| `/app/ajustes` | Solo administrador activo. |

No existe ruta de registro.

## Comandos

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Servidor local. |
| `npm run build` | Compilación de producción sin requerir secretos básicos. |
| `npm run start` | Sirve la compilación. |
| `npm run lint` | ESLint sin advertencias. |
| `npm run typecheck` | TypeScript sin emitir archivos. |
| `npm run test` | Pruebas unitarias y verificaciones estáticas. |

GitHub Actions ejecuta `npm ci`, lint, typecheck, test y build en pushes a `desarrollo` y pull requests hacia `desarrollo` o `main`, sin secretos reales.

### Verificación local de Etapa 2

Se ejecutaron `npm run lint`, `npm run typecheck`, `npm run test` (44 pruebas) y `npm run build` correctamente. `git diff --check` no reportó errores. La lista de migraciones confirma 001, 002 y 003 tanto en Local como en Remote. Las pruebas SQL de catálogos no se ejecutaron porque este entorno no dispone de `psql`, conexión SQL de pruebas ni perfiles ficticios configurados; no se usó la cuenta administrativa real.

### Verificación local de Etapa 3

La Etapa 3 quedó completada y validada con Supabase real. Con datos exclusivamente ficticios se comprobaron manualmente la creación y confirmación de compras, la recepción que genera inventario, el stock inicial, el costo promedio ponderado, los balances, el libro mayor inmutable, las transferencias sin stock anticipado en destino y los ajustes negativos. La presentación y conversión de fechas en `America/Lima` también fueron verificadas.

La batería automatizada cubre estados, validaciones, zona horaria, promedio ponderado, RLS, idempotencia, congelamiento, navegación, integridad UTF-8 y ausencia de escritura directa. `supabase/tests/rls_inventory.sql` conserva escenarios ficticios transaccionales con `ROLLBACK`. Las pruebas reales de concurrencia con conexiones independientes continúan pendientes y no se presentan como ejecutadas.

## Migraciones y pruebas Supabase

Las migraciones 001, 002, 003 y 004 aparecen aplicadas local y remotamente. La migración 004 crea `purchases`, `purchase_items`, `inventory_balances`, `inventory_movements`, `inventory_transfers` e `inventory_transfer_items`, además de secuencias y un registro privado de comandos idempotentes.

Las pruebas unitarias/estáticas cubren validaciones, permisos, navegación, RLS, restricciones, auditoría y límites de secretos. `supabase/tests/rls_catalogs.sql` prepara verificaciones reproducibles para anónimo, administrador, operador e inactivo, unicidad, relaciones inmutables, borrado y desactivación de padres. Termina con `ROLLBACK`; no se afirma que haya sido ejecutada sin una conexión SQL y perfiles ficticios confirmados.

## Seguridad

- Registro y acceso anónimo desactivados en la configuración manual.
- Perfiles nuevos nacen inactivos y con rol operador; el navegador no decide el rol.
- Ningún cliente tiene permisos directos para insertar, actualizar o borrar perfiles.
- Funciones `security definer` fijan `search_path` vacío y verifican actor activo/administrador.
- Los catálogos no admiten DELETE desde clientes; la desactivación de productos/almacenes exige que sus hijos estén inactivos.
- La auditoría de catálogos guarda actor, entidad, identificador y resúmenes sin correos, teléfonos, direcciones, identificaciones tributarias ni payloads completos.
- Balances y movimientos no conceden INSERT, UPDATE ni DELETE a clientes; las RPC usan el JWT del usuario y nunca `service_role`.
- Ajustes y conciliación vuelven a comprobar rol administrador en PostgreSQL.
- Nunca confirmar secretos, datos reales, Excel, CSV, respaldos, bases o logs.

## Flujo de ramas

- `main`: estable; no trabajar directamente.
- `desarrollo`: integración por etapas.
- No hay despliegue ni merge durante esta etapa.

## Documentación

- `docs/configuracion-supabase.md`: configuración, migraciones y primer administrador.
- `docs/arquitectura.md`: límites y flujo SSR.
- `docs/seguridad.md`: controles implementados y pendientes.
- `docs/modelo-datos.md`: modelo relacional general.
- `docs/plan-implementacion.md`: etapas y estado.
- `docs/reglas-inventario.md`: invariantes futuras de inventario.

La siguiente etapa prevista es **Etapa 4: clientes, pedidos, pagos y reservas**, pero todavía no ha sido iniciada y requiere una solicitud expresa independiente.
