# PEL Team Bot

Production-ready multi-server Discord bot for **PEL (Pro Esports League)** – EA FC Pro Clubs teams.

Any team can invite the bot to their Discord server. Most day-to-day management can be done either with slash commands or from a small configuration panel in the Team Captain profile on the PEL website.

---

## Features

| Feature | Discord Command | Website API |
|---------|-----------------|-------------|
| Link server to team | `/link` | – |
| Configure channels | `/setup` | `PATCH /guild/:id/channels` |
| Roster (add/remove/list) | `/roster` | – |
| Auto-updating `#roster` channel | Automatic | `POST .../roster/refresh` |
| Team news | `/news` | `POST .../news` |
| Fixtures & Results | `/fixture` | `POST .../fixture` + result endpoint |
| Line-ups | `/lineup` | `POST .../lineup` |
| Availability checks | `/availability` | `POST .../availability` |
| Discord Scheduled Events | `/event` | – |
| Help | `/help` | – |

### Channels the bot uses
- `#news`
- `#fixtures-and-results`
- `#lineups`
- `#availability` (or any channel chosen by the captain)
- `#roster` (auto-refreshed list with country + position)
- `#schedule` (optional, for event announcements)

---

## Tech Stack

- **discord.js** v14
- **TypeScript**
- **Prisma** + **PostgreSQL**
- **Express** REST API (for the website)

---

## Setup Instructions

### 1. Discord Application
You already created the application and have the token.

Make sure these **Privileged Gateway Intents** are enabled:
- Server Members Intent
- Message Content Intent (optional)

### 2. Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_client_id
DATABASE_URL="postgresql://user:password@host:5432/pel_bot?schema=public"
API_SECRET=generate_a_long_random_string_here_32chars_min
PORT=3000
NODE_ENV=production
```

### 3. Install & Database
```bash
npm install
npx prisma generate
npx prisma db push
```

### 4. Run
**Development** (hot reload):
```bash
npm run dev
```

**Production**:
```bash
npm run build
npm start
```

### 5. Invite the bot
Use the OAuth2 URL Generator in the Discord Developer Portal with:
- Scopes: `bot` + `applications.commands`
- Permissions: Manage Roles, Manage Events, Send Messages, Embed Links, Attach Files, Read Message History, Add Reactions, Use Slash Commands, Manage Messages

---

## Website Integration (Captain Panel)

All endpoints require the header:
```
x-api-key: your_API_SECRET
```

### Main endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/guild/:guildId` | Get full config + active roster |
| PATCH | `/guild/:guildId/channels` | Update channel IDs |
| POST | `/guild/:guildId/availability` | Create availability check |
| GET | `/guild/:guildId/availability/:checkId` | Get responses |
| POST | `/guild/:guildId/news` | Post news |
| POST | `/guild/:guildId/fixture` | Post fixture |
| PATCH | `/guild/:guildId/fixture/:fixtureId/result` | Update score |
| POST | `/guild/:guildId/lineup` | Post line-up |
| POST | `/guild/:guildId/roster/refresh` | Force roster channel update |
| GET | `/health` | Health check (no auth) |

### Example – Create availability check
```json
POST /guild/123456789012345678/availability
{
  "title": "Thursday League Match",
  "description": "Please confirm by Wednesday night",
  "eventDate": "2026-10-09T20:00:00.000Z",
  "createdBy": "captainDiscordId"
}
```

### Example – Post line-up
```json
POST /guild/123456789012345678/lineup
{
  "title": "vs Titans - Matchday 4",
  "formation": "4-3-3",
  "players": [
    { "position": "GK", "name": "Alex" },
    { "position": "CB", "name": "John" },
    { "position": "CB", "name": "Mike" },
    { "position": "ST", "name": "Carlos" }
  ]
}
```

---

## Recommended Hosting

- **Railway** or **Render** → both support Node.js + PostgreSQL easily
- Keep `API_SECRET` private (never put it in frontend code)
- Use environment variables for everything sensitive

---

## Command List

```
/link          → Link this server to a PEL team
/setup         → Configure all channels
/roster        → add | remove | list | refresh
/news          → Post team news
/fixture       → add | result | list
/lineup        → Post a formation + players
/availability  → create | results | list
/event         → Create Discord Scheduled Event
/help          → This help message
```

---

Built for PEL – Pro Esports League  
Season 4 • EA FC Pro Clubs Competitive
