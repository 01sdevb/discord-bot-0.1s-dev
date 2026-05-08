import { Message, EmbedBuilder, TextChannel } from "discord.js";
import axios from "axios";
import { logger } from "../../lib/logger";

const VD_CHANNEL_ID = "1502431041191804948";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface YTResult {
  id: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
  url: string;
}

async function searchYouTube(query: string): Promise<YTResult | null> {
  try {
    const res = await axios.get("https://www.youtube.com/results", {
      params: { search_query: query },
      headers: { "User-Agent": UA, "Accept-Language": "es-ES,es;q=0.9" },
      timeout: 10000,
    });

    const html = res.data as string;

    const dataMatch = html.match(/var ytInitialData = ({.+?});<\/script>/s);
    if (!dataMatch) return null;

    const data = JSON.parse(dataMatch[1]!);
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ?? [];

    for (const item of contents) {
      const v = item?.videoRenderer;
      if (!v) continue;

      const id: string = v.videoId ?? "";
      const title: string = v.title?.runs?.[0]?.text ?? "Sin título";
      const channel: string = v.ownerText?.runs?.[0]?.text ?? "Desconocido";
      const duration: string = v.lengthText?.simpleText ?? "?";
      const thumbnail: string = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

      return { id, title, channel, duration, thumbnail, url: `https://www.youtube.com/watch?v=${id}` };
    }

    return null;
  } catch (err) {
    logger.warn({ err }, "Error buscando en YouTube");
    return null;
  }
}

export async function cmdVd(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  const query = args.join(" ").trim();
  if (!query) {
    await message.reply("❌ Uso: `Dev vd <nombre del video, película o serie>`");
    return;
  }

  if ("sendTyping" in message.channel) {
    await (message.channel as TextChannel).sendTyping().catch(() => {});
  }

  const result = await searchYouTube(query);
  if (!result) {
    await message.reply(`📭 No encontré ningún video para \`${query}\`. Intenta con otra búsqueda.`);
    return;
  }

  const targetChannel = await message.client.channels.fetch(VD_CHANNEL_ID).catch(() => null);
  if (!targetChannel || !(targetChannel instanceof TextChannel)) {
    await message.reply("❌ No se pudo acceder al canal de videos.");
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(result.title)
    .setURL(result.url)
    .setColor(0xff0000)
    .setThumbnail(result.thumbnail)
    .addFields(
      { name: "📺 Canal", value: result.channel, inline: true },
      { name: "⏱️ Duración", value: result.duration, inline: true },
      { name: "🔗 Link", value: result.url, inline: false }
    )
    .setFooter({ text: `Solicitado por ${message.author.tag} • YouTube` })
    .setTimestamp();

  await targetChannel.send({ embeds: [embed] });

  if (message.channel.id !== VD_CHANNEL_ID) {
    await message.reply(`✅ Video enviado a <#${VD_CHANNEL_ID}> 🎬`);
  }
}
