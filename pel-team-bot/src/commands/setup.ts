import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} from "discord.js";
import { prisma } from "../utils/prisma";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure the bot channels for this team (Captain / Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName("news")
        .setDescription("Channel for team news")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName("fixtures")
        .setDescription("Channel for fixtures & results (#fixtures-and-results)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName("lineups")
        .setDescription("Channel for line-ups")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName("availability")
        .setDescription("Default channel for availability checks")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName("roster")
        .setDescription("Channel that shows the full roster (#roster)")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName("schedule")
        .setDescription("Channel for schedule / events")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId!;
    const news = interaction.options.getChannel("news");
    const fixtures = interaction.options.getChannel("fixtures");
    const lineups = interaction.options.getChannel("lineups");
    const availability = interaction.options.getChannel("availability");
    const roster = interaction.options.getChannel("roster");
    const schedule = interaction.options.getChannel("schedule");

    // Upsert guild record
    const data: any = {};
    if (news) data.newsChannelId = news.id;
    if (fixtures) data.fixturesChannelId = fixtures.id;
    if (lineups) data.lineupChannelId = lineups.id;
    if (availability) data.availabilityChannelId = availability.id;
    if (roster) data.rosterChannelId = roster.id;
    if (schedule) data.scheduleChannelId = schedule.id;

    if (Object.keys(data).length === 0) {
      // Just show current config
      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      if (!guild) {
        return interaction.editReply("This server is not yet configured. Please set at least one channel.");
      }

      const embed = new EmbedBuilder()
        .setTitle("Current Channel Configuration")
        .setColor(0xe85d04)
        .addFields(
          { name: "News", value: guild.newsChannelId ? `<#${guild.newsChannelId}>` : "Not set", inline: true },
          { name: "Fixtures & Results", value: guild.fixturesChannelId ? `<#${guild.fixturesChannelId}>` : "Not set", inline: true },
          { name: "Line-ups", value: guild.lineupChannelId ? `<#${guild.lineupChannelId}>` : "Not set", inline: true },
          { name: "Availability", value: guild.availabilityChannelId ? `<#${guild.availabilityChannelId}>` : "Not set", inline: true },
          { name: "Roster", value: guild.rosterChannelId ? `<#${guild.rosterChannelId}>` : "Not set", inline: true },
          { name: "Schedule", value: guild.scheduleChannelId ? `<#${guild.scheduleChannelId}>` : "Not set", inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    await prisma.guild.upsert({
      where: { id: guildId },
      create: {
        id: guildId,
        teamName: interaction.guild?.name ?? null,
        ...data,
      },
      update: data,
    });

    const embed = new EmbedBuilder()
      .setTitle("✅ Channels Updated")
      .setColor(0x2ecc71)
      .setDescription("The following channels have been configured:")
      .addFields(
        ...(news ? [{ name: "News", value: `<#${news.id}>`, inline: true }] : []),
        ...(fixtures ? [{ name: "Fixtures & Results", value: `<#${fixtures.id}>`, inline: true }] : []),
        ...(lineups ? [{ name: "Line-ups", value: `<#${lineups.id}>`, inline: true }] : []),
        ...(availability ? [{ name: "Availability", value: `<#${availability.id}>`, inline: true }] : []),
        ...(roster ? [{ name: "Roster", value: `<#${roster.id}>`, inline: true }] : []),
        ...(schedule ? [{ name: "Schedule", value: `<#${schedule.id}>`, inline: true }] : [])
      );

    await interaction.editReply({ embeds: [embed] });
  },
};
