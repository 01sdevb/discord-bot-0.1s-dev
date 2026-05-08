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
import { askAI } from "./aiClient";
import { addMessage, getHistory } from "./conversationHistory";
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
import { detectJailbreak, getJailbreakResponse } from "./jailbreakDetector";
import { storeMessage, markDeleted, loadMessages, saveMessages } from "./messageStore";
import { loadTickets } from "./ticketStore";

const PREFIX = "Dev ";
const AI_CHANNEL_ID = "1502082326270705796";
const SAVE_INTERVAL_MS = 60 * 1000;

const TWO_WORD_COMMANDS: Record<string, string> = {
  "anti link": "antilink",
  "anti spam": "antispam",
  "anti-link": "antilink",
  "anti-spam": "antispam",
  "warn clear": "warnclear",
};

export async function startBot(): Promise<void> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.error("DISCORD_BOT_TOKEN no está configurado.");
    return;
  }

  await loadMessages();
  await loadTickets();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildBans,
      GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
  });

  client.once(Events.ClientReady, (c) => {
    logger.info({ tag: c.user.tag }, "Bot de Discord listo");
    setInterval(() => {
      saveMessages().catch((err) => logger.error({ err }, "Auto-save fallido"));
    }, SAVE_INTERVAL_MS);
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
        case "conversacion":
        case "con":         { await cmdConversacion(message, args); break; }

        case "antispam": {
          await message.reply(
            `🛡️ **Anti-Spam** — Siempre activo.\nSi un usuario envía **3 mensajes seguidos** en menos de 5 segundos recibe timeout de **28 días** y sus mensajes se eliminan.`
          );
          break;
        }

        default: {
          const fullQuery = withoutPrefix;
          if (!fullQuery) break;

          if (message.channel.id !== AI_CHANNEL_ID) {
            await message.reply(`🤖 Las preguntas a la IA solo se pueden hacer en <#${AI_CHANNEL_ID}>.\n¡Ve allá y pregunta lo que quieras!`);
            break;
          }

          if (detectJailbreak(fullQuery)) {
            await message.reply(getJailbreakResponse());
            break;
          }

          await message.channel.sendTyping().catch(() => {});
          addMessage(message.author.id, message.channel.id, "user", fullQuery);
          const history = getHistory(message.author.id, message.channel.id);
          const response = await askAI(fullQuery, history);
          addMessage(message.author.id, message.channel.id, "model", response);
          await message.reply(response);
          break;
        }
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
      if (btn.customId.startsWith("ticketCreate_")) {
        await handleTicketCreate(btn);
      } else if (btn.customId.startsWith("ticketClose_")) {
        await handleTicketClose(btn);
      } else if (btn.customId.startsWith("ticketDelete_")) {
        await handleTicketDelete(btn);
      }
    } catch (err) {
      logger.error({ err, customId: btn.customId }, "Error en interacción de botón");
      try { await btn.reply({ content: "❌ Error al procesar la acción.", ephemeral: true }); } catch {}
    }
  });

  process.on("SIGTERM", async () => { await saveMessages(); process.exit(0); });
  process.on("SIGINT",  async () => { await saveMessages(); process.exit(0); });

  client.login(token).catch((err) => logger.error({ err }, "No se pudo conectar el bot."));
}
