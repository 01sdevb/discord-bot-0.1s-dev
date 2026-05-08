import { Message, EmbedBuilder, AttachmentBuilder } from "discord.js";
import { getUserMessages, getGeneralMessages } from "../messageStore";

function buildAttachment(lines: string[], header: string, filename: string): AttachmentBuilder {
  const buffer = Buffer.from(header + lines.join("\n"), "utf-8");
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
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const del = m.deleted ? " [ELIMINADO]" : "";
  const userPart = m.tag ? `[${m.tag}] ` : "";
  return `[${date}] ${userPart}#${m.channelName}${del}: ${m.content}`;
}

function extractFilter(rawArgs: string): string | undefined {
  const withoutMention = rawArgs.replace(/<@!?\d+>/g, "").trim();
  if (!withoutMention) return undefined;
  const explicit = withoutMention.match(/filtro:(\S+)/i);
  if (explicit) return explicit[1];
  return withoutMention.split(/\s+/)[0];
}

export async function cmdConversacion(message: Message, args: string[]): Promise<void> {
  if (!message.guild) { await message.reply("Solo funciona en un servidor."); return; }

  if (message.author.id !== message.guild.ownerId) {
    await message.reply("❌ Solo el **dueño del servidor** (👑) puede usar este comando.");
    return;
  }

  const rawArgs = args.join(" ");
  const isGeneral = args[0]?.toLowerCase() === "gen" || args[0]?.toLowerCase() === "general";

  if (isGeneral) {
    const filterRaw = args.slice(1).join(" ").replace(/filtro:/i, "").trim();
    const filter = filterRaw || undefined;
    if (!filter) {
      await message.reply("❌ Uso: `Dev con gen <palabra>`");
      return;
    }

    const messages = getGeneralMessages(message.guild.id, filter);
    if (messages.length === 0) {
      await message.reply(`📭 No se encontraron mensajes con \`${filter}\` en el servidor.`);
      return;
    }

    const header = [
      `=== BÚSQUEDA GENERAL ===`,
      `Servidor: ${message.guild.name}`,
      `Filtro: "${filter}"`,
      `Total: ${messages.length} mensajes`,
      "=".repeat(50), "",
    ].join("\n");

    const lines = messages.map((m) => formatLine({ ...m }));
    const attachment = buildAttachment(lines, header, `busqueda-${filter}-${Date.now()}.txt`);
    const embed = new EmbedBuilder()
      .setTitle(`🔎 Búsqueda general — \`${filter}\``)
      .setDescription(`**${messages.length}** mensajes encontrados en todo el servidor.`)
      .setColor(0xff6600)
      .setFooter({ text: "Incluye mensajes eliminados • Solo el owner" })
      .setTimestamp();

    await message.reply({ embeds: [embed], files: [attachment] });
    return;
  }

  const target = message.mentions.users.first();
  if (!target) {
    await message.reply(
      "❌ Uso:\n" +
      "`Dev con @usuario` — historial completo\n" +
      "`Dev con @usuario estafar` — filtrar por palabra\n" +
      "`Dev con gen estafar` — buscar en todo el servidor",
    );
    return;
  }

  const filter = extractFilter(rawArgs);
  const messages = getUserMessages(message.guild.id, target.id, filter);

  if (messages.length === 0) {
    await message.reply(`📭 No se encontraron mensajes de **${target.tag}**${filter ? ` con \`${filter}\`` : ""}.`);
    return;
  }

  const header = [
    `=== Conversaciones de ${target.tag} (${target.id}) ===`,
    `Servidor: ${message.guild.name}`,
    filter ? `Filtro: "${filter}"` : "Sin filtro",
    `Total: ${messages.length} mensajes`,
    "=".repeat(50), "",
  ].join("\n");

  const lines = messages.map((m) => formatLine(m));
  const fullText = header + lines.join("\n");

  if (fullText.length <= 1900) {
    await message.reply(`\`\`\`\n${fullText}\n\`\`\``);
    return;
  }

  const attachment = buildAttachment(lines, header, `conversacion-${target.username}-${Date.now()}.txt`);
  const embed = new EmbedBuilder()
    .setTitle(`📋 Historial de ${target.tag}`)
    .setDescription(filter ? `**${messages.length}** mensajes con \`${filter}\`.` : `**${messages.length}** mensajes en total.`)
    .setColor(0x5865f2)
    .setThumbnail(target.displayAvatarURL())
    .setFooter({ text: "Incluye mensajes eliminados • Solo el owner" })
    .setTimestamp();

  await message.reply({ embeds: [embed], files: [attachment] });
}
