import {
  Client,
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
import { Player, useQueue, GuildQueue, Track } from "discord-player";
import { DefaultExtractors } from "@discord-player/extractor";
import { logger } from "../../lib/logger";

interface QueueMeta {
  channel: TextChannel;
  controlMessageId: string | null;
}

interface CachedSearch {
  tracks: Track[];
  expiry: number;
}

let _player: Player | null = null;
const searchCache = new Map<string, CachedSearch>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of searchCache) {
    if (v.expiry < now) searchCache.delete(k);
  }
}, 5 * 60 * 1000);

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function buildSearchEmbed(tracks: Track[], query: string): EmbedBuilder {
  const lines = tracks.map(
    (t, i) => `**${i + 1}.** [${t.title}](${t.url})\n> ⏱️ ${t.duration} · 📺 ${t.author}`
  );
  const embed = new EmbedBuilder()
    .setTitle("🔎 Resultados de búsqueda")
    .setColor(0xff0000)
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: `"${truncate(query, 60)}" · Selecciona un resultado · Expira en 5 min` })
    .setTimestamp();
  if (tracks[0]?.thumbnail) embed.setThumbnail(tracks[0].thumbnail);
  return embed;
}

function buildSearchRow(tracks: Track[]): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();
  tracks.forEach((t, i) => {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`music_select_${i}`)
        .setLabel(`${i + 1}. ${truncate(t.title, 60)}`)
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

function buildNowPlayingEmbed(track: Track, queue: GuildQueue<QueueMeta>): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle("▶️ Reproduciendo ahora")
    .setColor(0x1db954)
    .setDescription(`**[${track.title}](${track.url})**`)
    .addFields(
      { name: "⏱️ Duración", value: track.duration || "En vivo", inline: true },
      { name: "👤 Pedido por", value: track.requestedBy?.tag ?? "Desconocido", inline: true },
      { name: "📋 En espera", value: `${queue.tracks.size} canción(es)`, inline: true },
      { name: "📺 Canal", value: track.author || "Desconocido", inline: true },
    )
    .setTimestamp();
  if (track.thumbnail) embed.setImage(track.thumbnail);
  return embed;
}

export function initMusicPlayer(client: Client): void {
  _player = new Player(client, {
    skipFFmpeg: false,
  });

  void _player.extractors.loadMulti(DefaultExtractors);

  _player.events.on("playerStart", async (queue, track) => {
    const meta = (queue as GuildQueue<QueueMeta>).metadata;
    if (!meta?.channel) return;

    const embed = buildNowPlayingEmbed(track as Track, queue as GuildQueue<QueueMeta>);
    const row = buildControlRow(false);

    try {
      if (meta.controlMessageId) {
        const msg = await meta.channel.messages.fetch(meta.controlMessageId).catch(() => null);
        if (msg) {
          await msg.edit({ embeds: [embed], components: [row] });
          return;
        }
      }
      const msg = await meta.channel.send({ embeds: [embed], components: [row] });
      meta.controlMessageId = msg.id;
    } catch (err) {
      logger.warn({ err }, "Error actualizando panel de música");
    }
  });

  _player.events.on("emptyQueue", async (queue) => {
    const meta = (queue as GuildQueue<QueueMeta>).metadata;
    if (!meta?.channel || !meta.controlMessageId) return;
    try {
      const msg = await meta.channel.messages.fetch(meta.controlMessageId).catch(() => null);
      await msg?.edit({
        embeds: [
          new EmbedBuilder()
            .setTitle("⏹️ Cola terminada")
            .setColor(0x99aab5)
            .setDescription("No hay más canciones. Usa `Dev play` para añadir más.")
            .setTimestamp(),
        ],
        components: [],
      });
    } catch {}
  });

  _player.events.on("disconnect", async (queue) => {
    const meta = (queue as GuildQueue<QueueMeta>).metadata;
    if (!meta?.controlMessageId) return;
    try {
      const msg = await meta.channel.messages.fetch(meta.controlMessageId).catch(() => null);
      await msg?.edit({ content: "⏹️ Desconectado del canal de voz.", embeds: [], components: [] });
    } catch {}
  });

  _player.events.on("playerError", (_q, error) => {
    logger.warn({ err: error.message }, "Error en stream de música");
  });

  _player.events.on("error", (_q, error) => {
    logger.warn({ err: error.message }, "Error general del player");
  });

  logger.info("Sistema de música (discord-player v7) inicializado");
}

