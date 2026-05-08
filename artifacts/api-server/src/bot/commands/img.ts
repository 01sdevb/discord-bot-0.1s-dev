import { Message, EmbedBuilder } from "discord.js";
import axios from "axios";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function searchImages(query: string): Promise<{ image: string; title: string } | null> {
  try {
    const searchRes = await axios.get("https://www.bing.com/images/search", {
      params: { q: query, form: "HDRSC2", first: 1 },
      headers: {
        "User-Agent": UA,
        "Accept": "text/html",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      timeout: 10000,
    });

    const html = searchRes.data as string;
    const matches = [...html.matchAll(/"murl":"(https?:\/\/[^"]+?)"/g)];
    if (matches.length === 0) return null;

    const pick = matches[Math.floor(Math.random() * Math.min(5, matches.length))]!;
    const imageUrl = pick[1]!;

    const titleMatch = html.match(/"t":"([^"]{5,80})"/);
    const title = titleMatch?.[1] ?? query;

    return { image: imageUrl, title };
  } catch {
    return null;
  }
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

  const result = await searchImages(query);
  if (!result) {
    await message.reply(`📭 No se encontraron imágenes para \`${query}\`. Intenta con otra búsqueda.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`🖼️ ${query}`)
    .setImage(result.image)
    .setColor(0x5865f2)
    .setDescription(`**${result.title.slice(0, 100)}**`)
    .setFooter({ text: "Bing Images • 0.1s Dev" });

  await message.reply({ embeds: [embed] });
}
