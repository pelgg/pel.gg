import {
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { prisma } from "./prisma";

export async function handleAvailabilityButton(interaction: ButtonInteraction) {
  const [_, action, checkId] = interaction.customId.split("_"); // availability_AVAILABLE_checkId

  if (!["AVAILABLE", "MAYBE", "UNAVAILABLE"].includes(action)) {
    return interaction.reply({ content: "Unknown action.", ephemeral: true });
  }

  const check = await prisma.availabilityCheck.findUnique({
    where: { id: checkId },
  });

  if (!check || !check.isOpen) {
    return interaction.reply({
      content: "This availability check is closed or no longer exists.",
      ephemeral: true,
    });
  }

  await prisma.availabilityResponse.upsert({
    where: {
      checkId_discordId: {
        checkId,
        discordId: interaction.user.id,
      },
    },
    create: {
      checkId,
      discordId: interaction.user.id,
      status: action,
    },
    update: {
      status: action,
      respondedAt: new Date(),
    },
  });

  await interaction.reply({
    content: `You marked yourself as **${action}**.`,
    ephemeral: true,
  });

  // Optionally update the original message with counts
  await updateAvailabilityEmbed(interaction, checkId);
}

async function updateAvailabilityEmbed(interaction: ButtonInteraction, checkId: string) {
  const responses = await prisma.availabilityResponse.findMany({
    where: { checkId },
  });

  const available = responses.filter((r) => r.status === "AVAILABLE").length;
  const maybe = responses.filter((r) => r.status === "MAYBE").length;
  const unavailable = responses.filter((r) => r.status === "UNAVAILABLE").length;

  const original = interaction.message;
  if (!original.embeds[0]) return;

  const embed = EmbedBuilder.from(original.embeds[0]);
  embed.setFooter({
    text: `✅ ${available}  •  ❓ ${maybe}  •  ❌ ${unavailable}`,
  });

  await original.edit({ embeds: [embed] }).catch(() => null);
}

export function createAvailabilityButtons(checkId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`availability_AVAILABLE_${checkId}`)
      .setLabel("Available")
      .setStyle(ButtonStyle.Success)
      .setEmoji("✅"),
    new ButtonBuilder()
      .setCustomId(`availability_MAYBE_${checkId}`)
      .setLabel("Maybe")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("❓"),
    new ButtonBuilder()
      .setCustomId(`availability_UNAVAILABLE_${checkId}`)
      .setLabel("Unavailable")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("❌")
  );
}
