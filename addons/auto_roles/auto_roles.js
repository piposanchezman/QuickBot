const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
    game_mode_description: "Selecciona cómo te gusta jugar en nuestro servidor",
    remove_title: "🗑️ Eliminar reacción/rol",
    remove_description: "Selecciona una reacción para eliminar"
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

  // Comando principal
  setCommand(client, {
    name: "autoroles",
    description: "Administra el sistema de auto-roles",
    usage: "autoroles <setup|remove>",
    permissions: ["ManageRoles"],
    category: "admin",
    enabled: true,
    slash: true,
    options: [
      {
        name: "action",
        description: "Acción a realizar",
        type: 3,
        required: true,
        choices: [
          { name: "Configurar auto-roles", value: "setup" },
          { name: "Eliminar reacción/rol", value: "remove" }
        ]
      }
    ],
    async slashRun(interaction) {
      if (!interaction.member.permissions.has("ManageRoles")) {
        return interaction.reply({
          content: "❌ Necesitas permisos de administrador para esto",
          ephemeral: true
        });
      }

      const action = interaction.options.getString("action");

      if (action === "setup") {
        await setupAutoroles(interaction);
      } else if (action === "remove") {
        await removeAutorole(interaction);
      }
    }
  });

  // Función para configurar auto-roles
  async function setupAutoroles(interaction) {
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

  // Función para eliminar reacción/rol
  async function removeAutorole(interaction) {
    if (!autorolesData.messages || Object.keys(autorolesData.messages).length === 0) {
      return interaction.reply({
        content: "❌ No hay mensajes de auto-roles configurados",
        ephemeral: true
      });
    }

    // Crear lista de mensajes configurados
    const messages = [];
    for (const [messageId, data] of Object.entries(autorolesData.messages)) {
      try {
        const message = await interaction.channel.messages.fetch(messageId);
        messages.push({
          label: `${data.type} (${messageId})`,
          description: `Roles: ${data.roleIds.length}`,
          value: messageId
        });
      } catch (error) {
        console.error(`Error al obtener mensaje ${messageId}:`, error);
        delete autorolesData.messages[messageId];
      }
    }

    if (messages.length === 0) {
      return interaction.reply({
        content: "❌ No se encontraron mensajes de auto-roles válidos",
        ephemeral: true
      });
    }

    const selectMenu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('remove_autorole_select')
        .setPlaceholder('Selecciona un mensaje de auto-roles')
        .addOptions(messages.slice(0, 25))
    );

    await interaction.reply({
      content: "🗑️ Selecciona el mensaje para eliminar una reacción",
      components: [selectMenu],
      ephemeral: true
    });
  }

  // Manejar selección de mensaje para eliminar reacción
  client.on('interactionCreate', async interaction => {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'remove_autorole_select') return;

    const messageId = interaction.values[0];
    const messageData = autorolesData.messages[messageId];

    try {
      const message = await interaction.channel.messages.fetch(messageId);
      const reactions = message.reactions.cache;

      if (reactions.size === 0) {
        return interaction.update({
          content: "❌ Este mensaje no tiene reacciones",
          components: [],
          ephemeral: true
        });
      }

      // Crear botones para cada reacción
      const buttons = [];
      reactions.forEach(reaction => {
        buttons.push(
          new ButtonBuilder()
            .setCustomId(`remove_reaction_${messageId}_${reaction.emoji.identifier}`)
            .setLabel(`Eliminar ${reaction.emoji.name}`)
            .setStyle(ButtonStyle.Danger)
            .setEmoji(reaction.emoji)
        );
      });

      // Dividir en filas de máximo 5 botones
      const rows = [];
      for (let i = 0; i < buttons.length; i += 5) {
        rows.push(
          new ActionRowBuilder().addComponents(buttons.slice(i, i + 5))
        );
      }

      await interaction.update({
        content: "Selecciona la reacción a eliminar:",
        components: rows,
        ephemeral: true
      });

    } catch (error) {
      console.error('Error al obtener mensaje:', error);
      await interaction.update({
        content: "❌ Error al obtener el mensaje",
        components: [],
        ephemeral: true
      });
    }
  });

  // Manejar eliminación de reacción
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || !interaction.customId.startsWith('remove_reaction_')) return;

    const [_, messageId, emojiId] = interaction.customId.split('_');
    const messageData = autorolesData.messages[messageId];

    try {
      const message = await interaction.channel.messages.fetch(messageId);
      const reaction = message.reactions.cache.find(r => r.emoji.identifier === emojiId);

      if (!reaction) {
        return interaction.update({
          content: "❌ La reacción no fue encontrada",
          components: [],
          ephemeral: true
        });
      }

      // Encontrar el rol asociado a esta reacción
      const roleId = messageData.roleIds.find(id => {
        const role = interaction.guild.roles.cache.get(id);
        if (!role) return false;
        const roleEmojiMatch = role.name.match(/\p{Emoji}/u);
        const roleEmoji = roleEmojiMatch ? roleEmojiMatch[0] : '✅';
        return roleEmoji === reaction.emoji.toString();
      });

      // Eliminar la reacción
      await reaction.remove();

      // Si encontramos un rol asociado
      if (roleId) {
        // Eliminar el rol de la configuración
        messageData.roleIds = messageData.roleIds.filter(id => id !== roleId);

        // Actualizar estado
        if (messageData.roleIds.length === 0) {
          delete autorolesData.messages[messageId];
        } else {
          autorolesData.messages[messageId] = messageData;
        }
        saveState();

        // Opcional: eliminar el rol del servidor
        // await interaction.guild.roles.delete(roleId).catch(console.error);
      }

      await interaction.update({
        content: `✅ Reacción ${reaction.emoji} eliminada correctamente`,
        components: [],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error al eliminar reacción:', error);
      await interaction.update({
        content: "❌ Error al eliminar la reacción",
        components: [],
        ephemeral: true
      });
    }
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