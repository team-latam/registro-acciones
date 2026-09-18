# Calendar, sin que nadie tenga la app abierta

Hasta ahora, un evento creado o cambiado **directo en Google Calendar**
entraba al Registro solo mientras alguien tenía la app abierta: el
navegador chequeaba cada 30 segundos. Si nadie entraba en toda la semana no
se perdía nada —Google guarda el lugar donde quedó— pero tampoco pasaba
nada hasta que alguien abriera.

Ahora esto corre **todas las madrugadas a las 3**, sin nadie adelante.

---

## Lo único que tenés que hacer, una vez

### 1. Copiar la llave de servicio de Supabase

Supabase → **Project Settings** → **API Keys**, en el menú de la izquierda.

Ahí puede aparecer de dos formas, según cómo lo muestre el panel:

- Si ves una que dice **`service_role`**, con un "Reveal" al lado → esa es.
- Si en cambio ves **"Secret keys"** y un botón para crear una → creá una
  nueva (`sb_secret_...`). Hace exactamente lo mismo: es el formato nuevo
  de llaves, el mismo sistema del que salió la `sb_publishable_...` que usa
  la app.

> ⚠️ **Esa llave pasa por encima de todos los permisos.** No es la misma
> que está en `index.html` (esa es la pública, y está bien que sea
> pública). Con la de servicio se puede leer, cambiar y borrar todo sin
> pasar por ninguna regla. No la pegues en un chat (tampoco conmigo), ni en
> un mail, ni en una captura. Va directo del panel de Supabase al de
> GitHub.

### 2. Guardarla en GitHub

https://github.com/team-latam/registro-acciones/settings/secrets/actions
→ **New repository secret**

- **Name:** `SUPABASE_SERVICE_ROLE_KEY`
- **Secret:** la llave que copiaste

Listo. Nada más: a qué proyecto conectarse, qué calendario mirar y con qué
clave leerlo salen de `index.html`, que es donde ya viven.

---

## Qué hace, todas las noches

1. Le pregunta a Google qué cambió desde la última vez.
2. Por cada evento decide lo mismo que decidiría la app: cancelar un
   posteo, mover una fecha, actualizar un título, o crear uno nuevo.
3. Escribe en Supabase y deja el comentario de 📅 Google Calendar, igual
   que cuando sincroniza desde el navegador.

### Dónde mirar

https://github.com/team-latam/registro-acciones/actions/workflows/calendario.yml

Cada corrida deja un resumen con cuántos eventos revisó y cuántos aplicó.
Si un evento falla, los demás se aplican igual y ese queda anotado con el
motivo.

### Correrlo a mano

En esa misma pantalla, botón **Run workflow**. Sirve para no esperar a la
madrugada.

---

## Lo que hay que saber antes de tocar esto

**La lógica está escrita dos veces.** Una en `index.html`
(`applyCalendarEventToPosts`, la que corre en el navegador) y otra en
`decidir.mjs` (la que corre de noche). Son la misma decisión en dos
lugares, y eso se eligió a ojos abiertos: llevarla a un solo lugar
obligaría a partir `index.html` en varios archivos, que es justamente lo
que este proyecto no hace.

**Lo que evita que se separen en silencio** es `pruebas/diferencial.mjs`:
corre las dos contra los mismos 48 eventos y compara, escritura por
escritura, lo que pide cada una. Si alguien toca una sola, esa prueba se
cae — y se cae en GitHub, en cada push que toque `index.html` o esta
carpeta, antes de que nadie lo note en producción.

**Si esa prueba se cae: no la saltees.** Significa que las dos copias
dejaron de decir lo mismo, y arreglarla es hacer el mismo cambio del otro
lado.

---

## Los archivos

| | Qué es |
|---|---|
| `decidir.mjs` | Qué hacer con cada evento. No escribe nada: devuelve la lista de escrituras. Por eso se puede comparar con la app sin tocar ninguna base |
| `sincronizar.mjs` | El trabajo: le pregunta a Google, llama a `decidir()` y ejecuta lo que dijo |
| `pruebas/diferencial.mjs` | Las dos copias contra los mismos eventos |
| `pruebas/de-punta-a-punta.mjs` | El trabajo entero contra un Supabase y un Calendar de mentira |
| `pruebas/correr.sh` | Las dos juntas |

## A mano, si hace falta

```
# Decide pero NO escribe: sirve para ver qué haría
EN_SECO=1 SUPABASE_SERVICE_ROLE_KEY=... node supabase/sync-calendar/sincronizar.mjs

# De verdad
SUPABASE_SERVICE_ROLE_KEY=... node supabase/sync-calendar/sincronizar.mjs

# Las pruebas (no necesitan ninguna llave ni internet)
./supabase/sync-calendar/pruebas/correr.sh
```
