import { Message, EmbedBuilder, TextChannel, Client, DMChannel } from "discord.js";
import axios from "axios";
import { logger } from "../../lib/logger";
import {
  loadGen,
  saveGen,
  getUserEntry,
  addEntry,
  getExpiredEntries,
  removeEntry,
  getAllEntries,
  GenEntry,
} from "../genStore";

const GEN_CHANNEL_ID = "1499958245526081727";
const REQUIRED_ROLE_ID = "1486253532750417951";
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

async function getPrivateServer(): Promise<{ accessCode: string; vipServerId: number } | null> {
  try {
    const cookie = process.env["ROBLOX_COOKIE"] ?? "";
    const res = await axios.get<{ data: { accessCode: string; vipServerId: number }[] }>(
      `https://games.roblox.com/v1/games/${PLACE_ID}/private-servers`,
      { headers: { Cookie: `.ROBLOSECURITY=${cookie}` }, timeout: 10000 }
    );
    return res.data.data?.[0] ?? null;
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

  const member = message.member;
  if (!member) return;

  if (!member.roles.cache.has(REQUIRED_ROLE_ID)) {
    await message.reply(`❌ Necesitas el rol <@&${REQUIRED_ROLE_ID}> para usar este comando.`);
    return;
  }

  const userId = message.author.id;
  const existing = getUserEntry(userId);
  const now = Date.now();

  if (existing) {
    const timeLeft = existing.expiresAt - now;
    if (timeLeft > 0) {
      await message.reply(`⏳ Ya generaste un servidor. Podrás generar otro en **${formatTimeLeft(timeLeft)}**.`);
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

  const dmEmbed = new EmbedBuilder()
    .setTitle(`🎮 Tu Servidor Privado — ${GAME_NAME}`)
    .setColor(0xe74c3c)
    .setDescription(
      `Aquí está tu servidor privado generado.\n\n` +
      `🔗 **[Unirse al servidor](${joinLink})**\n\n` +
      `⏱️ Expira en **5 días** — después deberás generar uno nuevo.`
    )
    .addFields(
      { name: "🎮 Juego", value: `[${GAME_NAME}](${GAME_URL})`, inline: true },
      { name: "📅 Expira", value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: true }
    )
    .setFooter({ text: "1 generación por usuario cada 5 días • 0.1s Dev" })
    .setTimestamp();

  if (thumbnail) dmEmbed.setThumbnail(thumbnail);

  let dmSent = false;
  try {
    const dm = await message.author.createDM();
    await dm.send({ embeds: [dmEmbed] });
    dmSent = true;
  } catch {
    dmSent = false;
  }

  const ownerEmbed = new EmbedBuilder()
    .setTitle(`📋 Servidor generado — ${GAME_NAME}`)
    .setColor(0xf39c12)
    .setDescription(
      `**${message.author.tag}** (<@${userId}>) generó un servidor privado.\n\n` +
      `🔗 **[Link del servidor](${joinLink})**\n` +
      `⏱️ Expira: <t:${Math.floor(expiresAt / 1000)}:R>`
    )
    .setTimestamp();

  const ownerId = process.env["DISCORD_OWNER_ID"];
  if (ownerId) {
    try {
      const ownerUser = await message.client.users.fetch(ownerId);
      await ownerUser.send({ embeds: [ownerEmbed] });
    } catch (err) {
      logger.warn({ err }, "No se pudo enviar DM al owner");
    }
  }

  const channelMsg = dmSent
    ? `✅ <@${userId}> — Servidor generado. **Revisa tus DMs** 📩`
    : `✅ <@${userId}> — Servidor generado, pero no pudimos enviarte el DM. Activa DMs del servidor e intenta de nuevo.`;

  const sent = await message.reply(channelMsg);

  const entry: GenEntry = {
    userId,
    messageId: sent.id,
    channelId: GEN_CHANNEL_ID,
    generatedAt: now,
    expiresAt,
    accessCode: server.accessCode,
    placeId: PLACE_ID,
  };

  addEntry(entry);
  await saveGen();
  logger.info({ userId, messageId: sent.id }, "Servidor privado generado");
}

export async function cmdServers(message: Message): Promise<void> {
  const entries = getAllEntries();
  const now = Date.now();

  const active = entries.filter(e => e.expiresAt > now);

  if (active.length === 0) {
    await message.reply("📭 No hay servidores generados activos en este momento.");
    return;
  }

  const lines = active.map((e, i) => {
    const timeLeft = formatTimeLeft(e.expiresAt - now);
    return `**${i + 1}.** <@${e.userId}> — expira en ${timeLeft}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`🎮 Servidores Privados Activos — ${GAME_NAME}`)
    .setColor(0x2ecc71)
    .setDescription(lines.join("\n"))
    .setFooter({ text: `${active.length} servidor(es) activo(s) • 0.1s Dev` })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
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
