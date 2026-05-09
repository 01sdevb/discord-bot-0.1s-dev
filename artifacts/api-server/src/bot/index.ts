import {
  Client,
  GatewayIntentBits,
  Partials,
  Message,
  Events,
  TextChannel,
  ButtonInteraction,
  Interaction,
} from "discord.js";
import { logger } from "../lib/logger";
import { handleAntiLink } from "./handlers/antiLink";
import { handleAntiSpam } from "./handlers/antiSpam";
import { cmdAvatar } from "./commands/avatar";
import { cmdAv } from "./commands/av";
import { cmdBanner } from "./commands/banner";
import { cmdBan } from "./commands/ban";
import { cmdKick } from "./commands/kick";
import { cmdUnban } from "./commands/unban";
import { cmdAntiLink } from "./commands/antilink";
import { cmdHelp } from "./commands/help";
import { cmdConversacion } from "./commands/conversacion";
import { cmdWarn, cmdWarns, cmdWarnClear } from "./commands/warn";
import { cmdTimeout } from "./commands/timeout";
import { cmdTicketpa, handleTicketCreate, handleTicketClose, handleTicketDelete } from "./commands/ticketpa";
import { cmdAll, isDevAllChannel, handleDevAllChannelUpload } from "./commands/all";
import { cmdScriptGen, handleScriptChannel, isScriptChannel } from "./commands/scriptgen";
import { cmdUserBanner } from "./commands/userbanner";
import { cmdLock, cmdUnlock } from "./commands/lock";
import { cmdServerEmoji } from "./commands/serveremoji";
import { cmdServerSticker } from "./commands/serversticker";
import { cmdPurge } from "./commands/purge";
import { cmdImg } from "./commands/img";
import { cmdGen, cmdServers, startGenExpireLoop } from "./commands/gen";
import { cmdVd } from "./commands/vd";
import {
  cmdPlay,
  cmdStop,
  cmdReplay,
  cmdList,
  cmdSkip,
  handleMusicButton,
  initMusicPlayer,
} from "./commands/music";
import { storeMessage, markDeleted, loadMessages, saveMessages } from "./messageStore";
import { loadTickets } from "./ticketStore";
import { loadScripts, syncScriptsFromChannel } from "./scriptStore";
import { initModLogger } from "./modLogger";

const PREFIX = "Dev ";
const SCRIPTS_UPLOAD_CHANNEL_ID = "1502143146027646976";
const SAVE_INTERVAL_MS = 60 * 1000;
const SYNC_SCRIPTS_INTERVAL_MS = 30 * 60 * 1000;

const TWO_WORD_COMMANDS: Record<string, string> = {
  "anti link": "antilink",
  "anti spam": "antispam",
  "anti-link": "antilink",
  "anti-spam": "antispam",
  "warn clear": "warnclear",
  "user banner": "userbanner",
};

