import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";
import { logger } from "../lib/logger";

const gemini1 = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");
const gemini2 = new GoogleGenerativeAI(process.env["GEMINI_API_KEY_2"] ?? "");

const openRouterKeys = [
  process.env["OPENROUTER_API_KEY"] ?? "",
  process.env["OPENROUTER_API_KEY_2"] ?? "",
];

let geminiIndex = 0;
let openRouterIndex = 0;

function nextGemini(): GoogleGenerativeAI {
  const clients = [gemini1, gemini2];
  const client = clients[geminiIndex % clients.length]!;
  geminiIndex++;
  return client;
}

function nextOpenRouterKey(): string {
  const key = openRouterKeys[openRouterIndex % openRouterKeys.length]!;
  openRouterIndex++;
  return key;
}

export async function askAI(prompt: string): Promise<string> {
  try {
    const genai = nextGemini();
    const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text.trim();
  } catch (err) {
    logger.warn({ err }, "Gemini failed, trying OpenRouter");
  }

  try {
    const key = nextOpenRouterKey();
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
      },
    );
    const content = response.data?.choices?.[0]?.message?.content ?? "";
    return content.trim();
  } catch (err) {
    logger.error({ err }, "OpenRouter also failed");
    return "No pude obtener una respuesta de la IA en este momento. Intenta de nuevo.";
  }
}
