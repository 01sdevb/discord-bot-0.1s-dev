export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

const MAX_HISTORY = 20;

const histories = new Map<string, ChatMessage[]>();

function getKey(userId: string, channelId: string): string {
  return `${channelId}:${userId}`;
}

export function addMessage(userId: string, channelId: string, role: "user" | "model", content: string): void {
  const key = getKey(userId, channelId);
  if (!histories.has(key)) {
    histories.set(key, []);
  }
  const history = histories.get(key)!;
  history.push({ role, content });
  if (history.length > MAX_HISTORY) {
    history.splice(0, history.length - MAX_HISTORY);
  }
}

export function getHistory(userId: string, channelId: string): ChatMessage[] {
  return histories.get(getKey(userId, channelId)) ?? [];
}

export function clearHistory(userId: string, channelId: string): void {
  histories.delete(getKey(userId, channelId));
}
