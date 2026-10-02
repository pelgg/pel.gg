import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { prisma } from "../utils/prisma";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link this Discord server to a PEL team (Captain only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName("team_name")
        .setDescription("Official team name on PEL")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const teamName = interaction.options.getString("team_name", true);
    const guildId = interaction.guildId!;

    await prisma.guild.upsert({
      where: { id: guildId },
      create: {
        id: guildId,
        teamName,
        captainUserId: interaction.user.id,
      },
      update: {
        teamName,
        captainUserId: interaction.user.id,
      },
    });

    const embed = new EmbedBuilder()
      .setTitle("✅ Server Linked")
      .setColor(0x2ecc71)
      .setDescription(
        `This Discord server is now linked to **${teamName}**.\n\n` +
          `Captain: <@${interaction.user.id}>\n` +
          `Guild ID: \`${guildId}\`\n\n` +
          `Use this Guild ID on the PEL website captain panel to manage the bot.`
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
