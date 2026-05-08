import { Message, TextChannel, PermissionFlagsBits } from "discord.js";

export async function cmdPurge(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
    await message.reply("❌ Necesitas el permiso **Gestionar Mensajes** para usar este comando.");
    return;
  }

  const amount = parseInt(args[0] ?? "");
  if (isNaN(amount) || amount < 1 || amount > 100) {
    await message.reply("❌ Especifica un número entre 1 y 100.\nUso: `Dev purge <número>`");
    return;
  }

  const channel = message.channel as TextChannel;

  try {
    await message.delete().catch(() => {});
    const deleted = await channel.bulkDelete(amount, true);
    const notice = await channel.send(
      `🗑️ Se eliminaron **${deleted.size}** mensaje${deleted.size === 1 ? "" : "s"}.`
    );
    setTimeout(() => notice.delete().catch(() => {}), 4000);
  } catch {
    await channel.send(
      "❌ No se pudieron eliminar los mensajes. Solo se pueden borrar mensajes de menos de **14 días**."
    );
  }
}
