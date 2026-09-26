import { expect, test } from 'bun:test'
import { addPrimitive, addStroke, createScene, serializeScene, setInterpretation } from '../js/scene.js'
import { generateTikz } from '../js/tikz.js'

test('scene primitives emit named, editable standard TikZ without changing the scene', () => {
  const scene = createScene()
  addPrimitive(scene, { kind: 'point', x: 5, y: 7 })
  addPrimitive(scene, { kind: 'segment', start: { x: 5, y: 7 }, end: { x: 30, y: 7 } })
  addPrimitive(scene, { kind: 'circle', center: { x: 40, y: 20 }, radius: 8 })
  addPrimitive(scene, { kind: 'label', position: { x: 10, y: 4 }, tex: '$\\operatorname{Exc}(\\pi)$' })
  const before = serializeScene(scene)

  expect(generateTikz(scene)).toEqual({
    source: [
      '\\begin{tikzpicture}[x=1pt,y=-1pt]',
      '  \\coordinate (o1) at (5,7);',
      '  \\fill (o1) circle[radius=1.5pt];',
      '  \\coordinate (o2-start) at (5,7);',
      '  \\coordinate (o2-end) at (30,7);',
      '  \\draw (o2-start) -- (o2-end);',
      '  \\coordinate (o3-center) at (40,20);',
      '  \\draw (o3-center) circle[radius=8pt];',
      '  \\node (o4) at (10,4) {$\\operatorname{Exc}(\\pi)$};',
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
    '\\begin{tikzpicture}[x=1pt,y=-1pt]',
    '  \\coordinate (o1-start) at (0,0);',
    '  \\draw (o1-start) -- (20,0) -- (40,20);',
    '  \\coordinate (o2-start) at (2,50);',
    '  \\coordinate (o2-end) at (22,50);',
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
  expect(generateTikz(scene).source).toContain('at (1.23,2);')
  expect(generateTikz(scene).source).toContain('at (20.99,2);')
})
