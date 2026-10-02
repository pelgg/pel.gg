import { REST, Routes } from "discord.js";
import { readdirSync } from "fs";
import path from "path";
import { config } from "dotenv";
config();

export async function deployCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, "../commands");
  const commandFiles = readdirSync(commandsPath).filter(
    (file) => (file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts")
  );

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ("data" in command && "execute" in command) {
      commands.push(command.data.toJSON());
    }
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

  try {
    console.log(`🔄 Started refreshing ${commands.length} application (/) commands.`);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
      body: commands,
    });
    console.log(`✅ Successfully reloaded ${commands.length} application (/) commands.`);
  } catch (error) {
    console.error("Failed to deploy commands:", error);
  }
}
