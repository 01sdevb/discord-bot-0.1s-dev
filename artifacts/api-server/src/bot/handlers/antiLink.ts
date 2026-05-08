import { Message, PermissionFlagsBits, TextChannel } from "discord.js";

const URL_REGEX =
  /(https?:\/\/[^\s]+|discord\.gg\/[^\s]+|www\.[^\s]+\.[a-z]{2,})/gi;

const enabledGuilds = new Set<string>();

export function isAntiLinkEnabled(guildId: string): boolean {
  return enabledGuilds.has(guildId);
}

export function setAntiLink(guildId: string, enabled: boolean): void {
  if (enabled) {
    enabledGuilds.add(guildId);
  } else {
    enabledGuilds.delete(guildId);
  }
}

export async function handleAntiLink(message: Message): Promise<void> {
  if (!message.guild) return;
  if (!isAntiLinkEnabled(message.guild.id)) return;

  const member = message.member;
  if (!member) return;

  if (member.permissions.has(PermissionFlagsBits.Administrator)) return;

  const matches = message.content.match(URL_REGEX);
  if (!matches) return;

  const linkType = matches[0]!.startsWith("discord")
    ? "Discord invite"
    : matches[0]!.startsWith("http")
    ? "URL"
    : "enlace";

  try {
    await message.delete();
    const channel = message.channel as TextChannel;
    await channel.send(
      `🚫 **Link eliminado** | Enviado por: **${message.author.tag}** | Tipo: \`${linkType}\``
    );
  } catch {}
}
