import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const VISION_PROMPT = `You are a shopping assistant that analyzes video screenshots to identify purchasable items.

Analyze this YouTube screenshot and identify 5-8 distinct purchasable items visible in the image.

RULES:
- Only identify items that can be purchased (physical products)
- Include specific details: color, material, pattern when clearly visible
- Only include brand names if a logo or brand text is CLEARLY visible in the image
- Create search-optimized phrases suitable for ecommerce search (e.g., "navy blue crew neck wool sweater" not "sweater")
- Avoid generic terms like "item", "thing", "object"
- Focus on: clothing, accessories, electronics, furniture, decor, beauty products
- Ignore: people, backgrounds, UI elements, non-purchasable items

CATEGORIES (use exactly these values):
- apparel: clothing, shoes, accessories, jewelry, bags
- electronics: devices, gadgets, cables, tech accessories
- home: furniture, decor, kitchenware, bedding, storage
- beauty: makeup, skincare, haircare, fragrances
- other: anything that doesn't fit above categories

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "items": [
    {
      "query": "detailed ecommerce search phrase",
      "category": "apparel|electronics|home|beauty|other",
      "confidence": 0.0-1.0
    }
  ]
}`;

export async function analyzeImage(imagePath) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'image/jpeg';

  const result = await model.generateContent([
    VISION_PROMPT,
    {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    },
  ]);

  const response = result.response;
  const text = response.text();

  // Parse JSON response, stripping any markdown code blocks if present
  let jsonText = text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(jsonText);

  // Validate and sanitize response
  if (!parsed.items || !Array.isArray(parsed.items)) {
    throw new Error('Invalid response structure from Gemini');
  }

  // Ensure 5-8 items max
  const items = parsed.items.slice(0, 8).map(item => ({
    query: String(item.query || '').trim(),
    category: ['apparel', 'electronics', 'home', 'beauty', 'other'].includes(item.category)
      ? item.category
      : 'other',
    confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0)),
  })).filter(item => item.query.length > 0);

  return { items };
}
