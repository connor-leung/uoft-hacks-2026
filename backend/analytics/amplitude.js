const AMPLITUDE_API_URL = 'https://api2.amplitude.com/2/httpapi';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 200;
const REQUEST_TIMEOUT_MS = 4000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetry(response) {
  if (!response) return true;
  return response.status >= 500 || response.status === 429;
}

export async function track(eventName, userId, eventProps = {}, userProps = undefined) {
  const apiKey = process.env.AMPLITUDE_API_KEY;
  const appEnv = process.env.APP_ENV || 'development';

  if (!apiKey || !eventName) return;

  const eventProperties = {
    app_env: appEnv,
    ...eventProps,
  };

  const payload = {
    api_key: apiKey,
    events: [
      {
        event_type: eventName,
        user_id: userId || 'anonymous',
        event_properties: eventProperties,
        user_properties: userProps,
        time: Date.now(),
      },
    ],
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      response = await fetch(AMPLITUDE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!shouldRetry(response)) return;
    } catch (error) {
      // Fail silently; retry only for network-like errors.
    }

    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * (2 ** attempt);
      await sleep(delay);
    }
  }
}
