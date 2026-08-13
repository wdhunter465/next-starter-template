# Repository Metadata Configuration

This file documents the recommended GitHub repository metadata to improve discoverability and clearly communicate the template's value.

## Recommended Settings

### Description

```
A modern Next.js 15 starter template with TypeScript, Tailwind CSS 4, React 19, and Cloudflare Pages deployment configuration
```

### Website

```
https://next-starter-template.templates.workers.dev
```

### Topics (Keywords)

```
nextjs
typescript
tailwindcss
cloudflare-pages
cloudflare-workers
starter-template
react
opennext
nextjs-template
fullstack
cloudflare
workers
nextjs-15
react-19
tailwind-css-4
```

## How to Apply These Settings

### Option 1: GitHub Web UI

1. Go to the repository homepage: https://github.com/wdhunter465/next-starter-template
2. Click the gear icon (⚙️) next to "About" on the right sidebar
3. In the dialog that appears:
   - **Description**: Paste the description from above
   - **Website**: Paste the website URL from above
   - **Topics**: Add the topics one by one or paste them comma-separated
4. Click "Save changes"

### Option 2: GitHub CLI (gh)

Run the following command from the repository root:

```bash
# Set description
gh repo edit wdhunter465/next-starter-template \
  --description "A modern Next.js 15 starter template with TypeScript, Tailwind CSS 4, React 19, and Cloudflare Pages deployment configuration"

# Set website
gh repo edit wdhunter465/next-starter-template \
  --homepage "https://next-starter-template.templates.workers.dev"

# Add topics (must be done one at a time or use the API)
gh api repos/wdhunter465/next-starter-template/topics \
  -X PUT \
  -f names[]='nextjs' \
  -f names[]='typescript' \
  -f names[]='tailwindcss' \
  -f names[]='cloudflare-pages' \
  -f names[]='cloudflare-workers' \
  -f names[]='starter-template' \
  -f names[]='react' \
  -f names[]='opennext' \
  -f names[]='nextjs-template' \
  -f names[]='fullstack' \
  -f names[]='cloudflare' \
  -f names[]='workers' \
  -f names[]='nextjs-15' \
  -f names[]='react-19' \
  -f names[]='tailwind-css-4' \
  -H "Accept: application/vnd.github.mercy-preview+json"
```

### Option 3: Using the Helper Script

We've provided a convenience script to apply these settings:

```bash
./scripts/update-repository-metadata.sh
```

## Why This Matters

Adding this metadata:

- **Improves Discoverability**: Users can find the template through GitHub search using relevant keywords
- **Communicates Value**: The description clearly states what technologies and features the template includes
- **Provides Context**: The website link gives users a live demo to explore
- **Enables Filtering**: Topics help users filter and discover templates for their specific needs

## Verification

After applying the settings, verify them by:

1. Visiting https://github.com/wdhunter465/next-starter-template
2. Checking that the "About" section shows the description, website, and topics
3. Searching for the repository using one of the topics (e.g., "nextjs-template")
