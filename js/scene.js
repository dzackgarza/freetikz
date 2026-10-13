// The scene is the editable figure. Ink samples remain attached to an object
// after its geometry is interpreted, so recognition never destroys the sketch.

const SCENE_VERSION = 1

export function createScene () {
  return { version: SCENE_VERSION, nextId: 1, objects: [], selectedId: null }
}

function point (value) {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new TypeError('Expected a point with finite x and y')
  }
  return { x: value.x, y: value.y }
}

function points (values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError('A stroke needs at least one point')
  }
  return values.map(point)
}

function sample (value) {
  const position = point(value)
  for (const [key, field] of Object.entries(value)) {
    if (typeof field !== 'number' || !Number.isFinite(field)) {
      throw new TypeError(`Ink sample field ${key} must be finite`)
    }
  }
  return { ...value, ...position }
}

function samples (values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new TypeError('A stroke needs at least one sample')
  }
  return values.map(sample)
}

function geometry (value) {
  if (!value || typeof value !== 'object') {
    throw new TypeError('Expected geometric primitive')
  }
  switch (value.kind) {
    case 'rawStroke':
      return { kind: value.kind, points: points(value.points) }
    case 'point':
      return { kind: value.kind, ...point(value) }
    case 'segment':
      return { kind: value.kind, start: point(value.start), end: point(value.end) }
    case 'circle':
      if (!Number.isFinite(value.radius) || value.radius < 0) {
        throw new TypeError('Circle radius must be finite and nonnegative')
      }
      return { kind: value.kind, center: point(value.center), radius: value.radius }
    case 'label':
      if (typeof value.tex !== 'string') {
        throw new TypeError('Label TeX must be a string')
      }
      return { kind: value.kind, position: point(value.position), tex: value.tex }
    default:
      throw new TypeError(`Unsupported primitive: ${value.kind}`)
  }
}

function appendObject (scene, ink, primitive) {
  const id = `o${scene.nextId++}`
  scene.objects.push({ id, ink, geometry: primitive })
  return id
}

export function addStroke (scene, samples) {
  const ink = samples.map(sample)
  if (ink.length === 0) throw new TypeError('A stroke needs at least one sample')
  return appendObject(scene, ink, { kind: 'rawStroke', points: points(ink) })
}

export function addPrimitive (scene, primitive) {
  return appendObject(scene, null, geometry(primitive))
}

export function setInterpretation (scene, id, primitive) {
  const object = scene.objects.find(item => item.id === id)
  if (!object) throw new RangeError(`Unknown scene object: ${id}`)
  object.geometry = geometry(primitive)
}

function translatedPoint (value, dx, dy) {
  return { ...value, x: value.x + dx, y: value.y + dy }
}

function translatedGeometry (value, dx, dy) {
  switch (value.kind) {
    case 'rawStroke':
      return { kind: value.kind, points: value.points.map(item => translatedPoint(item, dx, dy)) }
    case 'point':
      return { kind: value.kind, ...translatedPoint(value, dx, dy) }
    case 'segment':
      return {
        kind: value.kind,
        start: translatedPoint(value.start, dx, dy),
        end: translatedPoint(value.end, dx, dy)
      }
    case 'circle':
      return { kind: value.kind, center: translatedPoint(value.center, dx, dy), radius: value.radius }
    case 'label':
      return { kind: value.kind, position: translatedPoint(value.position, dx, dy), tex: value.tex }
  }
}

export function translateSelected (scene, dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    throw new TypeError('Translation must be finite')
  }
  if (scene.selectedId === null) return
  const object = scene.objects.find(item => item.id === scene.selectedId)
  if (!object) throw new RangeError(`Unknown selected object: ${scene.selectedId}`)
  object.geometry = translatedGeometry(object.geometry, dx, dy)
  if (object.ink !== null) object.ink = object.ink.map(item => translatedPoint(item, dx, dy))
}

// FreeTikZ's BoundingBox and distance functions in js/freetikz.js are the
// reference for the coordinate geometry here. Projection adds path hit tests.
function distanceToSegment (target, start, end) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(target.x - start.x, target.y - start.y)
  const fraction = Math.max(0, Math.min(1,
    ((target.x - start.x) * dx + (target.y - start.y) * dy) / lengthSquared))
  return Math.hypot(target.x - start.x - fraction * dx, target.y - start.y - fraction * dy)
}

function distanceToGeometry (target, value) {
  switch (value.kind) {
    case 'rawStroke': {
      let distance = Math.hypot(target.x - value.points[0].x, target.y - value.points[0].y)
      for (let index = 1; index < value.points.length; index++) {
        distance = Math.min(distance, distanceToSegment(target, value.points[index - 1], value.points[index]))
      }
      return distance
    }
    case 'point':
      return Math.hypot(target.x - value.x, target.y - value.y)
    case 'segment':
      return distanceToSegment(target, value.start, value.end)
    case 'circle':
      return Math.abs(Math.hypot(target.x - value.center.x, target.y - value.center.y) - value.radius)
    case 'label':
      return Math.hypot(target.x - value.position.x, target.y - value.position.y)
  }
}

