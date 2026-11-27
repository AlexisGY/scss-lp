# SCSS-LP

Proyecto 4 de SW608 · Grupo 2

Constructor de landing pages responsive. Elige Hero, Beneficios y Llamada a la acción y presiona **Generar página**. Todo se puede editar desde la pantalla:

| Qué | Cómo | Dónde se aplica |
|---|---|---|
| Secciones | Marcar, desmarcar y reordenar con ↑ ↓ | Compilación |
| Columnas | 12 o 16 | `$grid-columns` |
| Tarjetas de Beneficios | Agregar (hasta 6), quitar, reordenar, color y animación | `$benefit-variants` |
| Colores | Paleta completa y brillos del bloque final | `$palette`, `$cta-glows` |
| Tipografía | Una fuente para los títulos y otra para el texto (9 opciones del sistema) y tamaños de los títulos | `$font-heading`, `$font-body`, `$type-scale` |
| Grid | Gutter y breakpoints | `$gutter`, `$breakpoints` |
| Animaciones | Animación de cada elemento y duración | `$motion-duration` y clases `.motion_*` |
| Textos | **Editar texto** y escribir sobre la vista previa | HTML descargado |
| Enlaces | Destino (`#`, `https:`, `mailto:`, `tel:`) y mostrar u ocultar | HTML descargado |
| Imagen | PNG, JPG, WebP o GIF de hasta 1,5 MB en lugar del planeta | HTML descargado |

**Deshacer** y **Rehacer** (Ctrl+Z, Ctrl+Y o Ctrl+Shift+Z) cubren todos los cambios, incluidos **Restablecer todo** y **Restablecer textos**, hasta 100 pasos. Cada texto editado es un paso al salir del campo; mientras escribes, Ctrl+Z borra dentro de ese campo.

La pestaña **SCSS usado** muestra la configuración que produjo la landing. Los cambios duran mientras la página esté abierta: para conservarlos, descarga el HTML. El resultado incluye una vista móvil y de escritorio, el CSS generado y una descarga HTML autónoma.

## Ejecutar

Requiere Node.js 24 o posterior y npm.

```sh
npm ci
npm start
```

Abre [http://localhost:3000](http://localhost:3000). Puedes cambiar el puerto con `PORT`.

```sh
npm run check
npm run build
```

`check` ejecuta la auditoría BEM (`sass-lint` para los nombres y `scripts/bem.mjs` para la estructura: sin IDs, sin clases encadenadas ni selectores descendientes entre clases) y las pruebas, con un mínimo de 60 % de cobertura de líneas del generador. `build` deja la landing de ejemplo, su CSS comprimido y el reporte en `dist/`. `sass-lint` ya no recibe actualizaciones, así que `package.json` fija con `overrides` versiones corregidas de sus dependencias (`npm audit` sin vulnerabilidades); una prueba verifica que siga rechazando nombres que no son BEM. Ambos comandos se ejecutan en GitHub Actions para pushes y pull requests.

### Demo en contenedor

```sh
docker build -t scss-lp .
docker run --rm -p 127.0.0.1:3000:3000 scss-lp
```

Abre [http://localhost:3000](http://localhost:3000). Para aplicar cambios al código dentro de la imagen, vuelve a construirla.

## Código

| Ruta | Función |
|---|---|
| `public/` | Constructor, vista previa y descarga. `controls.js` dibuja los paneles; `texts.js` y `content.js` aplican textos, enlaces e imagen; `history.js` lleva deshacer y rehacer. |
| `src/server.mjs` | Servidor Node.js y ruta `GET /api/landing?sections=hero,cta&columns=16&settings={...}` (`columns` y `settings` son opcionales). |
| `src/settings.mjs` | Lee los valores de `_config.scss`, valida lo pedido y lo convierte en `@use "config" with (...)`. |
| `src/generator.mjs` | Validación de secciones, llamada a Dart Sass, HTML y reporte CSS. |
| `scss/_config.scss` | Columnas, gutter, breakpoints, fuentes, rango y escala tipográfica, paleta, animaciones, tarjetas y brillos. Todo con `!default`. |
| `scss/_landing.scss` | Entrada del DSL y selección de secciones con `@each`. |
| `scss/_grid.scss`, `_tools.scss`, `_animations.scss`, `_sections.scss` | Generación de reglas CSS y estilos de componentes. |
| `scripts/` y `test/` | Auditoría BEM, compilación, pruebas y medición. |

La API valida las secciones, las pasa a Dart Sass como `$section-order` y retorna HTML, CSS expandido, CSS comprimido y métricas. El constructor muestra el HTML en un iframe y lo descarga con el CSS embebido. El valor de **CSS final** corresponde al CSS comprimido. Los duplicados se cuentan en el CSS expandido por selector, orden de declaraciones y contexto de at-rules.

Consulta [el índice del entregable](docs/defensa.md), que incluye los requisitos y enlaza el guion de defensa; [las bases teóricas](docs/bases-teoricas.md) y [el metamodelo](docs/metamodelo.md).
