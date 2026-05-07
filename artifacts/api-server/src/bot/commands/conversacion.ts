import { Message, EmbedBuilder, AttachmentBuilder } from "discord.js";
import { getUserMessages } from "../messageStore";

export async function cmdConversacion(message: Message, args: string[]): Promise<void> {
  if (!message.guild) {
    await message.reply("Este comando solo funciona en un servidor.");
    return;
  }

  if (message.author.id !== message.guild.ownerId) {
    await message.reply("❌ Solo el **dueño del servidor** (👑) puede usar este comando.");
    return;
  }

  const target = message.mentions.users.first();
  if (!target) {
    await message.reply("❌ Debes mencionar al usuario.\nUso: `Dev conversacion @usuario [filtro:palabra]`");
    return;
  }

  const rawArgs = args.slice(1).join(" ");
  let filter: string | undefined;

  const filterMatch = rawArgs.match(/filtro:(\S+)/i);
  if (filterMatch) {
    filter = filterMatch[1];
  }

  const messages = getUserMessages(message.guild.id, target.id, filter);

  if (messages.length === 0) {
    const filterNote = filter ? ` con el filtro \`${filter}\`` : "";
    await message.reply(`📭 No se encontraron mensajes de **${target.tag}**${filterNote}.`);
    return;
  }

  const lines = messages.map((m) => {
    const date = new Date(m.timestamp).toLocaleString("es-ES", {
      timeZone: "America/Bogota",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const deletedTag = m.deleted ? " [ELIMINADO]" : "";
    return `[${date}] #${m.channelName}${deletedTag}: ${m.content}`;
  });

  const header = [
    `=== Conversaciones de ${target.tag} (${target.id}) ===`,
    `Servidor: ${message.guild.name}`,
    filter ? `Filtro: "${filter}"` : "Sin filtro",
    `Total de mensajes: ${messages.length}`,
    "=".repeat(50),
    "",
  ].join("\n");

  const fullText = header + lines.join("\n");

  if (fullText.length <= 1900) {
    await message.reply(`\`\`\`\n${fullText}\n\`\`\``);
    return;
  }

  const buffer = Buffer.from(fullText, "utf-8");
  const attachment = new AttachmentBuilder(buffer, {
    name: `conversacion-${target.username}-${Date.now()}.txt`,
    description: `Historial de mensajes de ${target.tag}`,
  });

  const embed = new EmbedBuilder()
    .setTitle(`📋 Historial de ${target.tag}`)
    .setDescription(
      filter
        ? `**${messages.length}** mensajes encontrados con filtro \`${filter}\`.`
        : `**${messages.length}** mensajes en total.`,
    )
    .setColor(0x5865f2)
    .setThumbnail(target.displayAvatarURL())
    .setFooter({ text: "Archivo adjunto con el historial completo" })
    .setTimestamp();

  await message.reply({ embeds: [embed], files: [attachment] });
}
