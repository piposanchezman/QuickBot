const { set: setCommand } = require("../../handlers/commands");
const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { readFileSync, writeFileSync, watch, existsSync, mkdirSync } = require("fs");
const { parse } = require("yaml");
const { join } = require("path");
const OpenAI = require('openai');
require('dotenv').config();

// Configuración de rutas
const configPath = join(__dirname, 'addon_config.yml');
const storiesDir = join(__dirname, 'stories_data');

// Configuración por defecto
const defaultConfig = {
  enabled: true,
  story_channels: [],
  cooldown: 5000,
  max_tokens: 100,
  min_chars: 10,
  max_chars: 300,
  model: "deepseek/deepseek-chat-v3-0324:free",
  baseTone: "misterioso/fantástico/intrigante",
  max_context_messages: 20,
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
    export_success: "📜 **Historia exportada**\nSe ha generado un archivo con la historia actual.",
    default_starters: [
      "Érase una vez en un lugar misterioso...",
      "En un mundo donde todo era posible...",
      "Todo comenzó cuando...",
      "Nadie esperaba que aquel día...",
      "La leyenda cuenta que..."
    ],
    status_fields: {
      last_ai_response: "🔄 Última interacción de la IA",
      last_contributor: "👤 Último contribuidor",
      last_contribution: "💬 Última contribución",
      top_contributors: "🏆 Top 5 contribuidores",
      total_participants: "👥 Total participantes"
    },
    export_fields: {
      recent_snippet: "📝 Fragmento reciente",
      participants: "👥 Participantes",
      length: "📖 Longitud"
    }
  }
};

// Estados de los canales
const channelStates = new Map();

// Cargar configuración
let config = loadConfig();

// Cliente OpenAI
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "http://tienda.quickland.net/",
    "X-Title": "QuickLand Network",
  },
});

// Funciones de utilidad
function loadConfig() {
  try {
    const fileConfig = existsSync(configPath) ? parse(readFileSync(configPath, 'utf8')) : {};
    return { ...defaultConfig, ...fileConfig };
  } catch (e) {
    console.error('[STORIES] Error al cargar configuración:', e);
    return defaultConfig;
  }
}

function getStoryPath(channelId) {
  return join(storiesDir, `story_${channelId}.json`);
}

function loadStoryStates() {
  try {
    if (!existsSync(storiesDir)) {
      mkdirSync(storiesDir, { recursive: true });
      return;
    }

    // Cargar historias para cada canal configurado
    config.story_channels.forEach(channelId => {
      const storyPath = getStoryPath(channelId);
      
      if (existsSync(storyPath)) {
        try {
          const savedData = JSON.parse(readFileSync(storyPath, 'utf8'));
          
          if (savedData?.messages?.length > 0) {
            channelStates.set(channelId, {
              active: true,
              processing: false,
              messages: savedData.messages,
              participants: new Map(Object.entries(savedData.participants || {})),
              lastContributor: savedData.lastContributor || null,
              lastUserMessage: savedData.lastUserMessage || null,
              cooldowns: new Map()
            });
            console.log(`[STORIES] Historia cargada para canal ${channelId}`);
          }
        } catch (e) {
          console.error(`[STORIES] Error al cargar historia para canal ${channelId}:`, e);
        }
      }
    });
  } catch (e) {
    console.error('[STORIES] Error al cargar historias:', e);
  }
}

function saveStory(channelId) {
  const channelState = channelStates.get(channelId);
  if (!channelState) return;

  const recentMessages = channelState.messages.slice(-config.max_context_messages);
  
  const dataToSave = {
    messages: recentMessages,
    participants: Object.fromEntries(channelState.participants),
    lastContributor: channelState.lastContributor,
    lastUserMessage: channelState.lastUserMessage
  };
  
  writeFileSync(getStoryPath(channelId), JSON.stringify(dataToSave, null, 2));
}

function createEmbed(description, color = config.embed_colors.info) {
  return new EmbedBuilder()
    .setDescription(description)
    .setColor(color);
}

function getMessage(key, vars = {}) {
  let msg = config.messages[key] || defaultConfig.messages[key] || key;
  return Object.entries(vars).reduce((acc, [k, v]) => 
    acc.replace(new RegExp(`\\{${k}\\}`, 'g'), v), msg);
}

