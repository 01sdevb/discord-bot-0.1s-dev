import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";

export async function cmdBan(message: Message, args: string[]): Promise<void> {
  if (!message.guild) {
    await message.reply("Este comando solo funciona en un servidor.");
    return;
  }

  const executor = message.member;
  if (!executor) return;

  if (!executor.permissions.has(PermissionFlagsBits.BanMembers)) {
    await message.reply("❌ No tienes permiso para banear miembros.");
    return;
  }

  const target = message.mentions.members?.first();
  if (!target) {
    await message.reply("❌ Debes mencionar al usuario a banear.\nUso: `Dev ban @usuario [razón]`");
    return;
  }

  if (target.id === message.author.id) {
    await message.reply("❌ No puedes banearte a ti mismo.");
    return;
  }

  if (!target.bannable) {
    await message.reply("❌ No puedo banear a este usuario. Puede que tenga un rol superior al mío o al tuyo.");
    return;
  }

  if (target.permissions.has(PermissionFlagsBits.Administrator) && !executor.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ No puedes banear a un administrador si no eres admin.");
    return;
  }

  const mentionCount = message.mentions.members?.size ?? 0;
  const reason = args.slice(mentionCount).join(" ") || "Sin razón especificada";

  try {
    await target.ban({ reason });

    const embed = new EmbedBuilder()
      .setTitle("🔨 Usuario Baneado")
      .addFields(
        { name: "Usuario", value: `${target.user.tag} (${target.id})`, inline: true },
        { name: "Moderador", value: `${message.author.tag}`, inline: true },
        { name: "Razón", value: reason },
      )
      .setColor(0xff0000)
      .setThumbnail(target.user.displayAvatarURL())
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  } catch (err) {
    await message.reply("❌ No se pudo banear al usuario. Verifica mis permisos.");
  }
}
