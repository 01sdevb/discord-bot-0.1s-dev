import { writeFile, readFile, readdir, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { logger } from "../lib/logger";

const SCRIPTS_DIR = path.resolve(process.cwd(), "data", "scripts");

const ALLOWED_EXTENSIONS = new Set([".lua", ".txt", ".text"]);

export interface ScriptFile {
  name: string;
  ext: string;
  content: string;
  savedAt: number;
}

const cache = new Map<string, ScriptFile>();

async function ensureDir(): Promise<void> {
  if (!existsSync(SCRIPTS_DIR)) await mkdir(SCRIPTS_DIR, { recursive: true });
}

export async function loadScripts(): Promise<void> {
  try {
    await ensureDir();
    const files = await readdir(SCRIPTS_DIR);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) continue;
      const content = await readFile(path.join(SCRIPTS_DIR, file), "utf-8");
      cache.set(file, { name: file, ext, content, savedAt: Date.now() });
    }
    logger.info({ count: cache.size }, "Scripts cargados");
  } catch (err) {
    logger.warn({ err }, "No se pudieron cargar scripts");
  }
}

export async function saveScript(filename: string, content: string): Promise<boolean> {
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  await ensureDir();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  await writeFile(path.join(SCRIPTS_DIR, safe), content, "utf-8");
  cache.set(safe, { name: safe, ext, content, savedAt: Date.now() });
  return true;
}

export function getAllScripts(): ScriptFile[] {
  return [...cache.values()];
}

export function getScriptCount(): number {
  return cache.size;
}

export function buildScriptContext(): string {
  const scripts = [...cache.values()];
  if (scripts.length === 0) return "-- No hay scripts de referencia guardados aún.";
  return scripts
    .map((s) => `-- === ARCHIVO: ${s.name} ===\n${s.content}`)
    .join("\n\n");
}
