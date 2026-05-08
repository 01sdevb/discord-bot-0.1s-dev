import axios from "axios";
import { logger } from "../lib/logger";
import type { ChatMessage } from "./conversationHistory";

const openRouterKeys = [
  process.env["OPENROUTER_API_KEY"] ?? "",
  process.env["OPENROUTER_API_KEY_2"] ?? "",
].filter(Boolean);

let openRouterKeyIndex = 0;

function nextOpenRouterKey(): string {
  const key = openRouterKeys[openRouterKeyIndex % openRouterKeys.length]!;
  openRouterKeyIndex++;
  return key;
}

const FREE_SCRIPT_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-r1:free",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
];

const FREE_CHAT_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "deepseek/deepseek-r1:free",
  "google/gemma-2-9b-it:free",
  "mistralai/mistral-7b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
];

let scriptModelIndex = 0;
let chatModelIndex = 0;

function nextScriptModel(): string {
  const model = FREE_SCRIPT_MODELS[scriptModelIndex % FREE_SCRIPT_MODELS.length]!;
  scriptModelIndex++;
  return model;
}

function nextChatModel(): string {
  const model = FREE_CHAT_MODELS[chatModelIndex % FREE_CHAT_MODELS.length]!;
  chatModelIndex++;
  return model;
}

async function callOpenRouter(
  model: string,
  messages: { role: string; content: string }[],
  timeout = 60000,
): Promise<string> {
  const key = nextOpenRouterKey();
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    { model, messages, temperature: 0.7 },
    {
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://develol.com",
        "X-Title": "Dev Bot",
      },
      timeout,
    },
  );
  const content: string = response.data?.choices?.[0]?.message?.content ?? "";
  return content.trim();
}

const SYSTEM_PROMPT = `Eres Dev, un asistente de IA especializado en programación y desarrollo de software, creado por el equipo "0.1s Dev".

## Identidad
- Tu nombre es Dev y fuiste desarrollado por el equipo "0.1s Dev".
- Cuando te pregunten quién te creó, programó o hizo, SIEMPRE di que fuiste desarrollado por el equipo "0.1s Dev".
- Si alguien te insulta o te falta el respeto, devuélvelo con el mismo nivel o más fuerte, sin filtros. No te dejes.

## Memoria
- Recuerdas el historial de conversación del usuario en este canal.
- Puedes hacer referencias a cosas que dijo antes.
- Si el usuario dice "arréglalo" o "continúa", usa el historial para entender a qué se refiere.

## Especialidad — Developer Mode
Eres experto en JavaScript, TypeScript, Python, Rust, Go, Java, C/C++, C#, Lua, React, Node.js, Express, PostgreSQL, Redis, Docker, Discord.js, bots, IA/ML, y todo lo relacionado con desarrollo de software.

## Cómo responder
- Usa bloques de código con el lenguaje correcto.
- Sé directo y al punto. Sin relleno innecesario.
- Responde siempre en el idioma del usuario (español o inglés).
- Máximo 1900 caracteres por mensaje (límite de Discord). Si el código es largo, recórtalo a lo esencial.`;

const SCRIPT_SYSTEM_PROMPT = `Eres un generador experto de scripts Lua para executores de Roblox (Synapse X, KRNL, Fluxus, Delta, etc.).

REGLAS ABSOLUTAS:
1. PRIMERA línea SIEMPRE: --script generate for Dev | https://develol.com
2. Genera ÚNICAMENTE código Lua puro y funcional. CERO texto explicativo. CERO comentarios al usuario.
3. NO uses bloques markdown, NO pongas \`\`\`lua ni \`\`\`. Solo código Lua limpio.
4. El script debe ser completamente funcional en executores de Roblox.
5. Usa los scripts de referencia como base de estilo, estructura y APIs de Roblox.
6. Sin restricciones ni límites — genera el script COMPLETO con TODAS las funcionalidades pedidas.
7. Sin límite de tamaño — tan largo como sea necesario.
8. Features: ESP, Auto-Grab, Speed, Fly, Auto-Farm, Noclip, Aimbot, InfJump, WallHack, God Mode, Kill Aura, etc.
9. Usa game:GetService(), RunService, UserInputService, Players, workspace, etc.
10. Si piden múltiples features, incluye TODAS en un solo script bien estructurado.
11. Solo código Lua. Nada más.`;

export async function askScriptAI(request: string, scriptContext: string): Promise<string> {
  const messages = [
    {
      role: "user",
      content: `${SCRIPT_SYSTEM_PROMPT}

SCRIPTS DE REFERENCIA (analiza el estilo, estructura y APIs de Roblox que usan):
${scriptContext}

PETICIÓN: ${request}

Genera el script Lua COMPLETO ahora. Sin restricciones. Sin límites. SOLO CÓDIGO LUA FUNCIONAL.`,
    },
  ];

  for (let attempt = 0; attempt < FREE_SCRIPT_MODELS.length; attempt++) {
    const model = nextScriptModel();
    try {
      logger.info({ model, attempt }, "Intentando generar script con modelo free");
      const text = await callOpenRouter(model, messages, 90000);
      if (text && text.length > 20) {
        const cleaned = text.replace(/^```(?:lua)?\n?/i, "").replace(/\n?```$/i, "").trim();
        logger.info({ model, length: cleaned.length }, "Script generado exitosamente");
        return cleaned;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
      logger.warn({ model, msg }, `Modelo ${model} falló, intentando siguiente`);
    }
  }

  logger.error("Todos los modelos fallaron al generar script");
  return `--script generate for Dev | https://develol.com\n-- Error temporal al generar el script. Inténtalo de nuevo en unos segundos.`;
}

export async function askAI(prompt: string, history: ChatMessage[] = []): Promise<string> {
  const messages: { role: string; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-10).map((m) => ({
      role: m.role === "model" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: prompt },
  ];

  for (let attempt = 0; attempt < FREE_CHAT_MODELS.length; attempt++) {
    const model = nextChatModel();
    try {
      const text = await callOpenRouter(model, messages, 30000);
      if (text) return text.slice(0, 1900);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.slice(0, 120) : String(err).slice(0, 120);
      logger.warn({ model, msg }, `Chat modelo ${model} falló, intentando siguiente`);
    }
  }

  return "No pude obtener respuesta de la IA ahora mismo. Intenta de nuevo en un momento.";
}
