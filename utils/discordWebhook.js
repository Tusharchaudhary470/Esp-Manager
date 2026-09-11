/**
 * Discord Webhook Notification Utility for Rosterly
 * Posts sleek, colored embeds directly into squad Discord channels.
 */

const User = require('../models/User');

const BOT_NAME = 'Rosterly';
const FOOTER_TEXT = 'Rosterly — Squad Operations & Treasury';

/**
 * Resolves an actor's display username from their User ObjectId.
 */
async function getActorName(actor) {
  if (!actor) return 'Captain';
  if (typeof actor === 'string' && actor.length !== 24) return actor;
  try {
    const user = await User.findById(actor).select('username').lean();
    return user?.username || 'Captain';
  } catch {
    return 'Captain';
  }
}

/**
 * Validates whether a string is a legitimate Discord webhook URL.
 */
function isValidDiscordWebhook(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'discord.com' || parsed.hostname === 'discordapp.com') &&
      parsed.pathname.startsWith('/api/webhooks/')
    );
  } catch {
    return false;
  }
}

/**
 * Dispatches an embed payload to a Discord webhook URL.
 */
async function postToDiscord(webhookUrl, embed) {
  if (!isValidDiscordWebhook(webhookUrl)) return false;

  try {
    const payload = {
      username: BOT_NAME,
      embeds: [
        {
          ...embed,
          timestamp: new Date().toISOString(),
          footer: {
            text: FOOTER_TEXT
          }
        }
      ]
    };

    const response = await fetch(webhookUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Discord Webhook Rejected ${response.status}]:`, errText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Discord Webhook Network Error]:', error.message);
    return false;
  }
}

/**
 * 1. Match / Lobby Result Notification
 */
async function sendMatchWebhook(team, match, actor = 'Captain') {
  if (!team?.discordWebhookUrl || !team?.webhookNotifications?.matchResults) return;

  const actorUsername = await getActorName(actor);
  const entryFee = Number(match.entryFee || 0);
  const profit = Number(match.profit || 0);
  const net = profit - entryFee;
  const isWin = net >= 0;

  const embed = {
    title: isWin ? `🏆 Match Victory — ${team.name}` : `⚔️ Match Logged — ${team.name}`,
    description: match.description ? `**Note:** ${match.description}` : 'Competitive lobby recorded.',
    color: isWin ? 0x10b981 : 0xf43f5e, // Emerald Green or Rose Red
    fields: [
      { name: '💰 Entry Fee', value: `₹${entryFee.toLocaleString('en-IN')}`, inline: true },
      { name: '🎯 Prize / Return', value: `₹${profit.toLocaleString('en-IN')}`, inline: true },
      { 
        name: isWin ? '📈 Net Profit' : '📉 Net Deficit', 
        value: `**${isWin ? '+' : ''}₹${net.toLocaleString('en-IN')}**`, 
        inline: true 
      },
      { name: '🏦 Vault Balance', value: `₹${Number(team.balance || 0).toLocaleString('en-IN')}`, inline: true },
      { name: '👤 Logged By', value: actorUsername, inline: true }
    ]
  };

  return postToDiscord(team.discordWebhookUrl, embed);
}

/**
 * 2. Player Payout Notification
 */
async function sendPayoutWebhook(team, payout, actor = 'Captain') {
  if (!team?.discordWebhookUrl || !team?.webhookNotifications?.payouts) return;

  const actorUsername = await getActorName(actor);
  const amount = Number(payout.amount || 0);
  const recipient = payout.recipientName || 'Squad Member';

  const embed = {
    title: `💸 Member Payout Issued — ${team.name}`,
    description: `A payout has been disbursed to **${recipient}**.`,
    color: 0xf59e0b, // Amber Gold
    fields: [
      { name: '👤 Paid To', value: `**${recipient}**`, inline: true },
      { name: '💵 Amount', value: `**₹${amount.toLocaleString('en-IN')}**`, inline: true },
      { name: '📝 Description', value: payout.description || 'Earnings distribution', inline: true },
      { name: '🏦 Remaining Vault', value: `₹${Number(team.balance || 0).toLocaleString('en-IN')}`, inline: true },
      { name: '🛡️ Authorized By', value: actorUsername, inline: true }
    ]
  };

  return postToDiscord(team.discordWebhookUrl, embed);
}

/**
 * 3. Treasury Movement (Deposit / Withdrawal)
 */
async function sendTreasuryWebhook(team, transaction, actor = 'Captain') {
  if (!team?.discordWebhookUrl || !team?.webhookNotifications?.treasury) return;

  const actorUsername = await getActorName(actor);
  const isDeposit = transaction.type === 'deposit';
  const amount = Number(transaction.amount || 0);

  const embed = {
    title: isDeposit ? `📥 Treasury Deposit — ${team.name}` : `📤 Treasury Withdrawal — ${team.name}`,
    description: transaction.description || (isDeposit ? 'Manual treasury deposit' : 'Manual treasury withdrawal'),
    color: isDeposit ? 0x06b6d4 : 0xf97316, // Cyan or Orange
    fields: [
      { name: '💰 Amount', value: `**₹${amount.toLocaleString('en-IN')}**`, inline: true },
      { name: '🏦 New Balance', value: `**₹${Number(team.balance || 0).toLocaleString('en-IN')}**`, inline: true },
      { name: '👤 Action By', value: actorUsername, inline: true }
    ]
  };

  return postToDiscord(team.discordWebhookUrl, embed);
}

/**
 * 4. Tournament Scheduled or Updated
 */
async function sendTournamentWebhook(team, tournament, actor = 'Captain', action = 'scheduled') {
  if (!team?.discordWebhookUrl || !team?.webhookNotifications?.tournaments) return;

  const actorUsername = await getActorName(actor);
  const isEdit = action === 'updated';
  const prizePool = Number(tournament.entryFee || 0);

  const fields = [
    { name: '🏆 Tournament', value: tournament.name, inline: true },
    { name: '📅 Date & Time', value: tournament.date || 'TBD', inline: true },
    { name: '💎 Prize Pool', value: `₹${prizePool.toLocaleString('en-IN')}`, inline: true },
    { name: '🛡️ Scheduled By', value: actorUsername, inline: true }
  ];

  if (Array.isArray(tournament.lineup) && tournament.lineup.length > 0) {
    const starters = tournament.lineup.filter(p => p.role !== 'Substitute').map(p => p.playerName);
    const subs = tournament.lineup.filter(p => p.role === 'Substitute').map(p => p.playerName);
    const lineupParts = [];
    if (starters.length > 0) lineupParts.push(`⭐ **Starters:** ${starters.join(', ')}`);
    if (subs.length > 0) lineupParts.push(`🔄 **Substitutes:** ${subs.join(', ')}`);
    if (lineupParts.length > 0) {
      fields.push({ name: '👥 Squad Lineup', value: lineupParts.join('\n'), inline: false });
    }
  }

  const embed = {
    title: isEdit ? `🔄 Tournament Updated — ${team.name}` : `📅 Tournament Scheduled — ${team.name}`,
    description: `**${tournament.name}** has been ${isEdit ? 'updated' : 'added to the squad calendar'}.`,
    color: 0x8b5cf6, // Violet / Purple
    fields
  };

  return postToDiscord(team.discordWebhookUrl, embed);
}

/**
 * 5. Test Webhook Ping
 */
async function sendTestWebhook(webhookUrl, squadName = 'Your Squad') {
  const embed = {
    title: `⚡ Webhook Connected — ${squadName}`,
    description: `Rosterly has successfully established a connection with your Discord channel! Automated alerts will now be posted here for match victories, payouts, and tournaments.`,
    color: 0x3b82f6, // Electric Blue
    fields: [
      { name: '📡 Status', value: 'Active & Verified', inline: true },
      { name: '🛡️ Squad', value: squadName, inline: true },
      { name: '⚙️ Powered By', value: 'Rosterly Webhooks', inline: true }
    ]
  };

  return postToDiscord(webhookUrl, embed);
}

module.exports = {
  isValidDiscordWebhook,
  postToDiscord,
  sendMatchWebhook,
  sendPayoutWebhook,
  sendTreasuryWebhook,
  sendTournamentWebhook,
  sendTestWebhook
};
