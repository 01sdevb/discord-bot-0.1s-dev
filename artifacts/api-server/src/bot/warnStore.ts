export interface WarnEntry {
  reason: string;
  moderator: string;
  timestamp: number;
}

export interface WarnRecord {
  count: number;
  entries: WarnEntry[];
}

const store = new Map<string, Map<string, WarnRecord>>();

function guild(guildId: string): Map<string, WarnRecord> {
  if (!store.has(guildId)) store.set(guildId, new Map());
  return store.get(guildId)!;
}

export function addWarn(
  guildId: string,
  userId: string,
  reason: string,
  moderator: string,
): WarnRecord {
  const g = guild(guildId);
  const rec = g.get(userId) ?? { count: 0, entries: [] };
  rec.count++;
  rec.entries.push({ reason, moderator, timestamp: Date.now() });
  g.set(userId, rec);
  return rec;
}

export function getWarns(guildId: string, userId: string): WarnRecord | null {
  return store.get(guildId)?.get(userId) ?? null;
}

export function clearWarns(guildId: string, userId: string): void {
  store.get(guildId)?.delete(userId);
}
