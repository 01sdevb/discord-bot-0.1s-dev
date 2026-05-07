import { Message, PermissionFlagsBits } from "discord.js";

export async function cmdBanner(message: Message, args: string[]): Promise<void> {
  if (!message.guild) {
    await message.reply("Este comando solo funciona en un servidor.");
    return;
  }

  const guild = message.guild;
  const ownerId = guild.ownerId;

  if (message.author.id !== ownerId) {
    await message.reply("❌ Solo el **dueño del servidor** (👑) puede cambiar el banner del bot.");
    return;
  }

  const imageUrl = args[0];
  if (!imageUrl) {
    await message.reply("❌ Debes proporcionar una URL de imagen.\nUso: `Dev banner <url>`");
    return;
  }

  try {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") ?? "image/png";
    const dataUrl = `data:${contentType};base64,${base64}`;

    await message.client.user?.setBanner(dataUrl);
    await message.reply("✅ ¡Banner del bot actualizado exitosamente!");
  } catch (err) {
    await message.reply("❌ No se pudo cambiar el banner. Verifica que la URL sea válida.");
  }
}
