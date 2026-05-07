import { Message, PermissionFlagsBits } from "discord.js";
import { setAntiLink, isAntiLinkEnabled } from "../handlers/antiLink";

export async function cmdAntiLink(message: Message, args: string[]): Promise<void> {
  if (!message.guild) {
    await message.reply("Este comando solo funciona en un servidor.");
    return;
  }

  const executor = message.member;
  if (!executor) return;

  if (!executor.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Solo los **administradores** pueden usar este comando.");
    return;
  }

  const sub = args[0]?.toLowerCase();

  if (sub === "on" || sub === "activar") {
    setAntiLink(message.guild.id, true);
    await message.reply("✅ **Anti-Link activado.** Los usuarios sin permiso de administrador no podrán enviar links.");
  } else if (sub === "off" || sub === "desactivar") {
    setAntiLink(message.guild.id, false);
    await message.reply("✅ **Anti-Link desactivado.** Los usuarios pueden enviar links nuevamente.");
  } else {
    const estado = isAntiLinkEnabled(message.guild.id) ? "🟢 Activado" : "🔴 Desactivado";
    await message.reply(`🔗 **Anti-Link** — Estado actual: ${estado}\nUso: \`Dev antilink on\` / \`Dev antilink off\``);
  }
}
