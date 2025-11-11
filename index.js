import { Client, GatewayIntentBits, Events } from 'discord.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// Bot ready event
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot is ready! Logged in as ${readyClient.user.tag}`);
});

// Message event handler
client.on(Events.MessageCreate, async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if message mentions the bot or starts with a prefix
  const prefix = process.env.BOT_PREFIX || '!';
  const mentioned = message.mentions.users.has(client.user.id);
  const hasPrefix = message.content.startsWith(prefix);

  if (!mentioned && !hasPrefix) return;

  // Extract the query (remove mention or prefix)
  let query = message.content;
  if (mentioned) {
    query = query.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
  } else if (hasPrefix) {
    query = query.slice(prefix.length).trim();
  }

  // Ignore empty queries
  if (!query) {
    await message.reply('Hello! How can I help you?');
    return;
  }

  // Show typing indicator
  await message.channel.sendTyping();

  try {
    // Generate response using Gemini
    const result = await model.generateContent(query);
    const response = await result.response;
    const text = response.text();

    // Discord has a 2000 character limit per message
    if (text.length > 2000) {
      // Split into chunks if too long
      const chunks = text.match(/.{1,1900}/g) || [];
      for (let i = 0; i < chunks.length; i++) {
        await message.reply({
          content: chunks[i],
          allowedMentions: { repliedUser: false },
        });
      }
    } else {
      await message.reply({
        content: text,
        allowedMentions: { repliedUser: false },
      });
    }
  } catch (error) {
    console.error('Error generating response:', error);
    await message.reply({
      content: 'Sorry, I encountered an error while processing your request.',
      allowedMentions: { repliedUser: false },
    });
  }
});

// Error handling
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN);

