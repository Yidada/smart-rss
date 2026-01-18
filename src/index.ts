import { parseArgs } from "util";
import { parseOpmlFile } from "./opml.ts";
import { fetchAllFeeds, type DateFilter } from "./rss.ts";
import { categorizeItems, saveCategorizedItems } from "./categorize.ts";
import { summarizeAllCategories } from "./summarize.ts";
import {
  ensureOutputDirectories,
  writeMarkdownOutput,
  writeMarkdownWithoutSummary,
  writeRssOutput,
  writeRssWithoutSummary,
  type OutputFormat,
} from "./output.ts";

const HELP_TEXT = `
smart-rss - Generate AI-powered summaries of your RSS feeds

Usage:
  bun run src/index.ts -i feeds.opml [options]

Options:
  -i, --input     OPML file path (required)
  -o, --output    Output directory (default: ./output)
  -s, --since     Filter items after date (ISO 8601)
  -u, --until     Filter items before date (ISO 8601)
  --no-summary    Skip AI summarization
  -f, --format    Output format: markdown, rss, all (default: all)
  -h, --help      Show help

Examples:
  bun run src/index.ts -i feeds.opml
  bun run src/index.ts -i feeds.opml --since 2024-01-11
  bun run src/index.ts -i feeds.opml -o ./my-output --no-summary
`;

interface CliArgs {
  input?: string;
  output: string;
  since?: string;
  until?: string;
  summary: boolean;
  format: OutputFormat;
  help: boolean;
}

function parseCliArgs(): CliArgs {
  const { values } = parseArgs({
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o", default: "./output" },
      since: { type: "string", short: "s" },
      until: { type: "string", short: "u" },
      summary: { type: "boolean", default: true },
      format: { type: "string", short: "f", default: "all" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowNegative: true,
  });

  return {
    input: values.input,
    output: values.output || "./output",
    since: values.since,
    until: values.until,
    summary: values.summary ?? true,
    format: (values.format as OutputFormat) || "all",
    help: values.help || false,
  };
}

function parseDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    console.error(`Invalid date format: ${dateStr}`);
    process.exit(1);
  }
  return date;
}

async function main() {
  const args = parseCliArgs();

  if (args.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (!args.input) {
    console.error("Error: Input OPML file is required (-i, --input)");
    console.log(HELP_TEXT);
    process.exit(1);
  }

  const dateFilter: DateFilter = {
    since: parseDate(args.since),
    until: parseDate(args.until),
  };

  console.log("smart-rss - RSS Feed Summarizer\n");

  // Step 1: Parse OPML
  console.log(`📂 Parsing OPML file: ${args.input}`);
  const opml = await parseOpmlFile(args.input);
  console.log(`   Found ${opml.feeds.length} feeds\n`);

  // Step 2: Fetch feeds
  console.log("📡 Fetching RSS feeds...");
  const items = await fetchAllFeeds(opml.feeds, dateFilter, (completed, total) => {
    process.stdout.write(`\r   Progress: ${completed}/${total} feeds`);
  });
  console.log(`\n   Fetched ${items.length} items\n`);

  // Step 3: Categorize items
  console.log("📁 Categorizing items...");
  const categorized = categorizeItems(items);
  const categories = Object.keys(categorized);
  console.log(`   Found ${categories.length} categories: ${categories.join(", ")}\n`);

  // Ensure output directories exist
  await ensureOutputDirectories(args.output);

  // Save raw categorized data
  console.log("💾 Saving raw categorized data...");
  await saveCategorizedItems(categorized, args.output);

  const today = new Date();
  const writtenFiles: string[] = [];

  // Step 4: Summarize (optional)
  if (args.summary) {
    console.log("\n🤖 Generating AI summaries...");
    const summaries = await summarizeAllCategories(
      categorized,
      (completed, total, category) => {
        console.log(`   [${completed}/${total}] Summarizing: ${category}`);
      }
    );

    // Step 5: Generate output
    if (args.format === "markdown" || args.format === "all") {
      console.log("\n📝 Generating Markdown files...");
      const mdFiles = await writeMarkdownOutput(summaries, args.output, today);
      writtenFiles.push(...mdFiles);
    }

    if (args.format === "rss" || args.format === "all") {
      console.log("📰 Generating RSS feeds...");
      const rssFiles = await writeRssOutput(summaries, args.output, today);
      writtenFiles.push(...rssFiles);
    }
  } else {
    console.log("\n⏭️  Skipping AI summarization (--no-summary)");

    // Generate output without summaries
    if (args.format === "markdown" || args.format === "all") {
      console.log("\n📝 Generating Markdown files...");
      const mdFiles = await writeMarkdownWithoutSummary(categorized, args.output, today);
      writtenFiles.push(...mdFiles);
    }

    if (args.format === "rss" || args.format === "all") {
      console.log("📰 Generating RSS feeds...");
      const rssFiles = await writeRssWithoutSummary(categorized, args.output, today);
      writtenFiles.push(...rssFiles);
    }
  }

  // Summary
  console.log("\n✅ Done!\n");
  console.log("Output files:");
  for (const file of writtenFiles) {
    console.log(`   ${file}`);
  }

  console.log(`\nStatistics:`);
  console.log(`   Feeds processed: ${opml.feeds.length}`);
  console.log(`   Items fetched: ${items.length}`);
  console.log(`   Categories: ${categories.length}`);
  console.log(`   Files generated: ${writtenFiles.length}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
