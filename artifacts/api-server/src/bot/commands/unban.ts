import { Message, PermissionFlagsBits, EmbedBuilder } from "discord.js";

export async function cmdUnban(message: Message, args: string[]): Promise<void> {
  if (!message.guild) {
    await message.reply("Este comando solo funciona en un servidor.");
    return;
  }

  const executor = message.member;
  if (!executor) return;

  if (!executor.permissions.has(PermissionFlagsBits.BanMembers)) {
    await message.reply("❌ No tienes permiso para desbanear usuarios.");
    return;
  }

  const userId = args[0];
  if (!userId || !/^\d{17,20}$/.test(userId)) {
    await message.reply("❌ Debes proporcionar un ID de usuario válido.\nUso: `Dev unban <ID>`");
    return;
  }

  try {
    const banList = await message.guild.bans.fetch();
    const banned = banList.get(userId);

    if (!banned) {
      await message.reply(`❌ El usuario con ID \`${userId}\` no está baneado en este servidor.`);
      return;
    }

    await message.guild.members.unban(userId, `Desbaneado por ${message.author.tag}`);

    const embed = new EmbedBuilder()
      .setTitle("✅ Usuario Desbaneado")
      .addFields(
        { name: "Usuario", value: `${banned.user.tag} (${userId})`, inline: true },
        { name: "Moderador", value: `${message.author.tag}`, inline: true },
      )
      .setColor(0x00ff88)
      .setThumbnail(banned.user.displayAvatarURL())
      .setTimestamp();

    await message.reply({ embeds: [embed] });
  } catch (err) {
    await message.reply("❌ No se pudo desbanear al usuario. Verifica que el ID sea correcto.");
  }
}
