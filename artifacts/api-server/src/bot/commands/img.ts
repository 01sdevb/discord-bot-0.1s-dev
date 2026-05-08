import { Message, EmbedBuilder } from "discord.js";
import axios from "axios";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function getVqd(query: string): Promise<string | null> {
  try {
    const res = await axios.get("https://duckduckgo.com/", {
      params: { q: query, iax: "images", ia: "images" },
      headers: { "User-Agent": UA },
      timeout: 8000,
    });
    const match = (res.data as string).match(/vqd="([^"]+)"/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function searchImages(query: string, vqd: string): Promise<{ image: string; title: string; source: string }[]> {
  const res = await axios.get("https://duckduckgo.com/i.js", {
    params: { q: query, vqd, o: "json", p: 1, s: 0, u: "bing", f: ",,,,,", l: "us-en" },
    headers: { "User-Agent": UA, Referer: "https://duckduckgo.com/" },
    timeout: 10000,
  });
  return (res.data as { results: { image: string; title: string; source: string }[] }).results ?? [];
}

export async function cmdImg(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  const query = args.join(" ").trim();
  if (!query) {
    await message.reply("❌ Uso: `Dev img <búsqueda>`\nEjemplo: `Dev img gatos jugando`");
    return;
  }

  if ("sendTyping" in message.channel) {
    await (message.channel as import("discord.js").TextChannel).sendTyping().catch(() => {});
  }

  try {
    const vqd = await getVqd(query);
    if (!vqd) {
      await message.reply("❌ No se pudo conectar con el buscador de imágenes. Intenta de nuevo.");
      return;
    }

    const results = await searchImages(query, vqd);
    if (results.length === 0) {
      await message.reply(`📭 No se encontraron imágenes para \`${query}\`.`);
      return;
    }

    const pick = results[Math.floor(Math.random() * Math.min(5, results.length))]!;

    const embed = new EmbedBuilder()
      .setTitle(`🖼️ ${query}`)
      .setImage(pick.image)
      .setColor(0x5865f2)
      .setDescription(pick.title ? `**${pick.title.slice(0, 100)}**` : null)
      .setFooter({ text: `Fuente: ${pick.source} • DuckDuckGo Images` });

    await message.reply({ embeds: [embed] });
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 100) : "Error desconocido";
    await message.reply(`❌ Error al buscar imágenes: \`${msg}\``);
  }
}
