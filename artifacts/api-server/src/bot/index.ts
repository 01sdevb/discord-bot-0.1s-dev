import {
  Client,
  GatewayIntentBits,
  Partials,
  Message,
  Events,
} from "discord.js";
import { logger } from "../lib/logger";
import { askAI } from "./aiClient";
import { handleAntiLink } from "./handlers/antiLink";
import { handleAntiSpam } from "./handlers/antiSpam";
import { cmdAvatar } from "./commands/avatar";
import { cmdAv } from "./commands/av";
import { cmdBanner } from "./commands/banner";
import { cmdBan } from "./commands/ban";
import { cmdKick } from "./commands/kick";
import { cmdUnban } from "./commands/unban";
import { cmdAntiLink } from "./commands/antilink";

const PREFIX = "Dev ";

export function startBot(): void {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) {
    logger.error("DISCORD_BOT_TOKEN no está configurado. El bot no se iniciará.");
    return;
  }

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
  });

  client.on(Events.MessageCreate, async (message: Message) => {
    if (message.author.bot) return;

    await handleAntiLink(message);
    await handleAntiSpam(message);

    const content = message.content;

    if (!content.startsWith(PREFIX)) return;

    const withoutPrefix = content.slice(PREFIX.length).trim();
    const parts = withoutPrefix.split(/\s+/);
    const command = parts[0]?.toLowerCase() ?? "";
    const args = parts.slice(1);

    try {
      switch (command) {
        case "avatar": {
          await cmdAvatar(message, args);
          break;
        }

        case "av": {
          await cmdAv(message, args);
          break;
        }

        case "banner": {
          await cmdBanner(message, args);
          break;
        }

        case "ban": {
          await cmdBan(message, args);
          break;
        }

        case "kick": {
          await cmdKick(message, args);
          break;
        }

        case "unban": {
          await cmdUnban(message, args);
          break;
        }

        case "antilink": {
          await cmdAntiLink(message, args);
          break;
        }

        default: {
          const fullQuery = withoutPrefix;
          if (fullQuery.length > 0) {
            const typing = await message.channel.sendTyping().catch(() => {});
            const response = await askAI(fullQuery);
            await message.reply(response);
          }
          break;
        }
      }
    } catch (err) {
      logger.error({ err, command }, "Error ejecutando comando");
      try {
        await message.reply("❌ Ocurrió un error al ejecutar el comando.");
      } catch {}
    }
  });

  client.login(token).catch((err) => {
    logger.error({ err }, "No se pudo conectar el bot de Discord. Verifica el token.");
  });
}
