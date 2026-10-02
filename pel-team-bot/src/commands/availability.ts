import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { prisma } from "../utils/prisma";
import { createAvailabilityButtons } from "../utils/availability";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("availability")
    .setDescription("Create or manage availability checks")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Send a new availability check")
        .addStringOption((opt) =>
          opt.setName("title").setDescription("Title of the check").setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("description").setDescription("Extra info").setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("event_date")
            .setDescription("When the event is (ISO or YYYY-MM-DD HH:mm)")
            .setRequired(false)
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Override the default availability channel")
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("results")
        .setDescription("See who responded to a check")
        .addStringOption((opt) =>
          opt
            .setName("check_id")
            .setDescription("The availability check ID")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List recent availability checks")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === "create") {
      await interaction.deferReply({ ephemeral: true });

      const title = interaction.options.getString("title", true);
      const description = interaction.options.getString("description");
      const eventDateRaw = interaction.options.getString("event_date");
      const overrideChannel = interaction.options.getChannel("channel");

      let eventDate: Date | null = null;
      if (eventDateRaw) {
        eventDate = new Date(eventDateRaw);
        if (isNaN(eventDate.getTime())) {
          return interaction.editReply("Invalid date format.");
        }
      }

      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      const targetChannelId =
        overrideChannel?.id || guild?.availabilityChannelId;

      if (!targetChannelId) {
        return interaction.editReply(
          "No availability channel configured. Use `/setup` or specify a channel."
        );
      }

      const channel = (await interaction.client.channels
        .fetch(targetChannelId)
        .catch(() => null)) as TextChannel | null;

      if (!channel) {
        return interaction.editReply("Could not access the channel.");
      }

      const check = await prisma.availabilityCheck.create({
        data: {
          guildId,
          channelId: targetChannelId,
          title,
          description,
          eventDate,
          createdBy: interaction.user.id,
        },
      });

      const embed = new EmbedBuilder()
        .setTitle(`📅 Availability Check: ${title}`)
        .setDescription(description || "Please indicate your availability below.")
        .setColor(0xe85d04)
        .setFooter({ text: "✅ 0  •  ❓ 0  •  ❌ 0" })
        .setTimestamp();

      if (eventDate) {
        embed.addFields({
          name: "Event Date",
          value: `<t:${Math.floor(eventDate.getTime() / 1000)}:F> (<t:${Math.floor(
            eventDate.getTime() / 1000
          )}:R>)`,
        });
      }

      const message = await channel.send({
        embeds: [embed],
        components: [createAvailabilityButtons(check.id)],
      });

      await prisma.availabilityCheck.update({
        where: { id: check.id },
        data: { messageId: message.id },
      });

      await interaction.editReply(
        `✅ Availability check posted in ${channel}.\nCheck ID: \`${check.id}\``
      );
    }

    if (sub === "results") {
      await interaction.deferReply({ ephemeral: true });

      const checkId = interaction.options.getString("check_id", true);

      const check = await prisma.availabilityCheck.findFirst({
        where: { id: checkId, guildId },
        include: { responses: true },
      });

      if (!check) {
        return interaction.editReply("Check not found.");
      }

      const available = check.responses.filter((r) => r.status === "AVAILABLE");
      const maybe = check.responses.filter((r) => r.status === "MAYBE");
      const unavailable = check.responses.filter((r) => r.status === "UNAVAILABLE");

      const formatList = (list: typeof available) =>
        list.length
          ? list.map((r) => `• <@${r.discordId}>`).join("\n")
          : "_None_";

      const embed = new EmbedBuilder()
        .setTitle(`Results: ${check.title}`)
        .setColor(0xe85d04)
        .addFields(
          {
            name: `✅ Available (${available.length})`,
            value: formatList(available),
            inline: false,
          },
          {
            name: `❓ Maybe (${maybe.length})`,
            value: formatList(maybe),
            inline: false,
          },
          {
            name: `❌ Unavailable (${unavailable.length})`,
            value: formatList(unavailable),
            inline: false,
          }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    }

    if (sub === "list") {
      await interaction.deferReply({ ephemeral: true });

      const checks = await prisma.availabilityCheck.findMany({
        where: { guildId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { _count: { select: { responses: true } } },
      });

      if (checks.length === 0) {
        return interaction.editReply("No availability checks yet.");
      }

      const lines = checks.map(
        (c) =>
          `\`${c.id.slice(0, 8)}\` **${c.title}** — ${c._count.responses} responses ${
            c.isOpen ? "🟢" : "🔴"
          }`
      );

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Recent Availability Checks")
            .setDescription(lines.join("\n"))
            .setColor(0xe85d04),
        ],
      });
    }
  },
};
