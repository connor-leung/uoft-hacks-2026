const API_ENDPOINT = 'http://localhost:3000/shop-frame';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'shopFrame') {
    return false;
  }

  handleShopFrame(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => {
      sendResponse({ ok: false, error: error.message || 'Request failed' });
    });

  return true;
});

async function handleShopFrame(message) {
  const blob = new Blob([message.image], { type: message.mimeType || 'image/jpeg' });
  const formData = new FormData();
  formData.append('frame', blob, message.filename || 'frame.jpg');

  console.log('[Background] Sending request to backend...');

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[Background] Server error:', response.status, text);
    throw new Error(`Server error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[Background] Received response:', JSON.stringify(data).slice(0, 500));
  return data;
}
