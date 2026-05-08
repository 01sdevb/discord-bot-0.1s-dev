import axios from "axios";
import { logger } from "../lib/logger";
import type { ChatMessage } from "./conversationHistory";

const DEVELOL_AI_URL = process.env["DEVELOL_AI_URL"] ?? "https://develol-ai-production.up.railway.app";

async function callDevelolAI(
  endpoint: string,
  body: Record<string, unknown>,
  timeout = 30000,
): Promise<Record<string, unknown>> {
  const response = await axios.post(`${DEVELOL_AI_URL}${endpoint}`, body, {
    headers: { "Content-Type": "application/json" },
    timeout,
  });
  return response.data as Record<string, unknown>;
}

export async function askAI(prompt: string, history: ChatMessage[] = []): Promise<string> {
  try {
    const data = await callDevelolAI("/chat", {
      prompt,
      history: history.slice(-10).map((m) => ({
        role: m.role === "model" ? "assistant" : "user",
        content: m.content,
      })),
    });
    const response = (data["response"] as string) ?? "";
    if (response) return response.slice(0, 1900);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
    logger.error({ msg }, "Error llamando a Develol AI /chat");
  }
  return "No pude obtener respuesta ahora mismo. Intenta de nuevo en un momento.";
}

export async function askScriptAI(request: string, _scriptContext: string): Promise<string> {
  try {
    const data = await callDevelolAI("/scriptgen", { request }, 90000);
    const code = (data["code"] as string) ?? "";
    if (code && code.length > 20) return code;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
    logger.error({ msg }, "Error llamando a Develol AI /scriptgen");
  }
  return "--script generate for Dev | https://develol.com\n-- Error temporal. Intenta de nuevo.";
}
