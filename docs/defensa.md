# SCSS-LP · Informe técnico y guion de defensa

Proyecto 4 de SW608 · Grupo 2

## Fundamentación

SCSS es un DSL de estilos que Sass compila a CSS. En este proyecto, una configuración declarativa describe la cuadrícula, los umbrales de viewport, las escalas tipográficas, las secciones y las animaciones. Durante la compilación, `@for` emite las familias de utilitarios, `@each` recorre listas y mapas, los mixins producen reglas reutilizables y `fluid-type()` calcula una expresión CSS `clamp()`. El navegador evalúa las media queries y ajusta la tipografía en tiempo de visualización.

La ventaja frente a CSS escrito a mano es que el diseño responsive se expresa con variables y familias de reglas. Esto permite cambiar una decisión del diseño en un solo lugar y regenerar sus variantes. JavaScript se ocupa de recibir la selección, armar el HTML y presentar el resultado. Sass decide qué reglas de estilo emitir.

### Demostración de abstracción

Estas son las doce clases base del grid con CSS escrito a mano, en formato compacto de una línea por clase.

```css
.col-1  { --grid-span: 1; }
.col-2  { --grid-span: 2; }
.col-3  { --grid-span: 3; }
.col-4  { --grid-span: 4; }
.col-5  { --grid-span: 5; }
.col-6  { --grid-span: 6; }
.col-7  { --grid-span: 7; }
.col-8  { --grid-span: 8; }
.col-9  { --grid-span: 9; }
.col-10 { --grid-span: 10; }
.col-11 { --grid-span: 11; }
.col-12 { --grid-span: 12; }
```

El fragmento equivalente en SCSS ocupa cinco líneas, más la variable que declara el total de columnas y que se comparte con el resto del diseño.

```scss
@for $span from 1 through config.$grid-columns {
  .col-#{$span} {
    --grid-span: #{$span};
  }
}
```

Al pasar a 16 columnas, el CSS manual necesita cuatro reglas nuevas solo para la familia base. En SCSS, editar la variable también actualiza los offsets, las variantes por breakpoint y las proporciones de los componentes.

## Metamodelo del DSL

| Metaclase | Atributos y restricciones | Sintaxis concreta |
|---|---|---|
| LandingPage | Secuencia de una a tres secciones distintas. | `@use "landing" with ($section-order: ("hero", "cta"));` |
| Section | Tipo en el conjunto `hero`, `benefits`, `cta`. | Lista `$section-order`, procesada con `@each`; mixins `sections.hero`, `sections.benefits`, `sections.cta`. |
| Grid | Total de columnas entero de al menos 3. Gutter con valor CSS compatible con `gap`. | `$grid-columns: 12 !default;` y `$gutter: 1rem;`. El selector del constructor configura la misma variable con `@use "config" with (...)`. |
| ColumnSpan | Entero entre 1 y el total de columnas. | `@for $span from 1 through config.$grid-columns` emite `.col-#{$span}`. |
| Offset | Entero entre 0 y el total de columnas menos 1. Sin `.col-*`, el elemento ocupa las columnas restantes. Con `.col-*`, la suma de offset y ancho no debe superar el total. | `@for $offset from 0 to config.$grid-columns` emite `.offset-#{$offset}`. |
| Breakpoint | Nombre único y ancho mínimo. El mapa va en orden ascendente; si no, la compilación falla con un error. | `$breakpoints: (tablet: 640px, desktop: 960px);`. |
| TypographyScale | Tamaño mínimo positivo, máximo igual o superior y viewport mínimo positivo menor al máximo. | `tools.fluid-type(44px, 94px)` usa `$viewport-min` y `$viewport-max`. |
| Animation | Nombre único y mapa ordenado de fotogramas. Cada entrada genera su `@keyframes` y su modificador `.motion_<nombre>`. | `$animations: (appear: (from: (opacity: 0), to: (opacity: 1)));`. |
| Keyframe | Punto `from`, `to` o porcentaje válido y mapa de declaraciones CSS. | `from: (opacity: 0, transform: translateY(12px))`. |

