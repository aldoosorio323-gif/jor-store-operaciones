# JOR Store Operaciones

Aplicación web interna, privada y móvil primero para administrar las operaciones de JOR STORE. El proyecto avanza por etapas y usa Supabase PostgreSQL como única fuente oficial de datos.

> Estado actual: **Etapa 2 — catálogos operativos completados y validados con Supabase real**. Las migraciones `202607130001`, `202607130002` y `202607130003` están aplicadas local y remotamente.

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
- Proveedores privados, sin compras asociadas todavía.
- Búsqueda, filtros administrativos, paginación de 20 registros y vistas móviles.
- Mutaciones exclusivas para administradores; operadores activos consultan solo registros activos.
- RLS, restricciones relacionales y auditoría transaccional para los cinco catálogos.

No se implementaron stock, movimientos, compras, pedidos, pagos, envíos, gastos ni dashboard.

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

## Migraciones y pruebas Supabase

Las migraciones 001, 002 y 003 aparecen aplicadas local y remotamente. La migración 003 crea `products`, `product_variants`, `warehouses`, `warehouse_locations` y `suppliers` con RLS, restricciones y auditoría transaccional.

Las pruebas unitarias/estáticas cubren validaciones, permisos, navegación, RLS, restricciones, auditoría y límites de secretos. `supabase/tests/rls_catalogs.sql` prepara verificaciones reproducibles para anónimo, administrador, operador e inactivo, unicidad, relaciones inmutables, borrado y desactivación de padres. Termina con `ROLLBACK`; no se afirma que haya sido ejecutada sin una conexión SQL y perfiles ficticios confirmados.

## Seguridad

- Registro y acceso anónimo desactivados en la configuración manual.
- Perfiles nuevos nacen inactivos y con rol operador; el navegador no decide el rol.
- Ningún cliente tiene permisos directos para insertar, actualizar o borrar perfiles.
- Funciones `security definer` fijan `search_path` vacío y verifican actor activo/administrador.
- Los catálogos no admiten DELETE desde clientes; la desactivación de productos/almacenes exige que sus hijos estén inactivos.
- La auditoría de catálogos guarda actor, entidad, identificador y resúmenes sin correos, teléfonos, direcciones, identificaciones tributarias ni payloads completos.
- Movimientos, stock y documentos operativos siguen fuera de alcance de esta etapa.
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

La siguiente etapa prevista es **Etapa 3: compras, reposición y movimientos**, pero no debe iniciarse sin una solicitud expresa.
