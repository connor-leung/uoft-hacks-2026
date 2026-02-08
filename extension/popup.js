const STORAGE_KEYS = {
  enabled: 'stfEnabled',
  productSource: 'stfProductSource',
};

const DEFAULT_SETTINGS = {
  enabled: true,
  productSource: 'shopify',
};

const enabledToggle = document.getElementById('enabled-toggle');
const productSourceSelect = document.getElementById('product-source');

init().catch((error) => {
  console.error('[Popup] Failed to initialize:', error);
});

async function init() {
  const settings = await loadSettings();
  enabledToggle.checked = settings.enabled;
  productSourceSelect.value = settings.productSource;

  enabledToggle.addEventListener('change', saveSettings);
  productSourceSelect.addEventListener('change', saveSettings);
}

async function loadSettings() {
  const storage = await chrome.storage.local.get({
    [STORAGE_KEYS.enabled]: DEFAULT_SETTINGS.enabled,
    [STORAGE_KEYS.productSource]: DEFAULT_SETTINGS.productSource,
  });

  return {
    enabled: storage[STORAGE_KEYS.enabled] !== false,
    productSource: normalizeProductSource(storage[STORAGE_KEYS.productSource]),
  };
}

async function saveSettings() {
  const payload = {
    [STORAGE_KEYS.enabled]: enabledToggle.checked,
    [STORAGE_KEYS.productSource]: normalizeProductSource(productSourceSelect.value),
  };

  await chrome.storage.local.set(payload);
}

function normalizeProductSource(source) {
  if (source === 'amazon' || source === 'all') return source;
  return 'shopify';
}
