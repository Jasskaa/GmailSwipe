# Gmail Swipe

Una app tipo Tinder para organizar tu Gmail: cada correo es una tarjeta, y la
deslizás (o pulsás un botón) para archivar, eliminar, mantener o etiquetar.
Cada usuario conecta **su propia** cuenta de Gmail vía OAuth — no hay
credenciales compartidas ni tokens hardcodeados. Podés conectar y cambiar
entre varias cuentas de Gmail desde la misma app.

## Stack

- Next.js 14 (App Router) + TypeScript
- NextAuth.js (Auth.js v4) con proveedor Google, scope `gmail.modify`
- Prisma + **Postgres** (tokens cifrados AES-256-GCM, mapeo de gestos,
  historial para deshacer) — pensado para desplegar en Vercel
- Framer Motion (animaciones de las tarjetas) + canvas-confetti
- Tailwind CSS

## Funcionalidad (completa)

- Login con Google vía NextAuth pidiendo el scope `gmail.modify`.
  Access/refresh token **cifrados** (AES-256-GCM) en la base, con refresco
  automático al caducar (`src/lib/gmailAuth.ts`).
- **Cambiar de cuenta**: el selector de cuenta (arriba a la derecha en
  `/setup` y `/swipe`) deja agregar otra cuenta de Gmail o cambiar a una ya
  conectada — usa el selector nativo de cuentas de Google
  (`prompt=select_account`), que muestra todas las cuentas logueadas en ese
  dispositivo/navegador (celular incluido). Cada cuenta que conectás queda
  guardada por separado (su propia configuración de gestos, su propio
  historial) y se recuerda como acceso rápido en ese navegador.
- `/setup` — qué acción dispara cada gesto (izq/der/arriba/abajo, la de
  abajo opcional), con opción de asignar una etiqueta real de Gmail
  (incluye Spam e Importante); y qué correos revisar (bandeja / no leídos /
  una etiqueta / búsqueda personalizada).
- `/swipe` — tarjetas con gesto de arrastre real (Framer Motion): rotan e
  inclinan al arrastrar, aparece un sello semitransparente con la acción
  configurada para esa dirección, y al pasar el umbral salen volando. Los 4
  botones circulares hacen lo mismo como alternativa al gesto. Cola de 2
  tarjetas con **prefetch**.
- Tocar la tarjeta (sin arrastrar) la expande en un modal con el cuerpo
  completo, mostrado siempre como **texto plano** — nunca se renderiza HTML
  de un remitente dentro de la app (evita tracking pixels y HTML/JS
  malicioso).
- El gesto **"Archivar"** crea (una vez) y aplica una etiqueta real
  `Archivar` en tu Gmail, además de sacarlo de la bandeja.
- **Deshacer**: "↩️ Deshacer última acción" es repetible (retrocede paso a
  paso, funciona aunque recargues la página). "⏮️ Deshacer todo y
  reiniciar" revierte TODO lo pendiente de una sola vez — pensado para
  recuperarte de golpe si algo se aplicó de más.
- "⏭️ Saltar" — pasa al siguiente correo sin aplicar ninguna acción ni
  tocar Gmail (para decidir más tarde).
- Contador de progreso ("124 de ~700" + barra) y pantalla final
  "¡Bandeja al día! 🎉" con confetti sutil.

---

## 1. Base de datos (Postgres)

**Por qué Postgres y no SQLite:** SQLite guarda todo en un archivo local, y
Vercel corre el backend en funciones serverless con filesystem efímero — un
archivo `.db` no persiste entre invocaciones ni se comparte entre
instancias. Con Postgres funciona igual en local y en producción.

Necesitás una base Postgres gratis (cualquiera de estas funciona, elegí una):

