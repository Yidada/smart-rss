import type { FeedItem } from "./rss.ts";

export interface CategorizedItems {
  [category: string]: FeedItem[];
}

export function categorizeItems(items: FeedItem[]): CategorizedItems {
  const categorized: CategorizedItems = {};

  for (const item of items) {
    const category = item.category || "Uncategorized";

    if (!categorized[category]) {
      categorized[category] = [];
    }

    categorized[category]!.push(item);
  }

  // Sort items within each category by publication date (newest first)
  for (const category of Object.keys(categorized)) {
    categorized[category]!.sort((a, b) => {
      if (!a.pubDate && !b.pubDate) return 0;
      if (!a.pubDate) return 1;
      if (!b.pubDate) return -1;
      return b.pubDate.getTime() - a.pubDate.getTime();
    });
  }

  return categorized;
}

export async function saveCategorizedItems(
  categorized: CategorizedItems,
  outputDir: string
): Promise<void> {
  const rawDir = `${outputDir}/raw`;
  await Bun.write(`${rawDir}/.gitkeep`, "");

  for (const [category, items] of Object.entries(categorized)) {
    const safeName = category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const filePath = `${rawDir}/${safeName}.json`;

    // Convert dates to ISO strings for JSON serialization
    const serializable = items.map((item) => ({
      ...item,
      pubDate: item.pubDate?.toISOString() || null,
    }));

    await Bun.write(filePath, JSON.stringify(serializable, null, 2));
  }
}
