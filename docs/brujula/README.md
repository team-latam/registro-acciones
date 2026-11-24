# Brújula en Toldot — el módulo nuevo (en construcción)

> **Estado (23/11/2026):** las **tres etapas están construidas, en la rama** (y el usuario pidió subirlas juntas al final,
> a `main`). Hay una maqueta navegable (página privada del usuario, con datos inventados:
> <https://claude.ai/artifact/4YmAhH8p97ghuKU7EHYe1b>) de la que salió el diseño. **Hecho:** la base
> (`supabase/30-brujula.sql`, 48 comprobaciones), las copias de seguridad con las tablas nuevas, la función `brujula`
> (lee, da y quita acceso, comprueba links y escribe en las planillas: `supabase/functions/_compartido/brujula.mjs`, 111
> comprobaciones), el mail de bienvenida en cuatro idiomas, la pantalla (Administración › Brújula, `brujula_test.mjs`, 84
> comprobaciones) y el aviso por correo de pendientes (`supabase/avisos/brujula.mjs`, 28). **Falta, y es del usuario:** la
> parte de Google (`supabase/functions/LEEME.md`; hasta entonces la pantalla dice «Todavía no está conectado Google») y que
> alguien que lea hebreo mire el mail. Subir a `main` aplica el SQL a la base real y publica la función.

**Qué es.** «Brújula» es la biblioteca de material de la organización: carpetas de Google Drive que se comparten, en
modo lectura, con unas 450 personas de las comunidades. Hoy se les da acceso con dos planillas de Google y un
Google Apps Script (abajo). El usuario quiere **una pantalla en Toldot** para invitar, elegir a qué carpetas, agregar
carpetas y **quitar** accesos (total o parcial), sin tocar las planillas.

**Sin datos sensibles.** Las planillas «Users» tienen nombres y correos de personas de afuera: **no van a este repo,
que es público**. Tampoco los ID de las carpetas ni de las planillas, ni la cuenta de Gmail dueña. Las pruebas usan
gente inventada (`@example.org`).

## Cómo funciona hoy (revisado el 23/11/2026)

- **Drive.** Una carpeta raíz «Brújula Cloud» de una cuenta de Gmail de la organización. Adentro: la carpeta de
  **entrada** (lo que reciben todos, con accesos directos a las otras), «Hadraja · Enseñanza», «Habtaja · Seguridad»,
  «CARE», «Material de Congresos y Seminarios» y «Newsletter» (viven en «Administrador › Spanish»), una carpeta
  «Brújula Cloud · CARE» aparte, y las carpetas **en portugués** (de otra cuenta de Gmail), que hoy solo tiene el
  equipo. Hay carpetas viejas por rol (Instructores, Mefakdim y Kabatim, Roshim de Áreas) sin tocar desde 2023-24, y
  un *Manual de usuario* con cuatro niveles (Administrador, 1 RM/Kabatim, 2 instructores/mefakdim, 3 CARE/protectores)
  que **ningún Script aplica**.
- **Dos planillas «Users»**: la grande y la de CARE (una copia de la grande). Columnas: Nombre, Correo, Comunidad
  (lista estricta de la hoja oculta `Hoja3`), Language (Español/Inglés/Portugués, lista estricta), Enviado, Responsable.
- **El Script** (Apps Script atado a cada planilla): por cada fila sin «Enviado», da **lectura** en 6 carpetas (la
  grande) o 2 (la de CARE), **sin invitación de Drive**, y manda un **mail de bienvenida** propio (`MailApp`) en
  español, inglés o portugués: **el idioma solo cambia el texto del mail**, no las carpetas. Después escribe
  «Enviado» o el error. El de la grande corre **solo los lunes a las 00:41 (Argentina)**; el de CARE **se corre a mano**.
- **Lo que se vio de flojo** (para tener presente, no para arreglar acá): reescribe la columna F entera en cada
  corrida (borra «Responsable»); trabaja sobre la pestaña abierta (la de CARE tiene una vacía); lee solo los
  primeros 100 accesos de cada carpeta (`Permissions.list` sin paginar); pega el nombre en el HTML sin escapar;
  quien edita la planilla puede cambiar el código, que corre con los permisos de la cuenta dueña; **los accesos solo
  se suman** (no hay forma de sacar); los errores quedan escritos en una columna y nadie los ve; lo que reciben
  todos es lo mismo (CARE incluido).

## Lo que decidió el usuario (23/11/2026)

1. **Herramienta complementaria.** Las planillas y sus Scripts **siguen funcionando**; no se apagan en lo inmediato.
2. **Solo los admins** de Toldot la usan: **Administración › Equipo › Brújula**, entre Personas y Registro de actividad.
3. **Qué hace:** invitar eligiendo a qué carpetas (con «paquetes» como «Todo Brújula» y «Solo CARE», o carpetas
   sueltas), agregarle carpetas a alguien, **quitar acceso total o parcial**, y ver de un vistazo quién tiene qué
   (una cuadrícula personas × carpetas). Las carpetas se agregan pegando su link.
4. **Drive es la fuente de verdad.** Como las planillas también dan accesos, Toldot **lee Drive en vivo** y **no guarda
   una copia** de «quién tiene qué». Guarda solo: el catálogo de carpetas y planillas, y el historial de lo que se hizo
   desde Toldot.
5. **Leer las planillas** cada 15 minutos (y cada vez que se abre Brújula): las personas **cargadas que todavía no
   tienen acceso** (el Script corre los lunes), las filas con error y el idioma y la comunidad de cada persona. No es
   instantáneo: un trabajo programado de GitHub puede demorar unos minutos.
6. **Escribir en las planillas** (pedido del usuario, importante): una **fila nueva** por cada persona invitada desde
   Toldot, **ya marcada «Enviado»** (el Script se saltea las filas con «Enviado», así no se repite el mail ni el
   acceso); «Enviado» al darle acceso a un pendiente; una **nota** al quitar un acceso. **Solo filas nuevas y dos
   columnas nuevas al final** («Desde» y «Nota de Toldot»): no toca lo escrito ni «Responsable» (el Script la borra).
   Qué planilla: «Todo Brújula» → la grande; «Solo CARE» → la de CARE; «A medida» → la de CARE si todo lo elegido es de
   CARE, y si no la grande. La lista de comunidades se toma de la hoja oculta, para que coincida.
7. **Los pendientes de la planilla: opción A.** Toldot los **muestra** y **un admin aprieta «Dar acceso ahora»**
   (comparte, manda el mail y marca «Enviado»). **Nunca da acceso solo** a lo que aparezca en una planilla (la editan
   unas diez personas). Un aviso por correo al admin cuando aparezcan pendientes nuevos: posible, **apagado por
   defecto** (a decidir).
8. **El mail de bienvenida sale de Toldot** (Resend), no de Drive, con el botón **directo a la carpeta** (sin
   acortador) y en **cuatro idiomas: español, inglés, portugués y hebreo** (este de derecha a izquierda, con la
   maquinaria de `supabase/functions/_compartido/correos.mjs`). **«Brújula» queda en letras latinas** dentro del
   texto hebreo (decidido el 23/11). El texto hebreo de la maqueta **falta que lo lea una persona que sepa hebreo**.
   Antes de invitar, Toldot mira Drive: si la persona ya tiene carpetas, lo dice y **no manda otro mail**.
9. **Cómo habla con Google:** una **cuenta de servicio nueva, solo para Brújula** (secreto `GOOGLE_CUENTA_BRUJULA`),
   distinta de la del Calendar (si una llave se filtra, no queda expuesto lo otro); **Editor** en las carpetas y en las
   dos planillas; APIs de **Drive** y **Sheets** prendidas en el proyecto de Google Cloud de siempre (**no se borra**).
   La función de Supabase decide con la sesión de quien llama (`es_admin…`), igual que `calendario`; las carpetas
   las toma **del catálogo**, nunca de lo que mande el navegador.
10. **Límites de Drive que Toldot tiene que mostrar y no esconder:** solo gestiona **lectores** (a los editores no los
    toca); un acceso **heredado** de una carpeta madre no se puede quitar desde la hija (se avisa); algunas
    organizaciones no dejan compartir con externos (se explica con palabras claras).
11. **El catálogo de carpetas se edita desde Toldot, siempre a partir de un link de Drive** (pedido del usuario, el
    23/11/2026: hoy son siete carpetas, pero Brújula puede cambiar, con más, menos u otras). Se puede:
    - **Agregar** pegando el link. Toldot comprueba con Drive que sea una carpeta de «Mi unidad» y que pueda gestionarla;
      si el link es un **acceso directo** (la entrada de Brújula está hecha de accesos directos) propone la carpeta
      de verdad; si no está compartida con la cuenta de Toldot, explica cómo hacerlo; si es un documento, lo dice.
    - **Editar**: nombre propio en Toldot (el de Drive no se toca), orden, **paquetes** a los que
      pertenece y **en qué planilla** se anota a quien la reciba (la regla de la planilla: si todas las carpetas
      elegidas están marcadas para la de CARE, va a la de CARE; si no, a la grande).
    - **Desactivar**: no se ofrece al invitar ni se da a nadie nuevo; quien ya la tiene la conserva y se le puede quitar.
    - **Dejar de gestionar**: sale del catálogo; **en Drive no cambia nada**.
    - Aparte, **«sacar a todos los lectores»**: acción peligrosa, pide escribir el nombre de la carpeta, no toca a los
      editores y no se deshace desde Toldot.
    - Las **unidades compartidas** todavía no (tienen otro modelo de permisos).

    **Consecuencia a tener presente:** el Script de los lunes tiene su lista de carpetas **fija**. Una carpeta nueva
    del catálogo **no la da el Script**, solo Toldot (invitar y «Dar acceso ahora»); para que el Script también la dé
    hay que actualizarlo. Por eso, con carpetas distintas a las de hoy, conviene dar acceso desde Toldot.
    En la base, el catálogo son tablas editables (carpetas y paquetes), no código: el ID de Drive sale del link.

## Cómo tiene que verse (UX)

Pedido del usuario el 23/11/2026: que siga lo que ya se trabajó de UX en Toldot, y que sea **simple, nada engorroso, sin
texto innecesario** que explique cómo funciona algo o diga lo que ya se entiende. La maqueta se recortó con estas reglas:

- **Sin párrafos debajo de los títulos ni «¿Cómo funciona?»** en las pantallas de Brújula: el título y los controles se
  explican solos. Tampoco hay cartelitos que repitan lo que la pantalla ya muestra.
- **Texto solo cuando evita un error o aclara algo que no se ve**, en **una línea** y **en el momento**: al confirmar
  algo que no se deshace, ante un error, o en un caso especial (un acceso heredado, una carpeta que el Script no da).
- **El estado se ve, no se cuenta:** tildes, rayas y etiquetas cortas. Una etiqueta aparece **solo cuando algo pide
  atención** (por ejemplo «Falta permiso»), no «todo bien» en cada fila.
- **Una palabra para cada cosa:** *carpeta*, *paquete*, *planilla*, *acceso*, *personas* (como D25 en el resto de Toldot).
- **Botones con un verbo corto** («Invitar», «Agregar», «Guardar»); lo peligroso se confirma escribiendo el nombre.
- **En el celular, lo que se toca mide 44 px** y lo secundario 32 (Z2 de la auditoría).
- **Cuatro idiomas con textos cortos:** el portugués y el hebreo suelen ser más largos y rompen las filas.
- El mail de bienvenida también es corto (como «Ya podés entrar», D26).

Otras secciones de Administración sí llevan un párrafo y «¿Cómo funciona?»; no se tocaron. Se pueden revisar aparte si el
usuario lo pide.

## Etapas (todas construidas; ver el estado arriba)

1. **Conexión y lectura:** catálogo de carpetas y planillas, la lista unificada (Drive + planillas) y los pendientes.
   No cambia nada en Drive ni en las planillas.
2. **Invitar y dar acceso:** invitar con paquetes o carpetas sueltas, agregar carpetas, «Dar acceso ahora» a los
   pendientes, el mail en cuatro idiomas y la escritura en las planillas.
3. **Quitar y mantener al día:** quitar total o parcial, acciones en grupo, la nota en la planilla, la lectura cada 15
   minutos y los avisos.

Con cada etapa: pruebas contra una **Drive y unas planillas de mentira** (como las de `supabase/sync-calendar/pruebas/`
y `supabase/functions/_pruebas/`); las **tablas nuevas se suman a `TABLAS` de `supabase/respaldo/respaldar.mjs`**
(para que entren en la copia de seguridad); el **recorrido de bienvenida** (`tourSteps()`) o `TOUR_SIN_PASO` se
revisa en la misma tanda; todo texto va en los cuatro idiomas.

## Hebreo en las planillas (falta decidir cómo)

Los menús de «Language» de las dos planillas aceptan solo Español, Inglés y Portugués, y el Script no conoce el
hebreo: una fila con «Hebreo» procesada un lunes sale **en español**. Dos caminos, que se pueden hacer los dos:
darle acceso desde Toldot («Dar acceso ahora», donde el hebreo ya funciona) y/o **actualizar los dos Scripts** (se
le pasa al usuario cada código **entero**, en un bloque, con una línea de qué cambió). Agregar «Hebreo» a los menús
lo hace el usuario o Toldot la primera vez que se conecte, **solo con su OK** (es un cambio en su planilla).

## Lo que tiene que hacer el usuario, en Google (una vez; los pasos van con capturas cuando se llegue)

> Las llaves **no se pegan en el chat**: van del panel donde nacen al de GitHub (`supabase/functions/LEEME.md`
> tiene el mismo procedimiento para la cuenta del Calendar).

1. Prender las APIs de **Drive** y de **Sheets** en el proyecto de Google Cloud.
2. Crear la cuenta de servicio de Brújula y su llave; cargarla en GitHub como `GOOGLE_CUENTA_BRUJULA`.
3. Compartir con esa cuenta, como **Editor**, las carpetas del catálogo y las dos planillas.
4. (Si se elige) agregar «Hebreo» a los menús de «Language» y actualizar los Scripts.

## Respuestas del 23/11/2026 (después de la maqueta)

- **Las carpetas en portugués no se suman** al catálogo (hoy no las recibe nadie de afuera y así sigue).
- **Aviso por correo al admin** cuando aparezcan pendientes nuevos en una planilla: **sí, y apagado por defecto.**
- **«Hebreo» en las planillas y en los Scripts: sí, pero después** («vamos de a poco»): primero el módulo de Toldot.
- **El texto hebreo del mail** lo revisa una persona que lea hebreo antes de que salga a alguien real (ok).
- **Los «¿Cómo funciona?» de las otras secciones de Administración: por ahora no se tocan.**
- «Primero hagamos esto» se tomó como el **visto bueno para empezar la etapa 1** (en la rama; a `main` solo con su OK y capturas).

## Lo que pasó al construirlo (para tener presente)

- **Un acceso heredado no se ve de antemano:** Drive no dice, en «Mi unidad», si un permiso viene de una carpeta madre.
  Toldot lo descubre al intentar quitarlo y lo explica («Le llega por otra carpeta: hay que sacarlo en Drive»).
- **Quién figura en la lista (24/11/2026):** quien tiene alguna carpeta o espera acceso. Quien se queda sin ninguna carpeta y sin
  nada esperando **ya no figura**, aunque su fila «Enviado» siga en la planilla (la fila no se borra: queda como historial, con la
  nota «Quitado de…»). Si se lo vuelve a invitar, vuelve a aparecer. Lo pidió el usuario: «no debería existir este registro».
- **Sacar de la lista (24/11/2026):** una persona a la que el Script no pudo darle acceso (por ejemplo, el administrador de su
  organización no deja recibir archivos de afuera) queda con la fila en error y **sin nada en Drive**: no hay acceso que quitar.
  Para eso está «Sacar de la lista» (la ficha y la barra de varias personas; el botón cambia de nombre solo cuando ninguna de las
  elegidas tiene carpetas). Escribe «Enviado» en la fila —el Script de los lunes salta solo las filas que dicen exactamente
  «Enviado»; con otra palabra, como «Descartado», las vuelve a procesar y a escribir encima— más una nota. Pasaba que «Quitar todo
  el acceso» le pedía a la función quitar **cero** carpetas, la función rechazaba el pedido entero y la pantalla ponía «Google no
  contestó» en las 7 carpetas: un fallo del pedido entero ahora se dice una sola vez y sin inventar un motivo por carpeta.
- **Lo que se anota en el registro de actividad:** `brujula_dio` y `brujula_quito` (03-validacion.sql), con quién lo hizo, a quién y
  de qué carpetas.
- **El aviso por correo a los admin** (viene apagado) lo corre el workflow horario de siempre («Resúmenes por correo»); se prende
  en Administración › Correos (`correos.brujula = { on }`).
- **Una prueba que dependía de la fecha** (`gastos_analisis_test`, un evento «dentro de 40 días» que desde fines de noviembre
  cae en 2027) se arregló de paso.

## Pendiente

- Empezar con el usuario la parte de Google (APIs, cuenta de servicio, compartir carpetas y planillas): se hace de a un paso.
- Que alguien que lea hebreo mire el mail antes de la etapa 2.
- «Hebreo» en los menús de las planillas y en los Scripts (después del módulo).
