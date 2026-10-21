// Shared by make-diagrams.mjs, which renders the docs' Mermaid diagrams, and
// build-docs.mjs, which puts the renders in the pages.
import { createHash } from 'node:crypto';

export const DIAGRAM_DOCS = ['runtime-architecture.md'];
export const DIAGRAM_DIR = 'assets/diagrams';

// A render is named after its source, so an edited diagram needs a new render.
export function diagramHash(source) {
  return createHash('sha256').update(source.trim()).digest('hex').slice(0, 12);
}

export function mermaidBlocks(markdown) {
  return [...markdown.matchAll(/^```mermaid\s*\n([\s\S]*?)\n```\s*$/gm)].map(m => m[1]);
}
