import { Events, Client } from "discord.js";

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client: Client) {
    // Extra ready logic can go here if needed
    // Main ready logic is already in index.ts
  },
};
