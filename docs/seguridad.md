# Seguridad

## Modelo de amenaza y principios

El sistema contiene datos personales, financieros e inventario. Se aplica denegación por defecto, mínimo privilegio, defensa en profundidad y trazabilidad. La validación del navegador mejora la experiencia, pero la autorización real ocurre en servidor y PostgreSQL.

## Autenticación

- Supabase Auth con correo y contraseña inicialmente; inicio de sesión obligatorio.
- `enable_signup` o equivalente debe impedir el registro público.
- Solo un administrador autenticado podrá invitar o crear cuentas mediante una acción de servidor.
- No guardar ni registrar contraseñas. Supabase administra hashes y tokens.
- Confirmar correo según la política del proyecto; no usar cuentas reales en seeds.
- La aplicación implementa login, logout, callback PKCE/OTP, recuperación y cambio de contraseña; no existe página pública de registro.
- Los perfiles creados por el trigger nacen inactivos y con rol operador. Solo el bootstrap manual o un administrador activo puede habilitarlos.

## Roles y acceso

Los roles iniciales son `administrator` y `operator`. `profiles.role_id` referencia `roles`; nunca se confía en un rol enviado por el cliente.

| Capacidad | Administrador | Operador |
| --- | --- | --- |
| Administrar usuarios y roles | Sí | No |
| Configuración maestra | Sí | Lectura necesaria |
| Compras, pedidos, pagos, envíos y gastos | Sí | Según permisos operativos |
| Ajustes y transferencias | Sí | Crear/ejecutar según política, siempre auditado |
| Importación masiva | Sí | No por defecto |
| Exportación/reportes | Sí | Solo alcance autorizado |
| Leer auditoría completa | Sí | No |
| Eliminar movimientos | Nunca | Nunca |

La matriz base se concretó en Etapa 1 y los catálogos de Etapa 2 aplican el siguiente alcance:

| Catálogos | Administrador activo | Operador activo | Inactivo/anónimo |
| --- | --- | --- | --- |
| Productos, variantes, almacenes, ubicaciones y proveedores | Leer activos/inactivos; crear, editar y activar/desactivar | Leer únicamente registros activos y padres activos | Sin acceso |

No existen políticas DELETE. Ocultar controles en la interfaz es solo una ayuda: Server Actions y RLS vuelven a autorizar cada mutación.

La matriz base ya está aplicada en la migración de Etapa 1. El navegador puede solicitar un rol permitido, pero la función SQL vuelve a validar actor, rol objetivo y la invariante del último administrador.

## Row Level Security

- RLS debe activarse antes de exponer cada tabla en la API.
- Sin sesión: ninguna lectura, inserción, actualización o borrado.
- Políticas separadas por operación; evitar políticas universales difíciles de auditar.
- Las tablas de movimientos y auditoría no tendrán política de borrado para clientes.
- Las escrituras críticas se harán mediante RPC transaccionales con permisos mínimos.
- Probar cada política como anónimo, operador, administrador y usuario deshabilitado.
- Revocar privilegios públicos innecesarios y no confiar solo en ocultar rutas.

La migración activa RLS en `roles`, `profiles` y `audit_logs`. No concede políticas de inserción, actualización o borrado de perfiles. Operadores leen su perfil y roles activos; administradores activos leen perfiles; anónimos e inactivos no obtienen filas. Las mutaciones administrativas pasan por RPC verificadas.

El trigger `private.protect_profile_write()` usa `session_user` únicamente para reconocer conexiones administrativas directas de migración o bootstrap (`postgres`/`supabase_admin`). En una función `SECURITY DEFINER`, `current_user` pasa a ser el propietario de la función y no identifica al solicitante original, por lo que no puede emplearse como bypass. Las peticiones de PostgREST conservan como usuario de sesión su conexión de API y deben superar las comprobaciones de `auth.uid()`, perfil activo y rol dentro de PostgreSQL.

