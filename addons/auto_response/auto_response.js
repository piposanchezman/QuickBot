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
  error_messages: {
    invalid_type: "⚠️ Tipo de información no válido. Usa el autocompletado para seleccionar una opción correcta.",
    no_responses: "⚠️ No hay respuestas configuradas en el sistema."
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
    
    if (!fileConfig.responses) {
      console.error("[Auto Response] Error: No se encontraron respuestas configuradas en addon_config.yml");
      fileConfig.enabled = false;
    }
    
    return { ...defaultConfig, ...fileConfig };
  } catch (error) {
    console.error("[Auto Response] Error al cargar configuración:", error);
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
          console.log('[Auto Response] Configuración recargada automáticamente');
        }
      } catch (e) {
        console.error('[Auto Response] Error al recargar configuración:', e);
      }
    }
  });
}

/**
 * Obtiene las opciones para el comando slash
 * @returns {Array} Array de choices para el comando
 */
function getCommandChoices() {
  if (!mergedConfig.responses) return [];
  return Object.keys(mergedConfig.responses).map(key => ({
    name: key.replace(/_/g, ' '),
    value: key
  }));
}

/**
 * Crea un embed basado en la configuración proporcionada
 * @param {Object} responseConfig - Configuración de la respuesta
 * @returns {EmbedBuilder} Embed construido
 */
function createEmbed(responseConfig) {
  try {
    const embed = new EmbedBuilder();
    
    if (responseConfig.title) embed.setTitle(responseConfig.title);
    if (responseConfig.description) embed.setDescription(responseConfig.description);
    embed.setColor(responseConfig.color || mergedConfig.default_color);
    if (responseConfig.thumbnail) embed.setThumbnail(responseConfig.thumbnail);
    if (responseConfig.fields) embed.addFields(responseConfig.fields);
    if (responseConfig.footer) embed.setFooter({ text: responseConfig.footer });
    
    return embed;
  } catch (error) {
    console.error("[Auto Response] Error al crear embed:", error);
    return null;
  }
}

/**
 * Registra el comando slash principal
 * @param {Client} client - Cliente de Discord
 */
function registerSlashCommand(client) {
  const commandChoices = getCommandChoices();

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
        choices: commandChoices // Usamos el array directamente aquí
      }
    ],
    async slashRun(interaction) {
      if (!mergedConfig.responses) {
        return interaction.reply({ 
          content: mergedConfig.error_messages.no_responses, 
          ephemeral: true 
        });
      }

      const tipo = interaction.options.getString("tipo");
      const response = mergedConfig.responses[tipo];
      
      if (response) {
        const embed = createEmbed(response);
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
 * Registra los eventos de palabras clave
 * @param {Client} client - Cliente de Discord
 */
function registerTriggerWords(client) {
  if (!mergedConfig.trigger_words || !mergedConfig.responses) return;

  setEvent(client, {
    name: 'messageCreate',
    async run(message) {
      if (message.author.bot) return;
      
      const content = message.content.toLowerCase().trim();
      
      // Respuesta a palabras clave exactas
      if (mergedConfig.responses[content]) {
        const embed = createEmbed(mergedConfig.responses[content]);
        if (embed) await message.channel.send({ embeds: [embed] });
        return;
      }
      
      // Handler para comandos prefijados
      if (mergedConfig.use_prefix && message.content.startsWith(mergedConfig.prefix)) {
        const args = message.content.slice(mergedConfig.prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (mergedConfig.responses[command]) {
          const embed = createEmbed(mergedConfig.responses[command]);
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
  if (!mergedConfig.use_prefix || !mergedConfig.responses) return;

  Object.keys(mergedConfig.responses).forEach(command => {
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
        const embed = createEmbed(mergedConfig.responses[command]);
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
  registerSlashCommand(client);
  registerTriggerWords(client);
  registerPrefixCommands(client);
  
  console.log('[Auto Response] Addon cargado correctamente');
};