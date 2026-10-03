import type { Client } from "discord.js";

const REFRESH_INTERVAL_MS = 60_000;

function getApiBaseUrl(): string | null {
  const value =
    process.env.PEL_GG_API_URL ||
    process.env.PEL_API_URL ||
    process.env.PELGG_API_URL;

  return value ? value.replace(/\/$/, "") : null;
}

async function syncGuilds(client: Client): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const secret = process.env.DISCORD_BOT_SHARED_SECRET;

  if (!apiBaseUrl || !secret) return;

  const guilds = client.guilds.cache.map((guild) => ({
    guild_id: guild.id,
    name: guild.name,
    icon: guild.iconURL({ extension: "png", size: 128 }) ?? null,
  }));

  try {
    const response = await fetch(`${apiBaseUrl}/api/public/discord-bot/guilds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PEL-Bot-Secret": secret,
        "Accept": "application/json",
      },
      body: JSON.stringify({ guilds }),
    });

    if (!response.ok) {
      console.warn(
        `⚠️ PEL.GG guild sync failed: ${response.status} ${response.statusText}`
      );
      return;
    }

    console.log(`🔄 Synced ${guilds.length} Discord server(s) with PEL.GG`);
  } catch (error) {
    console.warn("⚠️ Could not sync Discord servers with PEL.GG:", error);
  }
}

async function refreshGuildConfig(client: Client, guildId: string): Promise<void> {
  const apiBaseUrl = getApiBaseUrl();
  const secret = process.env.DISCORD_BOT_SHARED_SECRET;

  if (!apiBaseUrl || !secret) return;

  const url = `${apiBaseUrl}/api/public/discord-bot/config?guild_id=${encodeURIComponent(guildId)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-PEL-Bot-Secret": secret,
        "Accept": "application/json",
      },
    });

    if (response.status === 404) return;

    if (!response.ok) {
      console.warn(
        `⚠️ PEL.GG config request failed for guild ${guildId}: ${response.status} ${response.statusText}`
      );
      return;
    }

    await response.json();
    console.log(`🔄 PEL.GG config refreshed for guild ${guildId}`);
  } catch (error) {
    console.warn(`⚠️ Could not refresh PEL.GG config for guild ${guildId}:`, error);
  }
}

export function startPelIntegration(client: Client): void {
  const apiBaseUrl = getApiBaseUrl();
  const secret = process.env.DISCORD_BOT_SHARED_SECRET;

  if (!apiBaseUrl || !secret) {
    console.warn(
      "⚠️ PEL.GG integration is not active: set PEL_GG_API_URL and DISCORD_BOT_SHARED_SECRET in Railway."
    );
    return;
  }

  const refreshAll = async () => {
    await syncGuilds(client);

    for (const guild of client.guilds.cache.values()) {
      await refreshGuildConfig(client, guild.id);
    }
  };

  void refreshAll();
  setInterval(() => void refreshAll(), REFRESH_INTERVAL_MS);

  console.log("🔗 PEL.GG integration started.");
}
