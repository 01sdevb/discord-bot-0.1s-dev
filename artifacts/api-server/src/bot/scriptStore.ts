import { writeFile, readFile, readdir, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { logger } from "../lib/logger";
import type { Client, TextChannel } from "discord.js";
import { ChannelType } from "discord.js";
import axios from "axios";

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
    logger.info({ count: cache.size }, "Scripts cargados desde disco");
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

function extractKeywords(request: string): string[] {
  return request
    .toLowerCase()
    .replace(/[^a-záéíóúña-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function scoreScript(script: ScriptFile, keywords: string[]): number {
  const nameLower = script.name.toLowerCase();
  const contentLower = script.content.toLowerCase();
  let score = 0;

  for (const kw of keywords) {
    if (nameLower.includes(kw)) score += 10;
    const occurrences = (contentLower.match(new RegExp(kw, "g")) || []).length;
    score += Math.min(occurrences, 5);
  }

  return score;
}

export function findRelevantScripts(request: string, maxScripts = 4, maxCharsPerScript = 8000): string {
  const scripts = [...cache.values()];
  if (scripts.length === 0) return "-- No hay scripts de referencia guardados aún.";

  const keywords = extractKeywords(request);

  const scored = scripts
    .map((s) => ({ script: s, score: scoreScript(s, keywords) }))
    .sort((a, b) => b.score - a.score);

  const hasRelevant = scored[0]?.score && scored[0].score > 0;
  const selected = hasRelevant
    ? scored.slice(0, maxScripts).map((x) => x.script)
    : scored.sort(() => Math.random() - 0.5).slice(0, maxScripts).map((x) => x.script);

  return selected
    .map((s) => {
      const trimmed =
        s.content.length > maxCharsPerScript
          ? s.content.slice(0, maxCharsPerScript) + "\n-- [... continúa]"
          : s.content;
      return `-- === REFERENCIA: ${s.name} (relevancia para: ${request.slice(0, 60)}) ===\n${trimmed}`;
    })
    .join("\n\n");
}

export function buildScriptContext(): string {
  return findRelevantScripts("general lua roblox script");
}

export async function syncScriptsFromChannel(client: Client, channelId: string): Promise<number> {
  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) {
      logger.warn({ channelId }, "Canal de scripts no encontrado o no es de texto");
      return 0;
    }

    const textChannel = channel as TextChannel;
    let synced = 0;
    let lastId: string | undefined;

    while (true) {
      const messages = await textChannel.messages.fetch({
        limit: 100,
        ...(lastId ? { before: lastId } : {}),
      });

      if (messages.size === 0) break;

      for (const [, msg] of messages) {
        for (const [, attachment] of msg.attachments) {
          const filename = attachment.name ?? "script.txt";
          const ext = path.extname(filename).toLowerCase();
          if (!ALLOWED_EXTENSIONS.has(ext)) continue;
          if (cache.has(filename)) continue;

          try {
            const response = await axios.get<string>(attachment.url, {
              responseType: "text",
              timeout: 30000,
              maxContentLength: 100 * 1024 * 1024,
            });
            const saved = await saveScript(filename, response.data);
            if (saved) {
              synced++;
              logger.info({ filename }, "Script sincronizado desde Discord");
            }
          } catch (err) {
            logger.warn({ err, filename }, "Error descargando script del canal");
          }
        }
      }

      if (messages.size < 100) break;
      lastId = messages.last()?.id;
    }

    logger.info({ synced, total: cache.size }, "Sincronización de scripts completada");
    return synced;
  } catch (err) {
    logger.error({ err }, "Error en syncScriptsFromChannel");
    return 0;
  }
}