| Metasociación | Multiplicidad | Realización |
|---|---|---|
| LandingPage contiene Section | 1 a 1..3, ordenadas | Lista `$section-order`. |
| LandingPage usa Grid | 1 a 1 | Inclusión de `grid.render`. |
| Grid genera ColumnSpan y Offset | 1 a N para cada familia | Dos bucles `@for` en `grid.utilities`. |
| Grid se adapta a Breakpoint | 1 a 0..N | `@each` sobre `$breakpoints` y mixin `tools.at`. |
| Section usa TypographyScale | 1 a 0..N | Llamadas a `fluid-type()` desde estilos BEM. |
| Section aplica Animation | 1 a 0..N | Clases `motion motion_<nombre>` en el HTML. La librería completa va en un único bloque `prefers-reduced-motion`. |
| Animation contiene Keyframe | 1 a 1..N | Mapa de fotogramas recorrido por `@each` dentro de `@keyframes`. |

## El constructor es un editor del DSL

La pantalla no modifica el CSS: arma configuración SCSS y Sass vuelve a compilar. La pestaña **SCSS usado** lo muestra, por ejemplo:

```scss
@use "config" with (
  $grid-columns: 16,
  $gutter: 2rem,
  $benefit-variants: (speed: #ff8800, extra1: #ffe08a)
);

@use "landing" with ($section-order: ("cta", "hero", "benefits"));
```

| Metaclase añadida | Restricción | Sintaxis concreta |
|---|---|---|
| Palette | Nombres fijos; en pantalla, colores `#rrggbb`. | `$palette: (background: #1c1a2c, ...)`, leída con `tools.color()`. |
| TypeScale | Entre 12 y 160 px en pantalla; máximo no menor que el mínimo. | `$type-scale: (hero: (min: 44px, max: 94px), ...)` con `tools.title-size()`. |
| FontStack | Nombre de una pila de `$font-stacks`; en pantalla solo se elige de esa lista. Agregar una entrada la suma al selector. | `$font-stacks: (serif: (Georgia, ...))`, `$font-heading: serif;`, leída con `tools.font()`. |
| BenefitCard | De 1 a 6, en filas de hasta 3 que siempre quedan llenas. | `$benefit-variants` y `tools.distribute-rows()`. |

**Validación:** `src/settings.mjs` solo acepta claves conocidas, colores hexadecimales, números dentro de rango y nombres de listas cerradas. Nada escrito por el usuario llega al SCSS sin pasar por ahí. Lo que no se cambia en pantalla sigue saliendo de `_config.scss`.

**Tipografía:** se usan fuentes del sistema para no descargar nada y que el HTML exportado funcione sin conexión. Si un equipo no tiene la primera fuente de la pila, usa la siguiente, así que el aspecto puede variar entre computadoras.

**Deshacer y rehacer:** `public/history.js` guarda una foto del estado después de cada cambio (hasta 100). Al volver a una foto con otro estilo, Sass recompila; si solo cambia el contenido, se aplica sin recompilar. Un valor rechazado por la validación no queda en el historial.

**Contenido:** textos, enlaces e imagen no son estilo, así que no pasan por Sass. Se aplican en el navegador y viajan en el HTML descargado. Los enlaces se limitan a anclas, `https:`, `http:`, `mailto:` y `tel:`; las imágenes, a formatos rasterizados.

## Generación procedural por sección

| Sección | Bucles y funciones SCSS | Configuración que la gobierna |
|---|---|---|
| Hero | `@for` para los tres anillos; `math.ceil` para repartir texto e ilustración; mixin `tools.layout()`; `fluid-type()`. | `$grid-columns` |
| Beneficios | `distribute-rows()` y `distribute()` (con `@each` y `@for`) forman filas sin huecos (16 / 3 = 6, 5, 5; 5 tarjetas = 3 + 2); un `@each` emite cada color; `title-size()`. | `$grid-columns`, `$benefit-variants`, `$cards-per-row` |
| Llamada a la acción | `glow-layers()` recorre un mapa con `@each` y construye las capas `radial-gradient()`; `fluid-type()`. | `$cta-glows` |

