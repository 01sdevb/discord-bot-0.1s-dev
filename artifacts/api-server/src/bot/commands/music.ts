import {
  Message,
  EmbedBuilder,
  VoiceBasedChannel,
  GuildMember,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  MessageFlags,
} from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
  entersState,
  NoSubscriberBehavior,
  AudioPlayer,
} from "@discordjs/voice";
import playdl from "play-dl";
import { logger } from "../../lib/logger";

interface SearchResult {
  title: string;
  url: string;
  duration: string;
  thumbnail: string;
  channel: string;
}

interface QueueEntry extends SearchResult {
  requestedBy: string;
}

interface GuildQueue {
  entries: QueueEntry[];
  current: number;
  textChannelId: string;
  paused: boolean;
  controlMessageId?: string;
}

const queues = new Map<string, GuildQueue>();
const players = new Map<string, AudioPlayer>();

interface SearchCache {
  results: SearchResult[];
  expiry: number;
  vcId: string;
}
const searchCache = new Map<string, SearchCache>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of searchCache) {
    if (val.expiry < now) searchCache.delete(key);
  }
}, 5 * 60 * 1000);

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function formatDur(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildSearchEmbed(results: SearchResult[], query: string): EmbedBuilder {
  const lines = results.map(
    (r, i) => `**${i + 1}.** [${r.title}](${r.url})\n> ⏱️ ${r.duration} · 📺 ${r.channel}`
  );
  const embed = new EmbedBuilder()
    .setTitle("🔎 Resultados de búsqueda")
    .setColor(0xff0000)
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: `Búsqueda: "${truncate(query, 60)}" • Selecciona un resultado o expira en 5 min` })
    .setTimestamp();
  if (results[0]?.thumbnail) embed.setThumbnail(results[0].thumbnail);
  return embed;
}

function buildSearchRow(results: SearchResult[]): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  results.forEach((r, i) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`music_select_${i}`)
        .setLabel(`${i + 1}. ${truncate(r.title, 60)}`)
        .setStyle(ButtonStyle.Secondary)
    );
  });
  return row;
}

function buildControlRow(paused: boolean): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("music_toggle_pause")
      .setLabel(paused ? "▶️ Reanudar" : "⏸️ Pausar")
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("music_skip")
      .setLabel("⏭️ Skip")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_list")
      .setLabel("📋 Lista")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_stop")
      .setLabel("⏹️ Stop")
      .setStyle(ButtonStyle.Danger),
  );
}

function buildNowPlayingEmbed(entry: QueueEntry, queue: GuildQueue): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("▶️ Reproduciendo ahora")
    .setColor(0x1db954)
    .setDescription(`**[${entry.title}](${entry.url})**`)
    .addFields(
      { name: "⏱️ Duración", value: entry.duration, inline: true },
      { name: "👤 Pedido por", value: entry.requestedBy, inline: true },
      { name: "📋 En cola", value: `${queue.current + 1} / ${queue.entries.length}`, inline: true },
      { name: "📺 Canal", value: entry.channel, inline: true },
    )
    .setTimestamp();
  if (entry.thumbnail) embed.setImage(entry.thumbnail);
  return embed;
}

async function sendOrUpdateControlPanel(
  client: Message["client"],
  guildId: string,
  queue: GuildQueue
): Promise<void> {
  const entry = queue.entries[queue.current];
  if (!entry) return;

  const textChannel = await client.channels.fetch(queue.textChannelId).catch(() => null);
  if (!(textChannel instanceof TextChannel)) return;

  const embed = buildNowPlayingEmbed(entry, queue);
  const row = buildControlRow(queue.paused);

  if (queue.controlMessageId) {
    try {
      const msg = await textChannel.messages.fetch(queue.controlMessageId);
      await msg.edit({ embeds: [embed], components: [row] });
      return;
    } catch {
      queue.controlMessageId = undefined;
    }
  }

  const msg = await textChannel.send({ embeds: [embed], components: [row] });
  queue.controlMessageId = msg.id;
}

