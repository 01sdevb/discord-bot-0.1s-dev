import { Message, PermissionFlagsBits } from "discord.js";

function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32)
    .padEnd(2, "_");
}

export async function cmdServerEmoji(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  if (!message.member?.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)) {
    await message.reply("❌ Necesitas el permiso **Gestionar Emojis** para usar este comando.");
    return;
  }

  const ref = message.reference;
  if (!ref?.messageId) {
    await message.reply("❌ Debes **responder** a un mensaje que contenga un sticker, emoji personalizado, imagen o GIF.");
    return;
  }

  let refMessage;
  try {
    refMessage = await message.channel.messages.fetch(ref.messageId);
  } catch {
    await message.reply("❌ No se pudo obtener el mensaje referenciado.");
    return;
  }

  let emojiUrl: string | null = null;
  let defaultName = "emoji";

  if (refMessage.stickers.size > 0) {
    const sticker = refMessage.stickers.first()!;
    emojiUrl = sticker.url;
    defaultName = sticker.name;
  }

  if (!emojiUrl && refMessage.attachments.size > 0) {
    const attachment = refMessage.attachments.find(a =>
      a.contentType?.startsWith("image/") ||
      /\.(png|jpg|jpeg|gif|webp)$/i.test(a.name ?? "")
    );
    if (attachment) {
      emojiUrl = attachment.url;
      defaultName = (attachment.name ?? "emoji").replace(/\.[^.]+$/, "");
    }
  }

  if (!emojiUrl) {
    const match = refMessage.content.match(/<(a?):(\w+):(\d+)>/);
    if (match) {
      const animated = match[1] === "a";
      const emojiName = match[2]!;
      const id = match[3]!;
      emojiUrl = `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=128`;
      defaultName = emojiName;
    }
  }

  if (!emojiUrl) {
    await message.reply("❌ No se encontró un emoji, sticker, imagen o GIF en el mensaje referenciado.");
    return;
  }

  const name = sanitizeName(args[0] ?? defaultName) || "emoji__";

  try {
    const emoji = await message.guild.emojis.create({
      attachment: emojiUrl,
      name,
      reason: `Subido por ${message.author.tag} via Dev emoji`,
    });
    const prefix = emoji.animated ? "a" : "";
    await message.reply(`✅ Emoji <${prefix}:${emoji.name}:${emoji.id}> añadido al servidor con el nombre \`${emoji.name}\`.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    await message.reply(`❌ No se pudo crear el emoji: \`${msg.slice(0, 200)}\``);
  }
}
