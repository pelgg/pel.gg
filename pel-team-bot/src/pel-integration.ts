import type { Client } from "discord.js";

const REFRESH_INTERVAL_MS = 60_000;

function getApiBaseUrl(): string | null {
  const value =
    process.env.PEL_GG_API_URL ||
    process.env.PEL_API_URL ||
    process.env.PELGG_API_URL;

  return value ? value.replace(/\/$/, "") : null;
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

    if (!response.ok) {
      console.warn(
        `⚠️ PEL.GG config request failed for guild ${guildId}: ${response.status} ${response.statusText}`
      );
      return;
    }

    // Do not log the returned configuration; it may contain team data.
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
    for (const guild of client.guilds.cache.values()) {
      await refreshGuildConfig(client, guild.id);
    }
  };

  void refreshAll();
  setInterval(() => void refreshAll(), REFRESH_INTERVAL_MS);

  console.log("🔗 PEL.GG integration started.");
}
