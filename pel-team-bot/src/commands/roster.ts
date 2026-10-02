import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  User,
} from "discord.js";
import { prisma } from "../utils/prisma";
import { refreshRosterChannel } from "../utils/roster";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roster")
    .setDescription("Manage the team roster")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a player to the roster")
        .addUserOption((opt) =>
          opt.setName("player").setDescription("The Discord user").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("position")
            .setDescription("Position (GK, CB, LB, RB, CDM, CM, CAM, LW, RW, ST...)")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("country").setDescription("Country of origin").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("country_code")
            .setDescription("Optional ISO country code for flag (e.g. BR, SE, US)")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a player from the roster")
        .addUserOption((opt) =>
          opt.setName("player").setDescription("The Discord user").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Show the current roster")
    )
    .addSubcommand((sub) =>
      sub.setName("refresh").setDescription("Force refresh the #roster channel")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    // Ensure guild exists
    await prisma.guild.upsert({
      where: { id: guildId },
      create: { id: guildId, teamName: interaction.guild?.name },
      update: {},
    });

    if (sub === "add") {
      await interaction.deferReply({ ephemeral: true });

      const user = interaction.options.getUser("player", true);
      const position = interaction.options.getString("position", true).toUpperCase();
      const country = interaction.options.getString("country", true);
      const countryCode = interaction.options.getString("country_code")?.toUpperCase() ?? null;

      await prisma.rosterPlayer.upsert({
        where: {
          guildId_discordId: {
            guildId,
            discordId: user.id,
          },
        },
        create: {
          guildId,
          discordId: user.id,
          displayName: user.displayName || user.username,
          position,
          country,
          countryCode,
          isActive: true,
        },
        update: {
          displayName: user.displayName || user.username,
          position,
          country,
          countryCode,
          isActive: true,
        },
      });

      await refreshRosterChannel(interaction.client, guildId);

      await interaction.editReply({
        content: `✅ **${user.displayName || user.username}** added to the roster as **${position}** (${country})`,
      });
    }

    if (sub === "remove") {
      await interaction.deferReply({ ephemeral: true });

      const user = interaction.options.getUser("player", true);

      await prisma.rosterPlayer.updateMany({
        where: { guildId, discordId: user.id },
        data: { isActive: false },
      });

      await refreshRosterChannel(interaction.client, guildId);

      await interaction.editReply({
        content: `✅ **${user.displayName || user.username}** has been removed from the roster.`,
      });
    }

    if (sub === "list") {
      await interaction.deferReply();

      const players = await prisma.rosterPlayer.findMany({
        where: { guildId, isActive: true },
        orderBy: [{ position: "asc" }, { displayName: "asc" }],
      });

      if (players.length === 0) {
        return interaction.editReply("The roster is currently empty.");
      }

      const embed = new EmbedBuilder()
        .setTitle(`${interaction.guild?.name ?? "Team"} Roster`)
        .setColor(0xe85d04)
        .setDescription(
          players
            .map((p) => {
              const flag = p.countryCode ? `:flag_${p.countryCode.toLowerCase()}: ` : "";
              return `${flag}**${p.displayName}** — \`${p.position}\` • ${p.country}`;
            })
            .join("\n")
        )
        .setFooter({ text: `${players.length} players` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

    if (sub === "refresh") {
      await interaction.deferReply({ ephemeral: true });
      await refreshRosterChannel(interaction.client, guildId);
      await interaction.editReply("✅ Roster channel refreshed.");
    }
  },
};
