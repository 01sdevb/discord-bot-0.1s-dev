import { Message, EmbedBuilder, AttachmentBuilder } from "discord.js";
import { getUserMessages, getGeneralMessages } from "../messageStore";

function buildAttachment(
  lines: string[],
  header: string,
  filename: string,
): AttachmentBuilder {
  const fullText = header + lines.join("\n");
  const buffer = Buffer.from(fullText, "utf-8");
  return new AttachmentBuilder(buffer, { name: filename });
}

function formatLine(m: {
  timestamp: number;
  channelName: string;
  deleted: boolean;
  content: string;
  tag?: string;
}): string {
  const date = new Date(m.timestamp).toLocaleString("es-ES", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const deletedTag = m.deleted ? " [ELIMINADO]" : "";
  const userTag = m.tag ? `[${m.tag}] ` : "";
  return `[${date}] ${userTag}#${m.channelName}${deletedTag}: ${m.content}`;
}

function extractFilter(rawArgs: string): string | undefined {
  const match = rawArgs.match(/filtro:(\S+)/i);
  return match?.[1];
}

export async function cmdConversacion(message: Message, args: string[]): Promise<void> {
  if (!message.guild) {
    await message.reply("Este comando solo funciona en un servidor.");
    return;
  }

  if (message.author.id !== message.guild.ownerId) {
    await message.reply("❌ Solo el **dueño del servidor** (👑) puede usar este comando.");
    return;
  }

  const rawArgs = args.join(" ");
  const filter = extractFilter(rawArgs);

  const isGeneral =
    args[0]?.toLowerCase() === "gen" ||
    args[0]?.toLowerCase() === "general";

  if (isGeneral) {
    if (!filter) {
      await message.reply(
        "❌ Para la búsqueda general necesitas un filtro.\nUso: `Dev con gen filtro:palabra`",
      );
      return;
    }

    const messages = getGeneralMessages(message.guild.id, filter);

    if (messages.length === 0) {
      await message.reply(`📭 No se encontraron mensajes con el filtro \`${filter}\` en todo el servidor.`);
      return;
    }

    const header = [
      `=== BÚSQUEDA GENERAL EN EL SERVIDOR ===`,
      `Servidor: ${message.guild.name}`,
      `Filtro: "${filter}"`,
      `Total de resultados: ${messages.length}`,
      "=".repeat(50),
      "",
    ].join("\n");

    const lines = messages.map((m) => formatLine({ ...m, tag: m.tag }));
    const attachment = buildAttachment(lines, header, `busqueda-${filter}-${Date.now()}.txt`);

    const embed = new EmbedBuilder()
      .setTitle(`🔎 Búsqueda general — \`${filter}\``)
      .setDescription(`**${messages.length}** mensajes encontrados en todo el servidor.`)
      .setColor(0xff6600)
      .setFooter({ text: "Incluye mensajes eliminados • Solo visible para el owner" })
      .setTimestamp();

    await message.reply({ embeds: [embed], files: [attachment] });
    return;
  }

  const target = message.mentions.users.first();
  if (!target) {
    await message.reply(
      "❌ Uso correcto:\n" +
      "`Dev con @usuario` — historial de un usuario\n" +
      "`Dev con @usuario filtro:palabra` — historial filtrado\n" +
      "`Dev con gen filtro:palabra` — buscar en todo el servidor",
    );
    return;
  }

  const messages = getUserMessages(message.guild.id, target.id, filter);

  if (messages.length === 0) {
    const filterNote = filter ? ` con el filtro \`${filter}\`` : "";
    await message.reply(`📭 No se encontraron mensajes de **${target.tag}**${filterNote}.`);
    return;
  }

  const header = [
    `=== Conversaciones de ${target.tag} (${target.id}) ===`,
    `Servidor: ${message.guild.name}`,
    filter ? `Filtro: "${filter}"` : "Sin filtro",
    `Total de mensajes: ${messages.length}`,
    "=".repeat(50),
    "",
  ].join("\n");

  const lines = messages.map((m) => formatLine(m));
  const fullText = header + lines.join("\n");

  if (fullText.length <= 1900) {
    await message.reply(`\`\`\`\n${fullText}\n\`\`\``);
    return;
  }

  const attachment = buildAttachment(
    lines,
    header,
    `conversacion-${target.username}-${Date.now()}.txt`,
  );

  const embed = new EmbedBuilder()
    .setTitle(`📋 Historial de ${target.tag}`)
    .setDescription(
      filter
        ? `**${messages.length}** mensajes encontrados con filtro \`${filter}\`.`
        : `**${messages.length}** mensajes en total.`,
    )
    .setColor(0x5865f2)
    .setThumbnail(target.displayAvatarURL())
    .setFooter({ text: "Incluye mensajes eliminados • Solo visible para el owner" })
    .setTimestamp();

  await message.reply({ embeds: [embed], files: [attachment] });
}
