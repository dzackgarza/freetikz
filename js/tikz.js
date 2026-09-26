function number (value) {
  const rounded = Number(value.toFixed(2))
  return String(Object.is(rounded, -0) ? 0 : rounded)
}

function coordinate (point) {
  return `(${number(point.x)},${number(point.y)})`
}

// Ramer-Douglas-Peucker reduction follows Simplify.js's distance-based
// polyline algorithm: https://github.com/mourner/simplify-js/blob/master/simplify.js
// It only reduces the TikZ fallback; the scene retains every ink sample.
function squaredDistanceToSegment (point, start, end) {
  let x = start.x
  let y = start.y
  let dx = end.x - x
  let dy = end.y - y

  if (dx !== 0 || dy !== 0) {
    const fraction = ((point.x - x) * dx + (point.y - y) * dy) / (dx * dx + dy * dy)
    if (fraction >= 1) {
      x = end.x
      y = end.y
    } else if (fraction > 0) {
      x += dx * fraction
      y += dy * fraction
    }
  }

  dx = point.x - x
  dy = point.y - y
  return dx * dx + dy * dy
}

function simplifyStroke (points, tolerance = 1) {
  if (points.length <= 2) return points

  const keep = new Set([0, points.length - 1])
  const spans = [[0, points.length - 1]]
  const squaredTolerance = tolerance * tolerance

  while (spans.length > 0) {
    const [first, last] = spans.pop()
    let furthest = -1
    let greatestDistance = squaredTolerance
    for (let index = first + 1; index < last; index++) {
      const distance = squaredDistanceToSegment(points[index], points[first], points[last])
      if (distance > greatestDistance) {
        greatestDistance = distance
        furthest = index
      }
    }
    if (furthest >= 0) {
      keep.add(furthest)
      spans.push([first, furthest], [furthest, last])
    }
  }

  return points.filter((_, index) => keep.has(index))
}

function emitObject (object) {
  const { id, geometry } = object
  switch (geometry.kind) {
    case 'point':
      return [
        `  \\coordinate (${id}) at ${coordinate(geometry)};`,
        `  \\fill (${id}) circle[radius=1.5pt];`
      ]
    case 'segment':
      return [
        `  \\coordinate (${id}-start) at ${coordinate(geometry.start)};`,
        `  \\coordinate (${id}-end) at ${coordinate(geometry.end)};`,
        `  \\draw (${id}-start) -- (${id}-end);`
      ]
    case 'circle':
      return [
        `  \\coordinate (${id}-center) at ${coordinate(geometry.center)};`,
        `  \\draw (${id}-center) circle[radius=${number(geometry.radius)}pt];`
      ]
    case 'label':
      return [`  \\node (${id}) at ${coordinate(geometry.position)} {${geometry.tex}};`]
    case 'rawStroke': {
      const points = simplifyStroke(geometry.points)
      if (points.length === 1) {
        return [
          `  \\coordinate (${id}) at ${coordinate(points[0])};`,
          `  \\fill (${id}) circle[radius=1pt];`
        ]
      }
      return [
        `  \\coordinate (${id}-start) at ${coordinate(points[0])};`,
        `  \\draw (${id}-start) -- ${points.slice(1).map(coordinate).join(' -- ')};`
      ]
    }
    default:
      throw new TypeError(`Unsupported scene geometry: ${geometry.kind}`)
  }
}

export function generateTikz (scene) {
  const lines = ['\\begin{tikzpicture}[x=1pt,y=-1pt]']
  for (const object of scene.objects) lines.push(...emitObject(object))
  lines.push('\\end{tikzpicture}')
  return { source: `${lines.join('\n')}\n`, libraries: [] }
}
