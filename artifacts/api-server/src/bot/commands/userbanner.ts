import { Message, EmbedBuilder } from "discord.js";

export async function cmdUserBanner(message: Message, args: string[]): Promise<void> {
  const mentioned = message.mentions.users.first();
  const targetId = mentioned?.id ?? message.author.id;

  let user;
  try {
    user = await message.client.users.fetch(targetId, { force: true });
  } catch {
    await message.reply("❌ No se pudo obtener la información del usuario.");
    return;
  }

  const bannerUrl = user.bannerURL({ size: 4096, extension: "png" }) ?? null;

  if (!bannerUrl) {
    const name = mentioned ? `**${user.tag}**` : "**tu perfil**";
    await message.reply(`📭 ${name.replace(/\*\*/g, "")} no tiene un banner configurado.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🎨 Banner de ${user.tag}`)
    .setImage(bannerUrl)
    .setColor(user.accentColor ?? 0x5865f2)
    .setFooter({ text: `ID: ${user.id}` })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
