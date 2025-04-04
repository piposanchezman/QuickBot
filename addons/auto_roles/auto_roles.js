const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { set: setCommand } = require("../../handlers/commands");
const { set: setEvent } = require("../../handlers/events");
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { parse } = require('yaml');
const { join } = require('path');

// Configuración
const configPath = join(__dirname, 'addon_config.yml');
const defaultConfig = {
  enabled: true,
  messages: {
    gender_title: "🔞 Selecciona tu género",
    gender_description: "Reacciona para obtener tu rol de género",
    age_title: "🎂 Selecciona tu rango de edad",
    age_description: "Elige tu grupo de edad",
    country_title: "🌍 Selecciona tu país",
    country_description: "Elige tu país o región",
    game_mode_title: "🎮 Modalidad de juego favorita",
    game_mode_description: "Selecciona cómo te gusta jugar en nuestro servidor"
  }
};

let config = { ...defaultConfig, ...parse(readFileSync(configPath, 'utf8')) };

// Estado persistente
const statePath = join(__dirname, 'autoroles_state.json');
let autorolesData = {};

if (existsSync(statePath)) {
  try {
    autorolesData = JSON.parse(readFileSync(statePath, 'utf8'));
  } catch (e) {
    console.error('[AutoRoles] Error al cargar estado:', e);
  }
}

function saveState() {
  writeFileSync(statePath, JSON.stringify(autorolesData, null, 2));
}

// Comando para configurar mensajes de auto-roles
module.exports.run = (client) => {
  if (!config.enabled) return;

  setCommand(client, {
    name: "setupautoroles",
    description: "Configura los mensajes de auto-roles",
    usage: "setupautoroles",
    permissions: ["ManageRoles"],
    category: "admin",
    enabled: true,
    slash: true,
    async slashRun(interaction) {
      if (!interaction.member.permissions.has("ManageRoles")) {
        return interaction.reply({
          content: "❌ Necesitas permisos de administrador para esto",
          ephemeral: true
        });
      }

      const options = [
        { label: "Género", value: "gender" },
        { label: "Edad", value: "age" },
        { label: "País", value: "country" },
        { label: "Modalidades", value: "gamemode" }
      ];

      const selectMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('autoroles_type')
          .setPlaceholder('Selecciona el tipo de auto-roles')
          .addOptions(options)
      );

      await interaction.reply({
        content: "🔧 Configuración de Auto-Roles",
        components: [selectMenu],
        ephemeral: true
      });
    }
  });

  // Manejar selección de tipo de auto-roles
  client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'autoroles_type') return;

    const type = interaction.values[0];
    const { guild } = interaction;

    // Obtener roles disponibles
    const roles = guild.roles.cache
      .filter(role => !role.managed && role.name !== '@everyone')
      .map(role => ({ label: role.name, value: role.id }));

    if (roles.length === 0) {
      return interaction.reply({
        content: "❌ No hay roles configurados en el servidor",
        ephemeral: true
      });
    }

    const roleSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`autoroles_roles_${type}`)
        .setPlaceholder('Selecciona los roles para este tipo')
        .setMinValues(1)
        .setMaxValues(roles.length)
        .addOptions(roles)
    );

    await interaction.update({
      content: `Selecciona los roles para ${type}`,
      components: [roleSelect],
      ephemeral: true
    });
  });

  // Manejar selección de roles
  client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith('autoroles_roles_')) return;

    const type = interaction.customId.replace('autoroles_roles_', '');
    const roleIds = interaction.values;
    const { channel } = interaction;

    // Guardar configuración
    if (!autorolesData[channel.id]) autorolesData[channel.id] = {};
    autorolesData[channel.id][type] = roleIds;
    saveState();

    // Crear embed con emojis correspondientes
    const embed = new EmbedBuilder()
      .setTitle(config.messages[`${type}_title`] || `Selecciona tu ${type}`)
      .setDescription(config.messages[`${type}_description`] || "Reacciona para obtener tu rol");

    // Enviar mensaje
    const message = await channel.send({ embeds: [embed] });

    // Añadir reacciones
    for (const roleId of roleIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role) {
        // Usar el primer emoji del nombre del rol o uno por defecto
        const emojiMatch = role.name.match(/\p{Emoji}/u);
        const emoji = emojiMatch ? emojiMatch[0] : '✅';
        await message.react(emoji);
      }
    }

    // Guardar mensaje en el estado
    if (!autorolesData.messages) autorolesData.messages = {};
    autorolesData.messages[message.id] = { type, roleIds };
    saveState();

    await interaction.update({
      content: `✅ Mensaje de ${type} configurado correctamente`,
      components: [],
      ephemeral: true
    });
  });

  // Manejar reacciones
  setEvent(client, {
    name: 'messageReactionAdd',
    async run(reaction, user) {
      if (user.bot) return;
      if (!autorolesData.messages?.[reaction.message.id]) return;

      const { type, roleIds } = autorolesData.messages[reaction.message.id];
      const emoji = reaction.emoji.toString();
      const guild = reaction.message.guild;

      // Encontrar el rol correspondiente a la reacción
      const roleId = roleIds.find(id => {
        const role = guild.roles.cache.get(id);
        const roleEmojiMatch = role?.name.match(/\p{Emoji}/u);
        const roleEmoji = roleEmojiMatch ? roleEmojiMatch[0] : '✅';
        return roleEmoji === emoji;
      });

      if (roleId) {
        const member = await guild.members.fetch(user.id);
        await member.roles.add(roleId).catch(console.error);
      }
    }
  });

  setEvent(client, {
    name: 'messageReactionRemove',
    async run(reaction, user) {
      if (user.bot) return;
      if (!autorolesData.messages?.[reaction.message.id]) return;

      const { roleIds } = autorolesData.messages[reaction.message.id];
      const emoji = reaction.emoji.toString();
      const guild = reaction.message.guild;

      const roleId = roleIds.find(id => {
        const role = guild.roles.cache.get(id);
        const roleEmojiMatch = role?.name.match(/\p{Emoji}/u);
        const roleEmoji = roleEmojiMatch ? roleEmojiMatch[0] : '✅';
        return roleEmoji === emoji;
      });

      if (roleId) {
        const member = await guild.members.fetch(user.id);
        await member.roles.remove(roleId).catch(console.error);
      }
    }
  });
};