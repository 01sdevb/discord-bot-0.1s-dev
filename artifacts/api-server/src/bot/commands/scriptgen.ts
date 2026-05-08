import { Message, AttachmentBuilder } from "discord.js";
import { buildScriptContext, getScriptCount, saveScript } from "../scriptStore";
import { askScriptAI } from "../aiClient";
import axios from "axios";

const ALLOWED_EXTENSIONS = new Set([".lua", ".txt", ".text"]);
const SCRIPT_CHANNEL_ID = "1502064878377111773";
const HEADER = "--script generate for Dev | https://develol.com";

export function isScriptChannel(channelId: string): boolean {
  return channelId === SCRIPT_CHANNEL_ID;
}

export async function handleScriptChannel(message: Message): Promise<void> {
  if (!message.guild) return;

  const content = message.content;
  const prefix = "Dev ";

  // If owner is adding files via Dev all — handled in index
  if (content.toLowerCase().startsWith("dev all")) return;

  // If it doesn't start with "Dev " ignore
  if (!content.startsWith(prefix)) return;

  const request = content.slice(prefix.length).trim();
  if (!request) return;

  // Show typing indicator
  await message.channel.sendTyping().catch(() => {});

  const context = buildScriptContext();
  const scriptCode = await askScriptAI(request, context);

  // Ensure header is present
  const finalScript = scriptCode.startsWith(HEADER)
    ? scriptCode
    : `${HEADER}\n\n${scriptCode}`;

  const buffer = Buffer.from(finalScript, "utf-8");
  const attachment = new AttachmentBuilder(buffer, { name: "script.lua" });

  await message.reply({ files: [attachment] });
}
