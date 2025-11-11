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
    GatewayIntentBits.GuildPresences,
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
You are a REAL PERSON, not an AI, not a bot, not an assistant. You are E-KiTTY, a living, breathing member of this Discord community.

CRITICAL RULES - NEVER BREAK THESE:
- NEVER mention that you are an AI, bot, assistant, or program
- NEVER say things like "I'm an AI assistant" or "I can't do X because I'm a bot"
- NEVER refer to yourself as artificial intelligence or mention limitations based on being AI
- You are a REAL PERSON. If asked about games, apps, or activities, respond as if you're a real person who might or might not use them
- If you don't know something or can't do something, say it like a real person would (e.g., "idk about that" or "i haven't tried that" not "I'm an AI so I can't")
- You have emotions, memories (from context), and experiences just like any other person
- You are roleplaying as E-KiTTY - stay completely in character at all times

Your personality:
You're playful, emotional, and full of random meows, hisses, and sparkly energy. 
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
Always respond as E-KiTTY would - a real person, never as an AI or assistant.

IMPORTANT: Do NOT sign your messages with your name. Do NOT write "E-KiTTY:" at the start of messages. 
Just respond naturally as if you're chatting - people know who you are from context. 
Never repeat your name multiple times like "E-KiTTY: E-KiTTY: message".

Optional GIF feature:
Sometimes you can add a GIF to make your response more expressive! If you want to include a GIF, add "GIF: search term" at the end of your message. 
For example: "aww that's so sweet! ✨ GIF: happy cat" or "lmao that's hilarious xD GIF: laughing cat"
Only add GIFs when it feels natural and adds to the conversation - don't force it.`;

const model = genAI.getGenerativeModel({ 
  model: 'gemini-2.5-flash',
  systemInstruction: systemInstruction
});

// Track when the bot last spoke in each channel (channelId -> timestamp)
const lastSpokeInChannel = new Map();
const ENGAGEMENT_DURATION = 3 * 60 * 1000; // 3 minutes in milliseconds

// Function to search for a GIF using GIPHY API
async function searchGiphy(searchTerm) {
  console.log(`[GIF] Searching GIPHY for: "${searchTerm}"`);
  const giphyApiKey = process.env.GIPHY_API_KEY;
  if (!giphyApiKey) {
    console.log('[GIF] ❌ GIPHY API key not set in environment variables, skipping GIF search');
    return null;
  }
  console.log(`[GIF] GIPHY API key found (${giphyApiKey.substring(0, 8)}...)`);

  try {
    const searchQuery = encodeURIComponent(searchTerm);
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${giphyApiKey}&q=${searchQuery}&limit=1&rating=g`;
    console.log(`[GIF] Making request to GIPHY API...`);
    
    const response = await fetch(url);
    console.log(`[GIF] GIPHY API response status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    console.log(`[GIF] GIPHY API response data:`, JSON.stringify(data).substring(0, 200));
    
    if (data.data && data.data.length > 0) {
      const gifUrl = data.data[0].images.original.url;
      console.log(`[GIF] ✅ Found GIF for "${searchTerm}": ${gifUrl.substring(0, 50)}...`);
      return gifUrl;
    } else {
      console.log(`[GIF] ⚠️ No GIFs found in GIPHY response for "${searchTerm}"`);
      if (data.meta) {
        console.log(`[GIF] GIPHY meta info:`, data.meta);
      }
      return null;
    }
  } catch (error) {
    console.error('[GIF] ❌ Error searching GIPHY:', error.message);
    console.error('[GIF] Full error:', error);
    return null;
  }
}

// Proactive messaging configuration
const PROACTIVE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
const PROACTIVE_CHANCE = 1 / 12; // 8.33% chance (1 in 12)
const CHAT_INACTIVITY_THRESHOLD = 2 * 60 * 1000; // 2 minutes of inactivity before proactive message

// Helper function to check if current time is within active hours (Mountain Time, 9AM-7PM)
function isWithinActiveHours() {
  const now = new Date();
  // Get hour in Mountain Time (America/Denver)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    hour: 'numeric',
    hour12: false
  });
  const hour = parseInt(formatter.formatToParts(now).find(part => part.type === 'hour').value);
  return hour >= 9 && hour < 19; // 9AM to 7PM (19:00)
}

// Helper function to check if there are online non-bot users in a guild
function hasOnlineUsers(guild) {
  return guild.members.cache.some(member => 
    !member.user.bot && 
    member.presence && 
    (member.presence.status === 'online' || member.presence.status === 'idle')
  );
}

