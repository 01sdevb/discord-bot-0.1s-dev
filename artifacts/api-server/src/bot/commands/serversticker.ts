import { Message, PermissionFlagsBits } from "discord.js";

function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_ ]/g, "_")
    .slice(0, 30)
    .trim()
    .padEnd(2, "_");
}

export async function cmdServerSticker(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  if (!message.member?.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)) {
    await message.reply("❌ Necesitas el permiso **Gestionar Stickers** para usar este comando.");
    return;
  }

  const ref = message.reference;
  if (!ref?.messageId) {
    await message.reply("❌ Debes **responder** a un mensaje que contenga un sticker o imagen (PNG/GIF).");
    return;
  }

  let refMessage;
  try {
    refMessage = await message.channel.messages.fetch(ref.messageId);
  } catch {
    await message.reply("❌ No se pudo obtener el mensaje referenciado.");
    return;
  }

  let stickerUrl: string | null = null;
  let defaultName = "sticker";

  if (refMessage.stickers.size > 0) {
    const sticker = refMessage.stickers.first()!;
    stickerUrl = sticker.url;
    defaultName = sticker.name;
  }

  if (!stickerUrl && refMessage.attachments.size > 0) {
    const attachment = refMessage.attachments.find(a =>
      /\.(png|gif|apng)$/i.test(a.name ?? "") ||
      a.contentType?.match(/^image\/(png|gif)/)
    );
    if (attachment) {
      stickerUrl = attachment.url;
      defaultName = (attachment.name ?? "sticker").replace(/\.[^.]+$/, "");
    }
  }

  if (!stickerUrl) {
    await message.reply("❌ No se encontró un sticker o imagen PNG/GIF en el mensaje referenciado.\nNota: Discord solo acepta PNG, APNG o GIF para stickers.");
    return;
  }

  const name = sanitizeName(args[0] ?? defaultName) || "sticker__";

  try {
    const sticker = await message.guild.stickers.create({
      file: stickerUrl,
      name,
      tags: "⭐",
      description: `Subido por ${message.author.tag}`,
      reason: `Subido por ${message.author.tag} via Dev sticker`,
    });
    await message.reply(`✅ Sticker **${sticker.name}** añadido al servidor exitosamente.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    await message.reply(
      `❌ No se pudo crear el sticker: \`${msg.slice(0, 200)}\`\n` +
      `> Recuerda: los stickers deben ser PNG/GIF de 300x300px y máx 512KB.`
    );
  }
}