## La landing usa su propio grid

Sass calcula el reparto de cada sección y lo publica como `--layout-tablet` (por ejemplo `7 5` para Hero). El generador lo lee del CSS compilado y coloca las utilidades `.col-tablet-N` en el HTML. La decisión del diseño sigue en SCSS, y la página se maqueta con las mismas clases que ofrece el DSL.

La librería genera todas las utilidades `.col-*` y `.offset-*` porque el enunciado las exige; la landing de ejemplo usa solo las que necesita.

## Reinicio de variables del grid

Las propiedades personalizadas de CSS se heredan. Sin reiniciarlas, un grid anidado tomaba el ancho o el offset de un ancestro. La regla `:where(.grid > *)` las reinicia en cada hijo directo con especificidad cero, de modo que cualquier `.col-*` u `.offset-*` sigue teniendo prioridad.

## Auditoría BEM

La auditoría BEM usa `sass-lint` con `strictbem` sobre los selectores emitidos por Sass. El script extrae los selectores como SCSS plano, para que el parser de `sass-lint` pueda verificar también las clases creadas por interpolación y módulos `@use`. Como `sass-lint` solo revisa nombres, `scripts/bem.mjs` añade las reglas estructurales: sin IDs, sin clases encadenadas y sin selectores descendientes entre clases.

## Caso de uso principal

| Campo | Descripción |
|---|---|
| ID | CU-01 |
| Nombre | Generar una landing responsive |
| Actor | Usuario del constructor |
| Precondiciones | Constructor accesible y catálogo de secciones disponible. |
| Flujo principal | El actor elige secciones, pulsa **Generar página** y el sistema valida la selección. Sass compila el CSS y el constructor muestra el HTML, el código y el reporte. Opcionalmente elige 12 o 16 columnas y edita los textos sobre la vista previa. |
| Flujo alterno | Si ninguna sección está marcada, el botón se deshabilita. Si la API recibe una sección desconocida o repetida, devuelve un error de validación. |
| Postcondiciones | El usuario puede revisar la landing con dos anchos o descargar el HTML con sus estilos. |

## Historias y criterios de aceptación

| Historia | Given | When | Then |
|---|---|---|---|
| HU-01. Como usuario, quiero elegir secciones para componer mi landing. | El catálogo de secciones está disponible. | Selecciono Hero y CTA y pulso **Generar página**. | Se muestran Hero y CTA en la vista y el CSS omite los selectores propios de Beneficios. |
| HU-02. Como usuario, quiero comparar la landing en móvil y escritorio. | Generé una landing con Hero. | Alterno entre Móvil y Escritorio. | El cambio de ancho activa los breakpoints. Hero pasa de una columna a texto e ilustración en paralelo y el tamaño del título se ajusta dentro de su rango. |
| HU-03. Como mantenedor, quiero cambiar el total de columnas desde la configuración. | El grid tiene 12 columnas y la auditoría reporta cero duplicados. | Cambio `$grid-columns` a 16 y genero de nuevo. | El reporte indica 16 columnas y el CSS incluye `.col-16`, `.offset-15` y sus variantes responsive, con cero duplicados. |

## Guion de defensa

Consulta el [guion completo ejecutable en contenedor con casos de prueba y casos de error](guion.md).

