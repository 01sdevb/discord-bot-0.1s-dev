import {
  Message,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  ChannelType,
  ButtonInteraction,
  GuildMember,
} from "discord.js";
import { randomUUID } from "crypto";
import {
  savePanel,
  getPanel,
  openTicket,
  getTicket,
  closeTicket,
  deleteTicket,
  getUserOpenTicket,
} from "../ticketStore";
import { modLog } from "../modLogger";

async function ask(
  channel: TextChannel,
  userId: string,
  question: string,
  timeoutMs = 60000,
): Promise<string | null> {
  await channel.send(question);
  const collected = await channel
    .awaitMessages({
      filter: (m) => m.author.id === userId && !m.author.bot,
      max: 1,
      time: timeoutMs,
      errors: ["time"],
    })
    .catch(() => null);
  return collected?.first()?.content ?? null;
}

export async function cmdTicketpa(message: Message): Promise<void> {
  if (!message.guild) return;

  const executor = message.member;
  if (!executor?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Solo los **administradores** pueden crear paneles de tickets.");
    return;
  }

  const guild = message.guild;
  const setupChannel = message.channel as TextChannel;
  const userId = message.author.id;

  await message.reply("🎫 **Configurando panel de tickets** — Responde cada pregunta en 60 segundos.");

  const channelAnswer = await ask(setupChannel, userId, "📌 **1/6** — ¿En qué canal va el panel? Menciona el canal.");
  if (!channelAnswer) { await setupChannel.send("⏰ Tiempo agotado. Cancelado."); return; }

  const channelId = channelAnswer.match(/<#(\d+)>/)?.[1] ?? channelAnswer.trim();
  const panelChannel = guild.channels.cache.get(channelId) as TextChannel | undefined;
  if (!panelChannel || panelChannel.type !== ChannelType.GuildText) {
    await setupChannel.send("❌ Canal inválido. Cancelado.");
    return;
  }

  const createRoleAnswer = await ask(setupChannel, userId, "👥 **2/6** — ¿Qué rol puede **abrir** tickets? Menciona el rol o escribe `todos`.");
  if (!createRoleAnswer) { await setupChannel.send("⏰ Tiempo agotado."); return; }
  const createRoleId =
    createRoleAnswer.toLowerCase() === "todos"
      ? null
      : (createRoleAnswer.match(/<@&(\d+)>/)?.[1] ?? createRoleAnswer.trim());

  const staffAnswer = await ask(setupChannel, userId, "🛡️ **3/6** — ¿Qué roles pueden **ver y cerrar** tickets? Menciona los roles separados por espacios.");
  if (!staffAnswer) { await setupChannel.send("⏰ Tiempo agotado."); return; }
  const staffRoleIds = [...staffAnswer.matchAll(/<@&(\d+)>/g)].map((m) => m[1]!);
  if (staffRoleIds.length === 0 && staffAnswer.trim().match(/^\d+$/)) staffRoleIds.push(staffAnswer.trim());

  const titleAnswer = await ask(setupChannel, userId, "📝 **4/6** — ¿Cuál es el **título** del panel?");
  if (!titleAnswer) { await setupChannel.send("⏰ Tiempo agotado."); return; }

  const descAnswer = await ask(setupChannel, userId, "💬 **5/6** — ¿Cuál es el **texto/descripción** del panel?");
  if (!descAnswer) { await setupChannel.send("⏰ Tiempo agotado."); return; }

  const imageAnswer = await ask(setupChannel, userId, "🖼️ **6/6** — URL de **imagen** para el panel. Escribe `no` para omitir.");
  if (!imageAnswer) { await setupChannel.send("⏰ Tiempo agotado."); return; }
  const imageUrl = imageAnswer.toLowerCase() === "no" ? null : imageAnswer.trim();

  const panelId = randomUUID();

  const embed = new EmbedBuilder()
    .setTitle(titleAnswer)
    .setDescription(descAnswer)
    .setColor(0x5865f2)
    .setFooter({ text: "Haz clic en el botón para abrir un ticket" })
    .setTimestamp();

  if (imageUrl) embed.setImage(imageUrl);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticketCreate_${panelId}`)
      .setLabel("🎫 Abrir Ticket")
      .setStyle(ButtonStyle.Primary),
  );

  const panelMsg = await panelChannel.send({ embeds: [embed], components: [row] });

  savePanel({
    panelId,
    guildId: guild.id,
    channelId: panelChannel.id,
    messageId: panelMsg.id,
    createRoleId,
    staffRoleIds,
    title: titleAnswer,
    description: descAnswer,
    imageUrl,
    categoryId: panelChannel.parentId,
  });

  await setupChannel.send(
    `✅ **Panel creado** en <#${panelChannel.id}>!\n` +
    `> Título: **${titleAnswer}**\n` +
    `> Staff: ${staffRoleIds.map((r) => `<@&${r}>`).join(", ") || "No configurado"}`,
  );
}

