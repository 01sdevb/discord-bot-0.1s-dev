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

export function buildScriptContext(): string {
  const scripts = [...cache.values()];
  if (scripts.length === 0) return "-- No hay scripts de referencia guardados aún.";
  return scripts
    .map((s) => `-- === ARCHIVO: ${s.name} ===\n${s.content}`)
    .join("\n\n");
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