La migración incremental `202607130002` permite a un operador activo actualizar mediante `mark_current_user_login()` únicamente su propia marca `last_login_at` y `updated_by`. La excepción exige que identidad, rol, estado, nombre y demás campos de auditoría permanezcan sin cambios; no concede permisos directos de actualización sobre `profiles`.

La migración `202607130003` habilita RLS en las cinco tablas de catálogos. Las políticas separan SELECT, INSERT y UPDATE; el operador solo ve filas activas y, en variantes/ubicaciones, exige también padre activo. Triggers con funciones privadas asignan actor y fechas desde `auth.uid()`, normalizan entradas, bloquean cambios de padre y rechazan desactivaciones inconsistentes. Los clientes no reciben DELETE.

La migración `202607130004`, pendiente de aplicación remota, habilita RLS en las seis tablas operativas. Administrador y operador activos leen compras, balances, movimientos y transferencias, y administran borradores mediante permisos por columna. Ningún cliente inserta, actualiza o elimina balances o movimientos. Usuario inactivo y anónimo no obtienen filas ni ejecución. No existen políticas DELETE ni `using (true)`.

| Etapa 3 | Administrador activo | Operador activo | Inactivo/anónimo |
| --- | --- | --- | --- |
| Compras | Crear/editar borrador, confirmar, cancelar sin recepción y recibir | Igual | Sin acceso |
| Inventario | Leer balances/movimientos; ajustar y conciliar | Solo lectura | Sin acceso |
| Transferencias | Crear/editar borrador, confirmar, cancelar antes del despacho, despachar y recibir | Igual | Sin acceso |

Las RPC obtienen el actor desde `auth.uid()`, fijan `search_path = ''` y verifican el rol; no aceptan actor ni auditoría del navegador. Las claves idempotentes completas quedan en el registro cuantitativo/privado necesario, nunca en `audit_logs`. Los errores de PostgreSQL se traducen a mensajes cerrados en las Server Actions.

## Secretos y navegador

Nunca deben exponerse en el navegador:

- `SUPABASE_SERVICE_ROLE_KEY`, claves privadas, tokens de administración o secretos de webhooks.
- Contraseñas, hashes, refresh tokens de otros usuarios o cabeceras de autorización.
- Credenciales de base de datos, cadenas de conexión o secretos de Netlify.
- URLs permanentes de buckets privados.
- Datos personales o financieros fuera del alcance autorizado.
- Mensajes SQL internos, trazas completas o variables del proceso.

Los secretos locales viven en `.env.local`; en hosting, en el gestor cifrado. Se rotan si existe sospecha de exposición. `.env.example` nunca contiene valores.

`SUPABASE_SERVICE_ROLE_KEY` está aislada en `src/lib/env-server.ts` y `src/lib/supabase/admin.ts`, ambos `server-only`. Se utiliza solo para `inviteUserByEmail`; listar correos en la pantalla administrativa también requiere Auth Admin en servidor. Los cambios de rol/estado usan el JWT del administrador y no la clave privilegiada.

## Datos personales

- Recopilar solo datos necesarios y documentar finalidad y retención.
- Enmascarar datos en logs, pruebas, capturas y soporte.
- Usar datos ficticios en repositorio y entornos compartidos.
- Exportaciones son temporales, autorizadas, con acceso limitado y eliminación controlada.
- No subir Excel, CSV, respaldos, adjuntos ni datos reales a GitHub.
- Evitar mostrar teléfonos/direcciones completos en vistas que no los requieran.

## Storage y archivos privados

- Buckets de comprobantes, documentos e imágenes privadas no serán públicos.
- Rutas por entidad/UUID, sin datos personales en nombres de archivo.
- Validar tamaño, MIME y extensión; no confiar en el nombre enviado.
- Servir con URL firmada corta y verificar autorización antes de generarla.
- La clave `service_role` no debe convertirse en un proxy público de archivos.

