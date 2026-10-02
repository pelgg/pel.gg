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
    .setName("news")
    .setDescription("Post team news")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((opt) =>
      opt.setName("title").setDescription("News title").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("content").setDescription("News content").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("image").setDescription("Optional image URL").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guildId!;
    const title = interaction.options.getString("title", true);
    const content = interaction.options.getString("content", true);
    const imageUrl = interaction.options.getString("image");

    const guild = await prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild?.newsChannelId) {
      return interaction.editReply(
        "News channel is not configured. Use `/setup` first."
      );
    }

    const channel = (await interaction.client.channels
      .fetch(guild.newsChannelId)
      .catch(() => null)) as TextChannel | null;

    if (!channel) {
      return interaction.editReply("Could not access the news channel.");
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(content)
      .setColor(0xe85d04)
      .setFooter({ text: `Posted by ${interaction.user.displayName}` })
      .setTimestamp();

    if (imageUrl) embed.setImage(imageUrl);

    const message = await channel.send({ embeds: [embed] });

    await prisma.newsPost.create({
      data: {
        guildId,
        title,
        content,
        imageUrl,
        messageId: message.id,
        postedBy: interaction.user.id,
      },
    });

    await interaction.editReply(`✅ News posted in ${channel}.`);
  },
};
