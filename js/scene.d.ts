export interface Point {
  x: number;
  y: number;
}

export interface InkSample extends Point {
  time?: number;
  pressure?: number;
  altitude?: number;
  azimuth?: number;
  roll?: number;
  hoverHeight?: number;
  buttons?: number;
  has?: number;
  id?: number;
  tool?: number;
  phase?: number;
}

export type Geometry =
  | { kind: "rawStroke"; points: Point[] }
  | ({ kind: "point" } & Point)
  | { kind: "segment"; start: Point; end: Point }
  | { kind: "circle"; center: Point; radius: number }
  | { kind: "label"; position: Point; tex: string };

export interface SceneObject {
  id: string;
  ink: InkSample[] | null;
  geometry: Geometry;
}

export interface Scene {
  version: 1;
  nextId: number;
  objects: SceneObject[];
  selectedId: string | null;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function createScene(): Scene;
export function addStroke(scene: Scene, samples: InkSample[]): string;
export function addPrimitive(scene: Scene, primitive: Geometry): string;
export function setInterpretation(scene: Scene, id: string, primitive: Geometry): void;
export function translateSelected(scene: Scene, dx: number, dy: number): void;
export function selectAt(scene: Scene, location: Point, tolerance: number): string | null;
export function removeSelected(scene: Scene): void;
export function sceneBounds(scene: Scene): Bounds | null;
export function serializeScene(scene: Scene): string;
export function deserializeScene(source: string): Scene;
