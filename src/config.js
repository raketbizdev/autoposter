import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// AUTOPOSTER_HOME lets tests run against a throwaway folder.
export function paths(home = process.env.AUTOPOSTER_HOME || projectRoot) {
  const p = {
    root: projectRoot,
    home,
    data: path.join(home, 'data'),
    db: path.join(home, 'data', 'autoposter.db'),
    lock: path.join(home, 'data', 'worker.lock'),
    media: path.join(home, 'media'),
    jobs: path.join(home, 'jobs'),
    logs: path.join(home, 'logs'),
    webDist: path.join(projectRoot, 'web', 'dist'),
  };
  for (const dir of [p.data, p.media, p.jobs, p.logs]) fs.mkdirSync(dir, { recursive: true });
  return p;
}

export const PORT = Number(process.env.AUTOPOSTER_PORT || 4317);
export const HOST = '127.0.0.1';

export const LIMITS = {
  maxFileBytes: 10 * 1024 * 1024, // Claude in Chrome file_upload caps one call at 10 MB
  maxTotalBytes: 10 * 1024 * 1024,
  maxFiles: 10,
};
