import {
  Message,
  EmbedBuilder,
  VoiceBasedChannel,
  GuildMember,
  TextChannel,
} from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
  entersState,
} from "@discordjs/voice";
import playdl from "play-dl";
import { logger } from "../../lib/logger";

interface QueueEntry {
  title: string;
  url: string;
  duration: string;
  requestedBy: string;
}

interface GuildQueue {
  entries: QueueEntry[];
  current: number;
  textChannelId: string;
}

const queues = new Map<string, GuildQueue>();
const players = new Map<string, ReturnType<typeof createAudioPlayer>>();

async function searchYT(query: string): Promise<{ title: string; url: string; duration: string } | null> {
  try {
    const results = await playdl.search(query, { source: { youtube: "video" }, limit: 1 });
    const v = results[0];
    if (!v) return null;
    const dur = v.durationInSec ?? 0;
    const mins = Math.floor(dur / 60);
    const secs = dur % 60;
    return {
      title: v.title ?? "Sin título",
      url: v.url,
      duration: `${mins}:${secs.toString().padStart(2, "0")}`,
    };
  } catch (err) {
    logger.warn({ err }, "Error buscando en play-dl");
    return null;
  }
}

async function playNext(guildId: string, client: Message["client"]): Promise<void> {
  const queue = queues.get(guildId);
  if (!queue) return;

  if (queue.current >= queue.entries.length) {
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
      player = createAudioPlayer();
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
        logger.warn({ err }, "Error en audio player");
        const q = queues.get(guildId);
        if (q) {
          q.current++;
          playNext(guildId, client).catch(() => {});
        }
      });
    }

    player.play(resource);

    const textChannel = await client.channels.fetch(queue.textChannelId).catch(() => null);
    if (textChannel instanceof TextChannel) {
      const embed = new EmbedBuilder()
        .setTitle("▶️ Reproduciendo ahora")
        .setColor(0x1db954)
        .setDescription(`**[${entry.title}](${entry.url})**`)
        .addFields(
          { name: "⏱️ Duración", value: entry.duration, inline: true },
          { name: "👤 Pedido por", value: entry.requestedBy, inline: true },
          { name: "📋 En cola", value: `${queue.current + 1}/${queue.entries.length}`, inline: true }
        )
        .setTimestamp();
      await textChannel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) {
    logger.warn({ err, entry }, "Error reproduciendo canción");
    queue.current++;
    await playNext(guildId, client);
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
    await message.reply("❌ Debes estar en un canal de voz.");
    return;
  }

  if ("sendTyping" in message.channel) {
    await (message.channel as TextChannel).sendTyping().catch(() => {});
  }

  const result = await searchYT(query);
  if (!result) {
    await message.reply(`📭 No encontré la canción \`${query}\`.`);
    return;
  }

  const guildId = message.guild.id;

  let conn = getVoiceConnection(guildId);
  if (!conn) {
    conn = joinVoiceChannel({
      channelId: vc.id,
      guildId,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    try {
      await entersState(conn, VoiceConnectionStatus.Ready, 10_000);
    } catch {
      conn.destroy();
      await message.reply("❌ No pude conectarme al canal de voz.");
      return;
    }
  }

  const entry: QueueEntry = {
    title: result.title,
    url: result.url,
    duration: result.duration,
    requestedBy: message.author.tag,
  };

  let queue = queues.get(guildId);
  const wasPlaying = !!queue;

  if (!queue) {
    queue = { entries: [entry], current: 0, textChannelId: message.channel.id };
    queues.set(guildId, queue);
    await playNext(guildId, message.client);
  } else {
    queue.entries.push(entry);
    await message.reply(`✅ Añadido a la cola: **${result.title}** (posición ${queue.entries.length})`);
    return;
  }

  if (!wasPlaying) {
    await message.reply(`▶️ Reproduciendo: **${result.title}**`);
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

  player?.stop();
  conn?.destroy();
  queues.delete(guildId);
  players.delete(guildId);

  await message.reply("⏹️ Música detenida y desconectado del VC.");
}

export async function cmdReplay(message: Message): Promise<void> {
  if (!message.guild) return;

  const guildId = message.guild.id;
  const queue = queues.get(guildId);

  if (!queue || queue.entries.length === 0) {
    await message.reply("❌ No hay canción para repetir.");
    return;
  }

  if (queue.current > 0) queue.current--;
  players.delete(guildId);

  await playNext(guildId, message.client);
  await message.reply(`🔁 Repitiendo: **${queue.entries[queue.current]!.title}**`);
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
