import { sql } from "@ace/shared/clients";
import { logger } from "@ace/shared/logger.js";

export interface CalendarEvent {
  title: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  description?: string;
  attendeeEmail?: string;
  timezone?: string;
}

// Load tokens from merchant_integrations table
async function loadGoogleTokens(merchantId: string) {
  const rows = await sql<{ access_token: string; refresh_token: string; token_expires_at: Date }[]>`
    SELECT access_token, refresh_token, token_expires_at
    FROM merchant_integrations
    WHERE merchant_id = ${merchantId} AND provider = 'google_calendar'
  `;
  return rows[0] || null;
}

export async function refreshGoogleTokens(merchantId: string): Promise<string | null> {
  try {
    const tokens = await loadGoogleTokens(merchantId);
    if (!tokens || !tokens.refresh_token) {
      logger.error(`[googleCalendar] No refresh token for merchant ${merchantId}`);
      return null;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.error(`[googleCalendar] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET`);
      return null;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[googleCalendar] Failed to refresh token: ${response.status} ${errorText}`);
      return null;
    }

    const data = await response.json() as any;
    const newAccessToken = data.access_token;
    const expiresIn = data.expires_in; // in seconds
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await sql`
      UPDATE merchant_integrations
      SET access_token = ${newAccessToken}, token_expires_at = ${expiresAt}
      WHERE merchant_id = ${merchantId} AND provider = 'google_calendar'
    `;

    return newAccessToken;
  } catch (error) {
    logger.error(`[googleCalendar] Error refreshing token for ${merchantId}:`, error);
    return null;
  }
}

export async function createCalendarEvent(merchantId: string, event: CalendarEvent): Promise<{ calEventId: string | null; calLink: string | null }> {
  try {
    let tokens = await loadGoogleTokens(merchantId);
    if (!tokens || !tokens.access_token) {
      return { calEventId: null, calLink: null };
    }

    let accessToken = tokens.access_token;
    
    // Check expiry
    if (tokens.token_expires_at && new Date() >= new Date(tokens.token_expires_at.getTime() - 60000)) {
       const newToken = await refreshGoogleTokens(merchantId);
       if (!newToken) return { calEventId: null, calLink: null };
       accessToken = newToken;
    }

    const body: any = {
      summary: event.title,
      start: { dateTime: event.startTime, timeZone: event.timezone || 'UTC' },
      end: { dateTime: event.endTime, timeZone: event.timezone || 'UTC' },
    };
    if (event.description) body.description = event.description;
    if (event.attendeeEmail) body.attendees = [{ email: event.attendeeEmail }];

    let res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      const newToken = await refreshGoogleTokens(merchantId);
      if (!newToken) return { calEventId: null, calLink: null };
      accessToken = newToken;

      res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    }

    if (!res.ok) {
      const errorText = await res.text();
      logger.error(`[googleCalendar] Failed to create event: ${res.status} ${errorText}`);
      return { calEventId: null, calLink: null };
    }

    const data = await res.json() as any;
    return { calEventId: data.id, calLink: data.htmlLink };
  } catch (error) {
    logger.error(`[googleCalendar] Error creating event for ${merchantId}:`, error);
    return { calEventId: null, calLink: null };
  }
}

export async function deleteCalendarEvent(merchantId: string, googleEventId: string): Promise<boolean> {
  try {
    let tokens = await loadGoogleTokens(merchantId);
    if (!tokens || !tokens.access_token) return false;

    let accessToken = tokens.access_token;

    if (tokens.token_expires_at && new Date() >= new Date(tokens.token_expires_at.getTime() - 60000)) {
       const newToken = await refreshGoogleTokens(merchantId);
       if (!newToken) return false;
       accessToken = newToken;
    }

    let res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (res.status === 401) {
      const newToken = await refreshGoogleTokens(merchantId);
      if (!newToken) return false;
      accessToken = newToken;

      res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
    }

    if (!res.ok) {
      const errorText = await res.text();
      logger.error(`[googleCalendar] Failed to delete event: ${res.status} ${errorText}`);
      return false;
    }

    return true;
  } catch (error) {
    logger.error(`[googleCalendar] Error deleting event for ${merchantId}:`, error);
    return false;
  }
}

export async function checkFreeBusy(merchantId: string, timeMin: string, timeMax: string): Promise<Array<{start: string; end: string}>> {
  try {
    let tokens = await loadGoogleTokens(merchantId);
    if (!tokens || !tokens.access_token) return [];

    let accessToken = tokens.access_token;

    if (tokens.token_expires_at && new Date() >= new Date(tokens.token_expires_at.getTime() - 60000)) {
       const newToken = await refreshGoogleTokens(merchantId);
       if (!newToken) return [];
       accessToken = newToken;
    }

    const body = {
      timeMin,
      timeMax,
      items: [{ id: 'primary' }],
    };

    let res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      const newToken = await refreshGoogleTokens(merchantId);
      if (!newToken) return [];
      accessToken = newToken;

      res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    }

    if (!res.ok) {
      const errorText = await res.text();
      logger.error(`[googleCalendar] Failed to check free/busy: ${res.status} ${errorText}`);
      return [];
    }

    const data = await res.json() as any;
    const busy = data.calendars?.primary?.busy || [];
    return busy;
  } catch (error) {
    logger.error(`[googleCalendar] Error checking free/busy for ${merchantId}:`, error);
    return [];
  }
}
