const { set: setCommand } = require("../../handlers/commands");
const { EmbedBuilder } = require("discord.js");
const { readFileSync, writeFileSync, watch, existsSync } = require("fs");
const { parse } = require("yaml");
const { join } = require("path");

// Configuración de rutas
const configPath = join(__dirname, 'addon_config.yml');
const statePath = join(__dirname, 'counting_state.json');

// Configuración por defecto (como respaldo)
const defaultConfig = {
  enabled: true,
  counting_channel: "",
  message_timeout: 10000,
  reset_on_break: false,
  staff_roles: [],
  role_settings: [],
  embed_colors: {
    success: "#00FF00",
    error: "#FF0000",
    warning: "#FFA500",
    info: "#3498db"
  },
  messages: {
    chain_broken: "**{user}** rompió la cadena ❌\n\nEl siguiente número era: `{expected}`\n\n¡El conteo se ha reiniciado en: `1`!",
    wrong_number: "**{user}** número incorrecto ❌\n\nPor favor sigue la secuencia. \n\n¡El siguiente número es: `{expected}`!",
    invalid_message: "**{user}** mensaje no válido ❌\n\nSolo se permiten números.\n\n¡El siguiente número es: `{expected}`!",
    consecutive_limit: "**{user}** alcanzó el límite de {max} participaciones consecutivas",
    reset_success: "✅ Conteo y estadísticas reiniciados completamente",
    stats_title: "📊 Estadísticas del conteo",
    no_permission: "❌ No tienes permiso para usar este comando",
    help_title: "Uso del comando /counting",
    help_description: "Comandos disponibles:",
    help_stats: "/counting stats - Muestra estadísticas detalladas",
    help_reset: "/counting reset - Reinicia todo el sistema (Solo staff)",
    current_count: "**Número actual:** {current}\n**Siguiente número:** {next}",
    user_stats: "✅ Aciertos: {correct}\n❌ Errores: {wrong}",
    top_players: "Top {limit} {type}",
    no_data: "No hay datos aún",
    total_participants: "Total participantes: {count}"
  }
};

// Cargar configuración
let config = { ...defaultConfig, ...parse(readFileSync(configPath, 'utf8')) };

// Estado del sistema
let state = {
  currentCount: 0,
  lastUserId: "",
  userStats: new Map(),
  userConsecutives: new Map()
};

// Cargar estado guardado
if (existsSync(statePath)) {
  try {
    const savedState = JSON.parse(readFileSync(statePath, 'utf8'));
    state.currentCount = savedState.currentCount || 0;
    state.lastUserId = savedState.lastUserId || "";
    state.userStats = new Map(Object.entries(savedState.userStats || {}));
    state.userConsecutives = new Map(Object.entries(savedState.userConsecutives || {}));
    console.log('[Counting] Estado previo cargado correctamente');
  } catch (e) {
    console.error('[Counting] Error al cargar estado:', e);
  }
}

// Configurar watcher para cambios en la configuración
watch(configPath, (eventType) => {
  if (eventType === 'change') {
    try {
      config = { ...defaultConfig, ...parse(readFileSync(configPath, 'utf8')) };
      console.log('[Counting] Configuración recargada automáticamente');
    } catch (e) {
      console.error('[Counting] Error al recargar configuración:', e);
    }
  }
});

// Funciones de utilidad
function saveState() {
  try {
    writeFileSync(statePath, JSON.stringify({
      currentCount: state.currentCount,
      lastUserId: state.lastUserId,
      userStats: Object.fromEntries(state.userStats),
      userConsecutives: Object.fromEntries(state.userConsecutives)
    }, null, 2));
  } catch (e) {
    console.error('[Counting] Error al guardar estado:', e);
  }
}

function createEmbed(description, color = config.embed_colors.info) {
  return new EmbedBuilder()
    .setDescription(description)
    .setColor(color);
}

function getMessage(key, vars = {}) {
  let msg = config.messages[key] || defaultConfig.messages[key] || key;
  Object.entries(vars).forEach(([k, v]) => {
    msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  });
  return msg;
}

// Funciones del sistema de counting
function isCountingChannel(channelId) {
  return channelId === config.counting_channel;
}

function isStaffMember(member) {
  return config.staff_roles.some(roleId => member.roles.cache.has(roleId)) || 
         member.permissions.has("ManageChannels");
}

