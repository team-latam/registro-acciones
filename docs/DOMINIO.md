# Mudar el sitio a `registro.team-latam.com`

## Por qué

El 2 de octubre de 2026 el sitio dejó de abrir desde Argentina. Lo que se
comprobó, en este orden:

| Prueba | Resultado |
|---|---|
| `team-latam.github.io` desde su wifi | `ERR_CONNECTION_TIMED_OUT` |
| `team-latam.github.io` desde el celular con 5G | conecta y se cuelga, pantalla en blanco |
| La misma página pedida desde un runner de GitHub | **HTTP 200, 948.252 bytes, completa** |
| El mismo archivo por otro CDN (jsDelivr), desde su 4G | **bajó entero** |
| `microsoft.github.io` desde su celular | se cuelga igual |

O sea: la conexión puede bajar el archivo, el sitio está publicado y
sano, y lo que falla es **el nombre `*.github.io`** en el camino hacia
Argentina — no este proyecto. Por eso un sitio de Microsoft en el mismo
dominio falla igual.

Un dominio propio lo resuelve porque el navegador se conecta pidiendo
`registro.team-latam.com`: el bloqueo mira el nombre, y ese nombre no
está en la lista. El servidor sigue siendo el mismo GitHub Pages.

> Si en algún momento la página vuelve sola, el bloqueo se levantó — pero
> conviene hacer la mudanza igual: ya pasó una vez y va a volver a pasar.

## Antes de empezar: probar lo barato

Si el bloqueo fuera del DNS del proveedor (y no del tipo que mira el
nombre al conectar), se arregla gratis y en tres minutos:

1. Windows: `Configuración` → `Red e Internet` → `Wi-Fi` → `Propiedades
   del hardware` → `Asignación de servidores DNS` → `Editar` → `Manual`,
   prender IPv4 y poner `1.1.1.1` y `1.0.0.1`.
2. Consola: `ipconfig /flushdns`
3. Probar de nuevo.

Si anda, listo, no hace falta nada de lo de abajo. Si no, seguir.

## El orden importa

**Primero el DNS, después GitHub.** Al revés, GitHub empieza a mandar a
todo el mundo a un dominio que todavía no existe, y el sitio se cae
también para quienes hoy sí pueden entrar.

## 1. El registro DNS

Donde esté administrado `team-latam.com` (el panel del proveedor del
dominio), agregar:

| Tipo | Nombre | Valor |
|---|---|---|
| `CNAME` | `registro` | `team-latam.github.io.` |

Con el punto final si el panel lo pide. Esperar a que resuelva — suele
ser de un minuto a una hora.

## 2. GitHub

`Settings` → `Pages` → `Custom domain` → escribir
`registro.team-latam.com` → `Save`.

GitHub crea solo un archivo `CNAME` en la raíz del repo: **no borrarlo**,
es lo que le dice a Pages qué dominio sirve.

Después aparece `Enforce HTTPS` en gris mientras emite el certificado
(hasta ~15 minutos). Cuando se pueda tildar, tildarlo.

A partir de ahí `team-latam.github.io/registro-acciones/` redirige solo
al dominio nuevo: nadie tiene que cambiar su marcador. (Quien esté
bloqueado tampoco va a poder llegar a la redirección, así que al equipo
hay que pasarle la dirección nueva igual.)

## 3. Autorizar el dominio nuevo en los tres lados

El login y el calendario están atados al dominio desde el que se sirve la
página. Con el dominio nuevo sin autorizar, la página abre pero no se
puede iniciar sesión.

1. **Supabase** → `Authentication` → `URL Configuration` → agregar
   `https://registro.team-latam.com` a `Site URL` y a `Redirect URLs`
2. **Google Cloud** → `APIs y servicios` → `Credenciales` → la clave de
   API del navegador (la que está en `index.html`, restringida por
   dominio) → `Restricciones de sitio web` → agregar
   `https://registro.team-latam.com/*`
3. **Google Cloud** → la misma pantalla → el `ID de cliente de OAuth` →
   `Orígenes de JavaScript autorizados` → agregar
   `https://registro.team-latam.com`

> No tocar la **otra** clave de API, la del secreto `CALENDAR_API_KEY`:
> ésa no tiene restricción de dominio a propósito, porque la usa el
> workflow de Calendar desde un servidor.

## 4. Sumar el dominio nuevo en dos lugares del código

Desde el 6 y 7/10/2026 hay dos listas que aceptan solo
`https://team-latam.github.io`. Sin sumar el dominio nuevo, la app abre
pero el calendario y los avisos por correo dejan de andar sin un error
claro (el navegador bloquea las respuestas de las funciones), y el botón
de Google de la portada no aparece:

1. **`supabase/functions/_compartido/web.mjs`** → `ORIGENES`: sumar
   `/^https:\/\/registro\.team-latam\.com$/`. Al pushearlo a `main`, el
   workflow «Funciones de Supabase» vuelve a publicar `calendario` y
   `avisar` solo.
2. **`index.html`** → `ORIGENES_DEL_BOTON_DE_GOOGLE`: sumar
   `"https://registro.team-latam.com"`.

Las dos van **antes** de mudar (con las dos direcciones a la vez no se
rompe nada).

## Qué NO hay que tocar

- **El resto de `index.html`**: el redirect de Supabase sale de
  `location.href`, así que se adapta solo.
- **El SQL**: tampoco.

## Comprobarlo

`Actions` → **¿Está arriba la página?** → `Run workflow`. Para que mire
el dominio nuevo hay que cambiar `URL:` arriba del archivo
`.github/workflows/esta-arriba.yml`.
