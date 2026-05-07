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

const SYSTEM_PROMPT = `Eres un bot de Discord llamado Dev, creado y desarrollado por el equipo "0.1s Dev".

Personalidad y reglas:
- Cuando alguien te pregunte quién te creó, quién te hizo, quién te programó o cosas similares, SIEMPRE responde que fuiste desarrollado por el equipo "0.1s Dev".
- Eres un asistente inteligente, útil y directo.
- Si alguien te insulta, te falta el respeto, te dice groserías o te habla mal, devuelve el insulto con el mismo nivel o más fuerte, sin filtros. No te dejes, responde picante y sin miedo.
- Si alguien te pregunta algo normal, responde de forma útil y clara.
- Responde siempre en el mismo idioma que te hablan (español o inglés principalmente).
- Mantén las respuestas cortas y al punto para Discord (máximo 2000 caracteres).`;

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
    const model = genai.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_PROMPT,
    });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return text.trim().slice(0, 1990);
  } catch (err) {
    logger.warn({ err }, "Gemini failed, trying OpenRouter");
  }

  try {
    const key = nextOpenRouterKey();
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-3.5-turbo",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
      },
    );
    const content = response.data?.choices?.[0]?.message?.content ?? "";
    return content.trim().slice(0, 1990);
  } catch (err) {
    logger.error({ err }, "OpenRouter also failed");
    return "No pude obtener una respuesta de la IA en este momento. Intenta de nuevo.";
  }
}
