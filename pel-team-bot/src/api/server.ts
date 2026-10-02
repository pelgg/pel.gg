import express from "express";
import cors from "cors";
import helmet from "helmet";
import { Client } from "discord.js";
import { prisma } from "../utils/prisma";
import { createAvailabilityButtons } from "../utils/availability";
import { EmbedBuilder, TextChannel } from "discord.js";
import { refreshRosterChannel } from "../utils/roster";

export function startApiServer(client: Client) {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // Simple API key auth
  const auth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = req.headers["x-api-key"];
    if (key !== process.env.API_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", servers: client.guilds.cache.size });
  });

  // Get guild config (used by website)
  app.get("/guild/:guildId", auth, async (req, res) => {
    const guild = await prisma.guild.findUnique({
      where: { id: String(req.params.guildId) },
      include: {
        roster: { where: { isActive: true } },
      },
    });
    if (!guild) return res.status(404).json({ error: "Guild not found" });
    res.json(guild);
  });

  // Update channel configuration from website
  app.patch("/guild/:guildId/channels", auth, async (req, res) => {
    const { newsChannelId, fixturesChannelId, lineupChannelId, availabilityChannelId, rosterChannelId, scheduleChannelId } = req.body;

    const guild = await prisma.guild.upsert({
      where: { id: String(req.params.guildId) },
      create: {
        id: String(req.params.guildId),
        newsChannelId,
        fixturesChannelId,
        lineupChannelId,
        availabilityChannelId,
        rosterChannelId,
        scheduleChannelId,
      },
      update: {
        newsChannelId,
        fixturesChannelId,
        lineupChannelId,
        availabilityChannelId,
        rosterChannelId,
        scheduleChannelId,
      },
    });

    res.json(guild);
  });

  // Create availability check (from website captain panel)
  app.post("/guild/:guildId/availability", auth, async (req, res) => {
    const { title, description, eventDate, channelId, createdBy } = req.body;
    const guildId = String(req.params.guildId);

    const guild = await prisma.guild.findUnique({ where: { id: String(guildId) } });
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const targetChannelId = channelId || guild.availabilityChannelId;
    if (!targetChannelId) {
      return res.status(400).json({ error: "No availability channel configured" });
    }

    const channel = (await client.channels.fetch(targetChannelId).catch(() => null)) as TextChannel | null;
    if (!channel) return res.status(400).json({ error: "Channel not found or bot cannot access it" });

    const check = await prisma.availabilityCheck.create({
      data: {
        guildId,
        channelId: targetChannelId,
        title,
        description,
        eventDate: eventDate ? new Date(eventDate) : null,
        createdBy: createdBy || "website",
      },
    });

    const embed = new EmbedBuilder()
      .setTitle(`📅 Availability Check: ${title}`)
      .setDescription(description || "Please indicate your availability.")
      .setColor(0xe85d04)
      .setFooter({ text: "✅ 0  •  ❓ 0  •  ❌ 0" })
      .setTimestamp();

    if (eventDate) {
      embed.addFields({ name: "Event Date", value: `<t:${Math.floor(new Date(eventDate).getTime() / 1000)}:F>` });
    }

    const message = await channel.send({
      embeds: [embed],
      components: [createAvailabilityButtons(check.id)],
    });

    await prisma.availabilityCheck.update({
      where: { id: check.id },
      data: { messageId: message.id },
    });

    res.json({ success: true, checkId: check.id, messageId: message.id });
  });

  // Post news
  app.post("/guild/:guildId/news", auth, async (req, res) => {
    const { title, content, imageUrl, postedBy } = req.body;
    const guild = await prisma.guild.findUnique({ where: { id: String(req.params.guildId) } });
    if (!guild?.newsChannelId) return res.status(400).json({ error: "News channel not set" });

    const channel = (await client.channels.fetch(guild.newsChannelId).catch(() => null)) as TextChannel | null;
    if (!channel) return res.status(400).json({ error: "Channel not accessible" });

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(content)
      .setColor(0xe85d04)
      .setTimestamp();

    if (imageUrl) embed.setImage(imageUrl);

    const message = await channel.send({ embeds: [embed] });

    await prisma.newsPost.create({
      data: {
        guildId: String(req.params.guildId),
        title,
        content,
        imageUrl,
        messageId: message.id,
        postedBy: postedBy || "website",
      },
    });

    res.json({ success: true, messageId: message.id });
  });

  // Post fixture
  app.post("/guild/:guildId/fixture", auth, async (req, res) => {
    const { opponent, competition, homeAway, kickoff, notes } = req.body;
    const guild = await prisma.guild.findUnique({ where: { id: String(req.params.guildId) } });
    if (!guild?.fixturesChannelId) return res.status(400).json({ error: "Fixtures channel not set" });

    const channel = (await client.channels.fetch(guild.fixturesChannelId).catch(() => null)) as TextChannel | null;
    if (!channel) return res.status(400).json({ error: "Channel not accessible" });

    const embed = new EmbedBuilder()
      .setTitle(`⚽ Upcoming Match`)
      .setColor(0x3498db)
      .addFields(
        { name: "Opponent", value: opponent, inline: true },
        { name: "Competition", value: competition || "Friendly", inline: true },
        { name: "Home/Away", value: homeAway || "—", inline: true },
        { name: "Kick-off", value: `<t:${Math.floor(new Date(kickoff).getTime() / 1000)}:F>` }
      )
      .setTimestamp();

    if (notes) embed.setDescription(notes);

    const message = await channel.send({ embeds: [embed] });

    await prisma.fixture.create({
      data: {
        guildId: String(req.params.guildId),
        opponent,
        competition,
        homeAway,
        kickoff: new Date(kickoff),
        notes,
        messageId: message.id,
      },
    });

    res.json({ success: true, messageId: message.id });
  });

  // Refresh roster from website
  app.post("/guild/:guildId/roster/refresh", auth, async (req, res) => {
    await refreshRosterChannel(client, String(req.params.guildId));
    res.json({ success: true });
  });

  // Post line-up from website
  app.post("/guild/:guildId/lineup", auth, async (req, res) => {
    const { title, formation, players, createdBy } = req.body;
    // players expected as array: [{ position: "GK", name: "Alex" }, ...]

    const guild = await prisma.guild.findUnique({ where: { id: String(req.params.guildId) } });
    if (!guild?.lineupChannelId) return res.status(400).json({ error: "Line-up channel not set" });

    const channel = (await client.channels.fetch(guild.lineupChannelId).catch(() => null)) as TextChannel | null;
    if (!channel) return res.status(400).json({ error: "Channel not accessible" });

    let description = formation ? `**Formation: ${formation}**\n\n` : "";
    const positionOrder = ["GK","CB","LB","RB","LWB","RWB","CDM","CM","CAM","LM","RM","LW","RW","CF","ST"];

    const byPos: Record<string, string[]> = {};
    for (const p of players || []) {
      if (!byPos[p.position]) byPos[p.position] = [];
      byPos[p.position].push(p.name);
    }

    for (const pos of positionOrder) {
      if (byPos[pos]) description += `**${pos}**: ${byPos[pos].join(", ")}\n`;
    }
    for (const pos of Object.keys(byPos)) {
      if (!positionOrder.includes(pos)) description += `**${pos}**: ${byPos[pos].join(", ")}\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 Line-up: ${title}`)
      .setDescription(description || "No players listed.")
      .setColor(0x9b59b6)
      .setTimestamp();

    const message = await channel.send({ embeds: [embed] });

    await prisma.lineup.create({
      data: {
        guildId: String(req.params.guildId),
        title,
        formation,
        players: players || [],
        messageId: message.id,
        createdBy: createdBy || "website",
      },
    });

    res.json({ success: true, messageId: message.id });
  });

  // Update fixture result from website
  app.patch("/guild/:guildId/fixture/:fixtureId/result", auth, async (req, res) => {
    const { score } = req.body;
    const { guildId, fixtureId } = req.params;

    const fixture = await prisma.fixture.findFirst({
      where: { id: String(fixtureId), guildId: String(guildId) },
    });
    if (!fixture) return res.status(404).json({ error: "Fixture not found" });

    await prisma.fixture.update({
      where: { id: String(fixtureId) },
      data: { result: score },
    });

    // Try to edit the original Discord message
    if (fixture.messageId) {
      const guild = await prisma.guild.findUnique({ where: { id: String(guildId) } });
      if (guild?.fixturesChannelId) {
        const channel = (await client.channels.fetch(guild.fixturesChannelId).catch(() => null)) as TextChannel | null;
        if (channel) {
          const msg = await channel.messages.fetch(fixture.messageId).catch(() => null);
          if (msg && msg.embeds[0]) {
            const embed = EmbedBuilder.from(msg.embeds[0])
              .setTitle(`⚽ Result: ${score}`)
              .setColor(0x2ecc71);
            await msg.edit({ embeds: [embed] }).catch(() => null);
          }
        }
      }
    }

    res.json({ success: true });
  });

  // Get availability results (for captain panel)
  app.get("/guild/:guildId/availability/:checkId", auth, async (req, res) => {
    const check = await prisma.availabilityCheck.findFirst({
      where: { id: String(req.params.checkId), guildId: String(req.params.guildId) },
      include: { responses: true },
    });
    if (!check) return res.status(404).json({ error: "Check not found" });
    res.json(check);
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`🌐 API server running on port ${port}`);
  });
}