| Paso | Acción | Evidencia esperada |
|---|---|---|
| 1 | Abrir el constructor y generar Hero y CTA. | La landing muestra las dos secciones seleccionadas. |
| 2 | Alternar Móvil y Escritorio. | Hero cambia de disposición y su fuente se escala. |
| 3 | Abrir **CSS generado** y buscar `.col-12`, `clamp(`, `@keyframes rise` y `@media`. | Se ven las reglas del DSL y el panel indica cero duplicados. |
| 4 | Marcar **16** en **Columnas del grid**. | Aparecen 16 columnas en el reporte, `.col-16`, `.offset-15` y `.col-desktop-16`. En el breakpoint tablet, Hero ocupa 9 y 7 columnas y las tarjetas de Beneficios 6, 5 y 5, llenando la fila completa. |
| 5 | Para demostrar que es una sola variable: recargar el constructor, cambiar `$grid-columns: 12 !default;` a `16` en `scss/_config.scss` y pulsar **Generar página**. | El mismo resultado sin tocar la pantalla. |
| 6 | Activar **Editar texto**, escribir sobre un título, cambiar de columnas y descargar. | El texto se conserva y aparece en el HTML descargado. |
| 7 | Agregar dos tarjetas, cambiar un color y abrir **SCSS usado**. | Quedan filas 3 + 2 llenas y se ve la configuración generada. |
| 8 | En **Tipografía**, elegir una letra para los títulos y abrir **SCSS usado**. | Cambian solo los títulos y aparece `$font-heading` en la configuración. |
| 9 | Pulsar **Restablecer todo** y luego **Deshacer**. | Vuelve todo lo que se había editado. |
| 10 | Pulsar **Restablecer todo**, restaurar 12 columnas y correr `npm run check` y `npm run build`. | Auditoría BEM y pruebas correctas, y reporte JSON con bytes y cero duplicados. |

### Selector de columnas y edición de texto

El selector no crea un segundo mecanismo: compila la landing configurando la única variable `$grid-columns` (por eso está marcada `!default`). Mientras no se elija nada en pantalla, vale lo escrito en `_config.scss`. Después de elegir, la pantalla manda hasta recargar la página. La API solo acepta 12 o 16, y ningún otro texto llega al código SCSS.

La edición de texto ocurre sobre la vista previa. El iframe usa `sandbox="allow-same-origin"` sin `allow-scripts`: el constructor puede leer y escribir los textos, pero la landing no puede ejecutar código. Los textos se guardan como texto plano, así que escribir HTML solo muestra esos caracteres. Los cambios duran mientras la pestaña esté abierta y viajan en el HTML descargado; no se guardan en el servidor.

Para el paso 5, ejecuten `npm start` durante la edición. Si usan la demo en contenedor, monten la carpeta `scss` en `/app/scss` o reconstruyan la imagen tras editar la configuración.

## Lecciones aprendidas

- **Aislamiento de grids anidados con `:where()`:** Las propiedades personalizadas de CSS se heredan por defecto; reiniciar `--grid-span` y `--grid-start` en `:where(.grid > *)` con especificidad cero evita que un grid hijo herede el reparto del padre sin pisar las utilidades `.col-*` ni `.offset-*`.
- **Auditoría BEM sobre CSS generado:** `sass-lint` no evalúa clases construidas con interpolación ni módulos `@use`; extraer los selectores compilados y complementarlos con reglas estructurales en `scripts/bem.mjs` permite auditar realmente lo que llega al navegador.
- **Claves con nombres de color en mapas SCSS:** En Dart Sass, una clave sin comillas como `violet` se interpreta como un valor de color y genera advertencias al interpolarla; citar explícitamente las claves de texto y forzar conversión a string mantiene limpia la compilación.
- **Fuente única de verdad con `!default`:** Exponer `$grid-columns` y las demás variables con `!default` permite que tanto la edición directa de `scss/_config.scss` como el constructor visual usen exactamente el mismo mecanismo (`@use "config" with (...)`) sin duplicar lógica.

### Referencias

- [Documentación de Sass: reglas de control de flujo](https://sass-lang.com/documentation/at-rules/control/)
- [Documentación de Sass: mapas](https://sass-lang.com/documentation/values/maps/)
- [Documentación de Sass: API JavaScript](https://sass-lang.com/documentation/js-api/)
- [Regla BEM de sass-lint](https://github.com/sasstools/sass-lint/blob/develop/docs/rules/class-name-format.md)
