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

La matriz se concretará mediante políticas y pruebas en la Etapa 1. Los permisos delicados pueden separarse de los roles más adelante sin reescribir el modelo.

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

## Verificación de Etapa 1

Las pruebas unitarias/estáticas verifican validaciones, decisiones de ruta, inactividad, rol, redirecciones, ausencia de service role en componentes cliente y estructura de la migración. La prueba SQL `supabase/tests/rls_auth_roles.sql` queda preparada, pero requiere un Supabase local/de desarrollo con usuarios ficticios. No se declara probada contra un backend remoto porque `.env.local` no existe.
