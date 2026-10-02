import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all available commands and how to use the bot"),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle("PEL Team Bot – Help")
      .setColor(0xe85d04)
      .setDescription(
        "Multi-team bot for EA FC Pro Clubs. Most settings can also be managed from the PEL website captain panel."
      )
      .addFields(
        {
          name: "⚙️ Setup (Admins)",
          value: "`/setup` – Configure news, fixtures, lineups, availability, roster & schedule channels",
        },
        {
          name: "👥 Roster",
          value: [
            "`/roster add` – Add a player (position + country)",
            "`/roster remove` – Remove a player",
            "`/roster list` – Show current roster",
            "`/roster refresh` – Force update the #roster channel",
          ].join("\n"),
        },
        {
          name: "📰 News",
          value: "`/news` – Post team news to the news channel",
        },
        {
          name: "⚽ Fixtures & Results",
          value: [
            "`/fixture add` – Post a new match fixture",
            "`/fixture result` – Update the final score",
            "`/fixture list` – List recent fixtures",
          ].join("\n"),
        },
        {
          name: "📋 Line-ups",
          value: "`/lineup` – Post a formation + player list",
        },
        {
          name: "✅ Availability",
          value: [
            "`/availability create` – Send an availability check with buttons",
            "`/availability results` – See who is available / maybe / unavailable",
            "`/availability list` – Recent checks",
          ].join("\n"),
        },
        {
          name: "📅 Events",
          value: "`/event` – Create a Discord Scheduled Event (members can RSVP)",
        }
      )
      .setFooter({ text: "PEL • Pro Esports League" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
