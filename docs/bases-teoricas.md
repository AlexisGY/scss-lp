# Bases teóricas y fundamentación

Proyecto 4 de SW608 · Grupo 2

## 1. Lenguajes de dominio específico

Un **lenguaje de dominio específico** (DSL, *Domain-Specific Language*) es, en palabras de Fowler, un lenguaje informático orientado a un tipo particular de problema [1]. Se contrapone al lenguaje de propósito general (GPL), como JavaScript, que apunta a cualquier tipo de problema de software.

Un DSL renuncia a generalidad para ofrecer los conceptos de su dominio como parte del lenguaje. Mernik, Heering y Sloane señalan que así ofrece ganancias importantes de expresividad y facilidad de uso frente a un GPL dentro de ese dominio, y también que desarrollar un DSL es difícil, porque exige conocer tanto el dominio como la construcción de lenguajes [2]. La bibliografía anotada de van Deursen, Klint y Visser reúne el campo [3].

Fowler distingue tres formas [1]:

| Tipo | Idea | Ejemplos |
|---|---|---|
| DSL externo | Tiene sintaxis propia y un programa que la analiza e interpreta o compila. | SQL, CSS, **SCSS** |
| DSL interno (embebido) | Se escribe dentro de un lenguaje anfitrión, usando su sintaxis de una forma particular. | Una API fluida en Java o Ruby |
| *Language workbench* | Entorno para definir lenguajes y sus editores. | JetBrains MPS |

**En este proyecto, SCSS es un DSL externo** del dominio de las hojas de estilo: tiene gramática propia y un compilador, Dart Sass. Amplía CSS con variables, módulos, estructuras de control y funciones. La aplicación en Node.js es el programa anfitrión que **invoca** al compilador; eso no convierte a SCSS en un DSL interno de JavaScript.

El dominio concreto son las **páginas de aterrizaje responsive**. Sobre SCSS, el proyecto define su propio vocabulario: columnas, breakpoints, escalas tipográficas, secciones, tarjetas y animaciones. El constructor visual no edita CSS: escribe un pequeño programa SCSS, por ejemplo `@use "config" with ($grid-columns: 16);`, y deja que el compilador genere el resultado.

## 2. Sintaxis, semántica y metamodelo

| Concepto | Qué es | En SCSS-LP |
|---|---|---|
| **Sintaxis abstracta** | Los conceptos del lenguaje, sus atributos y relaciones, sin importar cómo se escriben. | LandingPage, Section, Grid, Breakpoint, TypeScale, Animation, etc. |
| **Sintaxis concreta** | La notación con la que se escribe un programa del lenguaje. | Variables, listas y mapas de `scss/_config.scss`, y `$section-order`. |
| **Semántica estática** | Reglas que un programa bien escrito debe cumplir antes de generar la salida. | Mínimo de 3 columnas, breakpoints ascendentes, nombres de fuente existentes. Varias se declaran con `@error`. |
| **Semántica (por traducción)** | El significado definido por lo que el programa produce en otro lenguaje. | La compilación de SCSS a CSS. Después, el navegador evalúa las media queries y `clamp()`. |
| **Metamodelo** | Modelo que define la sintaxis abstracta: qué modelos son posibles en el lenguaje. | [El metamodelo del DSL](metamodelo.md). |

Que dos notaciones expresen los mismos conceptos muestra la diferencia entre ambas sintaxis: en la pantalla, marcar **16** columnas y, en el archivo, escribir `$grid-columns: 16` cambian el mismo atributo, `Grid.columns` [4].

### Niveles de modelado

La arquitectura de cuatro niveles asociada a MOF [5] sitúa cada pieza así:

| Nivel | Qué contiene | En SCSS-LP |
|---|---|---|
| M3 · metametamodelo | El lenguaje para definir metamodelos. | MOF: clases, atributos y asociaciones. Aquí se usan con la notación de un diagrama de clases. |
| M2 · metamodelo | Los conceptos del DSL. | `Grid`, `Breakpoint`, `Animation`, etc. |
| M1 · modelo | Un programa concreto escrito con el DSL. | Los valores de `_config.scss` más el orden de secciones de una landing. |
| M0 · instancia | El sistema que ese modelo describe, en ejecución. | La landing mostrada en un navegador. |

La generación es una transformación **de modelo a texto**: a partir de M1, Sass produce el texto CSS, y `src/generator.mjs` produce el HTML que usa esas clases.

