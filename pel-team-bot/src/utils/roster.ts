import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { prisma } from "./prisma";

export async function refreshRosterChannel(client: Client, guildId: string) {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
  });

  if (!guild?.rosterChannelId) return;

  const channel = (await client.channels.fetch(guild.rosterChannelId).catch(() => null)) as TextChannel | null;
  if (!channel) return;

  const players = await prisma.rosterPlayer.findMany({
    where: { guildId, isActive: true },
    orderBy: [{ position: "asc" }, { displayName: "asc" }],
  });

  // Group by position for nicer display
  const byPosition: Record<string, typeof players> = {};
  for (const p of players) {
    if (!byPosition[p.position]) byPosition[p.position] = [];
    byPosition[p.position].push(p);
  }

  const positionOrder = ["GK", "CB", "LB", "RB", "LWB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "CF", "ST"];

  let description = "";
  for (const pos of positionOrder) {
    if (byPosition[pos]?.length) {
      description += `**${pos}**\n`;
      for (const p of byPosition[pos]) {
        const flag = p.countryCode ? `:flag_${p.countryCode.toLowerCase()}: ` : "";
        description += `${flag}${p.displayName} • ${p.country}\n`;
      }
      description += "\n";
    }
  }

  // Any remaining positions
  for (const pos of Object.keys(byPosition)) {
    if (!positionOrder.includes(pos)) {
      description += `**${pos}**\n`;
      for (const p of byPosition[pos]) {
        const flag = p.countryCode ? `:flag_${p.countryCode.toLowerCase()}: ` : "";
        description += `${flag}${p.displayName} • ${p.country}\n`;
      }
      description += "\n";
    }
  }

  if (!description) description = "_No players on the roster yet._";

  const embed = new EmbedBuilder()
    .setTitle(`📋 ${guild.teamName ?? "Team"} Roster`)
    .setColor(0xe85d04)
    .setDescription(description)
    .setFooter({ text: `${players.length} active players • Updated` })
    .setTimestamp();

  // Try to edit the last bot message, otherwise send a new one
  const messages = await channel.messages.fetch({ limit: 10 });
  const lastBotMessage = messages.find((m) => m.author.id === client.user?.id && m.embeds.length > 0);

  if (lastBotMessage) {
    await lastBotMessage.edit({ embeds: [embed] });
  } else {
    await channel.send({ embeds: [embed] });
  }
}