async function generateAIResponse(messages, systemPrompt, temperature = 0.7) {
  try {
    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      temperature,
      max_tokens: config.max_tokens,
      stop: ["\n"]
    });

    // Verificación robusta de la respuesta
    if (!completion?.choices?.[0]?.message?.content) {
      console.error("Respuesta de IA no válida:", completion);
      return null;
    }
    
    let response = completion.choices[0].message.content.trim();
    if (!/[.!?]$/.test(response)) response += '.';
    return response;
  } catch (error) {
    console.error("Error en generación de IA:", error);
    return null;
  }
}

async function generateStoryStart() {
  const systemPrompt = `Eres un narrador de historias. Especializado en inicios breves (1 FRASE) con tono ${config.baseTone}. 
  Usa estructuras como: 
  - "Érase una vez [lugar/misterio]..."
  - "La leyenda cuenta que [hecho inexplicable]..."
  - "Todo comenzó cuando [suceso inesperado]..."
  Solo escribe la ÚNICA FRASE, sin explicaciones ni resúmenes.`;

  const userPrompt = `Escribe EXACTAMENTE UNA FRASE de inicio. 
  Puedes seguir estos ejemplo: 
  - "Érase una vez en un lugar misterioso..." 
  - "En un mundo donde todo era posible..."
  - "Nadie esperaba que aquel día..."`;

  return generateAIResponse(
    [{ role: "user", content: userPrompt }],
    systemPrompt,
    0.8
  );
}

async function generateStoryEnd(channelId) {
  const channelState = channelStates.get(channelId);
  if (!channelState) return null;

  const storySoFar = channelState.messages.map(m => m.content).join("\n");
  
  const systemPrompt = `Eres un narrador de historias. Especializado en finales breves (2 FRASES) con tono ${config.baseTone}.   
  Usa estructuras como:
  - "Y así fue como [suceso inesperado]..."
  - "Nadie supo nunca que [secreto revelado]..."
  - "Al final, [reflexión o giro]..."
  Solo escribe laS 2 FRASES, sin explicaciones ni resúmenes.`;

  const userPrompt = `Escribe EXACTAMENTE DOS FRASES que cierre esta historia:\n\n${storySoFar}\n\n
  Puedes seguir estos ejemplos: 
  - "El espejo se rompió, pero su reflejo siguió sonriendo."
  - "Y así fue como el héroe se convirtió en leyenda."
  - "Nadie supo nunca que el verdadero tesoro era la amistad."`;

  return generateAIResponse(
    [{ role: "user", content: userPrompt }],
    systemPrompt,
    0.8
  );
}

async function generateContinuation(prompt, username, channelId) {
  const channelState = channelStates.get(channelId);
  if (!channelState) return null;

  const contextMessages = channelState.messages.slice(-10).map(msg => ({
    role: msg.role,
    content: msg.content,
    name: msg.role === 'user' ? (msg.username || 'Usuario') : 'Narrador'
  }));

  const systemPrompt = `Eres un narrador de historias colaborativas. Analiza el contexto y continúa la historia de manera coherente en 2 FRASES con tono ${config.baseTone}. 
  Contexto actual:
  ${contextMessages.map(m => `${m.name}: ${m.content}`).join('\n')}
  
  Directrices:
  1. Mantén coherencia con los eventos anteriores
  2. Usa transiciones naturales ("Pero entonces...", "De pronto...")
  3. Limita tu respuesta a 2 FRASES concisas
  4. Introduce desarrollo o conflicto cuando sea apropiado`;

  const userPrompt = `Continúa esta historia de manera natural basándote en la contribución de ${username}: ${prompt}`;

  return generateAIResponse(
    [
      ...contextMessages.map(msg => ({ role: msg.role, content: msg.content })),
      { role: "user", content: userPrompt }
    ],
    systemPrompt,
    0.8
  );
}

function validateMessageLength(content) {
  if (content.length < config.min_chars) {
    return { valid: false, error: getMessage("message_too_short", { min: config.min_chars }) };
  }
  if (content.length > config.max_chars) {
    return { valid: false, error: getMessage("message_too_long", { max: config.max_chars }) };
  }
  return { valid: true };
}

async function sendTemporaryMessage(channel, content, color, timeout = 3000) {
  try {
    const reply = await channel.send({ 
      embeds: [createEmbed(content, color)] 
    });
    setTimeout(() => reply.delete().catch(() => {}), timeout);
  } catch (error) {
    console.error('Error al enviar mensaje temporal:', error);
  }
}