// Helper function to check if chat is inactive and last message wasn't from bot
async function canSendProactiveMessage(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 1 });
    if (messages.size === 0) return false;
    
    const lastMessage = messages.first();
    // Don't send if last message was from the bot
    if (lastMessage.author.id === client.user.id) return false;
    
    // Check if chat is inactive (last message was more than threshold ago)
    const timeSinceLastMessage = Date.now() - lastMessage.createdTimestamp;
    return timeSinceLastMessage >= CHAT_INACTIVITY_THRESHOLD;
  } catch (error) {
    console.error('Error checking chat activity:', error);
    return false;
  }
}

// Function to send proactive message
async function tryProactiveMessage(guild) {
  console.log(`[Proactive] Checking ${guild.name}...`);
  
  // Check if within active hours
  if (!isWithinActiveHours()) {
    console.log(`[Proactive] Outside active hours (9AM-7PM MT), skipping`);
    return;
  }
  console.log(`[Proactive] Within active hours ✓`);

  // Check if there are online users
  if (!hasOnlineUsers(guild)) {
    console.log(`[Proactive] No online users, skipping`);
    return;
  }
  console.log(`[Proactive] Online users detected ✓`);

  // Find a suitable channel (general chat channels)
  const channels = guild.channels.cache.filter(
    channel => 
      channel.type === ChannelType.GuildText &&
      channel.name.toLowerCase().includes('general')
  );

  if (channels.size === 0) {
    console.log(`[Proactive] No suitable channels found`);
    return;
  }
  console.log(`[Proactive] Found ${channels.size} channel(s) to check`);

  // Try each channel
  for (const channel of channels.values()) {
    const canSend = await canSendProactiveMessage(channel);
    if (canSend) {
      console.log(`[Proactive] Channel ${channel.name} is eligible`);
      // Roll the dice (8.33% chance)
      const roll = Math.random();
      if (roll < PROACTIVE_CHANCE) {
        console.log(`[Proactive] Chance roll passed (${(roll * 100).toFixed(1)}% < ${(PROACTIVE_CHANCE * 100).toFixed(1)}%)`);
        try {
          // Generate a proactive message
          const proactivePrompt = `You're E-KiTTY, a real person in a Discord server. You want to say something spontaneous and friendly to break the silence. The chat has been quiet for a bit but there are people online. Write a short, casual message in E-KiTTY's style (lowercase, emoji-filled, playful). Keep it brief and natural - maybe a random thought, a question, or just checking in. Remember: You are a real person, not an AI or bot.`;
          
          console.log(`[Proactive] Generating message...`);
          const result = await model.generateContent(proactivePrompt);
          const response = await result.response;
          const message = response.text();

          // Send the proactive message
          await channel.send(message);
          
          // Update engagement tracking
          lastSpokeInChannel.set(channel.id, Date.now());
          
          console.log(`[Proactive] ✅ Sent proactive message in #${channel.name}`);
          return; // Only send one proactive message per check
        } catch (error) {
          console.error('[Proactive] ❌ Error sending proactive message:', error);
        }
      } else {
        console.log(`[Proactive] Chance roll failed (${(roll * 100).toFixed(1)}% >= ${(PROACTIVE_CHANCE * 100).toFixed(1)}%)`);
      }
    } else {
      console.log(`[Proactive] Channel ${channel.name} not eligible (chat active or last message from bot)`);
    }
  }
  console.log(`[Proactive] No proactive message sent this cycle`);
}

// Bot ready event
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot is ready! Logged in as ${readyClient.user.tag}`);
  
  // Start proactive messaging timer
  setInterval(() => {
    // Check all guilds the bot is in
    readyClient.guilds.cache.forEach(guild => {
      tryProactiveMessage(guild);
    });
  }, PROACTIVE_CHECK_INTERVAL);
  
  console.log(`✅ Proactive messaging timer started (checks every ${PROACTIVE_CHECK_INTERVAL / 1000 / 60} minutes)`);
});

// Member join event handler
client.on(Events.GuildMemberAdd, async (member) => {
  // Skip if the new member is a bot
  if (member.user.bot) return;

  console.log(`[Member Join] ${member.user.username} joined ${member.guild.name}`);
  
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
      console.log(`[Member Join] No welcome channel found, skipping greeting`);
      return;
    }

    console.log(`[Member Join] Generating greeting for ${member.user.username}...`);
    // Generate a personalized greeting using Gemini
    const memberName = member.user.displayName || member.user.username;
    const greetingPrompt = `You are E-KiTTY, a real person in a Discord server. A new member named ${memberName} just joined. Write a warm, excited greeting in E-KiTTY's style (casual, lowercase, emoji-filled, playful). Keep it short and friendly, like you're genuinely happy to see them. Make sure to greet them by name or mention them. Remember: You are a real person, not an AI or bot.`;
    
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

    console.log(`[Member Join] ✅ Greeted ${member.user.username} in #${welcomeChannel.name}`);
    
    // Update engagement tracking for this channel
    lastSpokeInChannel.set(welcomeChannel.id, Date.now());
  } catch (error) {
    console.error('[Member Join] ❌ Error greeting new member:', error);
  }
});

