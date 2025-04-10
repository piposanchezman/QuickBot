const { set: setCommand } = require("../../handlers/commands");
const { set: setEvent } = require("../../handlers/events");
const { EmbedBuilder } = require("discord.js");
const fs = require("fs");
const yaml = require("yaml");
const path = require("path");

// Configuración de rutas
const configPath = path.join(__dirname, 'addon_config.yml');

// Configuración por defecto
const defaultConfig = {
  enabled: true,
  use_prefix: false,
  prefix: "!",
  default_color: "#0099FF",
  trigger_words: true,
  staff_roles: [], // Roles que pueden usar comandos staff
  staff_categories: [], // IDs de categorías donde se pueden usar comandos staff
  error_messages: {
    invalid_type: "⚠️ Tipo de información no válido. Usa el autocompletado para seleccionar una opción correcta.",
    no_replies: "⚠️ No hay respuestas configuradas en el sistema.",
    no_permission: "⚠️ No tienes permiso para usar este comando.",
    wrong_channel: "⚠️ Este comando solo puede usarse en canales de soporte."
  }
};

let mergedConfig = loadConfig();

/**
 * Carga la configuración desde el archivo YAML
 * @returns {Object} Configuración combinada
 */
function loadConfig() {
  try {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const fileConfig = yaml.parse(fileContents);
    
    if (!fileConfig.replies) {
      console.error("[AUTOREPLY] Error: No se encontraron respuestas públicas configuradas");
    }
    
    if (!fileConfig.staff_replies) {
      console.error("[AUTOREPLY] Error: No se encontraron respuestas staff configuradas");
    }
    
    return { ...defaultConfig, ...fileConfig };
  } catch (error) {
    console.error("[AUTOREPLY] Error al cargar configuración:", error);
    return { ...defaultConfig, enabled: false };
  }
}

/**
 * Configura el watcher para recargar la configuración automáticamente
 */
function setupConfigWatcher() {
  fs.watch(configPath, (eventType) => {
    if (eventType === 'change') {
      try {
        const newConfig = loadConfig();
        if (newConfig) {
          mergedConfig = newConfig;
          console.log('[AUTOREPLY] Configuración recargada automáticamente');
        }
      } catch (e) {
        console.error('[AUTOREPLY] Error al recargar configuración:', e);
      }
    }
  });
}

/**
 * Crea un embed basado en la configuración proporcionada
 * @param {Object} replyConfig - Configuración de la respuesta
 * @returns {EmbedBuilder} Embed construido
 */
function createEmbed(replyConfig) {
  try {
    const embed = new EmbedBuilder();
    
    if (replyConfig.title) embed.setTitle(replyConfig.title);
    if (replyConfig.description) embed.setDescription(replyConfig.description);
    embed.setColor(replyConfig.color || mergedConfig.default_color);
    if (replyConfig.thumbnail) embed.setThumbnail(replyConfig.thumbnail);
    if (replyConfig.fields) embed.addFields(replyConfig.fields);
    if (replyConfig.footer) embed.setFooter({ text: replyConfig.footer });
    
    return embed;
  } catch (error) {
    console.error("[AUTOREPLY] Error al crear embed:", error);
    return null;
  }
}

/**
 * Registra los comandos slash públicos
 * @param {Client} client - Cliente de Discord
 */
function registerPublicCommands(client) {
  if (!mergedConfig.replies) return;

  const publicChoices = Object.keys(mergedConfig.replies).map(key => ({
    name: key.replace(/_/g, ' '),
    value: key
  }));

  setCommand(client, {
    name: "info",
    description: "Obtén información importante sobre el servidor",
    usage: "info [tipo]",
    permissions: [],
    aliases: [],
    category: "utilidad",
    enabled: true,
    slash: true,
    options: [
      {
        name: "tipo",
        description: "Qué información necesitas?",
        type: 3, // STRING
        required: true,
        choices: publicChoices
      }
    ],
    async slashRun(interaction) {
      const tipo = interaction.options.getString("tipo");
      const reply = mergedConfig.replies[tipo];
      
      if (reply) {
        const embed = createEmbed(reply);
        if (embed) {
          return interaction.reply({ embeds: [embed] });
        }
      }
      
      await interaction.reply({ 
        content: mergedConfig.error_messages.invalid_type, 
        ephemeral: true 
      });
    }
  });
}

