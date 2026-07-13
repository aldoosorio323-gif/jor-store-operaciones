# Configuración de Supabase para desarrollo

Esta guía prepara un proyecto **de desarrollo**. No contiene credenciales ni autoriza producción. La integración remota no se considera probada hasta completar estas instrucciones y ejecutar las verificaciones con cuentas ficticias.

## 1. Crear el proyecto

1. Iniciar sesión en el panel de Supabase y crear una organización/proyecto separado para desarrollo.
2. Usar un nombre que indique claramente que no es producción.
3. Generar una contraseña robusta para PostgreSQL y guardarla en un gestor de contraseñas; no copiarla al repositorio.
4. Para usuarios principalmente en Perú, elegir razonablemente **South America (São Paulo), `sa-east-1`**, la región específica sudamericana disponible. Antes de producción se debe medir latencia y revisar requisitos legales; la región no debe escogerse solo por nombre.

## 2. Obtener URL y claves

En el panel, abrir **Project Settings / API** o el diálogo **Connect**:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`.
- **anon key** de Legacy API Keys → `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **service_role key** de Legacy API Keys → `SUPABASE_SERVICE_ROLE_KEY`.

Supabase también ofrece claves publicables/secretas nuevas. Este proyecto mantiene los nombres solicitados para la Etapa 1; no mezclar tipos de clave sin actualizar y probar la configuración. La clave `service_role` evita RLS y solo se usa en el servidor para invitaciones.

## 3. Crear `.env.local`

Copiar `.env.example` como `.env.local` y completar localmente:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_TIMEZONE=America/Lima
```

No pegar estos valores en issues, logs, capturas, commits o conversaciones. Confirmar que Git ignora el archivo con `git check-ignore .env.local`.

## 4. Desactivar registro público

En **Authentication / Providers / Email** o configuración general de Auth:

1. Desactivar **Allow new users to sign up**.
2. Desactivar **Allow anonymous sign-ins**.
3. Mantener Email habilitado para cuentas existentes e invitaciones.
4. Configurar una política de contraseña de al menos 12 caracteres; activar protección contra contraseñas filtradas si el plan la ofrece.

La aplicación no contiene ruta ni botón de registro. Las cuentas se crean manualmente para el bootstrap o mediante invitación administrativa.

## 5. Configurar URLs autorizadas

En **Authentication / URL Configuration**:

- Site URL de desarrollo: `http://localhost:3000`.
- Redirect URL exacta: `http://localhost:3000/auth/callback`.

No añadir dominios arbitrarios ni comodines amplios. Al existir un entorno futuro, añadir únicamente su origen aprobado y actualizar `NEXT_PUBLIC_APP_URL`. La aplicación no acepta destinos externos enviados por parámetros.

## 6. Aplicar migraciones

La migración versionada es `supabase/migrations/202607130001_auth_profiles_roles.sql`.

Con Supabase CLI disponible:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref <PROJECT_REF>
npx supabase@latest db push --dry-run
npx supabase@latest db push
```

Revisar el `--dry-run` antes de aplicar. No ejecutar `db reset` en un proyecto remoto con información útil. Las migraciones crean roles, perfiles inactivos por defecto, auditoría mínima, funciones seguras y políticas RLS.

## 7. Crear el primer usuario

1. En **Authentication / Users**, elegir **Add user / Create new user**.
2. Proporcionar un correo controlado por el administrador y una contraseña temporal segura fuera del repositorio.
3. Copiar el UUID de Auth solo para el siguiente procedimiento; no guardarlo en Git.
4. Confirmar que el trigger creó `public.profiles` con rol `operator` e `is_active = false`.

## 8. Promover al primer administrador

Usar `supabase/bootstrap/promote-first-administrator.sql` como plantilla manual:

1. Copiar la plantilla al SQL Editor sin modificar el archivo versionado.
2. Sustituir `target_user_id uuid := null;` por el UUID explícito, convertido a `uuid`.
3. Ejecutar primero con `ROLLBACK` y revisar la fila mostrada.
4. Solo si el resultado es correcto, cambiar la copia temporal a `COMMIT` y ejecutar de nuevo.
5. La plantilla se niega a continuar si no hay UUID, si el usuario no existe o si ya hay un administrador activo.

No convertir esta plantilla en una migración repetible ni dejar el UUID en un archivo.

Verificación posterior:

```sql
select p.id, p.display_name, p.is_active, r.code
from public.profiles p
join public.roles r on r.id = p.role_id
where p.id = '<UUID_PROPORCIONADO_MANUALMENTE>'::uuid;
```

El resultado esperado es `is_active = true` y `code = 'administrator'`.

## 9. Iniciar y verificar la aplicación

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`. Verificar:

- `/` redirige a `/login` sin sesión y a `/app` con sesión válida.
- El administrador puede abrir `/app/usuarios`.
- Un operador no puede abrir esa ruta.
- Un perfil desactivado pierde acceso aunque conserve cookies anteriores.
- No existe registro público.

## 10. Invitar al segundo usuario

Desde `/app/usuarios`, el administrador ingresa nombre, correo y rol. La invitación se ejecuta en servidor con Auth Admin API; el perfil nace inactivo y solo se activa después de asignar el rol mediante la función SQL autorizada. El invitado usa el enlace para establecer su contraseña.

## 11. Verificar RLS

`supabase/tests/rls_auth_roles.sql` requiere una base local/de desarrollo con cuatro usuarios ficticios preparados. Ejecutar con `psql`, pasando sus UUID explícitamente como variables:

```bash
psql "$SUPABASE_DB_URL" -v admin_id='<UUID>' -v operator_id='<UUID>' -v inactive_id='<UUID>' -v other_id='<UUID>' -f supabase/tests/rls_auth_roles.sql
```

El script prueba anónimo, operador, administrador, usuario inactivo e intento de cambio directo de rol, y termina con `ROLLBACK`. No se ejecutó durante esta etapa porque no hay credenciales ni stack local Supabase.

## 12. Rotar una clave expuesta

1. Considerar comprometida cualquier clave publicada o registrada accidentalmente.
2. Rotarla desde la sección de API Keys de Supabase siguiendo el procedimiento del panel.
3. Actualizar `.env.local` y secretos de los entornos autorizados, nunca Git.
4. Reiniciar procesos y verificar login/invitación.
5. Revocar la clave anterior y revisar logs de acceso/auditoría.
6. Si se expuso `service_role`, tratar el incidente como acceso total a datos y revisar alcance inmediatamente.
