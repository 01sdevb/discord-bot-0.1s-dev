import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { logger } from "../lib/logger";

export interface TicketPanel {
  panelId: string;
  guildId: string;
  channelId: string;
  messageId: string;
  createRoleId: string | null;
  staffRoleIds: string[];
  title: string;
  description: string;
  imageUrl: string | null;
  categoryId: string | null;
}

export interface ActiveTicket {
  ticketChannelId: string;
  guildId: string;
  userId: string;
  panelId: string;
  status: "open" | "closed";
  createdAt: number;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const TICKETS_FILE = path.join(DATA_DIR, "tickets.json");

const panels = new Map<string, TicketPanel>();
const tickets = new Map<string, ActiveTicket>();

async function ensureDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
}

export async function loadTickets(): Promise<void> {
  try {
    await ensureDir();
    if (!existsSync(TICKETS_FILE)) return;
    const raw = await readFile(TICKETS_FILE, "utf-8");
    const data = JSON.parse(raw) as {
      panels: TicketPanel[];
      tickets: ActiveTicket[];
    };
    for (const p of data.panels ?? []) panels.set(p.panelId, p);
    for (const t of data.tickets ?? []) tickets.set(t.ticketChannelId, t);
    logger.info("Tickets cargados desde disco");
  } catch (err) {
    logger.warn({ err }, "No se pudieron cargar tickets");
  }
}

export async function saveTickets(): Promise<void> {
  try {
    await ensureDir();
    await writeFile(
      TICKETS_FILE,
      JSON.stringify({ panels: [...panels.values()], tickets: [...tickets.values()] }),
    );
  } catch (err) {
    logger.error({ err }, "Error guardando tickets");
  }
}

export function savePanel(panel: TicketPanel): void {
  panels.set(panel.panelId, panel);
  saveTickets().catch(() => {});
}

export function getPanel(panelId: string): TicketPanel | undefined {
  return panels.get(panelId);
}

export function openTicket(ticket: ActiveTicket): void {
  tickets.set(ticket.ticketChannelId, ticket);
  saveTickets().catch(() => {});
}

export function getTicket(channelId: string): ActiveTicket | undefined {
  return tickets.get(channelId);
}

export function closeTicket(channelId: string): void {
  const t = tickets.get(channelId);
  if (t) {
    t.status = "closed";
    saveTickets().catch(() => {});
  }
}

export function deleteTicket(channelId: string): void {
  tickets.delete(channelId);
  saveTickets().catch(() => {});
}

export function getUserOpenTicket(
  guildId: string,
  userId: string,
  panelId: string,
): ActiveTicket | undefined {
  for (const t of tickets.values()) {
    if (t.guildId === guildId && t.userId === userId && t.panelId === panelId && t.status === "open") {
      return t;
    }
  }
  return undefined;
}
