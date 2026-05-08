import { Message, PermissionFlagsBits, TextChannel, OverwriteType } from "discord.js";

interface SavedOverwrite {
  id: string;
  type: OverwriteType;
  allow: bigint;
  deny: bigint;
}

const lockStore = new Map<string, SavedOverwrite[]>();

export async function cmdLock(message: Message): Promise<void> {
  if (!message.guild) return;

  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Solo los **administradores** pueden bloquear canales.");
    return;
  }

  const channel = message.channel as TextChannel;

  if (lockStore.has(channel.id)) {
    await message.reply("⚠️ Este canal ya está bloqueado. Usa `Dev unlock` para desbloquearlo.");
    return;
  }

  const overwrites = [...channel.permissionOverwrites.cache.values()];
  lockStore.set(channel.id, overwrites.map(o => ({
    id: o.id,
    type: o.type,
    allow: o.allow.bitfield,
    deny: o.deny.bitfield,
  })));

  await channel.permissionOverwrites.set([
    {
      id: message.guild.roles.everyone.id,
      type: OverwriteType.Role,
      deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
    },
  ]);

  await message.reply("🔒 Canal **bloqueado**. Solo administradores pueden verlo y escribir en él.");
}

export async function cmdUnlock(message: Message): Promise<void> {
  if (!message.guild) return;

  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ Solo los **administradores** pueden desbloquear canales.");
    return;
  }

  const channel = message.channel as TextChannel;
  const saved = lockStore.get(channel.id);

  if (!saved) {
    await message.reply("⚠️ No hay configuración guardada para este canal. Puede que no fue bloqueado con `Dev lock`.");
    return;
  }

  if (saved.length === 0) {
    await channel.permissionOverwrites.set([]);
  } else {
    await channel.permissionOverwrites.set(
      saved.map(o => ({
        id: o.id,
        type: o.type,
        allow: o.allow,
        deny: o.deny,
      }))
    );
  }

  lockStore.delete(channel.id);
  await message.reply("🔓 Canal **desbloqueado** y restaurado a su configuración anterior.");
}