async function playNext(guildId: string, client: Message["client"]): Promise<void> {
  const queue = queues.get(guildId);
  if (!queue) return;

  if (queue.current >= queue.entries.length) {
    const textChannel = await client.channels.fetch(queue.textChannelId).catch(() => null);
    if (textChannel instanceof TextChannel && queue.controlMessageId) {
      try {
        const msg = await textChannel.messages.fetch(queue.controlMessageId).catch(() => null);
        await msg?.edit({
          embeds: [
            new EmbedBuilder()
              .setTitle("⏹️ Cola terminada")
              .setColor(0x99aab5)
              .setDescription("No hay más canciones en la cola. Usa `Dev play` para añadir más.")
              .setTimestamp(),
          ],
          components: [],
        });
      } catch {}
    }
    queues.delete(guildId);
    players.delete(guildId);
    const conn = getVoiceConnection(guildId);
    conn?.destroy();
    return;
  }

  const entry = queue.entries[queue.current]!;

  try {
    const stream = await playdl.stream(entry.url, { quality: 2 });
    const resource = createAudioResource(stream.stream, { inputType: stream.type });

    let player = players.get(guildId);
    if (!player) {
      player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
      });
      players.set(guildId, player);

      const conn = getVoiceConnection(guildId);
      conn?.subscribe(player);

      player.on(AudioPlayerStatus.Idle, () => {
        const q = queues.get(guildId);
        if (q) {
          q.current++;
          playNext(guildId, client).catch(() => {});
        }
      });

      player.on("error", (err) => {
        logger.warn({ err }, "Error en audio player — saltando canción");
        const q = queues.get(guildId);
        if (q) {
          q.current++;
          playNext(guildId, client).catch(() => {});
        }
      });
    }

    player.play(resource);
    queue.paused = false;
    await sendOrUpdateControlPanel(client, guildId, queue);
  } catch (err) {
    logger.warn({ err, title: entry.title }, "Error reproduciendo canción — saltando");
    queue.current++;
    await playNext(guildId, client);
  }
}

async function joinVC(guildId: string, vc: VoiceBasedChannel): Promise<boolean> {
  let conn = getVoiceConnection(guildId);
  if (conn) return true;

  conn = joinVoiceChannel({
    channelId: vc.id,
    guildId,
    adapterCreator: vc.guild.voiceAdapterCreator,
    selfDeaf: true,
  });

  try {
    await entersState(conn, VoiceConnectionStatus.Ready, 15_000);
    return true;
  } catch (err) {
    logger.warn({ err }, "No se pudo conectar al canal de voz");
    conn.destroy();
    return false;
  }
}

export async function cmdPlay(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  const query = args.join(" ").trim();
  if (!query) {
    await message.reply("❌ Uso: `Dev play <nombre de la canción>`");
    return;
  }

  const member = message.member as GuildMember | null;
  const vc = member?.voice.channel as VoiceBasedChannel | null;
  if (!vc) {
    await message.reply("❌ Debes estar en un canal de voz para usar este comando.");
    return;
  }

  if ("sendTyping" in message.channel) {
    await (message.channel as TextChannel).sendTyping().catch(() => {});
  }

  let results: SearchResult[];
  try {
    const raw = await Promise.race([
      playdl.search(query, { source: { youtube: "video" }, limit: 3 }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 15_000)
      ),
    ]);

    results = (raw as Awaited<ReturnType<typeof playdl.search>>).map((v) => ({
      title: v.title ?? "Sin título",
      url: v.url,
      duration: formatDur(v.durationInSec ?? 0),
      thumbnail: v.thumbnails?.[0]?.url ?? "",
      channel: v.channel?.name ?? "Desconocido",
    }));
  } catch (err) {
    logger.warn({ err, query }, "Error buscando en YouTube");
    await message.reply(
      "❌ No pude buscar esa canción. YouTube puede estar limitando las solicitudes. Inténtalo de nuevo en unos segundos."
    );
    return;
  }

  if (results.length === 0) {
    await message.reply(`📭 No encontré resultados para \`${query}\`.`);
    return;
  }

  const embed = buildSearchEmbed(results, query);
  const row = buildSearchRow(results);

  const panel = await message.reply({ embeds: [embed], components: [row] });

  searchCache.set(panel.id, {
    results,
    expiry: Date.now() + 5 * 60 * 1000,
    vcId: vc.id,
  });
}

