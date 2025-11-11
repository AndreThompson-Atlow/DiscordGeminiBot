# Discord Gemini Bot

A simple Discord bot that integrates with Google's Gemini AI for text generation.

## Features

- Always responds when mentioned with @
- Acts as an independent community member, occasionally joining conversations (10-15% chance)
- Uses Google's Gemini 2.5 Flash model for AI-powered responses
- Customizable personality through system instructions
- Handles long responses by splitting them into multiple messages
- Easy to configure and deploy

## Prerequisites

- Node.js (v18 or higher recommended)
- A Discord Bot Token
- A Google Gemini API Key

## Setup

1. **Clone or download this repository**

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Create a `.env` file with your configuration:
     ```
     DISCORD_TOKEN=your_discord_bot_token_here
     GEMINI_API_KEY=your_gemini_api_key_here
     REPLY_CHANCE=0.12
     BOT_PERSONALITY=You are e-kitten, a friendly and playful Discord bot...
     ```

4. **Get a Discord Bot Token**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to the "Bot" section
   - Create a bot and copy the token
   - Enable "Message Content Intent" under "Privileged Gateway Intents"
   - Invite the bot to your server with the following permissions:
     - Send Messages
     - Read Message History
     - Use Slash Commands (optional)

5. **Get a Gemini API Key**
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key to your `.env` file

## Running the Bot

```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Usage

The bot responds to:
- **Always** when mentioned: `@YourBotName your question here`
- **Occasionally** (10-15% chance) to regular messages in the chat, acting as a community member

## Configuration

- `DISCORD_TOKEN`: Your Discord bot token (required)
- `GEMINI_API_KEY`: Your Google Gemini API key (required)
- `REPLY_CHANCE`: Probability (0.0-1.0) for the bot to reply to non-mentioned messages (optional, defaults to `0.12` for 12%)
- `BOT_PERSONALITY`: System instruction/personality prompt for the bot (optional, has a default friendly personality)

## License

MIT

