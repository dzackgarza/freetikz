import type { Scene } from "./scene.js";

export interface GeneratedTikz {
  source: string;
  libraries: string[];
}

export function generateTikz(scene: Scene): GeneratedTikz;
