# JOR Store Operaciones

Sistema interno, privado y responsive para administrar las operaciones de JOR STORE. La aplicación se construye por etapas y prioriza el uso desde celulares, la trazabilidad del inventario y la seguridad de los datos.

> Estado actual: **Etapa 0 — inicialización y diseño técnico**. Todavía no existe autenticación funcional, conexión real con Supabase ni módulos operativos.

## Tecnologías

- Next.js con App Router y carpeta `src`.
- React y TypeScript en modo estricto.
- Tailwind CSS y ESLint.
- Supabase para PostgreSQL, autenticación y almacenamiento privado en etapas posteriores.
- React Hook Form y Zod para formularios y validación.
- ExcelJS para importaciones y exportaciones administrativas futuras.
- Vitest para pruebas automatizadas.
- Netlify como hosting futuro; no está configurado en esta etapa.

La interfaz será en español, la moneda funcional será PEN y las fechas de negocio usarán `America/Lima`.

## Requisitos

- Node.js 22 o superior.
- npm 10 o superior.
- Git.
- Un proyecto Supabase privado, únicamente a partir de la Etapa 1.

## Instalación local

```bash
git clone https://github.com/aldoosorio323-gif/jor-store-operaciones.git
cd jor-store-operaciones
git switch desarrollo
npm install
copy .env.example .env.local
npm run dev
```

La copia de variables usa `copy` en Windows. En macOS o Linux puede usarse `cp`.

## Comandos

| Comando | Propósito |
| --- | --- |
| `npm run dev` | Inicia el servidor local de Next.js. |
| `npm run build` | Genera la compilación de producción. |
| `npm run start` | Sirve una compilación generada. |
| `npm run lint` | Ejecuta ESLint sin admitir advertencias. |
| `npm run typecheck` | Verifica TypeScript sin emitir archivos. |
| `npm run test` | Ejecuta las pruebas con Vitest; cualquier fallo devuelve código distinto de cero. |

Antes de cada commit deben ejecutarse `lint`, `typecheck`, `test` y `build`. La prueba actual verifica la configuración base; las pruebas funcionales y de integración crecerán con cada módulo.

## Variables de entorno

Crear `.env.local` a partir de `.env.example`. Nunca confirmar valores reales en Git.

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima pública, limitada por RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave solo de servidor para tareas administrativas excepcionales. |
| `NEXT_PUBLIC_APP_URL` | URL base de la aplicación. |
| `APP_TIMEZONE` | Zona horaria de negocio; debe ser `America/Lima`. |

El prefijo `NEXT_PUBLIC_` permite que una variable llegue al navegador. La clave `service_role` nunca debe usar ese prefijo ni importarse desde componentes cliente.

## Estructura inicial

```text
src/
  app/          # Rutas, layouts y componentes de servidor de Next.js
  components/   # Componentes reutilizables de presentación
  features/     # Módulos organizados por dominio
  hooks/        # Hooks reutilizables del cliente
  lib/          # Configuración y utilidades de infraestructura
  services/     # Casos de uso y acceso controlado a servicios externos
  types/        # Tipos compartidos
  utils/        # Funciones puras
  validations/  # Esquemas Zod
docs/           # Decisiones y diseño técnico
supabase/       # Migraciones SQL y datos ficticios de desarrollo
scripts/        # Automatización segura
tests/          # Pruebas automatizadas
```

## Flujo de ramas

- `main`: rama estable. No se trabaja directamente ni se hace merge en esta etapa.
- `desarrollo`: rama de integración para las etapas del proyecto.
- El trabajo se entrega en incrementos acotados y con commits deliberados.
- No se abre pull request ni se despliega a producción durante la Etapa 0.

## Seguridad y datos

- Supabase será la única fuente oficial de datos; Excel no será base de datos.
- No usar `localStorage` ni estructuras en memoria como persistencia definitiva.
- No confirmar secretos, `.env.local`, credenciales, respaldos, bases locales, logs, Excel, CSV ni datos reales de clientes.
- El registro público estará desactivado y todas las tablas expuestas usarán Row Level Security.
- Los comprobantes e imágenes privadas vivirán en buckets privados.
- Ninguna operación de stock se hará sin movimiento inmutable y transacción PostgreSQL.

Consultar [AGENTS.md](AGENTS.md) y la documentación en [docs/](docs/) antes de implementar una etapa.

## Estado y próximas etapas

La Etapa 0 define la arquitectura, el modelo relacional, las reglas de inventario, seguridad y migración futura desde Excel. La siguiente etapa recomendada es **Etapa 1: autenticación y roles**, sin iniciarla hasta que se solicite expresamente.