async function exportStory(interaction, channelId, includeMetadata = true) {
  const channelState = channelStates.get(channelId);
  
  if (!channelState?.active || channelState.messages.length === 0) {
    return interaction.reply({
      embeds: [createEmbed(getMessage("no_story"), config.embed_colors.warning)],
      ephemeral: true
    });
  }

  await interaction.deferReply();

  try {
    const storyText = channelState.messages.map(msg => 
      `[${msg.role === 'assistant' ? 'Narrador' : msg.username || 'Usuario'}]: ${msg.content}`
    ).join('\n\n');

    let fullText = storyText;
    if (includeMetadata) {
      const participantsList = Array.from(channelState.participants.entries())
        .map(([id, count]) => `- <@${id}>: ${count} contribuciones`)
        .join('\n');
      
      fullText += `\n\n=== METADATOS ===\n` +
        `Participantes: ${channelState.participants.size}\n` +
        `Contribuciones totales: ${channelState.messages.filter(m => m.role === 'user').length}\n` +
        `Participantes:\n${participantsList}\n` +
        `Último contribuidor: <@${channelState.lastContributor}>`;
    }

    const storyBuffer = Buffer.from(fullText, 'utf-8');
    const fileName = `historia-${channelId}-${Date.now()}.txt`;
    const attachment = new AttachmentBuilder(storyBuffer, { name: fileName });

    const recentContent = channelState.messages.slice(-1)[0].content;
    const snippet = recentContent.length > 150 
      ? recentContent.substring(0, 150) + "..."
      : recentContent;

    const embed = new EmbedBuilder()
      .setColor(config.embed_colors.success)
      .setTitle(getMessage("story_exported"))
      .setDescription(getMessage("export_success"))
      .addFields(
        {
          name: config.messages.export_fields.recent_snippet,
          value: snippet
        },
        {
          name: config.messages.export_fields.participants,
          value: channelState.participants.size.toString(),
          inline: true
        },
        {
          name: config.messages.export_fields.length,
          value: `${channelState.messages.length} mensajes`,
          inline: true
        }
      );

    await interaction.editReply({
      embeds: [embed],
      files: [attachment]
    });

  } catch (error) {
    console.error('Error en exportStory:', error);
    await interaction.editReply({
      embeds: [createEmbed(getMessage("error_processing"), config.embed_colors.error)]
    });
  }
}

async function startStory(interaction) {
  const channelId = interaction.channel.id;
  
  // Verificar si el canal está en la lista de canales permitidos
  if (!config.story_channels.includes(channelId)) {
    return interaction.reply({
      embeds: [createEmbed("Este canal no está configurado para historias colaborativas.", config.embed_colors.error)],
      ephemeral: true
    });
  }

  // Verificar si ya hay una historia activa en este canal
  if (channelStates.has(channelId) && channelStates.get(channelId).active) {
    return interaction.reply({
      embeds: [createEmbed(getMessage("story_active"), config.embed_colors.warning)],
      ephemeral: true
    });
  }

  // Deferir la respuesta primero para evitar el timeout
  await interaction.deferReply();

  try {
    let storyStart = await generateStoryStart();
    if (!storyStart) {
      const starters = config.messages.default_starters;
      storyStart = starters[Math.floor(Math.random() * starters.length)];
    }

    channelStates.set(channelId, {
      active: true,
      processing: false,
      messages: [{ role: "assistant", content: storyStart }],
      participants: new Map(),
      lastContributor: null,
      lastUserMessage: null,
      cooldowns: new Map()
    });

    const embed = new EmbedBuilder()
      .setColor(config.embed_colors.info)
      .setDescription(getMessage("story_start"))
      .addFields(
        { name: "📖 Historia", value: storyStart },
        { name: "\u200B", value: getMessage("story_rules") }
      );

    await interaction.editReply({ embeds: [embed] });
    saveStory(channelId);
  } catch (error) {
    console.error('Error en startStory:', error);
    await interaction.editReply({
      embeds: [createEmbed(getMessage("error_processing"), config.embed_colors.error)]
    });
  }
}

async function resumeStory(interaction) {
  const channelId = interaction.channel.id;
  const channelState = channelStates.get(channelId);
  
  if (!channelState?.active || channelState.messages.length === 0) {
    return interaction.reply({
      embeds: [createEmbed(getMessage("no_story"), config.embed_colors.warning)],
      ephemeral: true
    });
  }

  try {
    const lastMessages = channelState.messages.slice(-3).map(m => m.content).join("\n\n");
    
    const embed = new EmbedBuilder()
      .setColor(config.embed_colors.info)
      .setDescription(getMessage("story_resumed", { story: lastMessages }))
      .addFields(
        { name: "\u200B", value: getMessage("story_rules") }
      );

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error en resumeStory:', error);
    await interaction.reply({
      embeds: [createEmbed(getMessage("error_processing"), config.embed_colors.error)],
      ephemeral: true
    });
  }
}

