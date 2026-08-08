#!/bin/bash
# Script to delete the reviewed branches from remote repository
# Run this script after the review PR has been merged to main

set -e

REPO="wdhunter465/next-starter-template"
BRANCHES=(
    "copilot/fix-codespaces-instability"
    "copilot/fix-codespaces-login-issue"
    "copilot/fix-git-push-auth-issue"
)

echo "This script will delete the following branches from remote repository:"
echo "Repository: $REPO"
echo ""
for branch in "${BRANCHES[@]}"; do
    echo "  - $branch"
done
echo ""
read -p "Are you sure you want to proceed? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo ""
echo "Deleting branches..."
echo ""

for branch in "${BRANCHES[@]}"; do
    echo "Deleting $branch..."
    if git push origin --delete "$branch" 2>&1; then
        echo "  ✅ Successfully deleted $branch"
    else
        echo "  ❌ Failed to delete $branch"
    fi
    echo ""
done

echo "Branch deletion complete!"
echo ""
echo "You can also delete these branches via GitHub web interface:"
echo "https://github.com/$REPO/branches"