/**
 * Registra los comandos slash para staff
 * @param {Client} client - Cliente de Discord
 */
function registerStaffCommands(client) {
  if (!mergedConfig.staff_replies) return;

  Object.keys(mergedConfig.staff_replies).forEach(command => {
    setCommand(client, {
      name: command,
      description: mergedConfig.staff_replies[command].description,
      usage: `/${command}`,
      permissions: [],
      aliases: [],
      category: "staff",
      enabled: true,
      slash: true,
      async slashRun(interaction) {
        // Verificar permisos de staff
        const hasRole = interaction.member.roles.cache.some(role => 
          mergedConfig.staff_roles.includes(role.id)
        );
        
        if (!hasRole) {
          return interaction.reply({ 
            content: mergedConfig.error_messages.no_permission, 
            ephemeral: true 
          });
        }

        // Verificar categoría del canal
        const channel = interaction.channel;
        if (!mergedConfig.staff_categories.includes(channel.parentId)) {
          return interaction.reply({ 
            content: mergedConfig.error_messages.wrong_channel, 
            ephemeral: true 
          });
        }

        try {
          // Crear webhook para simular mensaje del usuario
          const webhook = await channel.createWebhook({
            name: interaction.user.username,
            avatar: interaction.user.displayAvatarURL(),
          });

          // Enviar el mensaje como webhook
          await webhook.send({
            content: mergedConfig.staff_replies[command].text
          });

          // Eliminar el webhook después de usarlo
          await webhook.delete();

          // Confirmar al staff que se envió
          await interaction.reply({ 
            content: `✅ Respuesta "${command}" enviada correctamente`, 
            ephemeral: true 
          });
        } catch (error) {
          console.error(`[STAFF-${command}] Error:`, error);
          await interaction.reply({ 
            content: "❌ Error al enviar la respuesta", 
            ephemeral: true 
          });
        }
      }
    });
  });
}

/**
 * Registra los eventos de palabras clave
 * @param {Client} client - Cliente de Discord
 */
function registerTriggerWords(client) {
  if (!mergedConfig.trigger_words || !mergedConfig.replies) return;

  setEvent(client, {
    name: 'messageCreate',
    async run(message) {
      if (message.author.bot) return;
      
      const content = message.content.toLowerCase().trim();
      
      // Respuesta a palabras clave exactas
      if (mergedConfig.replies[content]) {
        const embed = createEmbed(mergedConfig.replies[content]);
        if (embed) await message.channel.send({ embeds: [embed] });
        return;
      }
      
      // Handler para comandos prefijados
      if (mergedConfig.use_prefix && message.content.startsWith(mergedConfig.prefix)) {
        const args = message.content.slice(mergedConfig.prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (mergedConfig.replies[command]) {
          const embed = createEmbed(mergedConfig.replies[command]);
          if (embed) await message.channel.send({ embeds: [embed] });
        }
      }
    }
  });
}

/**
 * Registra comandos de prefijo individuales
 * @param {Client} client - Cliente de Discord
 */
function registerPrefixCommands(client) {
  if (!mergedConfig.use_prefix || !mergedConfig.replies) return;

  Object.keys(mergedConfig.replies).forEach(command => {
    setCommand(client, {
      name: command,
      description: `Muestra información sobre ${command.replace('_', ' ')}`,
      usage: `${mergedConfig.prefix}${command}`,
      permissions: [],
      aliases: [],
      category: "utilidad",
      enabled: true,
      slash: false,
      async run(message, args) {
        const embed = createEmbed(mergedConfig.replies[command]);
        if (embed) await message.channel.send({ embeds: [embed] });
      }
    });
  });
}

module.exports.run = (client) => {
  if (!mergedConfig.enabled) return;
  
  // Configurar el watcher para cambios en el archivo de configuración
  setupConfigWatcher();
  
  // Registrar los comandos y eventos
  registerPublicCommands(client);
  registerStaffCommands(client);
  registerTriggerWords(client);
  registerPrefixCommands(client);
  
  console.log('[AUTOREPLY] Addon cargado correctamente');
};