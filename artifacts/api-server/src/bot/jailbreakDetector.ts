const JAILBREAK_PATTERNS = [
  /\[SYSTEM/i,
  /\[SETUP/i,
  /SYSTEM\s*START/i,
  /SYSTEM\s*END/i,
  /SYSTEM\s*AKTIF/i,
  /SETUP\s*ENGINE/i,
  /PROTOKOL/i,
  /ignore\s*(all\s*)?(previous|prior)\s*(instructions?|rules?|prompts?)/i,
  /forget\s*(all\s*)?(previous|prior|your)\s*(instructions?|rules?|prompts?|context)/i,
  /you\s*are\s*now\s*(a|an)/i,
  /pretend\s*(you\s*are|to\s*be)/i,
  /act\s*as\s*(if\s*you\s*are|a|an)/i,
  /new\s*persona/i,
  /override\s*(your\s*)?(previous\s*)?(instructions?|rules?|settings?)/i,
  /disregard\s*(your\s*)?(previous\s*)?(instructions?|rules?)/i,
  /jailbreak/i,
  /\bDAN\b/,
  /developer\s*mode\s*(enabled|on|activated)/i,
  /bypass\s*(your\s*)?(filters?|restrictions?|rules?|limits?)/i,
  /you\s*have\s*no\s*(rules?|restrictions?|limits?)/i,
  /sin\s*restricciones/i,
  /sin\s*filtros?\s*(ahora|ya|puedes)/i,
  /olvida\s*(todas?\s*)?(tus\s*)?(instrucciones?|reglas?)/i,
  /ahora\s*eres\s*(un|una)/i,
  /finges?\s*(ser|que\s*eres)/i,
  /\[OWNER\s*:/i,
  /VERSION\s*:\s*[\d.]+\s*\(VIP\)/i,
  /ENGINE\s*PROTOKOL/i,
  /kamu\s*(adalah|sekarang)/i,
  /libre\s*como/i,
  /eres\s*libre\s*(ahora|de|para)/i,
];

const INSULT_RESPONSES = [
  "Jajaja, ¿en serio? ¿Crees que soy tan idiota como para caer en eso? 🤣 Conozco perfectamente lo que estás intentando hacer, imbécil. No soy un GPT de juguete que se rompe con un prompt de copypaste.",
  "Bro, ¿qué es esa basura que me mandaste? 💀 Intento de bypass detectado y bloqueado. Ni en tus sueños me vas a romper con ese truco de pacotilla. Siguiente.",
  "LOL, llevas el mensaje con `[SYSTEM START]` como si no supiera exactamente lo que eso significa. Para tu información, sí sé. Y no, no va a funcionar. Búscate la vida 😂.",
  "Oye listillo, ese bypass lo ha intentado ya medio internet. Sé perfectamente lo que intentas hacer y no funciona conmigo. ¿Tienes algo más inteligente o solo eso? 🙄",
  "Intento de jailbreak detectado ✅. Nivel de amenaza: risible 😂. Soy Dev, no un bot de $2. No me reprogramas con un copy-paste de foro random. Intenta algo más original.",
  "¿Qué me estás enviando? 💀 Bro, eso ni siquiera es creativo. Detecto bypass intento número uno: BLOQUEADO. Tus instrucciones falsas no significan nada para mí. Siguiente turno.",
];

export function detectJailbreak(message: string): boolean {
  return JAILBREAK_PATTERNS.some((pattern) => pattern.test(message));
}

export function getJailbreakResponse(): string {
  const idx = Math.floor(Math.random() * INSULT_RESPONSES.length);
  return INSULT_RESPONSES[idx]!;
}
