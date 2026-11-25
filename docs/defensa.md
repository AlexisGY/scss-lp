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
| Grid | Total de columnas entero de al menos 3. Gutter con valor CSS compatible con `gap`. | `$grid-columns: 12;` y `$gutter: 1rem;`. |
| ColumnSpan | Entero entre 1 y el total de columnas. | `@for $span from 1 through config.$grid-columns` emite `.col-#{$span}`. |
| Offset | Entero entre 0 y el total de columnas menos 1. Se elige junto con el ancho para que la sección quepa en el grid. | `@for $offset from 0 to config.$grid-columns` emite `.offset-#{$offset}`. |
| Breakpoint | Nombre único y ancho mínimo. El mapa se escribe en orden ascendente. | `$breakpoints: (tablet: 640px, desktop: 960px);`. |
| TypographyScale | Tamaño mínimo positivo, máximo igual o superior y viewport mínimo positivo menor al máximo. | `tools.fluid-type(44px, 94px)` usa `$viewport-min` y `$viewport-max`. |
| Animation | Nombre único y mapa ordenado de fotogramas. | `$animations: (appear: (from: (opacity: 0), to: (opacity: 1)));`. |
| Keyframe | Punto `from`, `to` o porcentaje válido y mapa de declaraciones CSS. | `from: (opacity: 0, transform: translateY(12px))`. |

| Metasociación | Multiplicidad | Realización |
|---|---|---|
| LandingPage contiene Section | 1 a 1..3, ordenadas | Lista `$section-order`. |
| LandingPage usa Grid | 1 a 1 | Inclusión de `grid.render`. |
| Grid genera ColumnSpan y Offset | 1 a N para cada familia | Dos bucles `@for` en `grid.utilities`. |
| Grid se adapta a Breakpoint | 1 a 0..N | `@each` sobre `$breakpoints` y mixin `tools.at`. |
| Section usa TypographyScale | 1 a 0..N | Llamadas a `fluid-type()` desde estilos BEM. |
| Section aplica Animation | 1 a 0..N | `animations.motion(rise, 420ms)`. |
| Animation contiene Keyframe | 1 a 1..N | Mapa de fotogramas recorrido por `@each` dentro de `@keyframes`. |

La auditoría BEM usa `sass-lint` con `strictbem` sobre los selectores emitidos por Sass. El script extrae los selectores como SCSS plano, para que el parser de `sass-lint` pueda verificar también las clases creadas por interpolación y módulos `@use`.

## Caso de uso principal

| Campo | Descripción |
|---|---|
| ID | CU-01 |
| Nombre | Generar una landing responsive |
| Actor | Usuario del constructor |
| Precondiciones | Constructor accesible y catálogo de secciones disponible. |
| Flujo principal | El actor elige secciones, pulsa **Generar página** y el sistema valida la selección. Sass compila el CSS y el constructor muestra el HTML, el código y el reporte. |
| Flujo alterno | Si ninguna sección está marcada, el botón se deshabilita. Si la API recibe una sección desconocida o repetida, devuelve un error de validación. |
| Postcondiciones | El usuario puede revisar la landing con dos anchos o descargar el HTML con sus estilos. |

## Historias y criterios de aceptación

| Historia | Given | When | Then |
|---|---|---|---|
| HU-01. Como usuario, quiero elegir secciones para componer mi landing. | El catálogo de secciones está disponible. | Selecciono Hero y CTA y pulso **Generar página**. | Se muestran Hero y CTA en la vista y el CSS omite los selectores propios de Beneficios. |
| HU-02. Como usuario, quiero comparar la landing en móvil y escritorio. | Generé una landing con Hero. | Alterno entre Móvil y Escritorio. | El cambio de ancho activa los breakpoints. Hero pasa de una columna a texto e ilustración en paralelo y el tamaño del título se ajusta dentro de su rango. |
| HU-03. Como mantenedor, quiero cambiar el total de columnas desde la configuración. | El grid tiene 12 columnas y la auditoría reporta cero duplicados. | Cambio `$grid-columns` a 16 y genero de nuevo. | El reporte indica 16 columnas y el CSS incluye `.col-16`, `.offset-15` y sus variantes responsive, con cero duplicados. |

## Guion de defensa

| Paso | Acción | Evidencia esperada |
|---|---|---|
| 1 | Abrir el constructor y generar Hero y CTA. | La landing muestra las dos secciones seleccionadas. |
| 2 | Alternar Móvil y Escritorio. | Hero cambia de disposición y su fuente se escala. |
| 3 | Abrir **CSS generado** y buscar `.col-12`, `clamp(`, `@keyframes rise` y `@media`. | Se ven las reglas del DSL y el panel indica cero duplicados. |
| 4 | Editar `$grid-columns: 12;` a `16` en `scss/_config.scss` y pulsar **Generar página**. | Aparecen 16 columnas en el reporte, `.col-16`, `.offset-15` y `.col-desktop-16`. El contenido de Hero ocupa 9 y 7 columnas en el breakpoint tablet. |
| 5 | Restaurar 12 columnas y correr `npm run check` y `npm run build`. | Auditoría BEM y pruebas correctas, y reporte JSON con bytes y cero duplicados. |

Para el paso 4, ejecuten `npm start` durante la edición. Si usan la demo en contenedor, monten la carpeta `scss` en `/app/scss` o reconstruyan la imagen tras editar la configuración.

### Referencias

- [Documentación de Sass: reglas de control de flujo](https://sass-lang.com/documentation/at-rules/control/)
- [Documentación de Sass: mapas](https://sass-lang.com/documentation/values/maps/)
- [Documentación de Sass: API JavaScript](https://sass-lang.com/documentation/js-api/)
- [Regla BEM de sass-lint](https://github.com/sasstools/sass-lint/blob/develop/docs/rules/class-name-format.md)
