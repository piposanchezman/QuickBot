const { set: setCommand } = require("../../handlers/commands");
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { readFileSync, writeFileSync, watch, existsSync } = require("fs");
const { parse } = require("yaml");
const { join } = require("path");
const OpenAI = require('openai');

// Configuración de rutas
const configPath = join(__dirname, 'addon_config.yml');
const storyPath = join(__dirname, 'current_story.json');

// Configuración por defecto
const defaultConfig = {
  enabled: true,
  story_channel: "",
  cooldown: 5000,
  max_tokens: 100,
  min_chars: 10,
  max_chars: 300,
  model: "deepseek/deepseek-chat-v3-0324:free",
  embed_colors: {
    info: "#3498db",
    success: "#00FF00",
    error: "#FF0000",
    warning: "#FFA500"
  },
  messages: {
    story_start: "**¡Historia colaborativa!**\n📜 **Normas:**\n1. Escribe para continuar\n2. Espera tu turno\n3. Sé apropiado\n\nComienza:",
    story_resumed: "**¡Historia reanudada!**\n\n📖 **Hasta ahora:**\n{story}\n\n✍️ **Continúa la historia...**",
    story_rules: "**Cómo participar:**\n- Escribe tu continuación\n- 1 mensaje por turno\n- IA responderá después",
    story_stopped: "**¡Historia finalizada!**\n\n📜 **Resultado final:**",
    story_status: "📊 **Estado actual**",
    no_story: "No hay historia activa actualmente",
    story_active: "Ya hay historia en progreso",
    processing: "🔄 Procesando...",
    error_processing: "❌ Error al procesar",
    cooldown_active: "⏳ Espera antes de contribuir",
    waiting_ia: "⏳ IA generando respuesta...",
    ia_failed: "⚠️ **IA no pudo contribuir**\n¡Continúa tú!",
    ia_error: "⚠️ **Error de conexión con IA**\nContinúa sin IA",
    message_too_short: "❌ Muy corto (mín {min} chars)",
    message_too_long: "❌ Muy largo (máx {max} chars)",
    default_starters: [
      "Érase una vez en un lugar misterioso...",
      "En un mundo donde todo era posible...",
      "Todo comenzó cuando...",
      "Nadie esperaba que aquel día...",
      "La leyenda cuenta que..."
    ]
  }
};

// Estado del sistema
let state = {
  active: false,
  processing: false,
  messages: [],
  participants: new Map(),
  lastContributor: null,
  lastUserMessage: null,
  cooldowns: new Map()
};

// Cargar configuración
let config = { ...defaultConfig, ...parse(readFileSync(configPath, 'utf8')) };

// Cargar historia existente al iniciar
function loadStoryState() {
  if (existsSync(storyPath)) {
    try {
      const savedData = JSON.parse(readFileSync(storyPath, 'utf8'));
      
      // Validar datos cargados
      if (savedData && savedData.messages && savedData.messages.length > 0) {
        state = {
          active: true,
          processing: false,
          messages: savedData.messages,
          participants: new Map(Object.entries(savedData.participants || {})),
          lastContributor: savedData.lastContributor || null,
          lastUserMessage: savedData.lastUserMessage || null,
          cooldowns: new Map()
        };
        console.log('[Story] Historia cargada correctamente');
      }
    } catch (e) {
      console.error('[Story] Error al cargar historia:', e);
    }
  }
}

// Cargar estado al iniciar
loadStoryState();

// Cliente OpenAI
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: "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",
  defaultHeaders: {
    "HTTP-Referer": "http://tienda.quickland.net/",
    "X-Title": "QuickLand Network",
  },
});

// Funciones de utilidad
function saveStory() {
  const dataToSave = {
    messages: state.messages,
    participants: Object.fromEntries(state.participants),
    lastContributor: state.lastContributor,
    lastUserMessage: state.lastUserMessage
  };
  
  writeFileSync(storyPath, JSON.stringify(dataToSave, null, 2));
}

function createEmbed(description, color = config.embed_colors.info) {
  return new EmbedBuilder().setDescription(description).setColor(color);
}

