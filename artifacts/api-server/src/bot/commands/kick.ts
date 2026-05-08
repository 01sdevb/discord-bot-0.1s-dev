import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { modLog } from "../modLogger";

export async function cmdKick(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  const executor = message.member;
  if (!executor) return;

  if (!executor.permissions.has(PermissionFlagsBits.KickMembers)) {
    await message.reply("❌ No tienes permiso para expulsar miembros.");
    return;
  }

  const target = message.mentions.members?.first();
  if (!target) {
    await message.reply("❌ Debes mencionar al usuario a expulsar.\nUso: `Dev kick @usuario [razón]`");
    return;
  }

  if (target.id === message.author.id) {
    await message.reply("❌ No puedes expulsarte a ti mismo.");
    return;
  }

  if (!target.kickable) {
    await message.reply("❌ No puedo expulsar a este usuario. Puede que tenga un rol superior al mío.");
    return;
  }

  if (target.permissions.has(PermissionFlagsBits.Administrator) && !executor.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ No puedes expulsar a un administrador si no eres admin.");
    return;
  }

  const mentionCount = message.mentions.members?.size ?? 0;
  const reason = args.slice(mentionCount).join(" ") || "Sin razón especificada";

  try {
    await target.kick(reason);

    const embed = new EmbedBuilder()
      .setTitle("👢 Usuario Expulsado")
      .addFields(
        { name: "Usuario", value: `${target.user.tag} (${target.id})`, inline: true },
        { name: "Moderador", value: `${message.author.tag}`, inline: true },
        { name: "Razón", value: reason },
      )
      .setColor(0xff8800)
      .setThumbnail(target.user.displayAvatarURL())
      .setTimestamp();

    await message.reply({ embeds: [embed] });

    await modLog({
      type: "kick",
      guildId: message.guild.id,
      target: { id: target.id, tag: target.user.tag, avatarUrl: target.user.displayAvatarURL() },
      moderator: { id: message.author.id, tag: message.author.tag },
      reason,
    });
  } catch {
    await message.reply("❌ No se pudo expulsar al usuario. Verifica mis permisos.");
  }
}
