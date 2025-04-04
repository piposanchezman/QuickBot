const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
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
        { label: "Modalidad de juego", value: "game_mode" }
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
      return interaction.update({
        content: "❌ No hay roles configurados en el servidor",
        components: [],
        ephemeral: true
      });
    }

    const roleSelect = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`autoroles_roles_${type}`)
        .setPlaceholder('Selecciona los roles para este tipo')
        .setMinValues(1)
        .setMaxValues(Math.min(25, roles.length)) // Discord limita a 25 opciones
        .addOptions(roles.slice(0, 25)) // Tomar solo los primeros 25 roles
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

    // Crear embed
    const embed = new EmbedBuilder()
      .setTitle(config.messages[`${type}_title`] || `Selecciona tu ${type}`)
      .setDescription(config.messages[`${type}_description`] || "Reacciona para obtener tu rol");

    // Enviar mensaje
    const message = await channel.send({ embeds: [embed] });

    // Añadir reacciones (limitado a 20 por mensaje)
    const rolesToAdd = roleIds.slice(0, 20);
    for (const roleId of rolesToAdd) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role) {
        const emojiMatch = role.name.match(/\p{Emoji}/u);
        const emoji = emojiMatch ? emojiMatch[0] : '✅';
        await message.react(emoji).catch(console.error);
      }
    }

    // Guardar mensaje en el estado
    if (!autorolesData.messages) autorolesData.messages = {};
    autorolesData.messages[message.id] = { type, roleIds: rolesToAdd };
    saveState();

    await interaction.update({
      content: `✅ Mensaje de ${type} configurado correctamente`,
      components: [],
      ephemeral: true
    });
  });

  // Manejar reacciones - Asignar roles
  setEvent(client, {
    name: 'messageReactionAdd',
    async run(reaction, user) {
      if (user.bot) return;
      if (!autorolesData.messages?.[reaction.message.id]) return;

      // Si la reacción fue en un DM o el mensaje no está en cache
      if (reaction.message.partial) {
        try {
          await reaction.message.fetch();
        } catch (error) {
          console.error('Error al obtener el mensaje:', error);
          return;
        }
      }

      const { roleIds } = autorolesData.messages[reaction.message.id];
      const emoji = reaction.emoji.toString();
      const guild = reaction.message.guild;

      // Encontrar el rol correspondiente
      for (const roleId of roleIds) {
        const role = guild.roles.cache.get(roleId);
        if (!role) continue;
        
        const roleEmojiMatch = role.name.match(/\p{Emoji}/u);
        const roleEmoji = roleEmojiMatch ? roleEmojiMatch[0] : '✅';
        
        if (roleEmoji === emoji) {
          try {
            const member = await guild.members.fetch(user.id);
            await member.roles.add(role);
            break;
          } catch (error) {
            console.error(`Error al asignar rol ${role.name}:`, error);
          }
        }
      }
    }
  });

  // Manejar reacciones - Remover roles
  setEvent(client, {
    name: 'messageReactionRemove',
    async run(reaction, user) {
      if (user.bot) return;
      if (!autorolesData.messages?.[reaction.message.id]) return;

      // Si la reacción fue en un DM o el mensaje no está en cache
      if (reaction.message.partial) {
        try {
          await reaction.message.fetch();
        } catch (error) {
          console.error('Error al obtener el mensaje:', error);
          return;
        }
      }

      const { roleIds } = autorolesData.messages[reaction.message.id];
      const emoji = reaction.emoji.toString();
      const guild = reaction.message.guild;

      // Encontrar el rol correspondiente
      for (const roleId of roleIds) {
        const role = guild.roles.cache.get(roleId);
        if (!role) continue;
        
        const roleEmojiMatch = role.name.match(/\p{Emoji}/u);
        const roleEmoji = roleEmojiMatch ? roleEmojiMatch[0] : '✅';
        
        if (roleEmoji === emoji) {
          try {
            const member = await guild.members.fetch(user.id);
            await member.roles.remove(role);
            break;
          } catch (error) {
            console.error(`Error al remover rol ${role.name}:`, error);
          }
        }
      }
    }
  });
};