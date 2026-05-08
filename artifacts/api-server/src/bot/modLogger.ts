import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { logger } from "../lib/logger";

const LOG_CHANNEL_ID = "1502121032914305076";

type LogType =
  | "ban" | "kick" | "unban"
  | "warn" | "warnclear"
  | "timeout"
  | "ticketOpen" | "ticketClose" | "ticketDelete"
  | "antilink" | "antispam";

interface LogOptions {
  type: LogType;
  guildId: string;
  target?: { id: string; tag: string; avatarUrl?: string };
  moderator?: { id: string; tag: string };
  reason?: string;
  extra?: Record<string, string>;
}

const CONFIG: Record<LogType, { title: string; emoji: string; color: number }> = {
  ban:          { title: "Usuario Baneado",         emoji: "🔨", color: 0xff2222 },
  kick:         { title: "Usuario Expulsado",        emoji: "👢", color: 0xff8800 },
  unban:        { title: "Usuario Desbaneado",       emoji: "✅", color: 0x00cc66 },
  warn:         { title: "Advertencia",              emoji: "⚠️", color: 0xffcc00 },
  warnclear:    { title: "Advertencias Limpiadas",   emoji: "🧹", color: 0x00aaff },
  timeout:      { title: "Timeout Aplicado",         emoji: "⏱️", color: 0xff6600 },
  ticketOpen:   { title: "Ticket Abierto",           emoji: "🎫", color: 0x00b0f4 },
  ticketClose:  { title: "Ticket Cerrado",           emoji: "🔒", color: 0xaaaaaa },
  ticketDelete: { title: "Ticket Eliminado",         emoji: "🗑️", color: 0x666666 },
  antilink:     { title: "Link Eliminado",           emoji: "🔗", color: 0xff4444 },
  antispam:     { title: "Spam Detectado",           emoji: "🛡️", color: 0xff9900 },
};

let _client: Client | null = null;

export function initModLogger(client: Client): void {
  _client = client;
}

export async function modLog(opts: LogOptions): Promise<void> {
  if (!_client) return;

  try {
    const guild = _client.guilds.cache.get(opts.guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(LOG_CHANNEL_ID) as TextChannel | undefined;
    if (!channel) return;

    const cfg = CONFIG[opts.type];
    const now = new Date();

    const embed = new EmbedBuilder()
      .setTitle(`${cfg.emoji} ${cfg.title}`)
      .setColor(cfg.color)
      .setTimestamp(now)
      .setFooter({ text: `${now.toLocaleString("es-ES", { timeZone: "America/Bogota" })} COT` });

    if (opts.target) {
      embed.addFields({ name: "Usuario", value: `<@${opts.target.id}> — \`${opts.target.tag}\` (${opts.target.id})`, inline: false });
      if (opts.target.avatarUrl) embed.setThumbnail(opts.target.avatarUrl);
    }

    if (opts.moderator) {
      embed.addFields({ name: "Moderador", value: `<@${opts.moderator.id}> — \`${opts.moderator.tag}\``, inline: false });
    }

    if (opts.reason) {
      embed.addFields({ name: "Razón", value: opts.reason, inline: false });
    }

    if (opts.extra) {
      for (const [name, value] of Object.entries(opts.extra)) {
        embed.addFields({ name, value, inline: true });
      }
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn({ err }, "Error enviando log de moderación");
  }
}
