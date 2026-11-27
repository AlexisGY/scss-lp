# SCSS-LP · Índice del entregable e informe técnico

Proyecto 4 de SW608 · Grupo 2

## Índice del entregable

| # | Punto obligatorio | Dónde está |
|---|---|---|
| 1 | Bases teóricas y fundamentación | [Bases teóricas](bases-teoricas.md) |
| 2 | Justificación del DSL | [Justificación de SCSS](justificacion.md) |
| 3 | Demostración de abstracción | [Demostración de abstracción](abstraccion.md) |
| 4 | Metamodelo y su mapeo a la sintaxis concreta | [Metamodelo del DSL](metamodelo.md) |
| 5 | Especificación de requisitos | [Caso de uso](#caso-de-uso-principal) e [historias de usuario](#historias-y-criterios-de-aceptación) |
| 6 | Demostración guiada por casos de prueba | [Guion de demo y casos de prueba](guion.md) |
| 7 | Repositorio Git con historial por integrante | [Commits](https://github.com/AlexisGY/scss-lp/commits/main) y [contribuciones](https://github.com/AlexisGY/scss-lp/graphs/contributors) |

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

Las metaclases, metasociaciones y restricciones están en [el metamodelo](metamodelo.md).

**Validación:** `src/settings.mjs` solo acepta claves conocidas, colores hexadecimales, números dentro de rango y nombres de listas cerradas. Nada escrito por el usuario llega al SCSS sin pasar por ahí. Lo que no se cambia en pantalla sigue saliendo de `_config.scss`.

**Tipografía:** se usan fuentes del sistema para no descargar nada y que el HTML exportado funcione sin conexión. Si un equipo no tiene la primera fuente de la pila, usa la siguiente, así que el aspecto puede variar entre computadoras.

**Deshacer y rehacer:** `public/history.js` guarda una foto del estado después de cada cambio (hasta 100). Al volver a una foto con otro estilo, Sass recompila; si solo cambia el contenido, se aplica sin recompilar. Un valor rechazado por la validación no queda en el historial.

**Contenido:** textos, enlaces e imagen no son estilo, así que no pasan por Sass. Se aplican en el navegador y viajan en el HTML descargado. Los enlaces se limitan a anclas, `https:`, `http:`, `mailto:` y `tel:`; las imágenes, a formatos rasterizados.

## Generación procedural por sección

| Sección | Bucles y funciones SCSS | Configuración que la gobierna |
|---|---|---|
| Hero | `@for` para los anillos (`$hero-rings`); `math.ceil` para repartir texto e ilustración; mixin `tools.layout()`; `fluid-type()`. | `$grid-columns`, `$hero-rings` |
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
| Flujo principal | 1. El actor elige y ordena las secciones y pulsa **Generar página**. 2. El sistema valida la selección, Sass compila el CSS y el constructor muestra el HTML, el código y el reporte. 3. Opcionalmente, el actor cambia columnas (12 o 16), colores, tipografía de títulos y de texto, tarjetas u otros ajustes, y el sistema recompila solo; los textos, enlaces e imagen se aplican sobre la vista previa sin recompilar. 4. El actor puede **Deshacer** o **Rehacer** sus cambios, con los botones o con Ctrl+Z, Ctrl+Y o Ctrl+Shift+Z. |
| Flujos alternos | **A1.** Sin secciones marcadas, el botón de generar se deshabilita. **A2.** Si la API recibe una sección desconocida o repetida, responde con un error de validación. **A3.** Ante un valor fuera de rango, el sistema muestra el motivo, vuelve al último valor válido y no guarda ese paso en el historial. **A4.** Si falla la conexión, el cambio se conserva y se puede reintentar con **Generar página**. |
| Postcondiciones | El actor puede revisar la landing con dos anchos o descargar el HTML con sus estilos y cambios. Los cambios y el historial duran mientras la página esté abierta. |

## Historias y criterios de aceptación

| Historia | Given | When | Then |
|---|---|---|---|
| HU-01. Como usuario, quiero elegir secciones para componer mi landing. | El catálogo de secciones está disponible. | Selecciono Hero y CTA y pulso **Generar página**. | Se muestran Hero y CTA en la vista y el CSS omite los selectores propios de Beneficios. |
| HU-02. Como usuario, quiero comparar la landing en móvil y escritorio. | Generé una landing con Hero. | Alterno entre Móvil y Escritorio. | El cambio de ancho activa los breakpoints. Hero pasa de una columna a texto e ilustración en paralelo y el tamaño del título se ajusta dentro de su rango. |
| HU-03. Como mantenedor, quiero cambiar el total de columnas desde la configuración. | El grid tiene 12 columnas y la auditoría reporta cero duplicados. | Cambio `$grid-columns` a 16 y genero de nuevo. | El reporte indica 16 columnas y el CSS incluye `.col-16`, `.offset-15` y sus variantes responsive, con cero duplicados. |

## Notas de diseño

### Selector de columnas y edición de texto

El selector no crea un segundo mecanismo: compila la landing configurando la única variable `$grid-columns` (por eso está marcada `!default`). Mientras no se elija nada en pantalla, vale lo escrito en `_config.scss`. Después de elegir, la pantalla manda hasta recargar la página. La API solo acepta 12 o 16, y ningún otro texto llega al código SCSS.

La edición de texto ocurre sobre la vista previa. El iframe usa `sandbox="allow-same-origin"` sin `allow-scripts`: el constructor puede leer y escribir los textos, pero la landing no puede ejecutar código. Los textos se guardan como texto plano, así que escribir HTML solo muestra esos caracteres. Los cambios duran mientras la pestaña esté abierta y viajan en el HTML descargado; no se guardan en el servidor.

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