## 3. Sass y SCSS

Sass es el lenguaje y su compilador; **SCSS** es su sintaxis con llaves, compatible con CSS [6]. Todo CSS se resuelve en el navegador; la lógica de Sass se ejecuta antes, al compilar, y no existe en el resultado.

| Rasgo | Para qué se usa aquí | Dónde |
|---|---|---|
| `!default` y `@use ... with (...)` | Cambiar la configuración sin editar los módulos del DSL. | `_config.scss`, `_landing.scss` |
| Listas y mapas | Describir catálogos: paleta, fuentes, animaciones, tarjetas y brillos. | `_config.scss` |
| `@for` | Generar `.col-N` y `.offset-N`, los anillos del Hero y el reparto de columnas. | `_grid.scss`, `_sections.scss`, `_tools.scss` |
| `@each` | Recorrer breakpoints, animaciones, tarjetas, secciones y brillos. | Todos los módulos con catálogos |
| `@function` | Calcular valores: `fluid-type()`, `distribute()`, `glow-layers()`, `color()`, `font()`. | `_tools.scss` |
| `@mixin`, `@include`, `@content` | Producir grupos de reglas reutilizables y envolverlas en una media query. | Grid, animaciones, secciones y `tools.at` |
| `@if` y `@error` | Aplicar la semántica estática con un mensaje propio. | `_tools.scss`, `_grid.scss`, `_landing.scss` |
| Interpolación `#{}` | Construir nombres de clases y de propiedades a partir de datos. | Grid, tarjetas y animaciones |
| Módulos `sass:map`, `sass:list`, `sass:math` | Operar con colecciones y números. | `_tools.scss` y secciones |

## 4. Metodología BEM

BEM organiza las clases en **bloques** independientes, **elementos** que pertenecen a un bloque y **modificadores** que cambian su apariencia o estado. El proyecto usa la convención de nombres original de BEM [7]:

| Entidad | Forma | Ejemplo |
|---|---|---|
| Bloque | `bloque` | `.hero` |
| Elemento | `bloque__elemento` | `.hero__title` |
| Modificador de bloque | `bloque_modificador` | `.motion_rise` |
| Modificador de elemento | `bloque__elemento_modificador` | `.benefits__card_speed` |

Un mismo elemento puede reunir dos entidades (**mezcla** o *mix*): `class="landing__button cta__link"` toma el aspecto del botón y la posición del enlace de la sección final. Las utilidades del grid, como `.col-6` u `.offset-2`, son bloques cuyo nombre cumple la convención.

Con selectores de una sola clase la especificidad se mantiene baja y uniforme [8], y mover un bloque no rompe sus estilos. La auditoría se hace sobre el **CSS compilado**, porque las clases creadas por interpolación solo existen después de compilar, y tiene dos capas:

1. `sass-lint`, con la convención `strictbem`, revisa los nombres.
2. `scripts/bem.mjs` revisa la estructura: sin IDs, sin clases encadenadas y sin selectores descendientes entre clases.

## 5. CSS Grid

CSS Grid distribuye elementos en filas y columnas [9]. El grid propio del DSL se apoya en estas ideas:

- `grid-template-columns: repeat(N, minmax(0, 1fr))` crea `N` columnas iguales. La unidad `fr` reparte el espacio libre, y el mínimo `0` de `minmax()` evita que un contenido ancho ensanche su columna.
- Cada hijo ocupa `grid-column: inicio / span ancho`. Las utilidades no repiten esa declaración: `.col-N` solo asigna la propiedad personalizada `--grid-span` y `.offset-K` asigna `--grid-start` con el valor `K + 1`.
- Sin `.col-*`, un hijo ocupa las columnas que quedan desde su inicio. Así, un offset solo no crea columnas implícitas fuera del grid.
- Las propiedades personalizadas **se heredan** [10]. Para que un grid anidado no tome el ancho de un ancestro, `:where(.grid > *)` las reinicia en cada hijo directo. `:where()` tiene especificidad cero [8], así que cualquier utilidad prevalece.

### Diseño responsive

El diseño es *mobile first*: las reglas base valen para cualquier ancho y cada `@media (min-width: ...)` agrega variantes desde un umbral [11]. Las utilidades de todos los breakpoints tienen la misma especificidad, así que en una pantalla ancha **gana la que aparece al final**. Por eso `$breakpoints` debe declararse en orden ascendente y la compilación falla si no lo está.

