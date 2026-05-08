import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { addWarn, getWarns, clearWarns } from "../warnStore";

const MAX_WARNS = 3;
const TIMEOUT_DURATION_MS = 28 * 24 * 60 * 60 * 1000;

export async function cmdWarn(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  const executor = message.member;
  if (!executor?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply("❌ No tienes permiso para advertir miembros.");
    return;
  }

  const target = message.mentions.members?.first();
  if (!target) {
    await message.reply("❌ Uso: `Dev warn @usuario razón`");
    return;
  }

  if (target.id === message.author.id) {
    await message.reply("❌ No puedes advertirte a ti mismo.");
    return;
  }

  if (target.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ No puedes advertir a un administrador.");
    return;
  }

  const reason = args.slice(1).join(" ") || "Sin razón especificada";
  const record = addWarn(message.guild.id, target.id, reason, message.author.tag);

  const embed = new EmbedBuilder()
    .setTitle("⚠️ Advertencia")
    .addFields(
      { name: "Usuario", value: `${target.user.tag}`, inline: true },
      { name: "Moderador", value: `${message.author.tag}`, inline: true },
      { name: "Razón", value: reason },
      { name: "Advertencias", value: `${record.count} / ${MAX_WARNS}`, inline: true },
    )
    .setColor(0xffcc00)
    .setThumbnail(target.user.displayAvatarURL())
    .setTimestamp();

  if (record.count >= MAX_WARNS) {
    embed.addFields({ name: "🔴 Acción automática", value: "Ha alcanzado el límite. Aplicando timeout de 28 días." });

    try {
      if (target.moderatable) {
        await target.timeout(TIMEOUT_DURATION_MS, `Auto-timeout: ${MAX_WARNS} advertencias acumuladas`);
      }
      clearWarns(message.guild.id, target.id);
    } catch {
      embed.addFields({ name: "⚠️ Error", value: "No se pudo aplicar el timeout automático." });
    }
  }

  await message.reply({ embeds: [embed] });
}

export async function cmdWarns(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  const executor = message.member;
  if (!executor?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    await message.reply("❌ No tienes permiso para ver advertencias.");
    return;
  }

  const target = message.mentions.users.first();
  if (!target) {
    await message.reply("❌ Uso: `Dev warns @usuario`");
    return;
  }

  const record = getWarns(message.guild.id, target.id);

  if (!record || record.count === 0) {
    await message.reply(`✅ **${target.tag}** no tiene advertencias.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`📋 Advertencias de ${target.tag}`)
    .setDescription(`Total: **${record.count} / ${MAX_WARNS}** advertencias`)
    .setColor(record.count >= MAX_WARNS ? 0xff0000 : 0xffcc00)
    .setThumbnail(target.displayAvatarURL())
    .setTimestamp();

  record.entries.forEach((e, i) => {
    const date = new Date(e.timestamp).toLocaleDateString("es-ES");
    embed.addFields({
      name: `Advertencia #${i + 1} — ${date}`,
      value: `**Razón:** ${e.reason}\n**Moderador:** ${e.moderator}`,
    });
  });

  await message.reply({ embeds: [embed] });
}

export async function cmdWarnClear(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  const executor = message.member;
  if (!executor?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Solo administradores pueden limpiar advertencias.");
    return;
  }

  const target = message.mentions.users.first();
  if (!target) {
    await message.reply("❌ Uso: `Dev warnclear @usuario`");
    return;
  }

  clearWarns(message.guild.id, target.id);
  await message.reply(`✅ Advertencias de **${target.tag}** eliminadas.`);
}