async function stopStory(interaction) {
  const channelId = interaction.channel.id;
  const channelState = channelStates.get(channelId);
  
  if (!channelState?.active) {
    return interaction.reply({
      embeds: [createEmbed(getMessage("no_story"), config.embed_colors.warning)],
      ephemeral: true
    });
  }

  try {
    // Deferir la respuesta primero
    await interaction.deferReply();

    let storyEnd = await generateStoryEnd(channelId);
    if (!storyEnd) storyEnd = getMessage("default_ending") || "Y así terminó esta gran historia colaborativa.";

    channelState.messages.push({ role: "assistant", content: storyEnd });

    const storyText = channelState.messages.map(msg => 
      `[${msg.role === 'assistant' ? 'Narrador' : msg.username || 'Usuario'}]: ${msg.content}`
    ).join('\n\n');

    const storyBuffer = Buffer.from(storyText, 'utf-8');
    const fileName = `historia-final-${channelId}-${Date.now()}.txt`;
    const attachment = new AttachmentBuilder(storyBuffer, { name: fileName });

    const embed = new EmbedBuilder()
      .setColor(config.embed_colors.success)
      .setTitle(getMessage("story_stopped"))
      .setDescription(getMessage("story_completed") || "¡Historia finalizada con éxito! Descarga el archivo adjunto para ver el resultado completo.")
      .addFields(
        {
          name: config.messages.export_fields.recent_snippet,
          value: storyEnd.length > 150 
            ? storyEnd.substring(0, 150) + "..."
            : storyEnd
        },
        {
          name: config.messages.export_fields.participants,
          value: channelState.participants.size.toString(),
          inline: true
        },
        {
          name: config.messages.export_fields.length,
          value: `${channelState.messages.length} mensajes`,
          inline: true
        }
      );

    await interaction.editReply({
      embeds: [embed],
      files: [attachment]
    });

    // Marcar como inactiva pero mantener los datos por si se reanuda
    channelState.active = false;
    saveStory(channelId);

  } catch (error) {
    console.error('Error en stopStory:', error);
    // Usar followUp si ya hemos deferido
    await interaction.followUp({
      embeds: [createEmbed(getMessage("error_processing"), config.embed_colors.error)],
      ephemeral: true
    });
  }
}

async function showStatus(interaction) {
  const channelId = interaction.channel.id;
  const channelState = channelStates.get(channelId);
  
  if (!channelState?.active) {
    return interaction.reply({
      embeds: [createEmbed(getMessage("no_story"), config.embed_colors.warning)],
      ephemeral: true
    });
  }

  try {
    const lastAIResponse = channelState.messages.filter(m => m.role === "assistant").pop()?.content || "Ninguna aún";
    const lastUserMsg = channelState.messages.filter(m => m.role === "user").pop();
    const lastUserContribution = lastUserMsg?.content || "Ninguna aún";
    const lastUser = lastUserMsg?.username ? lastUserMsg.username : (channelState.lastContributor ? `<@${channelState.lastContributor}>` : "Desconocido");

    const topContributors = Array.from(channelState.participants.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId, count], index) => `${index + 1}. <@${userId}> - ${count} contribuciones`)
      .join('\n') || "Nadie aún";

    const embed = new EmbedBuilder()
      .setColor(config.embed_colors.info)
      .setTitle(getMessage("story_status"))
      .addFields(
        {
          name: config.messages.status_fields.last_ai_response,
          value: lastAIResponse.length > 150 
            ? lastAIResponse.substring(0, 150) + "..." 
            : lastAIResponse
        },
        {
          name: config.messages.status_fields.last_contributor,
          value: lastUser
        },
        {
          name: config.messages.status_fields.last_contribution,
          value: lastUserContribution.length > 150
            ? lastUserContribution.substring(0, 150) + "..."
            : lastUserContribution
        },
        {
          name: config.messages.status_fields.top_contributors,
          value: topContributors
        },
        {
          name: config.messages.status_fields.total_participants,
          value: channelState.participants.size.toString()
        }
      );

    await interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error en showStatus:', error);
    await interaction.reply({
      embeds: [createEmbed(getMessage("error_processing"), config.embed_colors.error)],
      ephemeral: true
    });
  }
}

