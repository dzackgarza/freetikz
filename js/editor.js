import {
  addPrimitive, addStroke, createScene, deserializeScene, removeSelected,
  sceneBounds, selectAt, serializeScene, translateSelected
} from './scene.js'
import { generateTikz } from './tikz.js'

const namespace = 'http://www.w3.org/2000/svg'
const storageKey = 'freetikz.scene.v1'
const canvas = document.getElementById('canvas')
const sceneContent = document.getElementById('scene-content')
const interactionOverlay = document.getElementById('interaction-overlay')
const previewCanvas = document.getElementById('preview-canvas')
const sourceArea = document.getElementById('tikz-source')
const status = document.getElementById('status')
const objectCount = document.getElementById('object-count')
const removeButton = document.getElementById('remove-selection')
const labelInput = document.getElementById('label-tex')
const fileInput = document.getElementById('scene-file')

let scene = localStorage.getItem(storageKey)
  ? deserializeScene(localStorage.getItem(storageKey))
  : createScene()
let tool = 'ink'
let gesture = null

function element (tag, attributes = {}) {
  const node = document.createElementNS(namespace, tag)
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value))
  return node
}

function pointFromEvent (event) {
  const inverse = canvas.getScreenCTM().inverse()
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse)
  return { x: point.x, y: point.y }
}

function svgPath (points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
}

function drawGeometry (target, object, selected = false) {
  const geometry = object.geometry
  let node
  switch (geometry.kind) {
    case 'rawStroke':
      node = element('path', { d: svgPath(geometry.points), fill: 'none', stroke: '#26313c', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
      break
    case 'point':
      node = element('circle', { cx: geometry.x, cy: geometry.y, r: 4.5, fill: '#26313c' })
      break
    case 'segment':
      node = element('line', { x1: geometry.start.x, y1: geometry.start.y, x2: geometry.end.x, y2: geometry.end.y, stroke: '#26313c', 'stroke-width': 2.5 })
      break
    case 'circle':
      node = element('circle', { cx: geometry.center.x, cy: geometry.center.y, r: geometry.radius, fill: 'none', stroke: '#26313c', 'stroke-width': 2.5 })
      break
    case 'label':
      node = element('text', { x: geometry.position.x, y: geometry.position.y, fill: '#26313c', 'font-size': 19, 'font-family': 'serif' })
      node.textContent = geometry.tex
      break
  }
  node.dataset.objectId = object.id
  if (selected) node.classList.add('selected')
  target.appendChild(node)
}

function render () {
  sceneContent.replaceChildren()
  previewCanvas.replaceChildren()
  for (const object of scene.objects) {
    drawGeometry(sceneContent, object, object.id === scene.selectedId)
    drawGeometry(previewCanvas, object)
  }
  const bounds = sceneBounds(scene)
  if (bounds) {
    const pad = 20
    previewCanvas.setAttribute('viewBox', `${bounds.minX - pad} ${bounds.minY - pad} ${Math.max(bounds.maxX - bounds.minX, 1) + 2 * pad} ${Math.max(bounds.maxY - bounds.minY, 1) + 2 * pad}`)
  } else {
    previewCanvas.setAttribute('viewBox', '0 0 1000 700')
  }
  sourceArea.value = generateTikz(scene).source
  objectCount.textContent = `${scene.objects.length} object${scene.objects.length === 1 ? '' : 's'}`
  removeButton.disabled = scene.selectedId === null
  localStorage.setItem(storageKey, serializeScene(scene))
}

function renderGesture () {
  interactionOverlay.replaceChildren()
  if (!gesture || tool === 'select') return
  if (tool === 'ink' && gesture.points.length > 1) {
    interactionOverlay.appendChild(element('path', { d: svgPath(gesture.points), fill: 'none', stroke: '#295ba8', 'stroke-width': 2.5, 'stroke-linecap': 'round' }))
  } else if (tool === 'segment' && gesture.current) {
    interactionOverlay.appendChild(element('line', { x1: gesture.start.x, y1: gesture.start.y, x2: gesture.current.x, y2: gesture.current.y, stroke: '#295ba8', 'stroke-width': 2, 'stroke-dasharray': '5 4' }))
  } else if (tool === 'circle' && gesture.current) {
    interactionOverlay.appendChild(element('circle', { cx: gesture.start.x, cy: gesture.start.y, r: Math.hypot(gesture.current.x - gesture.start.x, gesture.current.y - gesture.start.y), fill: 'none', stroke: '#295ba8', 'stroke-width': 2, 'stroke-dasharray': '5 4' }))
  }
}

function setTool (next) {
  tool = next
  canvas.dataset.tool = tool
  for (const button of document.querySelectorAll('[data-tool]')) {
    button.setAttribute('aria-pressed', String(button.dataset.tool === tool))
  }
  labelInput.hidden = tool !== 'label'
  status.textContent = {
    select: 'Select an object, then drag it to move.',
    ink: 'Draw a stroke.',
    point: 'Click to place a point.',
    segment: 'Drag to draw a line.',
    circle: 'Drag from the center to draw a circle.',
    label: 'Enter TeX, then click to place its label.'
  }[tool]
}

canvas.setAttribute('viewBox', '0 0 1000 700')
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0) return
  canvas.setPointerCapture(event.pointerId)
  const start = pointFromEvent(event)
  gesture = { start, current: start, points: [{ ...start, time: event.timeStamp, pressure: event.pressure }] }
  if (tool === 'select') {
    selectAt(scene, start, 9)
    render()
  }
})