export async function handleTicketCreate(interaction: ButtonInteraction): Promise<void> {
  const panelId = interaction.customId.replace("ticketCreate_", "");
  const panel = getPanel(panelId);
  if (!panel) { await interaction.reply({ content: "❌ Panel no encontrado.", ephemeral: true }); return; }

  const guild = interaction.guild!;
  const member = interaction.member as GuildMember;

  if (panel.createRoleId) {
    if (!member.roles.cache.has(panel.createRoleId)) {
      await interaction.reply({ content: `❌ Necesitas el rol <@&${panel.createRoleId}> para abrir un ticket.`, ephemeral: true });
      return;
    }
  }

  const existing = getUserOpenTicket(guild.id, member.id, panelId);
  if (existing) {
    await interaction.reply({ content: `❌ Ya tienes un ticket abierto: <#${existing.ticketChannelId}>`, ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const overwrites: any[] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: guild.members.me!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
  ];
  for (const roleId of panel.staffRoleIds) {
    overwrites.push({
      id: roleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
    });
  }

  const ticketChannel = await guild.channels.create({
    name: `ticket-${member.user.username}`,
    type: ChannelType.GuildText,
    parent: panel.categoryId ?? undefined,
    permissionOverwrites: overwrites,
    topic: `Ticket de ${member.user.tag} | Panel: ${panel.title}`,
  });

  openTicket({
    ticketChannelId: ticketChannel.id,
    guildId: guild.id,
    userId: member.id,
    panelId,
    status: "open",
    createdAt: Date.now(),
  });

  const ticketEmbed = new EmbedBuilder()
    .setTitle(`🎫 ${panel.title}`)
    .setDescription(
      `Hola ${member}, bienvenido a tu ticket.\n\n` +
      `${panel.description}\n\n` +
      `> ⏳ *Nadie ha respondido aún — por favor espera pacientemente al staff.*`,
    )
    .setColor(0x00b0f4)
    .setFooter({ text: `Ticket de ${member.user.tag}` })
    .setTimestamp();

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticketClose_${ticketChannel.id}`)
      .setLabel("🔒 Cerrar Ticket")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticketDelete_${ticketChannel.id}`)
      .setLabel("🗑️ Eliminar Ticket")
      .setStyle(ButtonStyle.Danger),
  );

  await ticketChannel.send({ embeds: [ticketEmbed], components: [closeRow] });
  await interaction.editReply({ content: `✅ Ticket creado: <#${ticketChannel.id}>` });

  await modLog({
    type: "ticketOpen",
    guildId: guild.id,
    target: { id: member.id, tag: member.user.tag, avatarUrl: member.user.displayAvatarURL() },
    extra: { "Panel": panel.title, "Canal": `<#${ticketChannel.id}>` },
  });
}

export async function handleTicketClose(interaction: ButtonInteraction): Promise<void> {
  const channelId = interaction.customId.replace("ticketClose_", "");
  const ticket = getTicket(channelId);
  const panel = ticket ? getPanel(ticket.panelId) : undefined;
  const member = interaction.member as GuildMember;

  const canClose =
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    (panel?.staffRoleIds.some((r) => member.roles.cache.has(r)) ?? false) ||
    ticket?.userId === member.id;

  if (!canClose) {
    await interaction.reply({ content: "❌ No tienes permiso para cerrar este ticket.", ephemeral: true });
    return;
  }

  closeTicket(channelId);

  const closedEmbed = new EmbedBuilder()
    .setTitle("🔒 Ticket Cerrado")
    .setDescription(`Cerrado por **${member.user.tag}**\nEliminando en 5 segundos...`)
    .setColor(0xff0000)
    .setTimestamp();

  await interaction.reply({ embeds: [closedEmbed] });

  if (ticket) {
    await modLog({
      type: "ticketClose",
      guildId: interaction.guild!.id,
      target: { id: ticket.userId, tag: ticket.userId },
      moderator: { id: member.id, tag: member.user.tag },
      extra: { "Panel": panel?.title ?? "Desconocido" },
    });
  }

  setTimeout(async () => {
    try { deleteTicket(channelId); await (interaction.channel as TextChannel).delete("Ticket cerrado"); } catch {}
  }, 5000);
}

export async function handleTicketDelete(interaction: ButtonInteraction): Promise<void> {
  const channelId = interaction.customId.replace("ticketDelete_", "");
  const ticket = getTicket(channelId);
  const panel = ticket ? getPanel(ticket.panelId) : undefined;
  const member = interaction.member as GuildMember;

  const canDelete =
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    (panel?.staffRoleIds.some((r) => member.roles.cache.has(r)) ?? false);

  if (!canDelete) {
    await interaction.reply({ content: "❌ Solo el staff puede eliminar tickets.", ephemeral: true });
    return;
  }

  await interaction.reply({ content: "🗑️ Eliminando ticket..." });

  if (ticket) {
    await modLog({
      type: "ticketDelete",
      guildId: interaction.guild!.id,
      target: { id: ticket.userId, tag: ticket.userId },
      moderator: { id: member.id, tag: member.user.tag },
      extra: { "Panel": panel?.title ?? "Desconocido" },
    });
  }

  deleteTicket(channelId);
  setTimeout(async () => {
    try { await (interaction.channel as TextChannel).delete("Ticket eliminado por staff"); } catch {}
  }, 2000);
}
