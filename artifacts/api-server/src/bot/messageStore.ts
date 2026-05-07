import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { logger } from "../lib/logger";

export interface StoredMessage {
  id: string;
  userId: string;
  username: string;
  tag: string;
  channelId: string;
  channelName: string;
  guildId: string;
  content: string;
  timestamp: number;
  deleted: boolean;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

const messagesByGuild = new Map<string, StoredMessage[]>();

async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

export async function loadMessages(): Promise<void> {
  try {
    await ensureDataDir();
    if (!existsSync(MESSAGES_FILE)) return;
    const raw = await readFile(MESSAGES_FILE, "utf-8");
    const data = JSON.parse(raw) as Record<string, StoredMessage[]>;
    for (const [guildId, msgs] of Object.entries(data)) {
      messagesByGuild.set(guildId, msgs);
    }
    logger.info({ total: Object.keys(data).length }, "Mensajes cargados desde disco");
  } catch (err) {
    logger.warn({ err }, "No se pudieron cargar mensajes guardados");
  }
}

export async function saveMessages(): Promise<void> {
  try {
    await ensureDataDir();
    const data: Record<string, StoredMessage[]> = {};
    for (const [guildId, msgs] of messagesByGuild.entries()) {
      data[guildId] = msgs;
    }
    await writeFile(MESSAGES_FILE, JSON.stringify(data), "utf-8");
  } catch (err) {
    logger.error({ err }, "Error guardando mensajes en disco");
  }
}

export function storeMessage(msg: Omit<StoredMessage, "deleted">): void {
  const guildMsgs = messagesByGuild.get(msg.guildId) ?? [];
  guildMsgs.push({ ...msg, deleted: false });
  messagesByGuild.set(msg.guildId, guildMsgs);
}

export function markDeleted(guildId: string, messageId: string): void {
  const guildMsgs = messagesByGuild.get(guildId);
  if (!guildMsgs) return;
  const msg = guildMsgs.find((m) => m.id === messageId);
  if (msg) msg.deleted = true;
}

export function getUserMessages(
  guildId: string,
  userId: string,
  filter?: string,
): StoredMessage[] {
  const guildMsgs = messagesByGuild.get(guildId) ?? [];
  let results = guildMsgs.filter((m) => m.userId === userId && m.content.trim().length > 0);
  if (filter) {
    const lower = filter.toLowerCase();
    results = results.filter((m) => m.content.toLowerCase().includes(lower));
  }
  return results.sort((a, b) => a.timestamp - b.timestamp);
}

export function getGeneralMessages(
  guildId: string,
  filter?: string,
): StoredMessage[] {
  const guildMsgs = messagesByGuild.get(guildId) ?? [];
  let results = guildMsgs.filter((m) => m.content.trim().length > 0);
  if (filter) {
    const lower = filter.toLowerCase();
    results = results.filter((m) => m.content.toLowerCase().includes(lower));
  }
  return results.sort((a, b) => a.timestamp - b.timestamp);
}
