# Justificación de SCSS como DSL

SCSS-LP genera landings a partir de secciones, una cuadrícula responsive, escalas tipográficas, colores y animaciones. SCSS permite expresar esas decisiones en el vocabulario del diseño. En `scss/_config.scss`, cada valor lleva `!default` y se puede sustituir con `@use "config" with (...)`. El constructor compila la selección con Dart Sass y entrega CSS estándar al navegador.

## Frente a JavaScript puro

Un generador escrito en JavaScript también podría recorrer mapas y construir reglas. Tendría que representar las declaraciones CSS, interpolar los selectores y montar los bloques `@media` y `@keyframes` en código general. En SCSS esas construcciones se escriben en el mismo lenguaje de las reglas. El mapa `$animations` describe cada paso y sus propiedades, y `@each` emite tanto los keyframes como las clases `.motion_*`. Si un valor por defecto apunta a una animación ausente, Sass detiene la compilación con `@error`.

La misma ventaja se aplica a Beneficios. `$benefit-variants` describe qué tarjetas aparecen, en qué orden y con qué acento. `$card-colors` define los colores iniciales del catálogo, incluidas las tarjetas que se agregan en pantalla. `$default-motion`, `$benefit-motion` y `$benefit-motion-fallback` determinan el movimiento inicial. Cambiar `heroContent: rise` por `heroContent: appear`, por ejemplo, actualiza la clase del Hero y el valor del selector desde el mismo archivo.

## Frente a CSS puro

CSS ejecuta las media queries, la cuadrícula y las animaciones en el navegador. Sus propiedades personalizadas sirven para reutilizar valores, pero no generan familias de selectores ni recorren un mapa para emitir varios keyframes. En SCSS, pasar de 12 a 16 columnas actualiza desde `$grid-columns` los tamaños, offsets y variantes por breakpoint. La función de tipografía fluida calcula una expresión `clamp()` y el navegador la evalúa según el viewport.

## Costos y límites

- Se añade una dependencia de compilación. Los cambios de estilo del constructor esperan a Dart Sass antes de actualizar la vista.
- Las reglas generadas por bucles no se ven completas en el archivo fuente. Depurar la cascada requiere inspeccionar el CSS compilado. El tamaño puede crecer al ampliar los mapas o los rangos.
- El editor necesita un puente para leer los valores efectivos de Sass y representarlos en los controles. `readSettings()` compila una consulta aislada para extraerlos, y el exportado contiene el HTML y el CSS resultantes.

## Responsabilidades de JavaScript

JavaScript recibe y valida las solicitudes del constructor, convierte los cambios admitidos en configuración Sass, ensambla el HTML y aplica las clases que corresponden a los valores leídos o elegidos. También gestiona los controles, el historial y la descarga. Los textos, enlaces e imágenes pertenecen al contenido del documento y se editan sobre el HTML. Esta división deja la estructura y la interacción en JavaScript y las decisiones reutilizables de estilo en SCSS.
