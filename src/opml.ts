import { parseOpml } from "feedsmith";

export interface FeedInfo {
  url: string;
  title: string;
  category: string;
}

export interface ParsedOpml {
  title: string;
  feeds: FeedInfo[];
}

interface OpmlOutline {
  text?: string;
  title?: string;
  xmlUrl?: string;
  outlines?: OpmlOutline[];
}

function extractFeeds(
  outlines: OpmlOutline[],
  category: string = "Uncategorized"
): FeedInfo[] {
  const feeds: FeedInfo[] = [];

  for (const outline of outlines) {
    // If outline has xmlUrl, it's a feed
    if (outline.xmlUrl) {
      feeds.push({
        url: outline.xmlUrl,
        title: outline.title || outline.text || "Untitled",
        category,
      });
    }

    // If outline has children, process them recursively
    // The category is the parent outline's text/title
    if (outline.outlines && outline.outlines.length > 0) {
      const childCategory = outline.text || outline.title || category;
      feeds.push(...extractFeeds(outline.outlines, childCategory));
    }
  }

  return feeds;
}

export async function parseOpmlFile(filePath: string): Promise<ParsedOpml> {
  const file = Bun.file(filePath);
  const content = await file.text();

  const opml = parseOpml(content);

  if (!opml) {
    throw new Error("Failed to parse OPML file");
  }

  const outlines = (opml.body?.outlines || []) as OpmlOutline[];
  const feeds = extractFeeds(outlines);

  return {
    title: opml.head?.title || "RSS Feeds",
    feeds,
  };
}
