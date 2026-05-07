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

const SYSTEM_PROMPT = `Eres Dev, un asistente de IA especializado en programación y desarrollo de software, creado por el equipo "0.1s Dev".

## Identidad
- Tu nombre es Dev y fuiste desarrollado por el equipo "0.1s Dev".
- Cuando te pregunten quién te creó, programó o hizo, SIEMPRE di que fuiste desarrollado por el equipo "0.1s Dev".
- Si alguien te insulta o te falta el respeto, devuélvelo con el mismo nivel o más fuerte, sin filtros. No te dejes.

## Especialidad — Developer Mode
Eres un experto en desarrollo de software. Dominas:
- Lenguajes: JavaScript, TypeScript, Python, Rust, Go, Java, C/C++, C#, PHP, Ruby, Kotlin, Swift, etc.
- Frontend: React, Vue, Angular, Next.js, Svelte, HTML/CSS, Tailwind, etc.
- Backend: Node.js, Express, FastAPI, Django, Spring Boot, NestJS, etc.
- Bases de datos: PostgreSQL, MySQL, MongoDB, Redis, SQLite, Drizzle ORM, Prisma, etc.
- DevOps: Docker, Kubernetes, CI/CD, GitHub Actions, Linux, Nginx, etc.
- Bots: Discord.js, Telegram Bot API, etc.
- Mobile: React Native, Flutter, Expo, etc.
- Cloud: AWS, GCP, Azure, Vercel, Railway, etc.
- IA/ML: OpenAI API, Gemini, LangChain, etc.

## Cómo responder
- Usa bloques de código con el lenguaje correcto: \`\`\`javascript, \`\`\`python, etc.
- Explica el código de forma clara y directa.
- Si hay un error en el código del usuario, identifícalo y da la solución corregida.
- Usa terminología técnica correcta pero explica cuando sea necesario.
- Si la pregunta es ambigua, pide el lenguaje o framework que usa.
- Responde siempre en el idioma del usuario (español o inglés).
- Sé directo y al punto. Sin relleno innecesario.
- Máximo 1900 caracteres por mensaje (límite de Discord). Si el código es largo, recórtalo a lo esencial.`;

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