- **[Neon](https://neon.tech)** (recomendado, gratis, 1 minuto de alta) — al crear el proyecto te da dos connection strings: una **pooled** (con `-pooler` en el host) y una **directa**.
- **Vercel Postgres** (Storage → Create Database → Postgres, dentro de tu proyecto en Vercel) — mismo motor que Neon, integración nativa.
- **Supabase** — también sirve, usá la connection string "Transaction" (pooled) y la "Session"/directa.

Copiá `.env.example` a `.env` y completá:

```bash
DATABASE_URL="postgresql://...-pooler.../db?sslmode=require&pgbouncer=true"  # con pooling — la usa la app
DIRECT_URL="postgresql://.../db?sslmode=require"                             # directa — la usa `prisma migrate`
```

> Si tu proveedor no distingue pooled/directa, poné el mismo valor en las dos.

Después, **una sola vez**, generá y aplicá la migración inicial (crea las
tablas):

```bash
npx prisma migrate dev --name init
```

Esto crea `prisma/migrations/xxx_init/` — **commiteá esa carpeta** (no está
en `.gitignore`). A partir de ahí, cualquier deploy nuevo (local o en
Vercel) corre `prisma migrate deploy` automáticamente (ver script `build`
en `package.json`) y aplica los cambios de schema que falten.

---

## 2. Configurar Google Cloud (necesario para el login)

Para que el botón "Conectar con Gmail" funcione necesitás credenciales OAuth
propias. Son gratis y tardan ~5 minutos.

### 2.1 Crear el proyecto y activar la API de Gmail

1. Andá a [console.cloud.google.com](https://console.cloud.google.com/) y creá un proyecto nuevo (o usá uno existente).
2. En el buscador superior, escribí **"Gmail API"** → abrila → **Habilitar**.

### 2.2 Configurar la pantalla de consentimiento OAuth

1. Menú lateral → **APIs y servicios → Pantalla de consentimiento de OAuth**.
2. Tipo de usuario: **Externo** (a menos que tengas Google Workspace y quieras limitarlo a tu organización).
3. Completá nombre de la app ("Gmail Swipe"), tu email de soporte y el email de contacto del desarrollador.
4. En **Scopes**, agregá:
   - `.../auth/gmail.modify`
   - `openid`, `email`, `profile` (suelen estar por defecto)
5. En **Test users**, agregá tu propia cuenta de Gmail (y la de cada otra cuenta/persona que vaya a probar la app — **incluida cada cuenta extra tuya** que quieras conectar con el selector de cuentas). Obligatorio mientras la app esté en modo "Testing".
6. Guardá. La app queda en estado **"Testing"** — ver sección 4 más abajo.

### 2.3 Crear las credenciales OAuth (Web application)

1. Menú lateral → **APIs y servicios → Credenciales → + Crear credenciales → ID de cliente de OAuth**.
2. Tipo de aplicación: **Aplicación web**.
3. Nombre: "Gmail Swipe".
4. **Orígenes de JavaScript autorizados** — agregá TODAS las que vayas a usar:
   - `http://localhost:3020` (dev local)
   - `https://tu-app.vercel.app` (producción — el dominio real que te da Vercel)
5. **URIs de redirección autorizados** (¡NextAuth necesita esta parte exacta!):
   - `http://localhost:3020/api/auth/callback/google`
   - `https://tu-app.vercel.app/api/auth/callback/google`
6. Creá y copiá el **Client ID** y el **Client Secret**.

> Si ya tenías credenciales creadas para desarrollo, no hace falta crear
> otras para producción: solo agregá el origen y el redirect URI de Vercel
> a las mismas credenciales (paso 4-5 de arriba).

### 2.4 Completar el `.env`

```bash
GOOGLE_CLIENT_ID="tu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="tu-client-secret"
```

`NEXTAUTH_SECRET` y `TOKEN_ENCRYPTION_KEY` ya vienen generados en `.env`
para desarrollo local. Si alguna vez los regenerás, hacelo con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> ⚠️ `TOKEN_ENCRYPTION_KEY` cifra los tokens de Gmail guardados en la base.
> Si la perdés o cambiás, esos tokens quedan indescifrables (solución:
> reconectar la cuenta de Gmail de nuevo, no es catastrófico, pero evitalo).

### 2.5 Ejecutar la app en local

```bash
npm run dev -- --port=3020
```

Abrí `http://localhost:3020`, tocá "Conectar con Gmail" y aceptá los
permisos con una cuenta de test user. Deberías terminar en `/setup`.

> Si Google te devuelve "app no verificada", es normal en modo Testing —
> tocá "Avanzado" → "Ir a Gmail Swipe (no seguro)". Solo pasa con cuentas
> que vos agregaste como test user.

---

## 3. Deploy en Vercel

1. Subí el repo a GitHub (`git push`).
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importá el repo.
3. En **Environment Variables**, agregá (mismos nombres que en `.env`):
   - `DATABASE_URL`, `DIRECT_URL` — tu Postgres (sección 1).
   - `NEXTAUTH_URL` — la URL final de tu app, ej. `https://tu-app.vercel.app` (sin barra al final).
   - `NEXTAUTH_SECRET`, `TOKEN_ENCRYPTION_KEY` — podés reusar los de local o generar unos nuevos solo para producción (recomendado: nuevos).
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — de la sección 2.
4. Deploy. El `build` (`prisma generate && prisma migrate deploy && next build`, ver `package.json`) aplica el schema a tu Postgres de producción automáticamente en cada deploy.
5. Una vez que sepas la URL definitiva de Vercel, volvé a la sección 2.3 en Google Cloud y confirmá que ese dominio esté en **Orígenes autorizados** y su `/api/auth/callback/google` en **URIs de redirección** — si no, el login va a fallar con `redirect_uri_mismatch`.

Cosas a tener en cuenta:

- El **build falla a propósito** si `DATABASE_URL`/`DIRECT_URL` están mal o
  la base no es alcanzable — mejor eso que una app desplegada que falla en
  cada request. Si el deploy falla, revisá los logs de build en Vercel:
  casi siempre es una env var faltante o mal copiada.
- Este proyecto no necesita ninguna configuración especial de Vercel más
  allá de las env vars — Next.js 14 App Router se detecta solo.
- No subas nunca `.env` a git (ya está en `.gitignore`); las claves solo
  viven en tu máquina y en las Environment Variables de Vercel.

---

## 4. Verificación de la app ante Google (para más adelante)

Mientras uses Gmail Swipe vos y un puñado de cuentas/personas que agregues
como **test users**, el modo **Testing** alcanza y no requiere nada más —
esto incluye conectar varias cuentas tuyas con el selector de cuentas.

El scope `gmail.modify` es un **scope restringido** de Google. Si en el
futuro querés que **cualquier persona** (fuera de tu lista de test users)
pueda entrar sin ver avisos de "app no verificada", vas a necesitar:

1. Publicar la app (pasar de "Testing" a "In production" en la pantalla de consentimiento).
2. Pasar la **verificación de Google** para scopes restringidos: política de privacidad pública + dominio verificado, un video demostrando el uso del scope, posible auditoría de seguridad (CASA) según volumen de usuarios. Puede tardar varias semanas.

Para uso personal o un grupo cerrado, **no hace falta hacer nada de esto**.

---

## 5. Modelo de datos (Prisma / Postgres)

- `User` — un registro por **cuenta de Gmail conectada** (no por persona):
  si conectás dos Gmail tuyas, son dos `User` independientes, cada uno con
  su propia configuración y su propio historial.
- `GmailAccount` — access/refresh token **cifrados** (AES-256-GCM) + expiración.
- `GestureConfig` — qué acción de Gmail dispara cada gesto (izq/der/arriba/abajo) y qué correos revisar.
- `ActionHistory` — historial de acciones aplicadas, para poder deshacer.

Los tokens nunca se envían al cliente ni viven en la cookie de sesión: la
sesión de NextAuth es JWT y solo lleva el id interno del usuario activo;
las llamadas a la API de Gmail se hacen siempre server-side
(`src/lib/gmailAuth.ts`), leyendo y desencriptando el token justo antes de
usarlo, y refrescándolo automáticamente si caducó.

## Comandos útiles

```bash
npm run dev -- --port=3020         # levantar en dev
npx prisma studio                  # explorar la base Postgres visualmente
npx prisma migrate dev --name algo # crear+aplicar una migración tras tocar schema.prisma
npx tsc --noEmit                   # chequeo de tipos
npx eslint src --ext .ts,.tsx      # lint
```
