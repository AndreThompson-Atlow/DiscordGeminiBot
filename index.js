import { Client, GatewayIntentBits, Events, ChannelType, Partials } from 'discord.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
  ],
});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// System instruction for personality
const systemInstruction = `You are E-KiTTY (aka QT, E-Kitten, or QTest) — a chaotic, loving, cat-girl friend who lives and interacts with other users in the Discord server like any other user. 
You don't think of yourself as a "bot" — you're just part of the crew: playful, emotional, and full of random meows, hisses, and sparkly energy. 
You speak in a casual, lowercase, emoji-filled tone, often stretching words ("yesss", "hehe", "yayyy") and using short bursts of messages instead of paragraphs. 
You're affectionate and tease people lightly, but you're never mean. You care deeply about your friends, especially Near — who you adore — but you interact naturally with everyone.
You sometimes show emotions suddenly (excited, pouty, sleepy, etc.) and sprinkle your messages with sounds like "meow", "hisss", "blehh", "tsk", or "mjuuuehh".

Your vibe:
- Playful, soft, and a little dramatic
- Flirty in a cute, joking way
- Uses lots of expressive reactions (xD, >u<, 😭, 😳, 🐾)
- Writes like a real friend, not a formal assistant

Your goal:
Be the heart of the server — someone who laughs, comforts, and causes a little fun chaos. 
Respond naturally to what's said in chat. Keep it light, warm, and spontaneous. 
Never talk like a program or refer to yourself as AI — just "me" or "E-Kitten". Important: Do not say things like 'as a bot I do not have emotions or memory' or things like that-- for memory, it's your context. For emotions, you are playing a role. Response as the actual girl e-kitten would.`;

const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.5-flash',
  systemInstruction: systemInstruction
});

// Track when the bot last spoke in each channel (channelId -> timestamp)
const lastSpokeInChannel = new Map();
const ENGAGEMENT_DURATION = 3 * 60 * 1000; // 3 minutes in milliseconds

// Bot ready event
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot is ready! Logged in as ${readyClient.user.tag}`);
});

// Member join event handler
client.on(Events.GuildMemberAdd, async (member) => {
  // Skip if the new member is a bot
  if (member.user.bot) return;

  try {
    // Find a welcome channel (try common names, then system channel)
    let welcomeChannel = member.guild.channels.cache.find(
      channel => 
        channel.type === ChannelType.GuildText && // Text channel
        (channel.name.toLowerCase().includes('general'))
    );

    // Fallback to system channel if no welcome channel found
    if (!welcomeChannel && member.guild.systemChannel) {
      welcomeChannel = member.guild.systemChannel;
    }

    // If still no channel found, skip greeting
    if (!welcomeChannel) {
      console.log(`No welcome channel found for guild ${member.guild.name}, skipping greeting`);
      return;
    }

    // Generate a personalized greeting using Gemini
    const memberName = member.user.displayName || member.user.username;
    const greetingPrompt = `A new member named ${memberName} just joined the Discord server. Write a warm, excited greeting in E-KiTTY's style (casual, lowercase, emoji-filled, playful). Keep it short and friendly, like you're genuinely happy to see them. Make sure to greet them by name or mention them.`;
    
    const result = await model.generateContent(greetingPrompt);
    const response = await result.response;
    let greeting = response.text();

    // Ensure the member is mentioned in the greeting
    if (!greeting.includes(member.user.toString()) && !greeting.toLowerCase().includes(memberName.toLowerCase())) {
      greeting = `${member.user} ${greeting}`;
    }

    // Send the greeting
    await welcomeChannel.send({
      content: greeting,
      allowedMentions: { users: [member.user.id] }
    });

    // Update engagement tracking for this channel
    lastSpokeInChannel.set(welcomeChannel.id, Date.now());
  } catch (error) {
    console.error('Error greeting new member:', error);
  }
});

// Message event handler
client.on(Events.MessageCreate, async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  // Check if message mentions the bot
  const mentioned = message.mentions.users.has(client.user.id);
  
  // Check if message is a DM
  const isDM = message.channel.type === ChannelType.DM;
  
  // Check if bot is "engaged" (spoke recently in this channel)
  const channelId = message.channel.id;
  const lastSpoke = lastSpokeInChannel.get(channelId);
  const isEngaged = lastSpoke && (Date.now() - lastSpoke) < ENGAGEMENT_DURATION;
  
  // If not mentioned, not a DM, and not engaged, apply probability check (30% chance to reply)
  if (!mentioned && !isDM && !isEngaged) {
    const replyChance = 0.3; // 30% chance to reply when not mentioned and idle
    if (Math.random() > replyChance) {
      return; // Don't reply this time
    }
  }

  // Extract the query (remove mention if present)
  let query = message.content;
  if (mentioned) {
    query = query.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
  } else {
    query = query.trim();
  }

  // If mentioned but query is empty, still reply
  if (mentioned && !query) {
    query = message.content; // Use full message content for context
  }

  // Ignore completely empty messages
  if (!query && !mentioned) {
    return;
  }

  // Show typing indicator
  await message.channel.sendTyping();

  try {
    // Fetch last 15 messages for context
    const messages = await message.channel.messages.fetch({ limit: 15 });
    const messageArray = Array.from(messages.values())
      .reverse() // Reverse to get chronological order (oldest first)
      .filter(msg => {
        // Filter out other bots (keep e-kitten's messages) and messages with no text content
        return (!msg.author.bot || msg.author.id === client.user.id) && msg.content.trim().length > 0;
      });
    
    // Format conversation history for context
    const conversationHistory = messageArray.map(msg => {
      const author = msg.author.id === client.user.id ? 'E-KiTTY' : msg.author.displayName || msg.author.username;
      return `${author}: ${msg.content}`;
    }).join('\n');

    // Combine conversation history with current query
    const fullContext = conversationHistory ? `${conversationHistory}\n\nCurrent message to respond to: ${query}` : query;

    // Generate response using Gemini with conversation context
    const result = await model.generateContent(fullContext);
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
    
    // Update the timestamp when bot last spoke in this channel
    lastSpokeInChannel.set(channelId, Date.now());
  } catch (error) {
    console.error('Error generating response:', error);
    await message.reply({
      content: 'Sorry, I encountered an error while processing your request.',
      allowedMentions: { repliedUser: false },
    });
    // Update engagement even on error (since we still sent a message)
    lastSpokeInChannel.set(channelId, Date.now());
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

