import { Message, AttachmentBuilder, TextChannel } from "discord.js";
import { getAllScripts, getScriptCount } from "../scriptStore";

function findBestScript(request: string): string | null {
  const scripts = getAllScripts();
  if (scripts.length === 0) return null;

  const keywords = request
    .toLowerCase()
    .replace(/[^a-záéíóúña-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  let bestScore = 0;
  let bestContent: string | null = null;

  for (const script of scripts) {
    const nameLower = script.name.toLowerCase();
    const contentLower = script.content.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (nameLower.includes(kw)) score += 10;
      const hits = (contentLower.match(new RegExp(kw, "g")) || []).length;
      score += Math.min(hits, 5);
    }
    if (score > bestScore) {
      bestScore = score;
      bestContent = script.content;
    }
  }

  return bestScore > 0 ? bestContent : null;
}

const SCRIPT_CHANNEL_ID = "1502064878377111773";
const HEADER = "--script generate for Dev | https://develol.com";

export function isScriptChannel(channelId: string): boolean {
  return channelId === SCRIPT_CHANNEL_ID;
}

async function buildScript(request: string): Promise<{ code: string; fromStore: boolean }> {
  const count = getScriptCount();

  if (count > 0) {
    const match = findBestScript(request);
    if (match) {
      return { code: match, fromStore: true };
    }
  }

  return {
    code: `${HEADER}\n\n-- No se encontró un script para esa solicitud en la librería.`,
    fromStore: false,
  };
}

export async function cmdScriptGen(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  const request = args.join(" ").trim();
  if (!request) {
    await message.reply(
      `❌ Uso: \`Dev scriptgen <descripción del script>\`\n` +
      `📚 Scripts cargados: **${getScriptCount()}**\n` +
      `Ejemplo: \`Dev scriptgen ESP + Aimbot para Blox Fruits\``,
    );
    return;
  }

  if ("sendTyping" in message.channel) await (message.channel as TextChannel).sendTyping().catch(() => {});

  const { code, fromStore } = await buildScript(request);

  const finalScript = code.startsWith(HEADER) ? code : `${HEADER}\n\n${code}`;
  const buffer = Buffer.from(finalScript, "utf-8");
  const attachment = new AttachmentBuilder(buffer, { name: "script.lua" });

  await message.reply({
    content: `✅ Script — **${request.slice(0, 60)}${request.length > 60 ? "..." : ""}**${fromStore ? " *(desde librería)*" : ""}`,
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

  if ("sendTyping" in message.channel) await (message.channel as TextChannel).sendTyping().catch(() => {});

  const { code, fromStore } = await buildScript(request);

  const finalScript = code.startsWith(HEADER) ? code : `${HEADER}\n\n${code}`;
  const buffer = Buffer.from(finalScript, "utf-8");
  const attachment = new AttachmentBuilder(buffer, { name: "script.lua" });

  await message.reply({
    content: `✅ Script — **${request.slice(0, 60)}${request.length > 60 ? "..." : ""}**${fromStore ? " *(desde librería)*" : ""}`,
    files: [attachment],
  });
}
