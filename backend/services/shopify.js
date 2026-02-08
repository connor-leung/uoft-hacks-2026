// Shopify Catalog API service
// Uses catalogClient for real API calls, falls back to mock for demo

import { searchProducts } from './catalogClient.js';

const FORCE_MOCK = process.env.SHOPIFY_USE_MOCK === 'true';
const ALLOW_MOCK_FALLBACK = process.env.SHOPIFY_FALLBACK_TO_MOCK === 'true';
const HAS_SHOPIFY_CREDS = Boolean(process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET);

export function normalizeProductSource(source) {
  if (source === 'amazon' || source === 'all') return source;
  return 'shopify';
}

export async function searchCatalog(query, limit = 5, source = 'shopify') {
  const normalizedSource = normalizeProductSource(source);

  if (normalizedSource === 'amazon') {
    return searchAmazonMock(query, limit);
  }

  if (normalizedSource === 'all') {
    const splitLimit = Math.max(1, Math.ceil(limit / 2));
    const [shopifyResult, amazonResult] = await Promise.all([
      searchShopifyCatalog(query, splitLimit),
      searchAmazonMock(query, splitLimit),
    ]);

    return {
      query,
      products: [...shopifyResult.products, ...amazonResult.products].slice(0, limit),
    };
  }

  return searchShopifyCatalog(query, limit);
}

export async function searchShopifyCatalog(query, limit = 5) {
  if (FORCE_MOCK) {
    console.log('[Shopify] Using mock data (SHOPIFY_USE_MOCK=true)');
    return searchMock(query, limit, 'shopify');
  }

  if (!HAS_SHOPIFY_CREDS) {
    console.warn('[Shopify] Missing credentials; returning no products');
    return { query, products: [] };
  }

  try {
    const products = await searchProducts(query, limit);

    // Transform to expected format
    const transformed = products.map(p => ({
      id: p.id,
      title: p.title,
      vendor: p.vendor,
      price: p.min_price,
      priceMax: p.max_price,
      image: p.image_url,
      url: p.product_url,
      marketplace: 'shopify',
    }));

    console.log(`[Shopify] Transformed products sample:`, transformed[0]);

    return {
      query,
      products: transformed,
    };
  } catch (error) {
    if (ALLOW_MOCK_FALLBACK) {
      console.error(`[Shopify] API error, falling back to mock:`, error.message);
      return searchMock(query, limit, 'shopify');
    }
    console.error('[Shopify] API error; returning no products:', error.message);
    return { query, products: [] };
  }
}

// Mock implementation for demo/development
async function searchMock(query, limit, marketplace = 'shopify') {
  console.log(`[Shopify] Mock search (${marketplace}): "${query}" (limit: ${limit})`);

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));

  const mockProducts = generateMockProducts(query, limit, marketplace);

  return {
    query,
    products: mockProducts,
  };
}

function generateMockProducts(query, limit, marketplace = 'shopify') {
  const words = query.toLowerCase().split(' ');
  const products = [];

  for (let i = 0; i < Math.min(limit, 3); i++) {
    const slug = `${words.join('-')}-${i + 1}`;
    const vendor = getRandomVendor(marketplace);
    products.push({
      id: `prod_${Date.now()}_${i}`,
      title: `${capitalize(query)} - Style ${i + 1}`,
      vendor,
      price: (Math.random() * 200 + 20).toFixed(2),
      image: `https://placehold.co/300x300/1a1a1a/ffffff?text=${encodeURIComponent(words[0] || 'Product')}`,
      url: marketplace === 'amazon'
        ? `https://www.amazon.com/s?k=${encodeURIComponent(query)}`
        : `https://example-shop.myshopify.com/products/${slug}`,
      marketplace,
    });
  }

  return products;
}

function capitalize(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

async function searchAmazonMock(query, limit) {
  console.log(`[Amazon] Using mock search for "${query}"`);
  return searchMock(query, limit, 'amazon');
}

function getRandomVendor(marketplace = 'shopify') {
  const vendors = marketplace === 'amazon'
    ? ['Amazon Basics', 'Anker', 'Levi\'s', 'New Balance', 'Adidas']
    : ['StyleCo', 'TrendHub', 'ModernWear', 'UrbanFinds', 'LuxeGoods'];
  return vendors[Math.floor(Math.random() * vendors.length)];
}