function getMessage(key, vars = {}) {
  let msg = config.messages[key] || defaultConfig.messages[key] || key;
  Object.entries(vars).forEach(([k, v]) => {
    msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  });
  return msg;
}

// Función para generar inicio con IA
async function generateStoryStart() {
  try {
    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content: "Genera un inicio breve (1 frase) para historia colaborativa. Debe ser abierto."
        },
        {
          role: "user",
          content: "Por favor, genera un inicio interesante para una historia."
        }
      ],
      max_tokens: 40
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error al generar inicio:", error);
    return null;
  }
}

// Función para generar final con IA
async function generateStoryEnd() {
  try {
    const storySoFar = state.messages.map(m => m.content).join("\n");
    
    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content: "Genera un final breve (1 frase) para esta historia."
        },
        {
          role: "user",
          content: `Genera un final conciso para:\n\n${storySoFar}`
        }
      ],
      max_tokens: 50
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error al generar final:", error);
    return null;
  }
}

// Función para generar continuación con IA
async function generateContinuation(prompt) {
  try {
    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content: "Continúa esta historia colaborativa con 1-2 frases breves. Mantén el estilo."
        },
        ...state.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: config.max_tokens
    });
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error al generar continuación:", error);
    return null;
  }
}

// Validar longitud del mensaje
function validateMessageLength(content) {
  if (content.length < config.min_chars) {
    return { valid: false, error: getMessage("message_too_short", { min: config.min_chars }) };
  }
  if (content.length > config.max_chars) {
    return { valid: false, error: getMessage("message_too_long", { max: config.max_chars }) };
  }
  return { valid: true };
}

// Handlers principales
async function startStory(interaction) {
  if (state.active) {
    return interaction.reply({
      embeds: [createEmbed(getMessage("story_active"), config.embed_colors.warning)],
      ephemeral: true
    });
  }

  let storyStart = await generateStoryStart();
  if (!storyStart) {
    const starters = config.messages.default_starters || defaultConfig.messages.default_starters;
    storyStart = starters[Math.floor(Math.random() * starters.length)];
  }

  state = {
    active: true,
    processing: false,
    messages: [{ role: "assistant", content: storyStart }],
    participants: new Map(),
    lastContributor: null,
    lastUserMessage: null,
    cooldowns: new Map()
  };

  const embed = new EmbedBuilder()
    .setColor(config.embed_colors.info)
    .setDescription(getMessage("story_start"))
    .addFields(
      { name: "📖 Historia", value: storyStart },
      { name: "\u200B", value: getMessage("story_rules") }
    );

  await interaction.reply({ embeds: [embed] });
  saveStory();
}

async function resumeStory(interaction) {
  if (!state.active || state.messages.length === 0) {
    return interaction.reply({
      embeds: [createEmbed(getMessage("no_story"), config.embed_colors.warning)],
      ephemeral: true
    });
  }

  const lastMessages = state.messages.slice(-3).map(m => m.content).join("\n\n");
  
  const embed = new EmbedBuilder()
    .setColor(config.embed_colors.info)
    .setDescription(getMessage("story_resumed", { story: lastMessages }))
    .addFields(
      { name: "\u200B", value: getMessage("story_rules") }
    );

  await interaction.reply({ embeds: [embed] });
}

