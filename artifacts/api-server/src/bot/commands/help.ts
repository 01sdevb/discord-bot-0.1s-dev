import { Message, EmbedBuilder } from "discord.js";

export async function cmdHelp(message: Message): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle("📖 Comandos de Dev — 0.1s Dev")
    .setColor(0x5865f2)
    .setDescription("Usa el prefijo **`Dev `** antes de cada comando.")
    .addFields(
      {
        name: "🤖 Inteligencia Artificial",
        value: [
          "`Dev <pregunta>` — Hace una pregunta a la IA (solo en <#1502082326270705796>)",
          "> La IA está especializada en programación y desarrollo de software.",
          "> Recuerda el historial de tu conversación en el canal.",
        ].join("\n"),
      },
      {
        name: "🔗 Anti-Link",
        value: [
          "`Dev Anti Link on` — Activa el anti-link (solo admins)",
          "`Dev Anti Link off` — Desactiva el anti-link (solo admins)",
          "> Elimina links de usuarios sin permiso y avisa el tipo de link.",
        ].join("\n"),
      },
      {
        name: "🛡️ Anti-Spam",
        value: [
          "`Dev Anti Spam` — Muestra el estado del anti-spam",
          "> Siempre activo. 3 mensajes seguidos en 5s = timeout de **28 días**.",
          "> Elimina los mensajes de spam automáticamente.",
        ].join("\n"),
      },
      {
        name: "🔨 Moderación",
        value: [
          "`Dev ban @usuario [razón]` — Banear un usuario",
          "`Dev kick @usuario [razón]` — Expulsar un usuario",
          "`Dev unban <ID>` — Desbanear un usuario por su ID",
        ].join("\n"),
      },
      {
        name: "🖼️ Perfil",
        value: [
          "`Dev avatar` — Muestra tu avatar",
          "`Dev avatar @usuario` — Muestra el avatar de otro usuario",
          "`Dev av <url>` — Cambia el avatar del bot (solo admins)",
          "`Dev banner <url>` — Cambia el banner del bot (solo dueño 👑)",
        ].join("\n"),
      },
      {
        name: "❓ Otros",
        value: ["`Dev help` — Muestra este menú de ayuda"].join("\n"),
      },
    )
    .setFooter({ text: "Desarrollado por el equipo 0.1s Dev" })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