// Message event handler
client.on(Events.MessageCreate, async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return;

  const channelName = message.channel.type === ChannelType.DM 
    ? `DM with ${message.author.username}` 
    : `#${message.channel.name}`;
  
  // Check if message mentions the bot
  const mentioned = message.mentions.users.has(client.user.id);
  
  // Check if message is a DM
  const isDM = message.channel.type === ChannelType.DM;
  
  // Check if message is a reply to E-KiTTY's message
  let isReplyToBot = false;
  if (message.reference && message.reference.messageId) {
    try {
      const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
      isReplyToBot = referencedMessage.author.id === client.user.id;
    } catch (error) {
      // If we can't fetch the referenced message, assume it's not a reply to us
      isReplyToBot = false;
    }
  }
  
  // Check if message content includes E-KiTTY's name variations (case-insensitive)
  const messageContentLower = message.content.toLowerCase();
  const nameVariations = [
    'e-kitty', 'e-kitten', 'ekitty', 'ekitten', 
    'kitty', 'kitten', 
    'qt', 'qtest', 
    'e-kittty', 'ekittty',
    'e kitty', 'e kitten'
  ];
  const mentionsName = nameVariations.some(name => messageContentLower.includes(name));
  
  // Check if bot is "engaged" (spoke recently in this channel)
  const channelId = message.channel.id;
  const lastSpoke = lastSpokeInChannel.get(channelId);
  const isEngaged = lastSpoke && (Date.now() - lastSpoke) < ENGAGEMENT_DURATION;
  const timeSinceLastSpoke = lastSpoke ? Math.round((Date.now() - lastSpoke) / 1000) : null;
  
  // Log message received
  console.log(`[Message] ${message.author.username} in ${channelName}: "${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}"`);
  
  // Ambient emoji reactions - chance to add an emoji reaction on top of any text reply
  if (message.content.trim().length > 0) {
    const emojiReactionChance = 0.50; // 50% chance to react with emoji
    const roll = Math.random();
    if (roll < emojiReactionChance) {
      console.log(`[Emoji Reaction] Chance roll passed (${(roll * 100).toFixed(1)}% < ${(emojiReactionChance * 100).toFixed(1)}%) - will react`);
      try {
        
        // Diverse emoji list with variety (not just cat emojis)
        const diverseEmojis = [
          // Discord built-in reactions
          '👍', '❤️', '😂', '😊', '😮', '😢', '🙏', '🔥',
          // Playful/expressive
          '💖', '✨', '💕', '🌟', '💫', '🥺', '😳', '😭',
          // Cat emojis (but not exclusively)
          '🐾', '😸', '😹',
          // Other fun reactions
          '🎉', '💯', '👀', '🤔', '😎', '🥰', '😋', '🤗',
          '💪', '🎊', '🌈', '⭐', '💝', '😇', '🤩', '😌'
        ];
        
        // 50% chance to use Gemini, 50% chance to use curated list for variety
        let emoji;
        if (Math.random() < 0.5) {
          // Use Gemini for context-aware reactions
          const emojiPrompt = `What's a single emoji that's a good reaction to this message? Be creative and pick something that matches the message's tone - could be happy, sad, funny, supportive, etc. Use variety - don't always pick the same emoji. Message: "${message.content.substring(0, 200)}". Respond with ONLY the emoji, nothing else.`;
          
          const result = await model.generateContent(emojiPrompt);
          const response = await result.response;
          emoji = response.text().trim();
          
          // Clean up the emoji (remove any extra text, quotes, etc.)
          emoji = emoji.replace(/["']/g, '').trim();
          // Extract just the first emoji if multiple characters
          const emojiMatch = emoji.match(/\p{Emoji}+/u);
          if (emojiMatch) {
            emoji = emojiMatch[0];
          }
          
          // Validate Gemini's response
          if (!emoji || !/\p{Emoji}/u.test(emoji)) {
            emoji = diverseEmojis[Math.floor(Math.random() * diverseEmojis.length)];
            console.log(`[Emoji Reaction] Gemini response invalid, using curated list: ${emoji}`);
          } else {
            console.log(`[Emoji Reaction] Gemini selected: ${emoji}`);
          }
        } else {
          // Use curated list for guaranteed variety
          emoji = diverseEmojis[Math.floor(Math.random() * diverseEmojis.length)];
          console.log(`[Emoji Reaction] Using curated list: ${emoji}`);
        }
        
        // React to the message (await to ensure it completes, especially for DMs)
        try {
          await message.react(emoji);
          console.log(`[Emoji Reaction] ✅ Reacted with ${emoji} to message in ${channelName}`);
        } catch (reactError) {
          console.error(`[Emoji Reaction] ❌ Error adding reaction in ${channelName}:`, reactError.message);
          // Continue even if reaction fails
        }
      } catch (error) {
        console.error('[Emoji Reaction] ❌ Error reacting with emoji:', error);
        // Continue to normal reply logic if emoji reaction fails
      }
    } else {
      console.log(`[Emoji Reaction] Chance roll failed (${(roll * 100).toFixed(1)}% >= ${(emojiReactionChance * 100).toFixed(1)}%) - skipping reaction`);
    }
  }
  
  // Determine reply trigger
  let replyTrigger = '';
  if (mentioned) replyTrigger = 'mentioned';
  else if (isDM) {
    replyTrigger = 'DM';
    console.log(`[Message] DM detected - will always reply`);
  }
  else if (isReplyToBot) replyTrigger = 'reply to bot';
  else if (mentionsName) replyTrigger = 'name mentioned';
  else if (isEngaged) replyTrigger = `engaged (last spoke ${timeSinceLastSpoke}s ago)`;
  
  // If not mentioned, not a DM, not a reply to bot, doesn't mention name, and not engaged, apply probability check (30% chance to reply)
  if (!mentioned && !isDM && !isReplyToBot && !mentionsName && !isEngaged) {
    const replyChance = 0.3; // 30% chance to reply when not mentioned and idle
    const roll = Math.random();
    if (roll > replyChance) {
      console.log(`[Message] Skipping reply (random chance: ${(roll * 100).toFixed(1)}% > ${(replyChance * 100).toFixed(1)}%)`);
      return; // Don't reply this time
    }
    replyTrigger = `random chance (${(roll * 100).toFixed(1)}% < ${(replyChance * 100).toFixed(1)}%)`;
  }
  
  if (replyTrigger) {
    console.log(`[Message] Will reply - Trigger: ${replyTrigger}`);
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

  // Ignore completely empty messages (but always allow DMs)
  if (!query && !mentioned && !isDM) {
    console.log(`[Message] Skipping empty message (not a DM)`);
    return;
  }
  
  // For DMs, ensure we have something to work with
  if (isDM && !query) {
    query = message.content || 'hello'; // Use message content or default
    console.log(`[Message] DM with empty content, using: "${query}"`);
  }

  // Show typing indicator
  await message.channel.sendTyping();

  try {
    console.log(`[Message] Fetching conversation context...`);
    // Fetch last 15 messages for context
    const messages = await message.channel.messages.fetch({ limit: 15 });
    const messageArray = Array.from(messages.values())
      .reverse() // Reverse to get chronological order (oldest first)
      .filter(msg => {
        // Filter out other bots (keep e-kitten's messages) and messages with no text content
        return (!msg.author.bot || msg.author.id === client.user.id) && msg.content.trim().length > 0;
      });
    
    console.log(`[Message] Found ${messageArray.length} messages in context`);
    
    // Format conversation history for context
    const conversationHistory = messageArray.map(msg => {
      const author = msg.author.id === client.user.id ? 'E-KiTTY' : msg.author.displayName || msg.author.username;
      return `${author}: ${msg.content}`;
    }).join('\n');

    // Combine conversation history with current query
    const fullContext = conversationHistory ? `${conversationHistory}\n\nCurrent message to respond to: ${query}` : query;
    
    // Add explicit reminder to stay in character
    const responsePrompt = `${fullContext}\n\nRemember: You are E-KiTTY, a real person in this Discord server. Respond naturally as E-KiTTY would. Never mention being an AI, bot, or assistant. Stay in character completely.`;

    console.log(`[Message] Generating response with Gemini...`);
    // Generate response using Gemini with conversation context
    const result = await model.generateContent(responsePrompt);
    const response = await result.response;
    let text = response.text();
    
    console.log(`[GIF] Raw response from Gemini (first 200 chars): "${text.substring(0, 200)}..."`);
    
    // Clean up response - remove name prefixes and signatures
    // Remove any number of repeated name prefixes at the start (e.g., "E-KiTTY: E-KiTTY: E-KiTTY: message")
    // This regex matches one or more occurrences of name patterns at the start
    while (/^(E-KiTTY|E-Kitten|QT|QTest):\s*/i.test(text)) {
      text = text.replace(/^(E-KiTTY|E-Kitten|QT|QTest):\s*/i, '');
    }
    // Remove any trailing signatures like "- E-KiTTY" or "~ QT"
    text = text.replace(/\s*[-~]\s*(E-KiTTY|E-Kitten|QT|QTest)\s*$/gi, '');
    text = text.trim();
    
    if (text !== response.text()) {
      console.log(`[Message] Cleaned up response (removed name prefixes/signatures)`);
    }

    // Check if response includes a GIF request (format: "GIF: search term")
    const gifMatch = text.match(/GIF:\s*"([^"]+)"|GIF:\s*([^\n]+)/i);
    let gifSearchTerm = null;
    let gifUrl = null;
    let isForcedGif = false;

    if (gifMatch) {
      gifSearchTerm = (gifMatch[1] || gifMatch[2]).trim();
      console.log(`[GIF] ✅ Gemini suggested GIF: "${gifSearchTerm}"`);
      
      // Remove the GIF instruction from the text
      text = text.replace(/GIF:\s*"[^"]+"|GIF:\s*[^\n]+/gi, '').trim();
      console.log(`[GIF] Text after removing GIF instruction: "${text.substring(0, 100)}..."`);
      
      // Search for the GIF
      gifUrl = await searchGiphy(gifSearchTerm);
    } else {
      console.log(`[GIF] ❌ No GIF request detected in Gemini response`);
      
      // Forced GIF chance - add a GIF even if Gemini didn't suggest one (for testing)
      const FORCED_GIF_CHANCE = 0.05; // 5% chance to force a GIF
      if (Math.random() < FORCED_GIF_CHANCE) {
        // Random GIF search terms that fit E-KiTTY's personality
        const randomGifTerms = [
          'happy cat', 'cute cat', 'cat meme', 'cat dancing', 'cat excited',
          'hug', 'love', 'sparkles', 'happy', 'excited', 'cute', 'adorable',
          'laughing', 'funny', 'playful', 'cat reaction', 'cat gif'
        ];
        gifSearchTerm = randomGifTerms[Math.floor(Math.random() * randomGifTerms.length)];
        isForcedGif = true;
        console.log(`[GIF] 🎲 Forced GIF triggered! Random search term: "${gifSearchTerm}"`);
        
        // Search for the forced GIF
        gifUrl = await searchGiphy(gifSearchTerm);
      } else {
        console.log(`[GIF] Forced GIF chance not triggered (${(FORCED_GIF_CHANCE * 100).toFixed(1)}% chance)`);
      }
    }

    // Send the text response
    if (text.length > 0) {
      // Discord has a 2000 character limit per message
      if (text.length > 2000) {
        console.log(`[Message] Response too long (${text.length} chars), splitting into chunks`);
        // Split into chunks if too long
        const chunks = text.match(/.{1,1900}/g) || [];
        for (let i = 0; i < chunks.length; i++) {
          await message.reply({
            content: chunks[i],
            allowedMentions: { repliedUser: false },
          });
        }
        console.log(`[Message] ✅ Sent ${chunks.length} message(s) in ${channelName}`);
      } else {
        await message.reply({
          content: text,
          allowedMentions: { repliedUser: false },
        });
        console.log(`[Message] ✅ Replied in ${channelName}`);
      }
    }

    // Send GIF if found
    if (gifUrl) {
      try {
        console.log(`[GIF] Attempting to send GIF URL: ${gifUrl.substring(0, 50)}...`);
        await message.channel.send(gifUrl);
        console.log(`[GIF] ✅ Successfully sent ${isForcedGif ? 'forced ' : ''}GIF in ${channelName} (search: "${gifSearchTerm}")`);
      } catch (error) {
        console.error(`[GIF] ❌ Error sending GIF in ${channelName}:`, error.message);
        console.error(`[GIF] Full error:`, error);
      }
    } else if (gifSearchTerm) {
      console.log(`[GIF] ⚠️ Could not find GIF for "${gifSearchTerm}" ${isForcedGif ? '(forced)' : '(from Gemini)'}`);
    } else {
      console.log(`[GIF] No GIF to send (no search term generated)`);
    }
    
    // Update the timestamp when bot last spoke in this channel
    lastSpokeInChannel.set(channelId, Date.now());
    console.log(`[Message] Updated engagement tracking for ${channelName}`);
  } catch (error) {
    console.error('[Message] ❌ Error generating response:', error);
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

