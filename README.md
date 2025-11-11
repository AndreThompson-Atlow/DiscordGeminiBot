# Discord Gemini Bot

A simple Discord bot that integrates with Google's Gemini AI for text generation.

## Features

- Responds to messages that mention the bot or use a command prefix
- Uses Google's Gemini 2.5 Flash model for AI-powered responses
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
   - Copy `.env.example` to `.env`
   - Fill in your Discord bot token and Gemini API key:
     ```
     DISCORD_TOKEN=your_discord_bot_token_here
     GEMINI_API_KEY=your_gemini_api_key_here
     BOT_PREFIX=!
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
- Messages that mention the bot: `@YourBotName your question here`
- Messages starting with the prefix: `!your question here` (default prefix is `!`)

## Configuration

- `DISCORD_TOKEN`: Your Discord bot token (required)
- `GEMINI_API_KEY`: Your Google Gemini API key (required)
- `BOT_PREFIX`: Command prefix for the bot (optional, defaults to `!`)

## License

MIT

