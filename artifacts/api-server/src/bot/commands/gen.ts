import { Message, EmbedBuilder, TextChannel, Client } from "discord.js";
import axios from "axios";
import { logger } from "../../lib/logger";
import {
  loadGen,
  saveGen,
  getUserEntry,
  addEntry,
  getExpiredEntries,
  removeEntry,
  GenEntry,
} from "../genStore";

const GEN_CHANNEL_ID = "1499958245526081727";
const PLACE_ID = "109983668079237";
const UNIVERSE_ID = "7709344486";
const COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000;

const GAME_NAME = "Steal and Brainrot";
const GAME_URL = `https://www.roblox.com/games/${PLACE_ID}`;

async function getGameThumbnail(): Promise<string> {
  try {
    const res = await axios.get<{ data: { imageUrl: string }[] }>(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${UNIVERSE_ID}&returnPolicy=PlaceHolder&size=512x512&format=Png&isCircular=false`,
      { timeout: 8000 }
    );
    return res.data.data?.[0]?.imageUrl ?? "";
  } catch {
    return "";
  }
}

async function getCsrfToken(): Promise<string> {
  try {
    const cookie = process.env["ROBLOX_COOKIE"] ?? "";
    const res = await axios.post(
      "https://auth.roblox.com/v2/logout",
      {},
      {
        headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
        validateStatus: () => true,
        timeout: 8000,
      }
    );
    return (res.headers["x-csrf-token"] as string) ?? "";
  } catch {
    return "";
  }
}

async function getPrivateServer(): Promise<{ accessCode: string; vipServerId: number } | null> {
  try {
    const cookie = process.env["ROBLOX_COOKIE"] ?? "";
    const res = await axios.get<{
      data: { accessCode: string; vipServerId: number }[];
    }>(
      `https://games.roblox.com/v1/games/${PLACE_ID}/private-servers`,
      {
        headers: { Cookie: `.ROBLOSECURITY=${cookie}` },
        timeout: 10000,
      }
    );
    const servers = res.data.data ?? [];
    return servers[0] ?? null;
  } catch (err) {
    logger.warn({ err }, "Error obteniendo servidor privado de Roblox");
    return null;
  }
}

function buildJoinLink(accessCode: string): string {
  return `${GAME_URL}?privateServerLinkCode=${accessCode}`;
}

function formatTimeLeft(ms: number): string {
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export async function cmdGen(message: Message): Promise<void> {
  if (message.channel.id !== GEN_CHANNEL_ID) return;

  const userId = message.author.id;
  const existing = getUserEntry(userId);
  const now = Date.now();

  if (existing) {
    const timeLeft = existing.expiresAt - now;
    if (timeLeft > 0) {
      await message.reply(
        `⏳ Ya generaste un servidor. Podrás generar otro en **${formatTimeLeft(timeLeft)}**.`
      );
      return;
    }
    removeEntry(userId);
    await saveGen();
  }

  const server = await getPrivateServer();
  if (!server) {
    await message.reply("❌ No se pudo obtener el servidor privado. Inténtalo más tarde.");
    return;
  }

  const joinLink = buildJoinLink(server.accessCode);
  const thumbnail = await getGameThumbnail();
  const expiresAt = now + COOLDOWN_MS;

  const entry: GenEntry = {
    userId,
    messageId: "",
    channelId: GEN_CHANNEL_ID,
    generatedAt: now,
    expiresAt,
    accessCode: server.accessCode,
    placeId: PLACE_ID,
  };

  const embed = new EmbedBuilder()
    .setTitle(`🎮 Servidor Privado — ${GAME_NAME}`)
    .setColor(0xe74c3c)
    .setDescription(
      `**${message.author.displayName}** generó un servidor privado.\n\n` +
      `🔗 **[Unirse al servidor](${joinLink})**\n\n` +
      `⏱️ Este mensaje se eliminará en **5 días**.`
    )
    .addFields(
      { name: "🎮 Juego", value: `[${GAME_NAME}](${GAME_URL})`, inline: true },
      { name: "👤 Generado por", value: `<@${userId}>`, inline: true },
      { name: "📅 Expira", value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: true }
    )
    .setFooter({ text: "1 generación por usuario cada 5 días • 0.1s Dev" })
    .setTimestamp();

  if (thumbnail) embed.setThumbnail(thumbnail);

  const sent = await message.reply({ embeds: [embed] });
  entry.messageId = sent.id;
  addEntry(entry);
  await saveGen();

  logger.info({ userId, messageId: sent.id }, "Servidor privado generado");
}

export async function startGenExpireLoop(client: Client): Promise<void> {
  await loadGen();

  const check = async () => {
    const expired = getExpiredEntries();
    for (const entry of expired) {
      try {
        const channel = await client.channels.fetch(entry.channelId);
        if (channel instanceof TextChannel) {
          const msg = await channel.messages.fetch(entry.messageId).catch(() => null);
          if (msg) await msg.delete();
        }
      } catch (err) {
        logger.warn({ err, entry }, "Error eliminando mensaje gen expirado");
      }
      removeEntry(entry.userId);
    }
    if (expired.length > 0) await saveGen();
  };

  await check();
  setInterval(check, 60 * 1000);
}
