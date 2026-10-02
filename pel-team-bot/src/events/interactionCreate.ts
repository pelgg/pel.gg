import { Events, Interaction } from "discord.js";
import { BotClient } from "../index";

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    const client = interaction.client as BotClient;

    // Slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing /${interaction.commandName}`, error);
        const reply = {
          content: "There was an error while executing this command.",
          ephemeral: true,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      }
    }

    // Button interactions (availability, RSVP, etc.)
    if (interaction.isButton()) {
      // We will handle specific button IDs in later feature files
      // For now just acknowledge unknown buttons
      if (interaction.customId.startsWith("availability_")) {
        const { handleAvailabilityButton } = require("../utils/availability");
        await handleAvailabilityButton(interaction);
      }
    }
  },
};
