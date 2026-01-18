import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { searchShopifyCatalog } from './shopify.js';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

// Function declaration for Gemini function calling
const SEARCH_TOOL = {
  name: 'searchShopifyCatalog',
  description: 'Search the Shopify product catalog for purchasable items. Call this function for each distinct product you identify in the image. Make 5-8 calls total for different items.',
  parameters: {
    type: 'object',
    properties: {
      item: {
        type: 'string',
        description: 'Short label for the item you identified (e.g., "black tee", "leather crossbody bag").',
      },
      query: {
        type: 'string',
        description: 'A detailed, search-optimized product query. Include specific attributes like color, material, style, and brand (if visible). Example: "navy blue crew neck cashmere sweater" or "black leather crossbody bag with gold hardware"',
      },
      confidence: {
        type: 'number',
        description: 'Confidence in this item identification from 0.0 to 1.0.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of products to return (1-5). Default is 3.',
      },
    },
    required: ['query'],
  },
};

const AGENT_EXTRACT_PROMPT = `You are a shopping assistant that helps users find and purchase items they see in YouTube videos.

Analyze this video screenshot and list 5-8 distinct purchasable items.

Return ONLY a JSON array with objects in this shape:
[
  { "item": "short item label", "confidence": 0.0-1.0 }
]

Rules:
- Only physical products that can be purchased
- Use short, concrete labels (e.g., "black graphic tee", "brown leather tote bag")
- Confidence is how sure you are the item is visible
- No extra text, only valid JSON`;

const AGENT_PROMPT = `You are a shopping assistant that helps users find and purchase items they see in YouTube videos.

Analyze this video screenshot carefully. Your task is to:
1. Identify 5-8 distinct purchasable items visible in the image
2. For EACH item, call the searchShopifyCatalog function with a detailed search query

RULES FOR IDENTIFYING ITEMS:
- Only identify physical products that can be purchased
- Include specific details: color, material, pattern, style when clearly visible
- Only include brand names if a logo or text is CLEARLY visible
- Prioritize prominent, clearly visible items
- Ignore: people's faces, backgrounds, UI elements, non-purchasable items

RULES FOR SEARCH QUERIES:
- Be specific and descriptive (e.g., "distressed light wash high waisted mom jeans" not "jeans")
- Include color, material, style attributes when visible
- Optimize for ecommerce search engines
- Avoid generic words like "nice", "cool", "item"

Make exactly 5-8 function calls, one for each distinct item you identify.`;

export async function analyzeImageWithFunctionCalling(imagePath) {
  const frameItems = await extractFrameItems(imagePath);

  console.log(`[Gemini] Extracted ${frameItems.length} frame items`);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    tools: [{ functionDeclarations: [SEARCH_TOOL] }],
  });

  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'image/jpeg';

  console.log('[Gemini] Starting search query generation with function calling...');

  // Initial request with image
  const result = await model.generateContent([
    `${AGENT_PROMPT}\n\nIdentified items:\n${JSON.stringify(frameItems, null, 2)}`,
    {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    },
  ]);

  const response = result.response;
  const functionCalls = extractFunctionCalls(response);

  console.log(`[Gemini] Received ${functionCalls.length} function calls`);

  // Execute all function calls in parallel
  const searchResults = await Promise.all(
    functionCalls.slice(0, 8).map(async (call) => {
      const { query, limit = 3 } = call.args;
      try {
        return await searchShopifyCatalog(query, limit);
      } catch (error) {
        console.error(`[Gemini] Search failed for "${query}":`, error.message);
        return { query, products: [] };
      }
    })
  );

  const results = buildRankedResults(functionCalls, searchResults);

  console.log(`[Gemini] Returning ${results.length} item result groups`);

  return {
    frameItems,
    results,
  };
}

async function extractFrameItems(imagePath) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
  });

  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'image/jpeg';

  console.log('[Gemini] Extracting frame items...');

  const result = await model.generateContent([
    AGENT_EXTRACT_PROMPT,
    {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    },
  ]);

  const text = result.response?.text?.() || '';
  const items = parseJsonArray(text);

  if (!Array.isArray(items)) return [];

  return items
    .filter(item => item && item.item)
    .slice(0, 8)
    .map(item => ({
      item: String(item.item).trim(),
      confidence: toConfidence(item.confidence),
    }));
}

function buildRankedResults(functionCalls, searchResults) {
  const seenUrls = new Set();
  const results = [];

  for (let i = 0; i < searchResults.length; i++) {
    const call = functionCalls[i];
    const result = searchResults[i];
    const products = dedupeAndRankProducts(result.products || [], seenUrls);

    results.push({
      item: {
        query: call.args?.query || result.query,
        confidence: toConfidence(call.args?.confidence),
      },
      products,
    });
  }

  return results;
}

function extractFunctionCalls(response) {
  const calls = [];

  for (const candidate of response.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.functionCall) {
        calls.push({
          name: part.functionCall.name,
          args: part.functionCall.args || {},
        });
      }
    }
  }

  return calls;
}

function dedupeAndRankProducts(products, seenUrls) {
  const scored = [];

  for (const product of products) {
    if (!product || !product.url) continue;
    if (seenUrls.has(product.url)) continue;
    seenUrls.add(product.url);

    scored.push({
      product,
      score: scoreProduct(product),
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .map(entry => entry.product);
}

function scoreProduct(product) {
  let score = 0;
  if (product.image) score += 2;
  if (product.price) score += 2;
  if (product.vendor) score += 1;
  if (product.url) score += 1;
  return score;
}

function parseJsonArray(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (error) {
    console.warn('[Gemini] Failed to parse JSON array');
    return [];
  }
}

function toConfidence(value) {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(num)) return 0.5;
  return Math.max(0, Math.min(1, num));
}

// Keep the old function for backwards compatibility
export async function analyzeImage(imagePath) {
  return analyzeImageWithFunctionCalling(imagePath);
}