export async function cmdPlay(message: Message, args: string[]): Promise<void> {
  if (!message.guild) return;

  const p = _player;
  if (!p) {
    await message.reply("❌ El sistema de música no está inicializado. Reinicia el bot.");
    return;
  }

  const query = args.join(" ").trim();
  if (!query) {
    await message.reply("❌ Uso: `Dev play <nombre de la canción o URL de YouTube>`");
    return;
  }

  const member = message.member as GuildMember | null;
  const vc = member?.voice.channel as VoiceBasedChannel | null;
  if (!vc) {
    await message.reply("❌ Debes estar en un canal de voz para usar este comando.");
    return;
  }

  await (message.channel as TextChannel).sendTyping().catch(() => {});

  let tracks: Track[];
  try {
    const result = await p.search(query, { requestedBy: message.author });
    if (!result.hasTracks()) {
      await message.reply(`📭 No encontré resultados para \`${query}\`.`);
      return;
    }
    tracks = result.tracks.slice(0, 3);
  } catch (err) {
    logger.warn({ err, query }, "Error buscando música");
    await message.reply("❌ No pude buscar esa canción. Inténtalo de nuevo.");
    return;
  }

  const embed = buildSearchEmbed(tracks, query);
  const row = buildSearchRow(tracks);
  const panel = await message.reply({ embeds: [embed], components: [row] });

  searchCache.set(panel.id, { tracks, expiry: Date.now() + 5 * 60 * 1000 });
}

