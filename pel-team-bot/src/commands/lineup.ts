import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { prisma } from "../utils/prisma";
module.exports = {
  data: new SlashCommandBuilder()
    .setName("lineup")
    .setDescription("Post a team line-up")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((opt) =>
      opt
        .setName("title")
        .setDescription("Title (e.g. vs Team X - League Matchday 5)")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("players")
        .setDescription(
          "Players in order (comma separated). Example: GK:Alex, CB:John, CB:Mike, ..."
        )
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("formation")
        .setDescription("Formation (e.g. 4-3-3, 4-2-3-1)")
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId!;
    const title = interaction.options.getString("title", true);
    const formation = interaction.options.getString("formation");
    const playersRaw = interaction.options.getString("players", true);

    const players = playersRaw.split(",").map((p) => {
      const [position, ...nameParts] = p.trim().split(":");
      return {
        position: (position || "").trim().toUpperCase(),
        name: nameParts.join(":").trim() || position.trim(),
      };
    });

    const guild = await prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild?.lineupChannelId) {
      return interaction.editReply(
        "Line-up channel is not configured. Use `/setup` first."
      );
    }

    const channel = (await interaction.client.channels
      .fetch(guild.lineupChannelId)
      .catch(() => null)) as TextChannel | null;

    if (!channel) {
      return interaction.editReply("Could not access the line-up channel.");
    }

    let description = formation ? `**Formation: ${formation}**\n\n` : "";

    const positionOrder = [
      "GK", "CB", "LB", "RB", "LWB", "RWB", "CDM", "CM",
      "CAM", "LM", "RM", "LW", "RW", "CF", "ST",
    ];

    const byPos: Record<string, string[]> = {};
    for (const p of players) {
      if (!byPos[p.position]) byPos[p.position] = [];
      byPos[p.position].push(p.name);
    }

    for (const pos of positionOrder) {
      if (byPos[pos]) {
        description += `**${pos}**: ${byPos[pos].join(", ")}\n`;
      }
    }

    for (const pos of Object.keys(byPos)) {
      if (!positionOrder.includes(pos)) {
        description += `**${pos}**: ${byPos[pos].join(", ")}\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 Line-up: ${title}`)
      .setDescription(description)
      .setColor(0x9b59b6)
      .setFooter({ text: `Posted by ${interaction.user.displayName}` })
      .setTimestamp();

    const message = await channel.send({ embeds: [embed] });
    await prisma.lineup.create({
      data: {
        guildId,
        title,
        formation,
        players,
        messageId: message.id,
        createdBy: interaction.user.id,
      },
    });

    await interaction.editReply(`✅ Line-up posted in ${channel}.`);
  },
};
