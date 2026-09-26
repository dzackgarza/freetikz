# FreeTikZ

FreeTikZ turns drawn figures into TikZ. The original string-diagram editor is
at `freetikz.html`. The geometric scene editor is at `editor.html`.

The scene editor stores each stroke's original pen samples alongside its
editable geometry. It supports freehand strokes, points, lines, circles, TeX
labels, selection, translation, scene save/open, and a generated standard-TikZ
draft. Its preview shows the geometry beside that source. The scene file is
JSON; the TikZ generator does not change the scene. The original editor's
specialized `freetikz.sty` remains with `freetikz.html`.

Run the scene-model tests with `bun test test/scene.test.js test/tikz.test.js`.
Serve this directory over HTTP to use the editor; browser modules do not load
from a local `file:` URL.

The [Math Notes drawing-mode specification](https://github.com/dzackgarza/math-notes-app/blob/v1-usable-library-editor/docs/specs/tikz-drawing-mode.md)
defines the integration, source round-trip, constraints, TeX preview, and
semantic backends.
