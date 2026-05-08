import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { logger } from "../lib/logger";

const LOG_CHANNEL_ID = "1502121032914305076";
const TIMEZONE = "America/Santo_Domingo";

type LogType =
  | "ban" | "kick" | "unban"
  | "warn" | "warnclear"
  | "timeout"
  | "ticketOpen" | "ticketClose" | "ticketDelete"
  | "antilink" | "antispam"
  | "scriptAdd";

interface LogOptions {
  type: LogType;
  guildId: string;
  target?: { id: string; tag: string; avatarUrl?: string };
  moderator?: { id: string; tag: string };
  reason?: string;
  extra?: Record<string, string>;
}

const CONFIG: Record<LogType, { title: string; emoji: string; color: number }> = {
  ban:          { title: "Usuario Baneado",         emoji: "🔨", color: 0xe74c3c },
  kick:         { title: "Usuario Expulsado",        emoji: "👢", color: 0xe67e22 },
  unban:        { title: "Usuario Desbaneado",       emoji: "✅", color: 0x2ecc71 },
  warn:         { title: "Advertencia",              emoji: "⚠️", color: 0xf1c40f },
  warnclear:    { title: "Advertencias Limpiadas",   emoji: "🧹", color: 0x3498db },
  timeout:      { title: "Timeout Aplicado",         emoji: "⏱️", color: 0xe67e22 },
  ticketOpen:   { title: "Ticket Abierto",           emoji: "🎫", color: 0x3498db },
  ticketClose:  { title: "Ticket Cerrado",           emoji: "🔒", color: 0x95a5a6 },
  ticketDelete: { title: "Ticket Eliminado",         emoji: "🗑️", color: 0x7f8c8d },
  antilink:     { title: "Link Eliminado",           emoji: "🔗", color: 0xe74c3c },
  antispam:     { title: "Spam Detectado",           emoji: "🛡️", color: 0xe67e22 },
  scriptAdd:    { title: "Script Añadido",           emoji: "📁", color: 0x9b59b6 },
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

    const rdTime = now.toLocaleString("es-DO", {
      timeZone: TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const embed = new EmbedBuilder()
      .setTitle(`${cfg.emoji} ${cfg.title}`)
      .setColor(cfg.color)
      .setTimestamp(now)
      .setFooter({ text: `${rdTime} RD` });

    if (opts.target) {
      embed.addFields({
        name: "Usuario",
        value: `<@${opts.target.id}> — \`${opts.target.tag}\` (${opts.target.id})`,
      });
      if (opts.target.avatarUrl) embed.setThumbnail(opts.target.avatarUrl);
    }

    if (opts.moderator) {
      embed.addFields({
        name: "Moderador",
        value: `<@${opts.moderator.id}> — \`${opts.moderator.tag}\``,
      });
    }

    if (opts.reason) {
      embed.addFields({ name: "Razón", value: opts.reason });
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