canvas.addEventListener('pointermove', event => {
  if (!gesture || !canvas.hasPointerCapture(event.pointerId)) return
  const current = pointFromEvent(event)
  if (tool === 'select') {
    if (scene.selectedId !== null) {
      translateSelected(scene, current.x - gesture.current.x, current.y - gesture.current.y)
      render()
    }
  } else if (tool === 'ink') {
    for (const sample of event.getCoalescedEvents()) {
      const point = pointFromEvent(sample)
      gesture.points.push({ ...point, time: sample.timeStamp, pressure: sample.pressure })
    }
  }
  gesture.current = current
  renderGesture()
})

canvas.addEventListener('pointerup', event => {
  if (!gesture || !canvas.hasPointerCapture(event.pointerId)) return
  const end = pointFromEvent(event)
  if (tool === 'ink') {
    gesture.points.push({ ...end, time: event.timeStamp, pressure: event.pressure })
    addStroke(scene, gesture.points)
  } else if (tool === 'point') {
    addPrimitive(scene, { kind: 'point', ...end })
  } else if (tool === 'segment' && Math.hypot(end.x - gesture.start.x, end.y - gesture.start.y) > 1) {
    addPrimitive(scene, { kind: 'segment', start: gesture.start, end })
  } else if (tool === 'circle' && Math.hypot(end.x - gesture.start.x, end.y - gesture.start.y) > 1) {
    addPrimitive(scene, { kind: 'circle', center: gesture.start, radius: Math.hypot(end.x - gesture.start.x, end.y - gesture.start.y) })
  } else if (tool === 'label') {
    addPrimitive(scene, { kind: 'label', position: end, tex: labelInput.value })
  }
  gesture = null
  interactionOverlay.replaceChildren()
  render()
})

canvas.addEventListener('pointercancel', () => {
  gesture = null
  interactionOverlay.replaceChildren()
})

document.querySelectorAll('[data-tool]').forEach(button => {
  button.addEventListener('click', () => setTool(button.dataset.tool))
})
removeButton.addEventListener('click', () => { removeSelected(scene); render() })
canvas.addEventListener('keydown', event => {
  if ((event.key === 'Delete' || event.key === 'Backspace') && scene.selectedId !== null) {
    removeSelected(scene)
    render()
  }
})
document.getElementById('copy-tikz').addEventListener('click', async () => {
  await navigator.clipboard.writeText(sourceArea.value)
  status.textContent = 'TikZ copied.'
})
document.getElementById('save-scene').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([serializeScene(scene)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'figure.scene.json'
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
})
document.getElementById('open-scene').addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0]
  if (!file) return
  scene = deserializeScene(await file.text())
  render()
})

setTool(tool)
render()