## Auditoría

Operaciones sensibles insertan `audit_logs` en la misma transacción, con actor, acción, entidad, identificador, resumen seguro, fecha, request/correlation ID e IP/agent cuando sea legítimo. Se filtran secretos y PII innecesaria. Los registros no se editan ni eliminan desde la interfaz.

En Etapa 1 se creó una estructura mínima compatible: invitación, cambio de rol, activación, desactivación, bootstrap y recuperación completada. `metadata` guarda solo estados/roles anteriores y nuevos; no guarda correo, contraseñas, tokens, enlaces ni payloads de Auth. La auditoría general se ampliará en su etapa sin reemplazar este historial.

Etapa 2 amplía de forma incremental `audit_logs` con `entity_type` y `entity_id`, además de acciones de creación, actualización, activación y desactivación para productos, variantes, almacenes, ubicaciones y proveedores. Los triggers guardan solo estado o una marca segura de cambio: nunca copian correos, teléfonos, direcciones, identificaciones tributarias ni formularios completos.

Etapa 3 añade acciones de compra, línea, transferencia, recepción y ajuste. Sus metadatos se limitan a estado, número de línea y cantidades; no copian proveedores, notas, referencias ni payloads. El movimiento es el historial cuantitativo y la auditoría registra la transición administrativa.

Después de invitar una cuenta, la acción comprueba por separado el resultado de `admin_record_invitation`. Si esa auditoría falla, no repite ni revierte la invitación: devuelve un estado no exitoso que informa, sin datos personales ni detalle técnico, que la cuenta fue invitada y la auditoría requiere revisión.

## Sesiones

- Cookies seguras, `HttpOnly` cuando corresponda, `Secure` en producción y `SameSite=Lax` o más restrictivo.
- Renovación manejada por bibliotecas oficiales de Supabase para Next.js.
- Cerrar sesión invalida la sesión local; cambios de contraseña o desactivación deben revocar sesiones relevantes.
- Validar redirecciones contra una lista permitida y evitar open redirects.
- Definir expiración y reautenticación para acciones administrativas sensibles.
- `proxy.ts` renueva cookies con `getClaims()` y preserva encabezados `private/no-store`; los Server Components vuelven a validar usuario y perfil.

## Recuperación de contraseña

- Flujo nativo de Supabase con enlace de un solo uso y expiración corta.
- Respuesta neutra para no revelar si un correo existe.
- Redirección únicamente a `NEXT_PUBLIC_APP_URL` autorizado.
- Tras restablecer, revocar sesiones anteriores cuando la plataforma lo permita y auditar el evento sin registrar tokens.

## Controles de aplicación

- Zod valida entradas; PostgreSQL repite checks críticos.
- Protección CSRF/origen para mutaciones basadas en cookies.
- Límites de tamaño y frecuencia en login, importaciones, exportaciones y endpoints costosos.
- Cabeceras de seguridad y CSP se configurarán antes del despliegue.
- Dependencias bloqueadas en `package-lock.json` y revisadas regularmente.
- Errores públicos genéricos; detalle técnico solo en observabilidad segura.

## Lista previa a producción

RLS probada, signup desactivado, buckets privados, secretos en hosting, URLs permitidas, backups/restore ensayados, retención definida, dependencias auditadas y pruebas de autorización aprobadas. Nada de esto implica que producción esté configurada en Etapa 1.

## Verificación

Etapas 1 y 2 están conectadas al Supabase real de desarrollo; las migraciones 001, 002 y 003 están aplicadas local y remotamente. Las pruebas unitarias/estáticas verifican Zod, permisos, navegación, ausencia de `service_role` cliente y estructura de migración/RLS. `supabase/tests/rls_catalogs.sql` queda preparado con `ROLLBACK`; no se declara ejecutado porque este entorno no dispone de `psql`, conexión SQL de pruebas ni perfiles ficticios configurados.
