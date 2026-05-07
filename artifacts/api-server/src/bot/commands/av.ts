import { Message, PermissionFlagsBits } from "discord.js";

export async function cmdAv(message: Message, args: string[]): Promise<void> {
  if (!message.guild) {
    await message.reply("Este comando solo funciona en un servidor.");
    return;
  }

  const member = message.member;
  if (!member) return;

  if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Solo los administradores pueden usar este comando.");
    return;
  }

  const imageUrl = args[0];
  if (!imageUrl) {
    await message.reply("❌ Debes proporcionar una URL de imagen o GIF.\nUso: `Dev av <url>`");
    return;
  }

  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const contentType = response.headers.get("content-type") ?? "image/png";
    const dataUrl = `data:${contentType};base64,${base64}`;

    await message.client.user?.setAvatar(dataUrl);
    await message.reply(`✅ ¡Avatar del bot actualizado exitosamente!`);
  } catch (err) {
    await message.reply("❌ No se pudo cambiar el avatar. Verifica que la URL sea válida y que sea una imagen o GIF.");
  }
}
