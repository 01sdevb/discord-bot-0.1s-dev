import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { modLog } from "../modLogger";

const MAX_MS = 28 * 24 * 60 * 60 * 1000;

function parseDuration(str: string): number | null {
  const match = str.match(/^(\d+)(d|h|m|s)$/i);
  if (!match) return null;
  const value = parseInt(match[1]!);
  const unit = match[2]!.toLowerCase();
  const multipliers: Record<string, number> = {
    d: 24 * 60 * 60 * 1000,
    h: 60 * 60 * 1000,
    m: 60 * 1000,
    s: 1000,
  };
  return value * (multipliers[unit] ?? 0);
}

function formatDuration(ms: number): string {
  const d = Math.floor(ms / (24 * 60 * 60 * 1000));
  const h = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  return parts.join(" ") || "menos de 1 minuto";
}

export async function cmdTimeout(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  const executor = message.member;
  if (!executor?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply("❌ No tienes permiso para dar timeout.");
    return;
  }

  const target = message.mentions.members?.first();
  if (!target) {
    await message.reply(
      "❌ Uso: `Dev timeout @usuario <duración> [razón]`\n" +
      "Ejemplos: `Dev timeout @usuario 1d`, `Dev timeout @usuario 6h Spam`, `Dev timeout @usuario 28d`",
    );
    return;
  }

  if (target.id === message.author.id) {
    await message.reply("❌ No puedes darte timeout a ti mismo.");
    return;
  }

  if (!target.moderatable) {
    await message.reply("❌ No puedo aplicar timeout a este usuario.");
    return;
  }

  if (target.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ No puedes dar timeout a un administrador.");
    return;
  }

  const durationStr = args[1];
  if (!durationStr) {
    await message.reply("❌ Debes especificar la duración. Ejemplo: `1d`, `6h`, `30m`");
    return;
  }

  let durationMs = parseDuration(durationStr);
  if (!durationMs || durationMs <= 0) {
    await message.reply("❌ Duración inválida. Usa formato: `1d`, `6h`, `30m`, `60s`");
    return;
  }
  if (durationMs > MAX_MS) durationMs = MAX_MS;

  const reason = args.slice(2).join(" ") || "Sin razón especificada";
  const formatted = formatDuration(durationMs);

  try {
    await target.timeout(durationMs, reason);

    const embed = new EmbedBuilder()
      .setTitle("⏱️ Timeout Aplicado")
      .addFields(
        { name: "Usuario", value: `${target.user.tag}`, inline: true },
        { name: "Moderador", value: `${message.author.tag}`, inline: true },
        { name: "Duración", value: formatted, inline: true },
        { name: "Razón", value: reason },
      )
      .setColor(0xff8800)
      .setThumbnail(target.user.displayAvatarURL())
      .setTimestamp();

    await message.reply({ embeds: [embed] });

    await modLog({
      type: "timeout",
      guildId: message.guild.id,
      target: { id: target.id, tag: target.user.tag, avatarUrl: target.user.displayAvatarURL() },
      moderator: { id: message.author.id, tag: message.author.tag },
      reason,
      extra: { "Duración": formatted },
    });
  } catch {
    await message.reply("❌ No se pudo aplicar el timeout. Verifica mis permisos.");
  }
}
