import { Message } from "discord.js";
import axios from "axios";
import { saveScript, getScriptCount } from "../scriptStore";

const ALLOWED_EXTENSIONS = new Set([".lua", ".txt", ".text"]);

export async function cmdAll(message: Message): Promise<void> {
  if (!message.guild) return;

  if (message.author.id !== message.guild.ownerId) {
    await message.reply("❌ Solo el **dueño del servidor** (👑) puede agregar archivos de scripts.");
    return;
  }

  if (message.attachments.size === 0) {
    await message.reply(
      "❌ Debes adjuntar al menos un archivo.\n" +
      "Formatos permitidos: `.lua`, `.txt`, `.text`\n" +
      `📚 Scripts guardados actualmente: **${getScriptCount()}**`,
    );
    return;
  }

  const results: string[] = [];

  for (const [, attachment] of message.attachments) {
    const filename = attachment.name ?? "script.txt";
    const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      results.push(`❌ \`${filename}\` — extensión no permitida (solo .lua .txt .text)`);
      continue;
    }

    try {
      const response = await axios.get<string>(attachment.url, {
        responseType: "text",
        timeout: 10000,
      });
      const saved = await saveScript(filename, response.data);
      if (saved) {
        results.push(`✅ \`${filename}\` — guardado correctamente`);
      } else {
        results.push(`❌ \`${filename}\` — no se pudo guardar`);
      }
    } catch {
      results.push(`❌ \`${filename}\` — error al descargar el archivo`);
    }
  }

  await message.reply(
    `📁 **Archivos procesados:**\n${results.join("\n")}\n\n📚 Total scripts en base: **${getScriptCount()}**`,
  );
}
