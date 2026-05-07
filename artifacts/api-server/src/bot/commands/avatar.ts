import { Message, EmbedBuilder, GuildMember } from "discord.js";

export async function cmdAvatar(message: Message, args: string[]): Promise<void> {
  let target: GuildMember | null = null;

  if (message.mentions.members && message.mentions.members.size > 0) {
    target = message.mentions.members.first() ?? null;
  } else {
    target = message.member;
  }

  if (!target) {
    await message.reply("No se pudo encontrar al usuario.");
    return;
  }

  const user = target.user;
  const avatarUrl =
    user.displayAvatarURL({ size: 4096, extension: "png" }) ?? "";

  const embed = new EmbedBuilder()
    .setTitle(`🖼️ Avatar de ${user.tag}`)
    .setImage(avatarUrl)
    .setColor(0x5865f2)
    .setFooter({ text: `ID: ${user.id}` });

  await message.reply({ embeds: [embed] });
}
