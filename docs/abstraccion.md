# Demostración de abstracción

El ejemplo usa la landing Órbita completa con Hero, Beneficios y CTA. Las dos versiones tienen el mismo HTML y las mismas reglas en el navegador. Con el DSL se mantienen los módulos SCSS y se compila la página. Con CSS directo se mantienen `index.html` y `landing.css`, que se pueden abrir y editar sin ejecutar Sass.

## Qué se expresa en cada versión

| Parte | Con SCSS | Con CSS directo |
|---|---|---|
| Grid completo | `$grid-columns` fija el total y `$gutter` el espacio. `grid.utilities` usa dos `@for` para columnas y offsets. `grid.render` recorre `$breakpoints` para generar las variantes. | `.grid` define las pistas y el gutter. En 12 columnas hay 24 reglas base (`.col-1` a `.col-12` y `.offset-0` a `.offset-11`), 24 para tablet desde 640 px y 24 para escritorio desde 960 px. |
| Tipografía fluida | `$type-scale` guarda los tamaños de cada título. `fluid-type()` calcula `clamp()` con el rango de 360 a 1200 px y `section-title()` aplica la fuente y el espaciado. | Cada título declara su `clamp()` y sus propiedades. El Hero usa `clamp(2.75rem, 1.4107142857rem + 5.9523809524vw, 5.875rem)`. Beneficios y CTA tienen sus propios valores. |
| Animaciones | `$animations` describe los fotogramas de `appear`, `rise`, `slide-left`, `slide-right` y `zoom-in`. Los mixins `animations.render` y `animations.library` generan los keyframes y las clases. | Se escriben los cinco `@keyframes` y los cinco modificadores `.motion_*`. Por ejemplo, `.motion_rise` declara `animation: rise 420ms ease-out both` dentro de `@media (prefers-reduced-motion: no-preference)`. |

## Pasar de 12 a 16 columnas

**Con SCSS.** Cambiar `$grid-columns: 12 !default;` a `16` en [`_config.scss`](../scss/_config.scss) y volver a generar. También se puede pasar `$grid-columns: 16` en `@use "config" with (...)`. Los bucles amplían las tres familias de utilidades. Sass calcula el reparto de cada sección y el generador HTML usa las clases resultantes.

**Con CSS directo.** Cambiar `--grid-columns` en `.grid` a `16`. Añadir `.col-13` a `.col-16` y `.offset-12` a `.offset-15` en base, tablet y escritorio. Son 24 reglas nuevas en total. El valor `--grid-start` de cada offset es el número del selector más uno.

| Elemento | Reparto a 12 | Reparto a 16 |
|---|---|---|
| Hero (texto, ilustración) | `7 5` | `9 7` |
| Beneficios (tres tarjetas) | `4 4 4` | `6 5 5` |

Para reproducir también el CSS exacto, actualizar `--layout-tablet` de `.hero` y `.benefits` con esos repartos. En el HTML estático, sustituir las clases `col-tablet-*` de los cinco elementos. La tipografía y las animaciones se conservan en ambas configuraciones.

En CSS se puede buscar directamente un selector como `.offset-tablet-15` y leer su valor. En SCSS hay que seguir el mapa de breakpoints y el bucle para encontrarlo. Para ampliar el grid, el SCSS concentra la decisión en una variable, mientras que en CSS hay que revisar cada grupo de utilidades y sus usos en el HTML.

## Medición

```sh
npm ci
node scripts/abstraccion.mjs
```

| Columnas | Líneas de SCSS | Líneas de CSS expandido |
|---:|---:|---:|
| 12 | 439 | 492 |
| 16 | 439 | 564 |

Se cuentan las líneas de código con el formato de cada archivo, omitiendo las líneas vacías y los comentarios `//`. La columna SCSS incluye la entrada de compilación y los seis módulos de la landing. La columna CSS usa esa misma salida expandida como punto de partida para la versión estática. Las 24 reglas adicionales ocupan tres líneas cada una y explican las 72 líneas de diferencia. El HTML queda fuera del conteo en ambas columnas.

El script deja `index.html` y `landing.css` en `dist/abstraccion/12/` y `dist/abstraccion/16/`. Se puede abrir cualquiera de los HTML directamente o ver las ediciones necesarias entre las dos copias con `git diff --no-index dist/abstraccion/12 dist/abstraccion/16`.
