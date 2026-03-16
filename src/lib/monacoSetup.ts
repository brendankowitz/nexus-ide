/**
 * Configure @monaco-editor/react to use the locally installed monaco-editor
 * package (ESM build) and wire up the core editor worker via Vite's native
 * worker import.  Import this module once before any DiffEditor renders.
 */
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
// Vite bundles this worker at build time
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

loader.config({ monaco });

window.MonacoEnvironment = {
  getWorker(_workerId: string, _label: string): Worker {
    return new EditorWorker();
  },
};