async function handleStoryMessage(message) {
  const channelId = message.channel.id;
  
  // Verificar si el canal está en la lista de canales permitidos
  if (!config.story_channels.includes(channelId)) return;
  
  const channelState = channelStates.get(channelId);
  if (!channelState?.active || message.author.bot) return;

  const validation = validateMessageLength(message.content);
  if (!validation.valid) {
    await message.delete().catch(() => {});
    await sendTemporaryMessage(message.channel, validation.error, config.embed_colors.error);
    return;
  }

  if (channelState.cooldowns.has(message.author.id)) {
    await message.delete().catch(() => {});
    await sendTemporaryMessage(message.channel, getMessage("cooldown_active"), config.embed_colors.warning);
    return;
  }

  if (channelState.processing) {
    await message.delete().catch(() => {});
    await sendTemporaryMessage(message.channel, getMessage("waiting_ia"), config.embed_colors.warning);
    return;
  }

  channelState.processing = true;
  channelState.lastContributor = message.author.id;
  channelState.lastUserMessage = message.content;
  
  const userContributions = channelState.participants.get(message.author.id) || 0;
  channelState.participants.set(message.author.id, userContributions + 1);

  channelState.messages.push({ 
    role: "user", 
    content: message.content,
    username: message.author.username
  });
  
  let processingMsg;
  try {
    processingMsg = await message.channel.send({ 
      embeds: [createEmbed(getMessage("processing"), config.embed_colors.info)] 
    });

    // Configurar timeout de 30 segundos
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout después de 30 segundos")), 30000)
    );

    const aiResponse = await Promise.race([
      generateContinuation(message.content, message.author.username, channelId),
      timeoutPromise
    ]);
    
    if (aiResponse) {
      channelState.messages.push({ role: "assistant", content: aiResponse });
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
    
    // Verificar si fue un timeout
    if (error.message === "Timeout después de 30 segundos") {
      await message.channel.send({ 
        embeds: [createEmbed("⏳ **La IA tardó demasiado en responder**\n¡Continúa tú con la historia!", config.embed_colors.warning)] 
      });
    } else {
      await message.channel.send({ 
        embeds: [createEmbed(getMessage("ia_error"), config.embed_colors.error)] 
      });
    }
  } finally {
    if (processingMsg) await processingMsg.delete().catch(() => {});
    channelState.processing = false;
    channelState.cooldowns.set(message.author.id, true);
    setTimeout(() => channelState.cooldowns.delete(message.author.id), config.cooldown);
    saveStory(channelId);
  }
}

module.exports.run = (client) => {
  // Crear directorio de historias si no existe
  if (!existsSync(storiesDir)) {
    mkdirSync(storiesDir, { recursive: true });
  }

  loadStoryStates();

  watch(configPath, (eventType) => {
    if (eventType === 'change') {
      try {
        config = loadConfig();
        console.log('[STORIES] Configuración recargada');
      } catch (e) {
        console.error('[STORIES] Error al recargar configuración:', e);
      }
    }
  });

  setCommand(client, {
    name: "story",
    description: "Historia colaborativa con IA",
    usage: "story <start|stop|status|resume|export>",
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
      },
      {
        name: "export",
        description: "Exporta la historia actual",
        type: 1
      }
    ],
    async slashRun(interaction) {
      try {
        const subcommand = interaction.options.getSubcommand();
        const channelId = interaction.channel.id;
        
        // Verificar si el canal está en la lista de canales permitidos
        if (!config.story_channels.includes(channelId)) {
          return interaction.reply({
            embeds: [createEmbed("Este canal no está configurado para historias colaborativas.", config.embed_colors.error)],
            ephemeral: true
          });
        }
        
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
          case "export": 
            await exportStory(interaction, channelId);
            break;
        }
      } catch (error) {
        console.error('Error en slashRun:', error);
        try {
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              embeds: [createEmbed(getMessage("error_processing"), config.embed_colors.error)],
              ephemeral: true
            });
          } else {
            await interaction.followUp({
              embeds: [createEmbed(getMessage("error_processing"), config.embed_colors.error)],
              ephemeral: true
            });
          }
        } catch (followUpError) {
          console.error('Error al enviar mensaje de error:', followUpError);
        }
      }
    }
  });

  client.on('messageCreate', handleStoryMessage);
  console.log('[STORIES] Addon cargado. Canales activos:', Array.from(channelStates.keys()).filter(id => channelStates.get(id).active));
};