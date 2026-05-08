import { Message, TextChannel } from "discord.js";
import axios from "axios";
import { saveScript, getScriptCount } from "../scriptStore";
import { logger } from "../../lib/logger";

const ALLOWED_EXTENSIONS = new Set([".lua", ".txt", ".text"]);

const devAllChannels = new Set<string>();

export function registerDevAllChannel(channelId: string): void {
  devAllChannels.add(channelId);
}

export function isDevAllChannel(channelId: string): boolean {
  return devAllChannels.has(channelId);
}

export async function handleDevAllChannelUpload(message: Message): Promise<void> {
  if (!message.guild) return;
  if (message.attachments.size === 0) return;

  const results: string[] = [];

  for (const [, attachment] of message.attachments) {
    const filename = attachment.name ?? "script.txt";
    const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;

    try {
      const response = await axios.get<string>(attachment.url, {
        responseType: "text",
        timeout: 30000,
        maxContentLength: 500 * 1024 * 1024,
      });
      const saved = await saveScript(filename, response.data);
      if (saved) {
        results.push(`✅ \`${filename}\``);
        logger.info({ filename }, "Script auto-guardado desde canal Dev all");
      }
    } catch (err) {
      logger.warn({ err, filename }, "Error guardando script en canal Dev all");
    }
  }

  if (results.length > 0) {
    await message.reply(
      `📥 **Scripts guardados automáticamente:**\n${results.join("\n")}\n📚 Total en base: **${getScriptCount()}**`
    ).catch(() => {});
  }
}

export async function cmdAll(message: Message): Promise<void> {
  if (!message.guild) return;

  let attachments = message.attachments;

  if (attachments.size === 0 && message.reference?.messageId) {
    try {
      const channel = message.channel as TextChannel;
      const referenced = await channel.messages.fetch(message.reference.messageId);
      attachments = referenced.attachments;
    } catch {
    }
  }

  if (attachments.size === 0) {
    registerDevAllChannel(message.channel.id);
    await message.reply(
      `📡 **Canal registrado** — todos los archivos que se envíen aquí se guardarán automáticamente.\n` +
      `📚 Scripts en base actualmente: **${getScriptCount()}**`
    );
    return;
  }

  registerDevAllChannel(message.channel.id);

  const results: string[] = [];

  for (const [, attachment] of attachments) {
    const filename = attachment.name ?? "script.txt";
    const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      results.push(`❌ \`${filename}\` — extensión no soportada (usa .lua .txt .text)`);
      continue;
    }

    try {
      const response = await axios.get<string>(attachment.url, {
        responseType: "text",
        timeout: 30000,
        maxContentLength: 500 * 1024 * 1024,
      });
      const saved = await saveScript(filename, response.data);
      if (saved) {
        results.push(`✅ \`${filename}\` — guardado`);
      } else {
        results.push(`❌ \`${filename}\` — no se pudo guardar`);
      }
    } catch {
      results.push(`❌ \`${filename}\` — error al descargar`);
    }
  }

  await message.reply(
    `📁 **Archivos procesados:**\n${results.join("\n")}\n\n📚 Total scripts en base: **${getScriptCount()}**`
  );
}
