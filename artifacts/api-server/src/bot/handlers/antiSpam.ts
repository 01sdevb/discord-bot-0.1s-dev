import { Message, PermissionFlagsBits, TextChannel } from "discord.js";

interface SpamRecord {
  messages: { id: string; content: string; timestamp: number }[];
  timeout: ReturnType<typeof setTimeout> | null;
}

const spamMap = new Map<string, SpamRecord>();

const SPAM_LIMIT = 3;
const SPAM_WINDOW_MS = 5000;
const TIMEOUT_DURATION_MS = 28 * 24 * 60 * 60 * 1000;

export async function handleAntiSpam(message: Message): Promise<void> {
  if (!message.guild) return;

  const member = message.member;
  if (!member) return;

  if (member.permissions.has(PermissionFlagsBits.Administrator)) return;

  const key = `${message.guild.id}-${message.author.id}`;
  const now = Date.now();

  if (!spamMap.has(key)) {
    spamMap.set(key, { messages: [], timeout: null });
  }

  const record = spamMap.get(key)!;

  record.messages = record.messages.filter(
    (m) => now - m.timestamp < SPAM_WINDOW_MS,
  );

  record.messages.push({
    id: message.id,
    content: message.content,
    timestamp: now,
  });

  if (record.messages.length >= SPAM_LIMIT) {
    const spamContents = record.messages.map((m) => m.content);
    const messageIds = record.messages.map((m) => m.id);

    spamMap.delete(key);

    try {
      const channel = message.channel as TextChannel;

      for (const id of messageIds) {
        try {
          const msg = await channel.messages.fetch(id);
          await msg.delete();
        } catch {
        }
      }

      if (member.moderatable) {
        await member.timeout(
          TIMEOUT_DURATION_MS,
          `Anti-spam: envió ${SPAM_LIMIT} mensajes seguidos en menos de ${SPAM_WINDOW_MS / 1000}s`,
        );
      }

      await channel.send(
        `⛔ **Anti-Spam** | ${message.author} ha recibido **timeout de 28 días**.\n` +
          `📋 **Razón:** Envió ${SPAM_LIMIT} mensajes seguidos rápidamente.\n` +
          `💬 **Mensajes enviados:**\n${spamContents.map((c, i) => `> ${i + 1}. ${c || "(vacío)"}`).join("\n")}`,
      );
    } catch {
    }
  }
}