export async function handleMusicButton(interaction: ButtonInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const customId = interaction.customId;

  if (customId.startsWith("music_select_")) {
    const index = parseInt(customId.replace("music_select_", ""), 10);
    const cached = searchCache.get(interaction.message.id);

    if (!cached || Date.now() > cached.expiry) {
      await interaction.reply({
        content: "❌ Esta búsqueda expiró. Usa `Dev play` de nuevo.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const result = cached.results[index];
    if (!result) {
      await interaction.reply({ content: "❌ Resultado inválido.", flags: MessageFlags.Ephemeral });
      return;
    }

    const member = interaction.member as GuildMember | null;
    const vc = member?.voice?.channel as VoiceBasedChannel | null;
    if (!vc) {
      await interaction.reply({
        content: "❌ Debes estar en un canal de voz.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();
    searchCache.delete(interaction.message.id);
    try { await interaction.message.delete(); } catch {}

    const entry: QueueEntry = { ...result, requestedBy: interaction.user.tag };
    let queue = queues.get(guildId);

    if (queue) {
      queue.entries.push(entry);
      const ch = await interaction.client.channels.fetch(queue.textChannelId).catch(() => null);
      if (ch instanceof TextChannel) {
        await ch.send(`✅ **${entry.title}** añadido a la cola — posición **${queue.entries.length}**.`).catch(() => {});
      }
      return;
    }

    const joined = await joinVC(guildId, vc);
    if (!joined) {
      try {
        await interaction.followUp({
          content: "❌ No pude conectarme al canal de voz. Verifica mis permisos.",
          flags: MessageFlags.Ephemeral,
        });
      } catch {}
      return;
    }

    queue = {
      entries: [entry],
      current: 0,
      textChannelId: interaction.channelId,
      paused: false,
    };
    queues.set(guildId, queue);
    await playNext(guildId, interaction.client);
    return;
  }

  const queue = queues.get(guildId);
  const player = players.get(guildId);

  if (customId === "music_toggle_pause") {
    if (!queue || !player) {
      await interaction.reply({ content: "❌ No hay música reproduciéndose.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferUpdate();
    if (queue.paused) {
      player.unpause();
      queue.paused = false;
    } else {
      player.pause();
      queue.paused = true;
    }
    await sendOrUpdateControlPanel(interaction.client, guildId, queue);
    return;
  }

  if (customId === "music_skip") {
    if (!queue) {
      await interaction.reply({ content: "❌ No hay nada en cola.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferUpdate();
    if (queue.current >= queue.entries.length - 1) {
      const p = players.get(guildId);
      p?.stop();
      players.delete(guildId);
      queues.delete(guildId);
      const conn = getVoiceConnection(guildId);
      conn?.destroy();
      try {
        await interaction.message.edit({ content: "⏹️ Era la última canción. Música terminada.", embeds: [], components: [] });
      } catch {}
    } else {
      const skipped = queue.entries[queue.current]!;
      queue.current++;
      players.delete(guildId);
      await playNext(guildId, interaction.client);
      logger.info({ title: skipped.title }, "Canción saltada via botón");
    }
    return;
  }

  if (customId === "music_stop") {
    await interaction.deferUpdate();
    player?.stop();
    const conn = getVoiceConnection(guildId);
    conn?.destroy();
    queues.delete(guildId);
    players.delete(guildId);
    try {
      await interaction.message.edit({ content: "⏹️ Música detenida.", embeds: [], components: [] });
    } catch {}
    return;
  }

  if (customId === "music_list") {
    if (!queue || queue.entries.length === 0) {
      await interaction.reply({ content: "📭 La cola está vacía.", flags: MessageFlags.Ephemeral });
      return;
    }
    const lines = queue.entries.map((e, i) => {
      const prefix = i === queue.current ? "▶️" : `${i + 1}.`;
      return `${prefix} **${e.title}** \`${e.duration}\` — ${e.requestedBy}`;
    });
    const embed = new EmbedBuilder()
      .setTitle("🎵 Cola de música")
      .setColor(0x1db954)
      .setDescription(lines.join("\n").slice(0, 4000))
      .setFooter({ text: `${queue.entries.length} canción(es) en cola` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }
}

export async function cmdStop(message: Message): Promise<void> {
  if (!message.guild) return;
  const guildId = message.guild.id;
  const player = players.get(guildId);
  const conn = getVoiceConnection(guildId);

  if (!player && !conn) {
    await message.reply("❌ No hay música reproduciéndose.");
    return;
  }

  const queue = queues.get(guildId);
  if (queue?.controlMessageId) {
    try {
      const ch = await message.client.channels.fetch(queue.textChannelId).catch(() => null);
      if (ch instanceof TextChannel) {
        const msg = await ch.messages.fetch(queue.controlMessageId).catch(() => null);
        await msg?.edit({ content: "⏹️ Música detenida.", embeds: [], components: [] });
      }
    } catch {}
  }

  player?.stop();
  conn?.destroy();
  queues.delete(guildId);
  players.delete(guildId);
  await message.reply("⏹️ Música detenida y desconectado del canal de voz.");
}

export async function cmdReplay(message: Message): Promise<void> {
  if (!message.guild) return;
  const guildId = message.guild.id;
  const queue = queues.get(guildId);

  if (!queue || queue.entries.length === 0) {
    await message.reply("❌ No hay canción para repetir.");
    return;
  }

  players.delete(guildId);
  await playNext(guildId, message.client);
  await message.reply(`🔁 Repitiendo: **${queue.entries[queue.current]!.title}**`);
}

export async function cmdSkip(message: Message): Promise<void> {
  if (!message.guild) return;
  const guildId = message.guild.id;
  const queue = queues.get(guildId);

  if (!queue || queue.entries.length === 0) {
    await message.reply("❌ No hay nada en cola para saltar.");
    return;
  }

  if (queue.current >= queue.entries.length - 1) {
    players.delete(guildId);
    queues.delete(guildId);
    const conn = getVoiceConnection(guildId);
    conn?.destroy();
    await message.reply("⏭️ Era la última canción. Música detenida.");
    return;
  }

  const skipped = queue.entries[queue.current]!;
  queue.current++;
  players.delete(guildId);
  await playNext(guildId, message.client);
  await message.reply(`⏭️ Saltada: **${skipped.title}**`);
}

export async function cmdList(message: Message): Promise<void> {
  if (!message.guild) return;
  const queue = queues.get(message.guild.id);

  if (!queue || queue.entries.length === 0) {
    await message.reply("📭 La cola está vacía.");
    return;
  }

  const lines = queue.entries.map((e, i) => {
    const prefix = i === queue.current ? "▶️" : `${i + 1}.`;
    return `${prefix} **${e.title}** \`${e.duration}\` — ${e.requestedBy}`;
  });

  const embed = new EmbedBuilder()
    .setTitle("🎵 Cola de música")
    .setColor(0x1db954)
    .setDescription(lines.join("\n").slice(0, 4000))
    .setFooter({ text: `${queue.entries.length} canción(es) en cola` })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
