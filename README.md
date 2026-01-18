# smart-rss

Generate AI-powered summaries of your RSS feeds, organized by category.

## Features

- Parse OPML files to extract RSS feed subscriptions
- Fetch and aggregate RSS feed items with optional date filtering
- Organize content by category (from OPML structure)
- Generate AI summaries using OpenRouter (Gemini 3.0 Flash)
- Output as Markdown files with dated filenames
- Generate RSS feeds of summaries for easy consumption

## Tech Stack

- Bun runtime
- feedsmith for OPML/RSS parsing and generation
- OpenRouter API for AI summarization

## Installation

```bash
bun install
```

## Configuration

Create a `.env` file with your OpenRouter API key:

```bash
OPENROUTER_API_KEY=your-api-key-here
```

## Usage

```bash
# Basic usage
bun run src/index.ts -i feeds.opml

# With date filter (articles from last 7 days)
bun run src/index.ts -i feeds.opml --since 2024-01-11

# Custom output directory
bun run src/index.ts -i feeds.opml -o ./my-output

# Skip AI summarization (just categorize)
bun run src/index.ts -i feeds.opml --no-summary

# Markdown output only
bun run src/index.ts -i feeds.opml -f markdown
```

### CLI Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--input` | `-i` | Path to OPML file (required) | - |
| `--output` | `-o` | Output directory | `./output` |
| `--since` | `-s` | Filter items after date (ISO 8601) | - |
| `--until` | `-u` | Filter items before date (ISO 8601) | - |
| `--no-summary` | - | Skip AI summarization | `false` |
| `--format` | `-f` | Output format: `markdown`, `rss`, `all` | `all` |
| `--help` | `-h` | Show help message | - |

## Output Structure

```
output/
├── raw/                    # Raw categorized feed items (JSON)
│   └── {category}.json
├── summaries/              # AI-generated summaries (Markdown)
│   └── {date}-{category}.md
└── feeds/                  # RSS feeds of summaries
    └── {category}.xml
```

## License

MIT
