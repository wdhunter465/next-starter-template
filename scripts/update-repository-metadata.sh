#!/bin/bash
# Update Repository Metadata Script
# This script applies the recommended repository metadata to improve discoverability

set -e

REPO_OWNER="wdhunter465"
REPO_NAME="next-starter-template"
DESCRIPTION="A modern Next.js 15 starter template with TypeScript, Tailwind CSS 4, React 19, and Cloudflare Pages deployment configuration"
WEBSITE="https://next-starter-template.templates.workers.dev"

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Repository Metadata Update Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}⚠️  GitHub CLI (gh) is not installed.${NC}"
    echo ""
    echo "Please install it from: https://cli.github.com/"
    echo ""
    echo "Or apply the metadata manually via GitHub web UI:"
    echo "See .github/REPOSITORY_METADATA.md for instructions"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  You are not authenticated with GitHub CLI.${NC}"
    echo ""
    echo "Please run: gh auth login"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ GitHub CLI is installed and authenticated${NC}"
echo ""

# Update description
echo -e "${BLUE}Updating repository description...${NC}"
gh repo edit "${REPO_OWNER}/${REPO_NAME}" \
  --description "${DESCRIPTION}" \
  && echo -e "${GREEN}✓ Description updated${NC}" \
  || echo -e "${YELLOW}⚠️  Failed to update description${NC}"

echo ""

# Update website
echo -e "${BLUE}Updating repository website...${NC}"
gh repo edit "${REPO_OWNER}/${REPO_NAME}" \
  --homepage "${WEBSITE}" \
  && echo -e "${GREEN}✓ Website updated${NC}" \
  || echo -e "${YELLOW}⚠️  Failed to update website${NC}"

echo ""

# Update topics
echo -e "${BLUE}Updating repository topics...${NC}"

TOPICS='["nextjs","typescript","tailwindcss","cloudflare-pages","cloudflare-workers","starter-template","react","opennext","nextjs-template","fullstack","cloudflare","workers","nextjs-15","react-19","tailwind-css-4"]'

gh api repos/"${REPO_OWNER}"/"${REPO_NAME}"/topics \
  -X PUT \
  -H "Accept: application/vnd.github.mercy-preview+json" \
  -f names="${TOPICS}" \
  && echo -e "${GREEN}✓ Topics updated${NC}" \
  || echo -e "${YELLOW}⚠️  Failed to update topics${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Repository metadata update complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Verify the changes at:"
echo "https://github.com/${REPO_OWNER}/${REPO_NAME}"
echo ""
echo "The 'About' section should now show:"
echo "  • Description: ${DESCRIPTION}"
echo "  • Website: ${WEBSITE}"
echo "  • Topics: nextjs, typescript, tailwindcss, cloudflare-pages, and more"
echo ""