export function selectAt (scene, location, tolerance) {
  const target = point(location)
  if (!Number.isFinite(tolerance) || tolerance < 0) {
    throw new TypeError('Selection tolerance must be finite and nonnegative')
  }
  scene.selectedId = null
  // The last object is topmost, like the last SVG path in FreeTikZ.
  for (let index = scene.objects.length - 1; index >= 0; index--) {
    const object = scene.objects[index]
    if (distanceToGeometry(target, object.geometry) <= tolerance) {
      scene.selectedId = object.id
      break
    }
  }
  return scene.selectedId
}

export function removeSelected (scene) {
  if (scene.selectedId === null) return
  const index = scene.objects.findIndex(item => item.id === scene.selectedId)
  if (index < 0) throw new RangeError(`Unknown selected object: ${scene.selectedId}`)
  scene.objects.splice(index, 1)
  scene.selectedId = null
}

function geometryBounds (value) {
  switch (value.kind) {
    case 'rawStroke': {
      const bounds = {
        minX: value.points[0].x, minY: value.points[0].y,
        maxX: value.points[0].x, maxY: value.points[0].y
      }
      for (const item of value.points.slice(1)) {
        bounds.minX = Math.min(bounds.minX, item.x)
        bounds.minY = Math.min(bounds.minY, item.y)
        bounds.maxX = Math.max(bounds.maxX, item.x)
        bounds.maxY = Math.max(bounds.maxY, item.y)
      }
      return bounds
    }
    case 'point':
      return { minX: value.x, minY: value.y, maxX: value.x, maxY: value.y }
    case 'segment':
      return {
        minX: Math.min(value.start.x, value.end.x),
        minY: Math.min(value.start.y, value.end.y),
        maxX: Math.max(value.start.x, value.end.x),
        maxY: Math.max(value.start.y, value.end.y)
      }
    case 'circle':
      return {
        minX: value.center.x - value.radius,
        minY: value.center.y - value.radius,
        maxX: value.center.x + value.radius,
        maxY: value.center.y + value.radius
      }
    case 'label':
      return {
        minX: value.position.x, minY: value.position.y,
        maxX: value.position.x, maxY: value.position.y
      }
  }
}

export function sceneBounds (scene) {
  if (scene.objects.length === 0) return null
  const bounds = geometryBounds(scene.objects[0].geometry)
  for (const object of scene.objects) {
    const next = geometryBounds(object.geometry)
    bounds.minX = Math.min(bounds.minX, next.minX)
    bounds.minY = Math.min(bounds.minY, next.minY)
    bounds.maxX = Math.max(bounds.maxX, next.maxX)
    bounds.maxY = Math.max(bounds.maxY, next.maxY)
    if (object.ink !== null) {
      const inkBounds = geometryBounds({ kind: 'rawStroke', points: object.ink })
      bounds.minX = Math.min(bounds.minX, inkBounds.minX)
      bounds.minY = Math.min(bounds.minY, inkBounds.minY)
      bounds.maxX = Math.max(bounds.maxX, inkBounds.maxX)
      bounds.maxY = Math.max(bounds.maxY, inkBounds.maxY)
    }
  }
  return bounds
}

export function serializeScene (scene) {
  return JSON.stringify(scene)
}

export function deserializeScene (source) {
  const scene = JSON.parse(source)
  if (!scene || scene.version !== SCENE_VERSION || !Number.isSafeInteger(scene.nextId) ||
    scene.nextId < 1 || !Array.isArray(scene.objects)) {
    throw new TypeError('Invalid scene document')
  }
  const ids = new Set()
  const objects = scene.objects.map(item => {
    if (!item || typeof item.id !== 'string' || !/^o[1-9]\d*$/.test(item.id) || ids.has(item.id)) {
      throw new TypeError('Invalid scene object ID')
    }
    const ordinal = Number(item.id.slice(1))
    if (!Number.isSafeInteger(ordinal) || ordinal >= scene.nextId) {
      throw new TypeError('Scene object ID exceeds next ID')
    }
    ids.add(item.id)
    return {
      id: item.id,
      ink: item.ink === null ? null : samples(item.ink),
      geometry: geometry(item.geometry)
    }
  })
  if (scene.selectedId !== null && !ids.has(scene.selectedId)) {
    throw new TypeError('Selected scene object is missing')
  }
  return { version: SCENE_VERSION, nextId: scene.nextId, objects, selectedId: scene.selectedId }
}
