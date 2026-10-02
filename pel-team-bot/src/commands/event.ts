import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  EmbedBuilder,
} from "discord.js";
import { prisma } from "../utils/prisma";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("event")
    .setDescription("Create a Discord Scheduled Event for the team")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addStringOption((opt) =>
      opt.setName("title").setDescription("Event title").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("start")
        .setDescription("Start time (ISO or YYYY-MM-DD HH:mm)")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("end")
        .setDescription("End time (ISO or YYYY-MM-DD HH:mm)")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("description").setDescription("Event description").setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName("location")
        .setDescription("Location / Voice channel name or external link")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const title = interaction.options.getString("title", true);
    const startRaw = interaction.options.getString("start", true);
    const endRaw = interaction.options.getString("end", true);
    const description = interaction.options.getString("description") || undefined;
    const location = interaction.options.getString("location") || "EA FC Pro Clubs";

    const start = new Date(startRaw);
    const end = new Date(endRaw);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return interaction.editReply("Invalid date format. Use ISO or YYYY-MM-DD HH:mm");
    }

    if (end <= start) {
      return interaction.editReply("End time must be after start time.");
    }

    try {
      const scheduledEvent = await interaction.guild!.scheduledEvents.create({
        name: title,
        scheduledStartTime: start,
        scheduledEndTime: end,
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
        entityType: GuildScheduledEventEntityType.External,
        description,
        entityMetadata: { location },
      });

      // Also post a nice embed in the schedule channel if configured
      const guild = await prisma.guild.findUnique({
        where: { id: interaction.guildId! },
      });

      if (guild?.scheduleChannelId) {
        const channel = await interaction.client.channels
          .fetch(guild.scheduleChannelId)
          .catch(() => null);

        if (channel && channel.isSendable()) {
          const embed = new EmbedBuilder()
            .setTitle(`📅 ${title}`)
            .setDescription(description || "New team event created.")
            .setColor(0xe85d04)
            .addFields(
              {
                name: "Starts",
                value: `<t:${Math.floor(start.getTime() / 1000)}:F>`,
                inline: true,
              },
              {
                name: "Ends",
                value: `<t:${Math.floor(end.getTime() / 1000)}:F>`,
                inline: true,
              },
              { name: "Location", value: location }
            )
            .setFooter({ text: "Click the event in the server sidebar to RSVP" })
            .setTimestamp();

          await channel.send({ embeds: [embed] });
        }
      }

      await interaction.editReply(
        `✅ Discord Scheduled Event created!\nMembers can now RSVP directly on the event.\nEvent ID: \`${scheduledEvent.id}\``
      );
    } catch (error: any) {
      console.error("Failed to create scheduled event:", error);
      await interaction.editReply(
        `Failed to create event: ${error.message || "Unknown error"}`
      );
    }
  },
};