async function stopStory(interaction) {
  if (!state.active) {
    return interaction.reply({
      embeds: [createEmbed(getMessage("no_story"), config.embed_colors.warning)],
      ephemeral: true
    }).catch(error => {
      console.error('Error al responder a interacción:', error);
    });
  }

  // Deferir la respuesta primero para evitar timeout
  await interaction.deferReply();

  try {
    let storyEnd = await generateStoryEnd();
    if (!storyEnd) storyEnd = "Y así terminó esta gran historia colaborativa.";

    // Añadir el final a la historia
    state.messages.push({ role: "assistant", content: storyEnd });

    // Formatear la historia completa en memoria
    const storyText = state.messages.map(msg => {
      return `${msg.role === 'assistant' ? '[Narrador]' : '[Usuario]'}: ${msg.content}`;
    }).join('\n\n');

    // Crear buffer en memoria
    const storyBuffer = Buffer.from(storyText, 'utf-8');
    const fileName = `historia-colaborativa-${Date.now()}.txt`;

    // Crear attachment desde el buffer
    const attachment = new AttachmentBuilder(storyBuffer, { name: fileName });

    // Crear embed de confirmación
    const embed = new EmbedBuilder()
      .setColor(config.embed_colors.success)
      .setTitle(getMessage("story_stopped"))
      .setDescription("¡Historia finalizada con éxito! Descarga el archivo adjunto para ver el resultado completo.")
      .addFields(
        {
          name: "📝 Fragmento final",
          value: storyEnd.length > 150 
            ? storyEnd.substring(0, 150) + "..."
            : storyEnd
        },
        {
          name: "👥 Participantes",
          value: state.participants.size.toString(),
          inline: true
        },
        {
          name: "📖 Longitud",
          value: `${state.messages.length} mensajes`,
          inline: true
        }
      );

    // Enviar respuesta con archivo en memoria
    await interaction.editReply({
      embeds: [embed],
      files: [attachment]
    });

    // Actualizar estado
    state.active = false;
    saveStory();

  } catch (error) {
    console.error('Error en stopStory:', error);
    
    try {
      await interaction.editReply({
        embeds: [createEmbed("❌ Ocurrió un error al finalizar la historia", config.embed_colors.error)]
      });
    } catch (secondaryError) {
      console.error('Error al notificar error:', secondaryError);
    }
  }
}

async function showStatus(interaction) {
  if (!state.active) {
    return interaction.reply({
      embeds: [createEmbed(getMessage("no_story"), config.embed_colors.warning)],
      ephemeral: true
    });
  }

  // Obtener últimos mensajes
  let lastAIResponse = "Ninguna aún";
  let lastUserContribution = "Ninguna aún";
  let lastUser = "Nadie aún";

  // Buscar la última respuesta de IA
  for (let i = state.messages.length - 1; i >= 0; i--) {
    if (state.messages[i].role === "assistant") {
      lastAIResponse = state.messages[i].content;
      break;
    }
  }

  // Buscar la última contribución de usuario
  for (let i = state.messages.length - 1; i >= 0; i--) {
    if (state.messages[i].role === "user") {
      lastUserContribution = state.messages[i].content;
      // Obtener el usuario que hizo esta contribución (aproximado)
      lastUser = state.lastContributor ? `<@${state.lastContributor}>` : "Desconocido";
      break;
    }
  }

  // Obtener top contribuidores
  const topContributors = Array.from(state.participants.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([userId, count], index) => `${index + 1}. <@${userId}> - ${count} contribuciones`)
    .join('\n') || "Nadie aún";

  // Crear embed con la información
  const embed = new EmbedBuilder()
    .setColor(config.embed_colors.info)
    .setTitle(getMessage("story_status"))
    .addFields(
      {
        name: "🔄 Última interacción de la IA",
        value: lastAIResponse.length > 150 
          ? lastAIResponse.substring(0, 150) + "..." 
          : lastAIResponse || "Ninguna"
      },
      {
        name: "👤 Último contribuidor",
        value: lastUser
      },
      {
        name: "💬 Última contribución",
        value: lastUserContribution.length > 150
          ? lastUserContribution.substring(0, 150) + "..."
          : lastUserContribution || "Ninguna"
      },
      {
        name: "🏆 Top 5 contribuidores",
        value: topContributors
      },
      {
        name: "👥 Total participantes",
        value: state.participants.size.toString()
      }
    );

  await interaction.reply({ embeds: [embed] });
}

