import { expect, test } from 'bun:test'
import {
  addPrimitive, addStroke, createScene, deserializeScene, removeSelected,
  sceneBounds, selectAt, serializeScene, setInterpretation, translateSelected
} from '../js/scene.js'

test('a recognized sketch retains its ink and can be selected, moved, and reopened', () => {
  const scene = createScene()
  const strokeId = addStroke(scene, [
    { x: 10, y: 20 }, { x: 45, y: 23 }, { x: 80, y: 20 }
  ])
  setInterpretation(scene, strokeId, {
    kind: 'segment', start: { x: 10, y: 20 }, end: { x: 80, y: 20 }
  })
  addPrimitive(scene, { kind: 'circle', center: { x: 100, y: 50 }, radius: 12 })

  expect(selectAt(scene, { x: 50, y: 20 }, 3)).toBe(strokeId)
  translateSelected(scene, 5, -10)
  expect(sceneBounds(scene)).toEqual({ minX: 15, minY: 10, maxX: 112, maxY: 62 })

  const reopened = deserializeScene(serializeScene(scene))
  expect(reopened.objects[0].ink).toEqual([
    { x: 15, y: 10 }, { x: 50, y: 13 }, { x: 85, y: 10 }
  ])
  expect(reopened.objects[0].geometry).toEqual({
    kind: 'segment', start: { x: 15, y: 10 }, end: { x: 85, y: 10 }
  })
  expect(selectAt(reopened, { x: 50, y: 10 }, 3)).toBe(strokeId)
  expect(serializeScene(reopened)).toBe(serializeScene(scene))
})

test('interpretation changes do not discard ink, and object IDs survive deletion', () => {
  const scene = createScene()
  const first = addStroke(scene, [{ x: 2, y: 3 }, { x: 9, y: 13 }])
  const second = addStroke(scene, [{ x: 40, y: 50 }, { x: 42, y: 52 }])
  setInterpretation(scene, first, { kind: 'point', x: 7, y: 8 })
  setInterpretation(scene, first, { kind: 'rawStroke', points: scene.objects[0].ink })

  expect(scene.objects[0].ink).toEqual([{ x: 2, y: 3 }, { x: 9, y: 13 }])
  expect(selectAt(scene, { x: 8, y: 12 }, 2)).toBe(first)
  removeSelected(scene)
  expect(sceneBounds(scene)).toEqual({ minX: 40, minY: 50, maxX: 42, maxY: 52 })
  expect(scene.objects.map(item => item.id)).toEqual([second])
  expect(addStroke(scene, [{ x: 70, y: 80 }])).toBe('o3')
})

test('the completed figure bounds and saved scene retain the original pen samples', () => {
  const scene = createScene()
  const samples = [
    { x: 10, y: 12, time: 40, pressure: 0.2 },
    { x: 50, y: 42, time: 60, pressure: 0.8 }
  ]
  const id = addStroke(scene, samples)
  setInterpretation(scene, id, {
    kind: 'segment', start: { x: 12, y: 20 }, end: { x: 48, y: 20 }
  })

  expect(sceneBounds(scene)).toEqual({ minX: 10, minY: 12, maxX: 50, maxY: 42 })
  expect(deserializeScene(serializeScene(scene)).objects[0].ink).toEqual(samples)
})
