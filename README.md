# Tarjeta de fidelidad para venta de agua

Aplicación web de código abierto para administrar clientes, registrar compras y generar tarjetas de fidelidad que pueden descargarse o compartirse desde computadoras, Android y iPhone.

Incluye un panel administrativo con historial, beneficios, métricas de ventas, tasas de cambio e ingresos estimados por día o rango de fechas.

## Funciones principales

- Registro y búsqueda de clientes por cédula venezolana.
- Progreso de fidelidad de 0 a 10 compras.
- Canje del beneficio al completar la tarjeta.
- Generación de una imagen para descargar o compartir por WhatsApp.
- Flujo compatible con iPhone, Android y escritorio.
- Historial de movimientos y correcciones.
- Dashboard con filtros por día, rango y períodos predefinidos.
- Cálculo referencial en USD, bolívares BCV y Binance.
- Acceso administrativo mediante Supabase Auth.
- Base de datos protegida con RLS y funciones PostgreSQL controladas.

## Tecnologías

- Vite
- React 19
- TypeScript
- Supabase
- Netlify Functions
- Cotizave API
- Vitest y Testing Library

## Requisitos

- Node.js 24 o una versión compatible con Vite 7.
- Un proyecto de Supabase.
- Una cuenta de Netlify para el despliegue recomendado.
- Una clave de Cotizave para consultar las tasas de cambio.

## Instalación local

```bash
git clone https://github.com/macnemoto/fidelidad-agua.git
cd fidelidad-agua
npm install
```

Copia `.env.example` como `.env.local` y reemplaza los valores de ejemplo con los datos de tus propios servicios:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_ADMIN_EMAIL=admin@example.com

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
COTIZAVE_API_KEY=your-cotizave-api-key
```

Las variables que comienzan con `VITE_` quedan disponibles en el navegador. No coloques allí claves secretas, `service_role` ni contraseñas.

Inicia el entorno local:

```bash
npm run dev
```

## Configuración de Supabase

1. Crea un proyecto nuevo en Supabase.
2. Ejecuta, en orden, los archivos de `supabase/migrations` usando el SQL Editor.
3. En Authentication, crea el usuario que administrará la aplicación.
4. Copia el UUID de ese usuario y autorízalo en la tabla administrativa:

```sql
insert into public.admin_users (user_id)
values ('UUID_DEL_USUARIO');
```

5. Configura el mismo correo en `VITE_ADMIN_EMAIL`.

La contraseña del usuario de Supabase funciona como PIN de acceso en la interfaz. Para conservar el diseño actual debe tener ocho dígitos.

Las migraciones activan RLS, revocan el acceso directo desde la clave pública y exponen solamente funciones que comprueban que la sesión pertenece a un administrador.

## Configuración financiera

Por defecto, cada marca representa un camión con tres tanques y un valor referencial de USD 25. Estos valores se guardan en `public.business_settings` y pueden adaptarse directamente en Supabase.

Las tasas se obtienen mediante una función de Netlify. Si Cotizave no responde, el registro del cliente continúa y la venta queda marcada como pendiente de tasa.

## Despliegue en Netlify

Conecta el repositorio y usa esta configuración:

- Comando de compilación: `npm run build`
- Directorio de publicación: `dist`
- Versión de Node: `24`

Agrega en Netlify todas las variables enumeradas en `.env.example`. Los valores reales no deben guardarse en Git.

## Validación

```bash
npm run lint
npm run test
npm run build
```

Antes de usar la aplicación con datos reales, prueba la creación de un cliente, el guardado del progreso, el canje, la generación de imágenes y los filtros del dashboard.

## Seguridad y privacidad

- No publiques archivos `.env.local`.
- No utilices una clave `service_role` en el frontend ni en este proyecto.
- Cambia el correo y la contraseña del administrador en cada instalación.
- La cédula y el nombre son datos personales; informa a los clientes sobre su uso y protege el acceso a Supabase.
- Este repositorio no incluye credenciales, clientes ni datos de producción.

## Personalización

Los textos, colores, valor del beneficio, cantidad de compras y proveedor de tasas pueden adaptarse para otros comercios. Si cambias la lógica de fidelidad, actualiza también las restricciones y funciones de Supabase para mantener la validación del lado del servidor.

## Licencia

Este proyecto se distribuye bajo la [licencia MIT](LICENSE). Puedes usarlo, modificarlo y distribuirlo respetando los términos de la licencia.

