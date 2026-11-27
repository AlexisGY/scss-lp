# SCSS-LP · Guion de demo y pruebas en contenedor

Proyecto 4 de SW608 · Grupo 2

Guion ejecutable de principio a fin sobre el contenedor Docker para validar los 10 pasos del flujo principal (`CP-01` a `CP-10`), los 5 casos de error (`CE-01` a `CE-05`, Criterio B) y el cierre técnico con auditoría BEM, métricas y lecciones aprendidas (Criterio E).

## Arranque del contenedor

```sh
docker build -t scss-lp .
docker run --rm --name scss-lp-demo -p 127.0.0.1:3000:3000 scss-lp
```

Para ejecutar el paso `CP-05` (editar `scss/_config.scss` en caliente sin reconstruir la imagen), monta la carpeta `scss` en `/app/scss`:

```sh
# Linux / macOS
docker run --rm --name scss-lp-demo -p 127.0.0.1:3000:3000 -v "$(pwd)/scss:/app/scss" scss-lp

# Git Bash (Windows)
MSYS_NO_PATHCONV=1 docker run --rm --name scss-lp-demo -p 127.0.0.1:3000:3000 -v "$(pwd)/scss:/app/scss" scss-lp

# PowerShell (Windows)
docker run --rm --name scss-lp-demo -p 127.0.0.1:3000:3000 -v "${PWD}/scss:/app/scss" scss-lp
```

