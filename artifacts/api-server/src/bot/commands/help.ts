import { Message, EmbedBuilder } from "discord.js";

export async function cmdHelp(message: Message): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle("📖 Comandos de Dev — 0.1s Dev")
    .setColor(0x5865f2)
    .setDescription("Usa el prefijo **`Dev `** antes de cada comando.")
    .addFields(
      {
        name: "🔗 Anti-Link",
        value: [
          "`Dev Anti Link on/off` — Activa/desactiva (solo admins)",
          "> Elimina links de usuarios sin permiso admin y avisa el tipo.",
        ].join("\n"),
      },
      {
        name: "🛡️ Anti-Spam",
        value: [
          "`Dev Anti Spam` — Muestra estado",
          "> 3 mensajes seguidos en 5s = timeout de 28 días automático.",
        ].join("\n"),
      },
      {
        name: "⚠️ Advertencias",
        value: [
          "`Dev warn @usuario razón` — Dar advertencia (admins/mods)",
          "`Dev warns @usuario` — Ver advertencias de un usuario",
          "`Dev warnclear @usuario` — Limpiar advertencias (solo admins)",
          "> Al llegar a **3 warns** → timeout automático de 28 días.",
        ].join("\n"),
      },
      {
        name: "🔨 Moderación",
        value: [
          "`Dev ban @usuario [razón]` — Banear",
          "`Dev kick @usuario [razón]` — Expulsar",
          "`Dev unban <ID>` — Desbanear por ID",
          "`Dev timeout @usuario 1d [razón]` — Timeout personalizado (1d, 6h, 30m...)",
        ].join("\n"),
      },
      {
        name: "🎫 Sistema de Tickets",
        value: [
          "`Dev ticketpa` — Crear panel de tickets (solo admins)",
          "> Configuración interactiva paso a paso.",
          "> Los usuarios hacen clic en el botón para abrir un ticket privado.",
          "> El staff puede cerrar o eliminar tickets con botones.",
        ].join("\n"),
      },
      {
        name: "🖼️ Perfil",
        value: [
          "`Dev avatar [@usuario]` — Ver avatar propio o de otro",
          "`Dev av <url>` — Cambiar avatar del bot (admins)",
          "`Dev banner <url>` — Cambiar banner del bot (owner 👑)",
        ].join("\n"),
      },
      {
        name: "🔍 Historial (Solo Owner 👑)",
        value: [
          "`Dev con @usuario` — Historial completo de un usuario",
          "`Dev con @usuario estafar` — Filtrar por palabra clave",
          "`Dev con gen estafar` — Buscar en TODO el servidor",
          "> Guarda todos los mensajes del servidor incluyendo eliminados.",
        ].join("\n"),
      },
      {
        name: "❓ Otros",
        value: ["`Dev help` — Muestra este menú"].join("\n"),
      },
    )
    .setFooter({ text: "Desarrollado por el equipo 0.1s Dev" })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
