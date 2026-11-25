# SCSS-LP

Proyecto 4 de SW608 · Grupo 2

Constructor de landing pages responsive. Elige Hero, Beneficios y Llamada a la acción y presiona **Generar página**. El resultado incluye una vista móvil y de escritorio, el CSS generado y una descarga HTML autónoma.

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

`check` ejecuta la auditoría BEM con `sass-lint` y las pruebas, con un mínimo de 60 % de cobertura de líneas del generador. `build` deja la landing de ejemplo, su CSS comprimido y el reporte en `dist/`. Ambos comandos se ejecutan en GitHub Actions para pushes y pull requests.

### Demo en contenedor

```sh
docker build -t scss-lp .
docker run --rm -p 127.0.0.1:3000:3000 scss-lp
```

Abre [http://localhost:3000](http://localhost:3000). Para aplicar cambios al código dentro de la imagen, vuelve a construirla.

## Código

| Ruta | Función |
|---|---|
| `public/` | Constructor, vista previa y descarga. |
| `src/server.mjs` | Servidor Node.js y ruta `GET /api/landing?sections=hero,cta`. |
| `src/generator.mjs` | Validación de secciones, llamada a Dart Sass, HTML y reporte CSS. |
| `scss/_config.scss` | Columnas, gutter, breakpoints, rango tipográfico y animaciones. |
| `scss/_landing.scss` | Entrada del DSL y selección de secciones con `@each`. |
| `scss/_grid.scss`, `_tools.scss`, `_animations.scss`, `_sections.scss` | Generación de reglas CSS y estilos de componentes. |
| `scripts/` y `test/` | Auditoría BEM, compilación, pruebas y medición. |

La API valida las secciones, las pasa a Dart Sass como `$section-order` y retorna HTML, CSS expandido, CSS comprimido y métricas. El constructor muestra el HTML en un iframe y lo descarga con el CSS embebido. El valor de **CSS final** corresponde al CSS comprimido. Los duplicados se cuentan en el CSS expandido por selector, orden de declaraciones y contexto de at-rules.

Consulta [el informe técnico y el guion de defensa](docs/defensa.md) para ver el metamodelo, los requisitos y la demo.