Abre [http://localhost:3000](http://localhost:3000).

## Flujo principal (`CP-01` a `CP-10`)

| ID | Precondición | Acción | Resultado esperado | Responsable |
|---|---|---|---|---|
| `CP-01` | Contenedor arriba y constructor abierto en `http://localhost:3000` con las 3 secciones marcadas por defecto. | Desmarcar **Beneficios**, dejar **Hero** y **Llamada a la acción** y pulsar **Generar página**. | La vista previa muestra únicamente Hero y CTA; el botón **Descargar HTML** se habilita y `#status` indica `Página generada.`. | Roy |
| `CP-02` | Landing generada con Hero visible en modo **Escritorio**. | Alternar entre **Móvil** y **Escritorio** en la barra de vista previa. | En Móvil, Hero apila texto e ilustración en una columna; en Escritorio se muestran en paralelo y el título escala suavemente dentro de su rango `clamp()`. | Roy |
| `CP-03` | Landing generada con Hero y CTA. | Abrir la pestaña **CSS generado** y buscar `.col-12`, `clamp(`, `@keyframes rise` y `@media`. | Se observan las utilidades generadas por `@for`, el escalado tipográfico fluido, los `@keyframes` de `@each` y las media queries; el panel inferior marca `Reglas duplicadas: 0`. | Alexis |
| `CP-04` | Volver a marcar **Beneficios** para tener las 3 secciones y estar en **12** columnas. | Seleccionar **16** en **Columnas del grid** y volver a **Vista previa**. | El reporte cambia a `Columnas: 16`. En **CSS generado** aparecen `.col-16`, `.offset-15` y `.col-desktop-16`. En `tablet`, Hero reparte `9` y `7` columnas y las tarjetas de Beneficios `6`, `5` y `5` llenando la fila completa. | Lenin |
| `CP-05` | Contenedor iniciado con el volumen `-v .../scss:/app/scss` y página recién recargada (sin elegir columnas en pantalla). | Cambiar `$grid-columns: 12 !default;` a `16` en `scss/_config.scss` y pulsar **Generar página**. | Se obtiene el mismo grid de 16 columnas sin tocar el selector de pantalla, demostrando la única variable `$grid-columns` (luego restaurar `12`). | Lenin |
| `CP-06` | Landing generada y pestaña **Vista previa** activa. | Pulsar **Editar texto**, cambiar el título del Hero, cambiar entre 12 y 16 columnas y pulsar **Descargar HTML**. | El texto editado se conserva tras recompilar y aparece dentro del archivo `landing.html` descargado. | Franz |
| `CP-07` | Sección **Beneficios** activa con 3 tarjetas iniciales. | En **Tarjetas de Beneficios**, pulsar **+ Agregar tarjeta** dos veces (total 5), cambiar un color y abrir **SCSS usado**. | Las 5 tarjetas forman filas completas `3 + 2` sin huecos y **SCSS usado** muestra `$benefit-variants` con el color actualizado. | Alexis |
| `CP-08` | Constructor con landing generada. | En **Tipografía**, elegir una fuente en **Letra de los títulos** y abrir **SCSS usado**. | Cambia únicamente la tipografía de los títulos en la vista previa y aparece `$font-heading` en **SCSS usado**. | Alexis |
| `CP-09` | Se realizaron ediciones de estilo y tarjetas respecto al estado inicial. | Pulsar **Restablecer todo** y a continuación pulsar **Deshacer** (o `Ctrl+Z`). | **Restablecer todo** vuelve a la configuración base; **Deshacer** restaura inmediatamente el estado editado previo. | Roy |
| `CP-10` | Contenedor detenido o terminal en la raíz del proyecto con `$grid-columns` restaurado en `12`. | Pulsar **Restablecer todo**, restaurar 12 columnas y ejecutar `npm run check` y `npm run build`. | `npm run check` aprueba los 112 selectores BEM y todas las pruebas con >= 60 % de cobertura; `npm run build` emite `dist/reporte-css.json` con bytes finales y `duplicateRules: 0`. | Dair |

## Casos de error y validación (`CE-01` a `CE-05`)

| ID | Precondición | Acción | Resultado esperado | Responsable |
|---|---|---|---|---|
| `CE-01` | Constructor abierto con una landing válida ya compilada (ej. Hero mínimo en `44` px). | En **Tipografía → Título del Hero → Mínimo (px)** ingresar `500` y salir del campo. | La API rechaza la configuración (`400`), `#status` muestra `El tamaño de hero debe ser un número entero entre 12 y 160.`, el cambio inválido se descarta del historial y el campo regresa al último valor válido. | Roy |
| `CE-02` | Contenedor corriendo en `http://127.0.0.1:3000`. | Consultar `GET http://127.0.0.1:3000/api/landing?sections=invalida` (navegador o `curl -i`). | El servidor responde HTTP `400 Bad Request` con JSON `{"error":"La selección incluye una sección desconocida."}` y no interrumpe el proceso. | Dair |
| `CE-03` | Panel **Enlaces e imagen** abierto en el constructor. | Escribir `javascript:alert(1)` en el campo de destino de un enlace y salir del campo. | El campo se marca con `aria-invalid="true"`, `#status` muestra `Destino no válido. Usa #seccion, https://, mailto: o tel:.` y el enlace en la vista previa conserva su destino seguro anterior. | Franz |
| `CE-04` | Panel **Enlaces e imagen** abierto y un archivo de imagen mayor a `1,5 MB` disponible. | Seleccionar la imagen de más de `1,5 MB` en **Imagen propia**. | El navegador rechaza el archivo antes de cargarlo, limpia el selector de archivo, mantiene la ilustración actual y `#status` muestra `La imagen no puede pesar más de 1,5 MB.`. | Franz |
| `CE-05` | Constructor abierto en el navegador conectado al contenedor `scss-lp-demo`. | Detener el contenedor (`docker stop scss-lp-demo`), cambiar columnas a `16` (fallará la compilación de red), volver a levantar el contenedor y pulsar **Generar página**. | Con el servidor caído, `#status` muestra el error de conexión sin borrar ni revertir la selección hecha en pantalla; al reintentar con **Generar página** con el contenedor arriba, compila y renderiza la landing de 16 columnas. | Dair |

## Ensayo y reparto de módulos para la defensa

Secuencia recomendada para el ensayo completo sin pausas desde el contenedor:

| Bloque | Pasos / Casos | Módulo asignado | Integrante |
|---|---|---|---|
| 1. Arquitectura y composición | `CP-01`, `CP-02`, `CP-09`, `CE-01` | Metamodelo del DSL, servidor (`src/generator.mjs`, `src/settings.mjs`) e historial | Roy |
| 2. Núcleo SCSS y secciones | `CP-03`, `CP-07`, `CP-08` | Configuración SCSS (`_config.scss`), secciones, animaciones y justificación del DSL | Alexis |
| 3. Grid procedural y tipografía | `CP-04`, `CP-05` | Mixins, bucles `@for`/`@each`, anillos configurables, `clamp()` y demostración de abstracción | Lenin |
| 4. Edición de contenido y descarga | `CP-06`, `CE-03`, `CE-04` | Vista previa segura (`sandbox`), textos, enlaces e imagen propia y exportación HTML | Franz (si no llega: Lenin) |
| 5. Calidad, CI y despliegue | `CP-10`, `CE-02`, `CE-05` + Lecciones aprendidas | Auditoría BEM, reporte de optimización (`0` duplicados), GitHub Actions y contenedor Docker | Dair |

**Plan de contingencia:** Si Franz no llega al ensayo o a la defensa, **Lenin** cubre el bloque 4 (`CP-06`, `CE-03`, `CE-04`).