export async function handleMusicButton(interaction: ButtonInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) return;

  const p = _player;
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

    const track = cached.tracks[index];
    if (!track) {
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

    if (!p) {
      await interaction.reply({ content: "❌ Player no disponible.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferUpdate();
    searchCache.delete(interaction.message.id);
    try { await interaction.message.delete(); } catch {}

    const textChannel = interaction.channel as TextChannel;
    const existingQueue = useQueue<QueueMeta>(guildId);

    if (existingQueue) {
      existingQueue.addTrack(track);
      const pos = existingQueue.tracks.size;
      await textChannel
        .send(`✅ **${track.title}** añadido a la cola — posición **${pos}**.`)
        .catch(() => {});
      return;
    }

    try {
      await p.play(vc, track, {
        nodeOptions: {
          metadata: { channel: textChannel, controlMessageId: null } satisfies QueueMeta,
          selfDeaf: true,
          volume: 80,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 5000,
          leaveOnEnd: false,
          skipOnNoStream: true,
        },
      });
    } catch (err) {
      logger.warn({ err }, "Error iniciando reproducción");
      await textChannel
        .send("❌ No pude reproducir esa canción. Verifica mis permisos en el canal de voz.")
        .catch(() => {});
    }
    return;
  }

  const queue = useQueue<QueueMeta>(guildId);

  if (customId === "music_toggle_pause") {
    if (!queue) {
      await interaction.reply({ content: "❌ No hay música reproduciéndose.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferUpdate();
    const wasPaused = queue.node.isPaused();
    wasPaused ? queue.node.resume() : queue.node.pause();

    const meta = queue.metadata;
    if (meta?.controlMessageId && queue.currentTrack) {
      try {
        const msg = await meta.channel.messages.fetch(meta.controlMessageId).catch(() => null);
        await msg?.edit({
          embeds: [buildNowPlayingEmbed(queue.currentTrack, queue)],
          components: [buildControlRow(!wasPaused)],
        });
      } catch {}
    }
    return;
  }

  if (customId === "music_skip") {
    if (!queue) {
      await interaction.reply({ content: "❌ No hay música reproduciéndose.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferUpdate();
    queue.node.skip();
    return;
  }

  if (customId === "music_stop") {
    await interaction.deferUpdate();
    const meta = queue?.metadata;
    queue?.delete();
    if (meta?.controlMessageId) {
      try {
        const msg = await meta.channel.messages.fetch(meta.controlMessageId).catch(() => null);
        await msg?.edit({ content: "⏹️ Música detenida.", embeds: [], components: [] });
      } catch {}
    }
    return;
  }

  if (customId === "music_list") {
    if (!queue) {
      await interaction.reply({ content: "📭 No hay música reproduciéndose.", flags: MessageFlags.Ephemeral });
      return;
    }
    const upcoming = queue.tracks.toArray();
    const lines: string[] = [];
    if (queue.currentTrack) {
      lines.push(`▶️ **${queue.currentTrack.title}** \`${queue.currentTrack.duration}\` — reproduciendo`);
    }
    upcoming.forEach((t, i) => {
      lines.push(`${i + 1}. **${t.title}** \`${t.duration}\` — ${t.requestedBy?.tag ?? "?"}`);
    });

    const embed = new EmbedBuilder()
      .setTitle("🎵 Cola de música")
      .setColor(0x1db954)
      .setDescription((lines.join("\n") || "Cola vacía").slice(0, 4000))
      .setFooter({ text: `${upcoming.length} canción(es) en espera` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }
}

export async function cmdStop(message: Message): Promise<void> {
  if (!message.guild) return;
  const queue = useQueue<QueueMeta>(message.guild.id);
  if (!queue) {
    await message.reply("❌ No hay música reproduciéndose.");
    return;
  }
  const meta = queue.metadata;
  queue.delete();
  if (meta?.controlMessageId) {
    try {
      const msg = await meta.channel.messages.fetch(meta.controlMessageId).catch(() => null);
      await msg?.edit({ content: "⏹️ Música detenida.", embeds: [], components: [] });
    } catch {}
  }
  await message.reply("⏹️ Música detenida.");
}

export async function cmdSkip(message: Message): Promise<void> {
  if (!message.guild) return;
  const queue = useQueue(message.guild.id);
  if (!queue) {
    await message.reply("❌ No hay música reproduciéndose.");
    return;
  }
  queue.node.skip();
  await message.reply("⏭️ Canción saltada.");
}

export async function cmdReplay(message: Message): Promise<void> {
  if (!message.guild) return;
  const queue = useQueue(message.guild.id);
  if (!queue || !queue.currentTrack) {
    await message.reply("❌ No hay canción para repetir.");
    return;
  }
  await queue.node.seek(0);
  await message.reply(`🔁 Repitiendo desde el inicio: **${queue.currentTrack.title}**`);
}

export async function cmdList(message: Message): Promise<void> {
  if (!message.guild) return;
  const queue = useQueue(message.guild.id);
  if (!queue) {
    await message.reply("📭 No hay música reproduciéndose.");
    return;
  }
  const upcoming = queue.tracks.toArray();
  const lines: string[] = [];
  if (queue.currentTrack) {
    lines.push(`▶️ **${queue.currentTrack.title}** \`${queue.currentTrack.duration}\` — reproduciendo`);
  }
  upcoming.forEach((t, i) => {
    lines.push(`${i + 1}. **${t.title}** \`${t.duration}\` — ${t.requestedBy?.tag ?? "?"}`);
  });

  const embed = new EmbedBuilder()
    .setTitle("🎵 Cola de música")
    .setColor(0x1db954)
    .setDescription((lines.join("\n") || "Cola vacía").slice(0, 4000))
    .setFooter({ text: `${upcoming.length} canción(es) en espera` })
    .setTimestamp();
  await message.reply({ embeds: [embed] });
}
