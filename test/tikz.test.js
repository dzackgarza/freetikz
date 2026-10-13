import { expect, test } from 'bun:test'
import { addPrimitive, addStroke, createScene, serializeScene, setInterpretation } from '../js/scene.js'
import { generateTikz } from '../js/tikz.js'

test('captured geometry and later standard TikZ paths share one physical coordinate plane', () => {
  const scene = createScene()
  addPrimitive(scene, { kind: 'segment', start: { x: 28.4527559, y: 56.9055118 }, end: { x: 56.9055118, y: 56.9055118 } })
  const source = generateTikz(scene).source

  // A visual editor adds paths using TikZ's default 1 cm right/up basis.
  // The captured segment must land at (1,-2) through (2,-2) in that basis.
  expect(source).toContain('\\begin{tikzpicture}\n')
  expect(source).toContain('\\coordinate (o1-start) at (1,-2);')
  expect(source).toContain('\\coordinate (o1-end) at (2,-2);')
})

test('scene primitives emit named, editable standard TikZ without changing the scene', () => {
  const scene = createScene()
  addPrimitive(scene, { kind: 'point', x: 5, y: 7 })
  addPrimitive(scene, { kind: 'segment', start: { x: 5, y: 7 }, end: { x: 30, y: 7 } })
  addPrimitive(scene, { kind: 'circle', center: { x: 40, y: 20 }, radius: 8 })
  addPrimitive(scene, { kind: 'label', position: { x: 10, y: 4 }, tex: '$\\operatorname{Exc}(\\pi)$' })
  const before = serializeScene(scene)

  expect(generateTikz(scene)).toEqual({
    source: [
      '\\begin{tikzpicture}',
      '  \\coordinate (o1) at (0.1757,-0.246);',
      '  \\fill (o1) circle[radius=1.5pt];',
      '  \\coordinate (o2-start) at (0.1757,-0.246);',
      '  \\coordinate (o2-end) at (1.0544,-0.246);',
      '  \\draw (o2-start) -- (o2-end);',
      '  \\coordinate (o3-center) at (1.4058,-0.7029);',
      '  \\draw (o3-center) circle[radius=8pt];',
      '  \\node (o4) at (0.3515,-0.1406) {$\\operatorname{Exc}(\\pi)$};',
      '\\end{tikzpicture}',
      ''
    ].join('\n'),
    libraries: []
  })
  expect(serializeScene(scene)).toBe(before)
})

test('raw ink emits a reduced polyline while an interpreted stroke emits its geometry', () => {
  const scene = createScene()
  addStroke(scene, [
    { x: 0, y: 0 }, { x: 10, y: 0.2 }, { x: 20, y: 0 },
    { x: 30, y: 11 }, { x: 40, y: 20 }
  ])
  const interpreted = addStroke(scene, [
    { x: 2, y: 50 }, { x: 12, y: 52 }, { x: 22, y: 49 }
  ])
  setInterpretation(scene, interpreted, {
    kind: 'segment', start: { x: 2, y: 50 }, end: { x: 22, y: 50 }
  })

  expect(generateTikz(scene).source).toBe([
    '\\begin{tikzpicture}',
    '  \\coordinate (o1-start) at (0,0);',
    '  \\draw (o1-start) -- (0.7029,0) -- (1.4058,-0.7029);',
    '  \\coordinate (o2-start) at (0.0703,-1.7573);',
    '  \\coordinate (o2-end) at (0.7732,-1.7573);',
    '  \\draw (o2-start) -- (o2-end);',
    '\\end{tikzpicture}',
    ''
  ].join('\n'))
})

test('source does not expose pointer-coordinate noise', () => {
  const scene = createScene()
  addPrimitive(scene, {
    kind: 'segment',
    start: { x: 1.23456789, y: 2.00000001 },
    end: { x: 20.98765432, y: 2.00000001 }
  })
  expect(generateTikz(scene).source).toContain('at (0.0434,-0.0703);')
  expect(generateTikz(scene).source).toContain('at (0.7376,-0.0703);')
})
