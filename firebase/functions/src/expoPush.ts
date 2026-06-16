import * as functions from 'firebase-functions';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: 'default' | null;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoPushResponse {
  data: ExpoPushTicket[];
}

export async function sendExpoPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<boolean> {
  if (
    !expoPushToken.startsWith('ExponentPushToken[')
    && !expoPushToken.startsWith('ExpoPushToken[')
  ) {
    functions.logger.warn('[push] token is not an Expo push token — skipping', {
      tokenPrefix: expoPushToken.slice(0, 20),
    });
    return false;
  }

  const message: ExpoPushMessage = {
    to: expoPushToken,
    title,
    body,
    data,
    sound: 'default',
    channelId: 'default',
    priority: 'high',
  };

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    functions.logger.warn('[push] Expo API HTTP error', {
      status: response.status,
      statusText: response.statusText,
    });
    return false;
  }

  const result = (await response.json()) as ExpoPushResponse;
  const ticket = result.data?.[0];

  if (!ticket) {
    functions.logger.warn('[push] Expo API returned no ticket', { result });
    return false;
  }

  if (ticket.status === 'error') {
    functions.logger.warn('[push] Expo push failed', {
      message: ticket.message,
      details: ticket.details,
    });
    return false;
  }

  functions.logger.info('[push] sent', {
    ticketId: ticket.id,
    title,
    body,
  });

  return true;
}
