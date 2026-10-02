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
    .setName("fixture")
    .setDescription("Manage match fixtures & results")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Post a new fixture")
        .addStringOption((opt) =>
          opt.setName("opponent").setDescription("Opponent team name").setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("kickoff")
            .setDescription("Kick-off time (ISO format or YYYY-MM-DD HH:mm)")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName("competition").setDescription("Competition / League").setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName("home_away")
            .setDescription("Home / Away / Neutral")
            .addChoices(
              { name: "Home", value: "HOME" },
              { name: "Away", value: "AWAY" },
              { name: "Neutral", value: "NEUTRAL" }
            )
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("notes").setDescription("Extra notes").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("result")
        .setDescription("Update the result of a fixture")
        .addStringOption((opt) =>
          opt
            .setName("fixture_id")
            .setDescription("The fixture ID (from /fixture list)")
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName("score")
            .setDescription("Final score (e.g. 3-1)")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("List upcoming and recent fixtures")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === "add") {
      await interaction.deferReply({ ephemeral: true });

      const opponent = interaction.options.getString("opponent", true);
      const kickoffRaw = interaction.options.getString("kickoff", true);
      const competition = interaction.options.getString("competition");
      const homeAway = interaction.options.getString("home_away");
      const notes = interaction.options.getString("notes");

      const kickoff = new Date(kickoffRaw);
      if (isNaN(kickoff.getTime())) {
        return interaction.editReply(
          "Invalid date format. Use ISO (2026-10-09T20:00:00Z) or YYYY-MM-DD HH:mm"
        );
      }

      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      if (!guild?.fixturesChannelId) {
        return interaction.editReply(
          "Fixtures channel is not configured. Use `/setup` first."
        );
      }

      const channel = (await interaction.client.channels
        .fetch(guild.fixturesChannelId)
        .catch(() => null)) as TextChannel | null;

      if (!channel) {
        return interaction.editReply("Could not access the fixtures channel.");
      }

      const embed = new EmbedBuilder()
        .setTitle("⚽ Upcoming Match")
        .setColor(0x3498db)
        .addFields(
          { name: "Opponent", value: opponent, inline: true },
          { name: "Competition", value: competition || "Friendly", inline: true },
          { name: "Home/Away", value: homeAway || "—", inline: true },
          {
            name: "Kick-off",
            value: `<t:${Math.floor(kickoff.getTime() / 1000)}:F> (<t:${Math.floor(
              kickoff.getTime() / 1000
            )}:R>)`,
          }
        )
        .setTimestamp();

      if (notes) embed.setDescription(notes);

      const message = await channel.send({ embeds: [embed] });

      const fixture = await prisma.fixture.create({
        data: {
          guildId,
          opponent,
          competition,
          homeAway,
          kickoff,
          notes,
          messageId: message.id,
        },
      });

      await interaction.editReply(
        `✅ Fixture posted in ${channel}.\nFixture ID: \`${fixture.id}\``
      );
    }

    if (sub === "result") {
      await interaction.deferReply({ ephemeral: true });

      const fixtureId = interaction.options.getString("fixture_id", true);
      const score = interaction.options.getString("score", true);

      const fixture = await prisma.fixture.findFirst({
        where: { id: fixtureId, guildId },
      });

      if (!fixture) {
        return interaction.editReply("Fixture not found.");
      }

      await prisma.fixture.update({
        where: { id: fixtureId },
        data: { result: score },
      });

      // Try to update the original message
      if (fixture.messageId && fixture.guildId) {
        const guild = await prisma.guild.findUnique({ where: { id: guildId } });
        if (guild?.fixturesChannelId) {
          const channel = (await interaction.client.channels
            .fetch(guild.fixturesChannelId)
            .catch(() => null)) as TextChannel | null;

          if (channel) {
            const msg = await channel.messages.fetch(fixture.messageId).catch(() => null);
            if (msg) {
              const embed = EmbedBuilder.from(msg.embeds[0] || new EmbedBuilder())
                .setTitle(`⚽ Result: ${score}`)
                .setColor(0x2ecc71)
                .addFields({ name: "Final Score", value: `**${score}**`, inline: true });

              await msg.edit({ embeds: [embed] }).catch(() => null);
            }
          }
        }
      }

      await interaction.editReply(`✅ Result **${score}** saved for the fixture against **${fixture.opponent}**.`);
    }

    if (sub === "list") {
      await interaction.deferReply();

      const fixtures = await prisma.fixture.findMany({
        where: { guildId },
        orderBy: { kickoff: "desc" },
        take: 15,
      });

      if (fixtures.length === 0) {
        return interaction.editReply("No fixtures found.");
      }

      const lines = fixtures.map((f) => {
        const date = `<t:${Math.floor(f.kickoff.getTime() / 1000)}:d>`;
        const result = f.result ? ` → **${f.result}**` : "";
        return `\`${f.id.slice(0, 8)}\` ${date} vs **${f.opponent}** (${f.competition || "Friendly"})${result}`;
      });

      const embed = new EmbedBuilder()
        .setTitle("Fixtures & Results")
        .setColor(0xe85d04)
        .setDescription(lines.join("\n"))
        .setFooter({ text: "Use the ID with /fixture result" });

      await interaction.editReply({ embeds: [embed] });
    }
  },
};