// Evento para mensajes en el canal de historia
async function handleStoryMessage(message) {
  if (!state.active || message.author.bot || message.channel.id !== config.story_channel) return;

  const validation = validateMessageLength(message.content);
  if (!validation.valid) {
    try {
      await message.delete();
      const reply = await message.channel.send({ 
        embeds: [createEmbed(validation.error, config.embed_colors.error)] 
      });
      setTimeout(() => reply.delete().catch(() => {}), 3000);
    } catch (error) {
      console.error('Error al manejar mensaje inválido:', error);
    }
    return;
  }

  if (state.cooldowns.has(message.author.id)) {
    try {
      await message.delete();
      const reply = await message.channel.send({ 
        embeds: [createEmbed(getMessage("cooldown_active"), config.embed_colors.warning)] 
      });
      setTimeout(() => reply.delete().catch(() => {}), 3000);
    } catch (error) {
      console.error('Error al manejar cooldown:', error);
    }
    return;
  }

  if (state.processing) {
    try {
      await message.delete();
      const reply = await message.channel.send({ 
        embeds: [createEmbed(getMessage("waiting_ia"), config.embed_colors.warning)] 
      });
      setTimeout(() => reply.delete().catch(() => {}), 3000);
    } catch (error) {
      console.error('Error al manejar procesamiento:', error);
    }
    return;
  }

  state.processing = true;
  state.lastContributor = message.author.id;
  state.lastUserMessage = message.content;
  
  const userContributions = state.participants.get(message.author.id) || 0;
  state.participants.set(message.author.id, userContributions + 1);

  state.messages.push({ role: "user", content: message.content });
  
  let processingMsg;
  try {
    processingMsg = await message.channel.send({ 
      embeds: [createEmbed(getMessage("processing"), config.embed_colors.info)] 
    });

    const aiResponse = await generateContinuation(message.content);
    
    if (aiResponse) {
      state.messages.push({ role: "assistant", content: aiResponse });
      
      await message.channel.send({ 
        embeds: [createEmbed(aiResponse, config.embed_colors.info)] 
      });
    } else {
      await message.channel.send({ 
        embeds: [createEmbed(getMessage("ia_failed"), config.embed_colors.warning)] 
      });
    }
  } catch (error) {
    console.error("Error en handleStoryMessage:", error);
    await message.channel.send({ 
      embeds: [createEmbed(getMessage("ia_error"), config.embed_colors.error)] 
    });
  } finally {
    if (processingMsg) await processingMsg.delete().catch(() => {});
    state.processing = false;
    state.cooldowns.set(message.author.id, true);
    setTimeout(() => state.cooldowns.delete(message.author.id), config.cooldown);
    saveStory();
  }
}

// Implementación de comandos
module.exports.run = (client) => {
  // Configurar watcher para cambios en la configuración
  watch(configPath, (eventType) => {
    if (eventType === 'change') {
      try {
        config = { ...defaultConfig, ...parse(readFileSync(configPath, 'utf8')) };
        console.log('[Story] Configuración recargada');
      } catch (e) {
        console.error('[Story] Error al recargar configuración:', e);
      }
    }
  });

  // Registrar comandos slash
  setCommand(client, {
    name: "story",
    description: "Historia colaborativa con IA",
    usage: "story <start|stop|status|resume>",
    permissions: [],
    aliases: [],
    category: "addon",
    enabled: true,
    slash: true,
    options: [
      {
        name: "start",
        description: "Inicia nueva historia",
        type: 1
      },
      {
        name: "resume",
        description: "Reanuda historia existente",
        type: 1
      },
      {
        name: "stop",
        description: "Finaliza historia actual",
        type: 1
      },
      {
        name: "status",
        description: "Muestra estado actual",
        type: 1
      }
    ],
    async slashRun(interaction) {
      try {
        const subcommand = interaction.options.getSubcommand();
        
        switch (subcommand) {
          case "start":
            await startStory(interaction);
            break;
          case "resume":
            await resumeStory(interaction);
            break;
          case "stop":
            await stopStory(interaction);
            break;
          case "status":
            await showStatus(interaction);
            break;
        }
      } catch (error) {
        console.error('Error en slashRun:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            embeds: [createEmbed("❌ Ocurrió un error al procesar el comando", config.embed_colors.error)],
            ephemeral: true
          }).catch(e => console.error('Error al enviar mensaje de error:', e));
        }
      }
    }
  });

  // Manejar mensajes en el canal de historia
  client.on('messageCreate', handleStoryMessage);

  console.log('[Story] Addon cargado. Historia activa:', state.active);
};