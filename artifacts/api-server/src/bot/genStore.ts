import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../../data/gen.json");

export interface GenEntry {
  userId: string;
  messageId: string;
  channelId: string;
  generatedAt: number;
  expiresAt: number;
  accessCode: string;
  placeId: string;
}

interface GenStore {
  entries: GenEntry[];
}

let store: GenStore = { entries: [] };

export async function loadGen(): Promise<void> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    store = JSON.parse(raw) as GenStore;
  } catch {
    store = { entries: [] };
  }
}

export async function saveGen(): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export function getUserEntry(userId: string): GenEntry | undefined {
  return store.entries.find((e) => e.userId === userId);
}

export function addEntry(entry: GenEntry): void {
  store.entries = store.entries.filter((e) => e.userId !== entry.userId);
  store.entries.push(entry);
}

export function removeEntry(userId: string): void {
  store.entries = store.entries.filter((e) => e.userId !== userId);
}

export function getExpiredEntries(): GenEntry[] {
  const now = Date.now();
  return store.entries.filter((e) => e.expiresAt <= now);
}

export function getAllEntries(): GenEntry[] {
  return store.entries;
}
