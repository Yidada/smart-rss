import OpenAI from "openai";
import type { FeedItem } from "./rss.ts";
import type { CategorizedItems } from "./categorize.ts";

const DEFAULT_MODEL = "google/gemini-2.0-flash-001";
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export interface CategorySummary {
  category: string;
  overview: string;
  highlights: string[];
  items: FeedItem[];
}

function getClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY environment variable is required for AI summarization"
    );
  }

  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });
}

function buildPrompt(category: string, items: FeedItem[]): string {
  const articlesText = items
    .slice(0, 50) // Limit to 50 articles to avoid token limits
    .map((item, index) => {
      const date = item.pubDate
        ? item.pubDate.toLocaleDateString()
        : "Unknown date";
      const description = item.description
        ? item.description.slice(0, 500)
        : "No description";
      return `${index + 1}. "${item.title}" (${item.feedTitle}, ${date})\n   ${description}`;
    })
    .join("\n\n");

  return `You are a content curator summarizing RSS feed articles for the category "${category}".

Here are the articles:

${articlesText}

Please provide:
1. A concise overview paragraph (2-3 sentences) summarizing the main themes and trends in this category
2. 3-5 key highlights, each as a single sentence mentioning specific articles with their titles

Format your response as JSON:
{
  "overview": "Your overview paragraph here",
  "highlights": ["Highlight 1", "Highlight 2", "Highlight 3"]
}

Only respond with valid JSON, no additional text.`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function summarizeCategory(
  client: OpenAI,
  category: string,
  items: FeedItem[],
  model: string
): Promise<{ overview: string; highlights: string[] }> {
  const prompt = buildPrompt(category, items);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("No response content from AI");
      }

      // Parse JSON response
      const parsed = JSON.parse(content);

      return {
        overview: parsed.overview || "No overview available.",
        highlights: parsed.highlights || [],
      };
    } catch (error) {
      if (attempt < MAX_RETRIES - 1) {
        console.error(
          `Attempt ${attempt + 1} failed for ${category}, retrying...`
        );
        await sleep(RETRY_DELAY * (attempt + 1));
      } else {
        console.error(`Failed to summarize ${category} after ${MAX_RETRIES} attempts:`, error);
        return {
          overview: "Summary could not be generated.",
          highlights: [],
        };
      }
    }
  }

  return {
    overview: "Summary could not be generated.",
    highlights: [],
  };
}

export async function summarizeAllCategories(
  categorized: CategorizedItems,
  onProgress?: (completed: number, total: number, category: string) => void
): Promise<CategorySummary[]> {
  const client = getClient();
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  const categories = Object.keys(categorized);
  const summaries: CategorySummary[] = [];

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    if (!category) continue;

    const items = categorized[category];
    if (!items) continue;

    onProgress?.(i + 1, categories.length, category);

    if (items.length === 0) {
      summaries.push({
        category,
        overview: "No articles in this category.",
        highlights: [],
        items: [],
      });
      continue;
    }

    const { overview, highlights } = await summarizeCategory(
      client,
      category,
      items,
      model
    );

    summaries.push({
      category,
      overview,
      highlights,
      items,
    });
  }

  return summaries;
}
