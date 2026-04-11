// src/lib/slack.ts
// Slack WebClient singleton for sending notifications.
// Uses the bot token directly — all strategists are in the same Boldfy workspace.

import { WebClient } from '@slack/web-api';

let slackClient: WebClient | null = null;

export function getSlackClient(): WebClient {
  if (!slackClient) {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) throw new Error('SLACK_BOT_TOKEN not configured.');
    slackClient = new WebClient(token);
  }
  return slackClient;
}

/**
 * List channels the bot has been invited to.
 * Only returns channels where the bot is a member.
 */
export async function listSlackChannels(): Promise<{ id: string; name: string }[]> {
  const client = getSlackClient();
  const allChannels: { id: string; name: string }[] = [];
  let cursor: string | undefined = undefined;

  // Paginate through all channels
  do {
    const result = await client.conversations.list({
      types: 'public_channel,private_channel',
      exclude_archived: true,
      limit: 200,
      cursor,
    });

    const channels = (result.channels || [])
      .filter(ch => ch.is_member)
      .map(ch => ({ id: ch.id!, name: ch.name! }));

    allChannels.push(...channels);
    cursor = result.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return allChannels.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Send a Slack message using mrkdwn format.
 * Returns { ok, ts, error }.
 */
export async function sendSlackMessage(
  channelId: string,
  text: string
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const client = getSlackClient();
  try {
    const result = await client.chat.postMessage({
      channel: channelId,
      text,
      mrkdwn: true,
    });
    return { ok: true, ts: result.ts };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown Slack error';
    console.error('Slack message failed:', msg);
    return { ok: false, error: msg };
  }
}