Con `N` columnas, el DSL genera en cada ámbito (el base y cada breakpoint) `N` clases de ancho y `N` de desplazamiento. Con `B` breakpoints son `2 · N · (1 + B)` utilidades: **72** con 12 columnas y 2 breakpoints, y **96** con 16, a partir de cambiar solo `$grid-columns`.

## 6. Tipografía fluida con `clamp()`

`clamp(MIN, VALOR, MAX)` entrega `VALOR` limitado al intervalo: equivale a `max(MIN, min(VALOR, MAX))` [12]. Se busca un tamaño que valga `min` cuando el viewport mide `vmin`, valga `max` cuando mide `vmax`, y crezca de forma lineal entre ambos.

### Deducción

Sea `w` el ancho del viewport. Una función lineal es:

```text
f(w) = b + m · w
```

Se le imponen los dos puntos:

```text
f(vmin) = min   →   b + m · vmin = min
f(vmax) = max   →   b + m · vmax = max
```

Al restar la primera ecuación de la segunda se obtiene la pendiente, y al sustituirla, el término independiente:

```text
m = (max − min) / (vmax − vmin)
b = min − m · vmin
```

En CSS, `100vw` es el ancho del viewport, así que `m · w` se escribe como `(100 · m)vw`. Los tamaños se pasan a `rem` dividiendo entre 16, el tamaño de letra raíz por defecto:

```text
font-size: clamp( (min/16)rem , (b/16)rem + (100·m)vw , (max/16)rem )
```

### Ejemplo: título del Hero

Con `min = 44px`, `max = 94px`, `vmin = 360px` y `vmax = 1200px`:

```text
m = (94 − 44) / (1200 − 360) = 50 / 840 = 0.0595238…
b = 44 − 0.0595238… · 360     = 22.5714… px
```

Resultado, tal como lo emite `tools.fluid-type()`:

```css
font-size: clamp(2.75rem, 1.4107142857rem + 5.9523809524vw, 5.875rem);
```

Comprobación: en 360 px da 44 px; en 780 px, 69 px; y en 1200 px, 94 px. Por debajo de 360 px se mantiene en 44 px y por encima de 1200 px, en 94 px.

La función exige `min > 0`, `max ≥ min` y `0 < vmin < vmax`; de lo contrario, detiene la compilación. Usar `rem` en los límites y en el término independiente hace que respondan al tamaño de letra raíz que elija la persona; la parte en `vw` no cambia con esa preferencia.

## Referencias

1. Fowler, M. (2008). *Domain Specific Language*. <https://martinfowler.com/bliki/DomainSpecificLanguage.html>. El tema se desarrolla en: Fowler, M. (con Parsons, R.). (2010). *Domain Specific Languages*. Addison-Wesley. <https://martinfowler.com/books/dsl.html>
2. Mernik, M., Heering, J. y Sloane, A. M. (2005). When and how to develop domain-specific languages. *ACM Computing Surveys*, 37(4), 316–344. <https://doi.org/10.1145/1118890.1118892>
3. van Deursen, A., Klint, P. y Visser, J. (2000). Domain-specific languages: An annotated bibliography. *ACM SIGPLAN Notices*, 35(6), 26–36. <https://doi.org/10.1145/352029.352035>
4. Kleppe, A. (2008). *Software Language Engineering: Creating Domain-Specific Languages Using Metamodels*. Addison-Wesley.
5. Object Management Group. *Meta Object Facility (MOF)*. <https://www.omg.org/spec/MOF/>
6. Sass. *Documentation*. <https://sass-lang.com/documentation/>
7. BEM. *Naming convention*. <https://en.bem.info/methodology/naming-convention/>
8. W3C. *Selectors Level 4*. <https://www.w3.org/TR/selectors-4/>
9. W3C. *CSS Grid Layout Module Level 1*. <https://www.w3.org/TR/css-grid-1/>
10. W3C. *CSS Custom Properties for Cascading Variables Module Level 1*. <https://www.w3.org/TR/css-variables-1/>
11. W3C. *Media Queries Level 5*. <https://www.w3.org/TR/mediaqueries-5/>
12. W3C. *CSS Values and Units Module Level 4*. <https://www.w3.org/TR/css-values-4/>
