import { config } from "dotenv";
config();

import { Client, GatewayIntentBits, Collection, Events } from "discord.js";
import { readdirSync } from "fs";
import path from "path";
import { startApiServer } from "./api/server";
import { deployCommands } from "./utils/deployCommands";
import { startPelIntegration } from "./pel-integration";

export interface BotClient extends Client {
  commands: Collection<string, any>;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildScheduledEvents,
  ],
}) as BotClient;

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = readdirSync(commandsPath).filter(
  (file) => (file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts")
);

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[WARNING] Command at ${filePath} is missing "data" or "execute".`);
  }
}

const eventsPath = path.join(__dirname, "events");
const eventFiles = readdirSync(eventsPath).filter(
  (file) => (file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts")
);

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  console.log(`📊 Serving ${c.guilds.cache.size} servers`);

  await deployCommands();
  startApiServer(client);

  startPelIntegration(client);
});

client.login(process.env.DISCORD_TOKEN);
