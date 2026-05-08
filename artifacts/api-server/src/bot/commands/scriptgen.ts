import { Message, AttachmentBuilder } from "discord.js";
import { buildScriptContext, getScriptCount } from "../scriptStore";
import { askScriptAI } from "../aiClient";

const SCRIPT_CHANNEL_ID = "1502064878377111773";
const HEADER = "--script generate for Dev | https://develol.com";

export function isScriptChannel(channelId: string): boolean {
  return channelId === SCRIPT_CHANNEL_ID;
}

export async function cmdScriptGen(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  const request = args.join(" ").trim();
  if (!request) {
    await message.reply(
      `❌ Uso: \`Dev scriptgen <descripción del script>\`\n` +
      `📚 Scripts de referencia cargados: **${getScriptCount()}**\n` +
      `Ejemplo: \`Dev scriptgen ESP + Aimbot + Speed para Blox Fruits\``,
    );
    return;
  }

  await message.channel.sendTyping().catch(() => {});

  const context = buildScriptContext();
  const scriptCode = await askScriptAI(request, context);

  const finalScript = scriptCode.startsWith(HEADER)
    ? scriptCode
    : `${HEADER}\n\n${scriptCode}`;

  const buffer = Buffer.from(finalScript, "utf-8");
  const attachment = new AttachmentBuilder(buffer, { name: "script.lua" });

  await message.reply({
    content: `✅ Script generado — **${request.slice(0, 60)}${request.length > 60 ? "..." : ""}**`,
    files: [attachment],
  });
}

export async function handleScriptChannel(message: Message): Promise<void> {
  if (!message.guild) return;

  const content = message.content;
  const prefix = "Dev ";

  if (content.toLowerCase().startsWith("dev all")) return;
  if (!content.startsWith(prefix)) return;

  const request = content.slice(prefix.length).trim();
  if (!request) return;

  await message.channel.sendTyping().catch(() => {});

  const context = buildScriptContext();
  const scriptCode = await askScriptAI(request, context);

  const finalScript = scriptCode.startsWith(HEADER)
    ? scriptCode
    : `${HEADER}\n\n${scriptCode}`;

  const buffer = Buffer.from(finalScript, "utf-8");
  const attachment = new AttachmentBuilder(buffer, { name: "script.lua" });

  await message.reply({
    content: `✅ Script generado — **${request.slice(0, 60)}${request.length > 60 ? "..." : ""}**`,
    files: [attachment],
  });
}