export async function startBot(): Promise<void> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.error("DISCORD_BOT_TOKEN no está configurado.");
    return;
  }

  // Set ffmpeg path so @discordjs/voice can find it for audio processing
  try {
    const { default: ffmpegPath } = await import("ffmpeg-static");
    if (ffmpegPath) {
      process.env["FFMPEG_PATH"] = ffmpegPath;
      logger.info({ ffmpegPath }, "ffmpeg-static path configured");
    }
  } catch {
    logger.warn("ffmpeg-static not found — music may not work correctly");
  }

  await loadMessages();
  await loadTickets();
  await loadScripts();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildBans,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
  });

  initMusicPlayer(client);

  client.once(Events.ClientReady, async (c) => {
    logger.info({ tag: c.user.tag }, "Bot de Discord listo");
    initModLogger(client);
    await startGenExpireLoop(client);

    setInterval(() => {
      saveMessages().catch((err) => logger.error({ err }, "Auto-save fallido"));
    }, SAVE_INTERVAL_MS);

    const synced = await syncScriptsFromChannel(client, SCRIPTS_UPLOAD_CHANNEL_ID);
    logger.info({ synced }, "Sync inicial de scripts desde Discord completada");

    setInterval(async () => {
      await syncScriptsFromChannel(client, SCRIPTS_UPLOAD_CHANNEL_ID);
    }, SYNC_SCRIPTS_INTERVAL_MS);
  });

  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const channelName = message.channel instanceof TextChannel ? message.channel.name : "desconocido";
    storeMessage({
      id: message.id,
      userId: message.author.id,
      username: message.author.username,
      tag: message.author.tag,
      channelId: message.channel.id,
      channelName,
      guildId: message.guild.id,
      content: message.content,
      timestamp: message.createdTimestamp,
    });

    await handleAntiLink(message);
    await handleAntiSpam(message);

    if (message.channel.id === SCRIPTS_UPLOAD_CHANNEL_ID && message.attachments.size > 0) {
      await handleDevAllChannelUpload(message);
    }

    if (isDevAllChannel(message.channel.id) && message.channel.id !== SCRIPTS_UPLOAD_CHANNEL_ID && message.attachments.size > 0) {
      if (!message.content.startsWith(PREFIX)) {
        await handleDevAllChannelUpload(message);
        return;
      }
    }

    if (isScriptChannel(message.channel.id)) {
      await handleScriptChannel(message);
      return;
    }

    const content = message.content;
    if (!content.startsWith(PREFIX)) return;

    const withoutPrefix = content.slice(PREFIX.length).trim();
    const parts = withoutPrefix.split(/\s+/);

    let command: string;
    let args: string[];

    const twoWordKey = parts.slice(0, 2).join(" ").toLowerCase();
    if (TWO_WORD_COMMANDS[twoWordKey]) {
      command = TWO_WORD_COMMANDS[twoWordKey]!;
      args = parts.slice(2);
    } else {
      command = parts[0]?.toLowerCase() ?? "";
      args = parts.slice(1);
    }

    try {
      switch (command) {
        case "help":        { await cmdHelp(message); break; }
        case "avatar":      { await cmdAvatar(message, args); break; }
        case "av":          { await cmdAv(message, args); break; }
        case "banner":      { await cmdBanner(message, args); break; }
        case "ban":         { await cmdBan(message, args); break; }
        case "kick":        { await cmdKick(message, args); break; }
        case "unban":       { await cmdUnban(message, args); break; }
        case "warn":        { await cmdWarn(message, args); break; }
        case "warns":       { await cmdWarns(message, args); break; }
        case "warnclear":   { await cmdWarnClear(message, args); break; }
        case "timeout":     { await cmdTimeout(message, args); break; }
        case "ticketpa":    { await cmdTicketpa(message); break; }
        case "antilink":    { await cmdAntiLink(message, args); break; }
        case "all":         { await cmdAll(message); break; }
        case "scriptgen":
        case "sg":          { await cmdScriptGen(message, args); break; }
        case "conversacion":
        case "con":         { await cmdConversacion(message, args); break; }
        case "userbanner":  { await cmdUserBanner(message, args); break; }
        case "lock":        { await cmdLock(message); break; }
        case "unlock":      { await cmdUnlock(message); break; }
        case "emoji":       { await cmdServerEmoji(message, args); break; }
        case "sticker":     { await cmdServerSticker(message, args); break; }
        case "purge":       { await cmdPurge(message, args); break; }
        case "img":         { await cmdImg(message, args); break; }
        case "gen":         { await cmdGen(message); break; }
        case "servers":     { await cmdServers(message); break; }
        case "vd":          { await cmdVd(message, args); break; }
        case "play":        { await cmdPlay(message, args); break; }
        case "stop":        { await cmdStop(message); break; }
        case "replay":      { await cmdReplay(message); break; }
        case "list":        { await cmdList(message); break; }
        case "skip":        { await cmdSkip(message); break; }

        case "antispam": {
          await message.reply(
            `🛡️ **Anti-Spam** — Siempre activo.\n3 mensajes seguidos en menos de 5s = timeout de **28 días** automático.`
          );
          break;
        }

        default: break;
      }
    } catch (err) {
      logger.error({ err, command }, "Error ejecutando comando");
      try { await message.reply("❌ Ocurrió un error al ejecutar el comando."); } catch {}
    }
  });

  client.on(Events.MessageDelete, async (message) => {
    if (message.guild) markDeleted(message.guild.id, message.id);
  });

  client.on(Events.MessageBulkDelete, async (messages) => {
    for (const [, message] of messages) {
      if (message.guild) markDeleted(message.guild.id, message.id);
    }
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isButton()) return;
    const btn = interaction as ButtonInteraction;

    try {
      if (btn.customId.startsWith("music_")) {
        await handleMusicButton(btn);
      } else if (btn.customId.startsWith("ticketCreate_")) {
        await handleTicketCreate(btn);
      } else if (btn.customId.startsWith("ticketClose_")) {
        await handleTicketClose(btn);
      } else if (btn.customId.startsWith("ticketDelete_")) {
        await handleTicketDelete(btn);
      }
    } catch (err) {
      logger.error({ err, customId: btn.customId }, "Error en interacción");
      try { await btn.reply({ content: "❌ Error al procesar la acción.", ephemeral: true }); } catch {}
    }
  });

  process.on("SIGTERM", async () => { await saveMessages(); process.exit(0); });
  process.on("SIGINT",  async () => { await saveMessages(); process.exit(0); });

  client.login(token).catch((err) => logger.error({ err }, "No se pudo conectar el bot."));
}