function initUserStats(userId) {
  if (!state.userStats.has(userId)) {
    state.userStats.set(userId, { correct: 0, wrong: 0 });
    saveState();
  }
  if (!state.userConsecutives.has(userId)) {
    state.userConsecutives.set(userId, 0);
    saveState();
  }
}

function getMaxConsecutive(member) {
  const roleConfig = config.role_settings.find(r => member.roles.cache.has(r.role_id));
  return roleConfig?.max_consecutive || 1;
}

async function safeDelete(message) {
  if (message.deletable) {
    try {
      await message.delete();
    } catch (error) {
      if (error.code !== 10008) console.error('Error al borrar mensaje:', error);
    }
  }
}

async function sendTempMessage(channel, content, color, timeout = config.message_timeout) {
  const msg = await channel.send({ embeds: [createEmbed(content, color)] });
  if (timeout > 0) setTimeout(() => msg.delete().catch(() => {}), timeout);
  return msg;
}

// Handlers de counting
async function handleCorrect(message, number, userId, member) {
  const stats = state.userStats.get(userId);
  const consecutives = state.userConsecutives.get(userId);
  const maxAllowed = getMaxConsecutive(member);

  if (userId === state.lastUserId && consecutives >= maxAllowed) {
    await safeDelete(message);
    await sendTempMessage(
      message.channel,
      getMessage("consecutive_limit", { user: message.author.toString(), max: maxAllowed }),
      config.embed_colors.warning
    );
    stats.wrong++;
    state.userStats.set(userId, stats);
    saveState();
    return false;
  }

  state.currentCount = number;
  stats.correct++;
  state.userConsecutives.set(userId, userId === state.lastUserId ? consecutives + 1 : 1);
  state.lastUserId = userId;
  state.userStats.set(userId, stats);
  saveState();
  return true;
}

async function handleWrong(message, expected, userId) {
  await safeDelete(message);
  
  const stats = state.userStats.get(userId);
  stats.wrong++;
  state.userStats.set(userId, stats);

  if (config.reset_on_break) {
    await message.channel.send({ 
      embeds: [createEmbed(
        getMessage("chain_broken", { user: message.author.toString(), expected }),
        config.embed_colors.error
      )]
    });
    state.currentCount = 0;
    state.lastUserId = "";
    saveState();
  } else {
    await sendTempMessage(
      message.channel,
      getMessage("wrong_number", { user: message.author.toString(), expected }),
      config.embed_colors.warning
    );
    saveState();
  }
}

async function handleInvalid(message, expected, userId) {
  await safeDelete(message);
  await sendTempMessage(
    message.channel,
    getMessage("invalid_message", { 
      user: message.author.toString(), 
      expected 
    }),
    config.embed_colors.error
  );
  const stats = state.userStats.get(userId);
  stats.wrong++;
  state.userStats.set(userId, stats);
  saveState();
}

function getTopPlayers(type = 'correct', limit = 5) {
  const playersArray = Array.from(state.userStats.entries());
  
  return playersArray
    .sort((a, b) => b[1][type] - a[1][type])
    .slice(0, limit)
    .map(([userId, stats], index) => {
      return `${index + 1}. <@${userId}> - ${stats[type]} ${type === 'correct' ? '✅' : '❌'}`;
    });
}

// Implementación de comandos
module.exports.run = (client) => {
  // Evento para mensajes de conteo
  client.on('messageCreate', async (message) => {
    try {
      if (!isCountingChannel(message.channel.id) || message.author.bot) return;

      const userId = message.author.id;
      initUserStats(userId);
      const expected = state.currentCount + 1;

      const num = parseInt(message.content.trim());
      
      if (isNaN(num)) {
        await handleInvalid(message, expected, userId);
        return;
      }

      if (num === expected) {
        await handleCorrect(message, num, userId, message.member);
      } else {
        await handleWrong(message, expected, userId);
      }
    } catch (error) {
      console.error('Error en messageCreate:', error);
    }
  });

  // Comando /counting
  setCommand(client, {
    name: "counting",
    description: "Sistema de conteo con estadísticas",
    usage: "counting <reset|stats>",
    permissions: [], 
    aliases: ["count"], 
    category: "addon", 
    enabled: true, 
    slash: true,
    options: [
      {
        name: "reset",
        description: "Reinicia el conteo y estadísticas (Solo staff)",
        type: 1
      },
      {
        name: "stats",
        description: "Muestra estadísticas del conteo",
        type: 1
      }
    ],
    async run(message, args) {
      if (!message.member) return;
      
      const action = args[0]?.toLowerCase();

      if (action === "reset" && isStaffMember(message.member)) {
        state.currentCount = 0;
        state.lastUserId = "";
        state.userStats = new Map();
        state.userConsecutives = new Map();
        saveState();
        const reply = await message.reply({   
          embeds: [createEmbed(getMessage("reset_success"), config.embed_colors.success)]
        });
        setTimeout(() => reply.delete().catch(() => {}), config.message_timeout);
        return;
      }

      if (action === "stats" || !action) {
        const userStatsData = state.userStats.get(message.author.id) || { correct: 0, wrong: 0 };
        const topCorrect = getTopPlayers('correct');
        const topWrong = getTopPlayers('wrong');
        
        const statsEmbed = new EmbedBuilder()
          .setColor(config.embed_colors.info)
          .setTitle(getMessage("stats_title"))
          .addFields(
            {
              name: "Conteo Actual",
              value: getMessage("current_count", {
                current: state.currentCount,
                next: state.currentCount + 1
              }),
              inline: false
            },
            {
              name: "Tus Estadísticas",
              value: getMessage("user_stats", {
                correct: userStatsData.correct,
                wrong: userStatsData.wrong
              }),
              inline: true
            },
            {
              name: getMessage("top_players", { limit: 5, type: "Aciertos" }),
              value: topCorrect.join('\n') || getMessage("no_data"),
              inline: true
            },
            {
              name: getMessage("top_players", { limit: 5, type: "Errores" }),
              value: topWrong.join('\n') || getMessage("no_data"),
              inline: true
            }
          )
          .setFooter({ 
            text: getMessage("total_participants", { count: state.userStats.size }) 
          });
        
        await message.reply({ embeds: [statsEmbed] });
        return;
      }

      // Mensaje de ayuda
      const helpEmbed = new EmbedBuilder()
        .setColor(config.embed_colors.info)
        .setTitle(getMessage("help_title"))
        .setDescription(getMessage("help_description"))
        .addFields(
          { name: getMessage("help_stats"), value: "" },
          { name: getMessage("help_reset"), value: "" }
        );
      
      const reply = await message.reply({ embeds: [helpEmbed] });
      setTimeout(() => reply.delete().catch(() => {}), 15000);
    },
    async slashRun(interaction) {
      if (!interaction.member) return;

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === "reset") {
        if (!isStaffMember(interaction.member)) {
          return interaction.reply({
            embeds: [createEmbed(getMessage("no_permission"), config.embed_colors.error)],
            ephemeral: true
          });
        }

        state.currentCount = 0;
        state.lastUserId = "";
        state.userStats = new Map();
        state.userConsecutives = new Map();
        saveState();
        
        return interaction.reply({
          embeds: [createEmbed(getMessage("reset_success"), config.embed_colors.success)],
          ephemeral: true
        });
      }

      if (subcommand === "stats") {
        const userStatsData = state.userStats.get(interaction.user.id) || { correct: 0, wrong: 0 };
        const topCorrect = getTopPlayers('correct');
        const topWrong = getTopPlayers('wrong');
        
        const statsEmbed = new EmbedBuilder()
          .setColor(config.embed_colors.info)
          .setTitle(getMessage("stats_title"))
          .addFields(
            {
              name: "Conteo Actual",
              value: getMessage("current_count", {
                current: state.currentCount,
                next: state.currentCount + 1
              }),
              inline: false
            },
            {
              name: "Tus Estadísticas",
              value: getMessage("user_stats", {
                correct: userStatsData.correct,
                wrong: userStatsData.wrong
              }),
              inline: true
            },
            {
              name: getMessage("top_players", { limit: 5, type: "Aciertos" }),
              value: topCorrect.join('\n') || getMessage("no_data"),
              inline: true
            },
            {
              name: getMessage("top_players", { limit: 5, type: "Errores" }),
              value: topWrong.join('\n') || getMessage("no_data"),
              inline: true
            }
          )
          .setFooter({ 
            text: getMessage("total_participants", { count: state.userStats.size }) 
          });
        
        return interaction.reply({
          embeds: [statsEmbed],
          ephemeral: false
        });
      }
    }
  });
};