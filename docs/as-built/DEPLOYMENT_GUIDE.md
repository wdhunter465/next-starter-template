# Deployment Guide

## Overview

This Next.js application is designed to be deployed on Cloudflare Pages using GitHub Actions for automated deployment. The application uses **Next.js's built-in static export** feature (`output: "export"`) to generate a fully static site.

### Static Export Build

This project uses Next.js's native static export feature instead of server-side rendering or Workers-based adapters. The static export provides:
- Pure static HTML/CSS/JS output
- No server-side runtime required
- Fast deployment and serving from Cloudflare's global CDN
- Simple, maintainable architecture
- Full Next.js 15 and React 19 compatibility

The build process:
1. Runs `next build` to compile the Next.js application
2. Automatically generates static HTML files in the `out/` directory
3. Deploys `out/` directory to Cloudflare Pages

## Prerequisites

- Cloudflare account with Pages enabled
- GitHub repository with Actions enabled
- Cloudflare API token with appropriate permissions

## Cloudflare Setup

### 1. Create Cloudflare API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token" or "Create Custom Token"
3. Configure the following permissions:
   - **Account → Cloudflare Pages → Edit**
   - **User → User Details → Read**
4. Set token expiration (recommended: 90 days or custom)
5. Click "Continue to summary" → "Create Token"
6. **Important**: Copy the token immediately - you won't see it again

### 2. Configure GitHub Secrets

Navigate to your repository settings: `Settings → Secrets and variables → Actions`

Add these repository secrets:

- **CLOUDFLARE_API_TOKEN**: Your API token from Step 1
- **CLOUDFLARE_ACCOUNT_ID**: Find in Cloudflare dashboard (right sidebar under "Account ID")
- **CLOUDFLARE_PROJECT_NAME**: Your Cloudflare Pages project name (e.g., `next-starter-template`)

### 3. Automated Deployment

The repository uses GitHub Actions to automatically deploy when code is pushed to the `main` branch.

**Workflow steps:**
1. Builds the Next.js application
2. Transforms build output with OpenNext
3. Deploys to Cloudflare Pages
4. Makes deployment live at your Cloudflare Pages URL

### 4. Manual Deployment

To deploy manually from your local machine:

```bash
# Build the application
npm run build

# Build for Cloudflare (same as above)
npm run build:cf
```

**Note**: Manual deployment is handled through Cloudflare Pages dashboard or GitHub Actions workflows.

## Common Deployment Issues

### Authentication Errors

**Error**: `Authentication error [code: 10000]`

**Solution**: Update your API token with "User Details Read" permission (see Cloudflare Setup above).

### Build Failures

**Error**: Build fails during `next build`

**Solution**: 
- Check build logs for specific errors
- Ensure all dependencies are installed: `npm install`
- Verify Node.js version matches `.node-version` file
- Ensure `next.config.ts` has `output: "export"` configured

### White Screen / Blank Page

**Issue**: Cloudflare Pages deployment succeeds but shows a white screen

**Common Causes**:
1. **Runtime errors**: JavaScript errors preventing page load
   - **Solution**: Check browser console for errors; add error boundaries if needed
2. **Missing static files**: Build artifacts not properly deployed
   - **Solution**: Verify GitHub Actions workflow deploys the `out/` directory
3. **Routing issues**: Client-side routing not working properly
   - **Solution**: Ensure Cloudflare Pages is configured for single-page applications if using client-side routing

### Missing Static Assets (404 on /_next/static/*)

**Issue**: Static chunks fail to load with 404 errors

**Common Causes**:
1. **Incorrect deployment directory**: Deploying wrong directory to Pages
   - **Solution**: Ensure workflows deploy `out/` directory (not `.next/` or root)
2. **CSP blocking assets**: Content-Security-Policy headers blocking chunks
   - **Solution**: Check and update CSP headers in `_headers` file

### Deployment Not Updating

**Issue**: New code is pushed but live site shows old content

**Solution**:
- Check GitHub Actions workflow status
- Verify secrets are correctly configured
- Manually trigger workflow from Actions tab
- Clear Cloudflare cache if needed

## Monitoring Deployments

### GitHub Actions

View deployment history: `Actions → deploy.yml` in your repository

### Cloudflare Dashboard

View deployment details: [Cloudflare Pages Dashboard](https://dash.cloudflare.com)

### Real-time Monitoring

View deployment status and analytics in the Cloudflare Pages dashboard.

## Rollback

To rollback to a previous deployment:

1. Go to Cloudflare Pages dashboard
2. Select your project
3. Navigate to deployment history
4. Click "Rollback" on the desired deployment

## Additional Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Next.js Static Exports](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Next.js Deployment Guide](https://nextjs.org/docs/app/building-your-application/deploying)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

## Getting Help

If you encounter deployment issues:

1. Check [Incident Response Quickstart](../incident-response/quickstart_MASTER.md) for common solutions
2. Review GitHub Actions logs for error details
3. Consult Cloudflare Pages documentation
4. Check repository issues for similar problems
# Cloudflare Pages Setup

## Build Configuration

This Next.js application is configured for Cloudflare Pages deployment using static export.

### Cloudflare Pages Settings

Configure your Cloudflare Pages project with the following settings:

- **Framework preset**: Next.js
- **Build command**: `npm run build:cf`
- **Build output directory**: `out`
- **Node.js version**: `22` (set via `.node-version` file)

### Why Static Export?

All pages in this application are statically generated at build time, so we use Next.js's static export feature (`output: "export"` in `next.config.ts`). This approach:

1. **Eliminates runtime dependencies** - No need for Node.js or Cloudflare Workers at runtime
2. **Maximizes compatibility** - Works with Cloudflare Pages' static hosting without adapter issues
3. **Improves performance** - Static files served directly from Cloudflare's CDN
4. **Simplifies deployment** - No complex build adapters or worker bundles required

### Migration from @cloudflare/next-on-pages

This project previously used `@cloudflare/next-on-pages`, which is now deprecated and has compatibility issues with Next.js 15. The static export approach is simpler and more reliable.

#### Previous Issue

The deprecated adapter generated workers with Node.js imports (`node:buffer`, `node:async_hooks`) that aren't available in Cloudflare Workers runtime, causing blank white screens.

#### Current Solution

Static export generates pure HTML/CSS/JS files in the `out/` directory, which Cloudflare Pages serves directly without any worker runtime.

### Environment Variables

Environment variables should be configured in the Cloudflare Pages dashboard under **Settings > Environment variables**.

Available environment variables:
- `NEXT_PUBLIC_SITE_NAME` - Site name (default: "Lou Gehrig Fan Club")
- `NEXT_PUBLIC_APP_VERSION` - Application version (default: "1.0.0")
- `NEXT_PUBLIC_GA_ID` - Google Analytics 4 measurement ID. Optional override. Production Cloudflare Pages builds of `main` bake `G-BRV48J1VEJ` when this var is unset (`src/lib/gaMeasurementId.ts`, #4350). Preview/`non-main` Pages builds never bake an id. gtag still loads only after the visitor Accepts (`AnalyticsConsent`). Dashboard override remains **Production** env only.

### Local Development

```bash
# Development server
npm run dev

# Production build (same as Cloudflare Pages)
npm run build:cf

# Preview the production build locally
npx serve out
```

### Troubleshooting

If you encounter a blank white screen after deployment:

1. Verify the build output directory is set to `out` in Cloudflare Pages settings
2. Check that the build command is `npm run build:cf`
3. Ensure environment variables are properly configured if required
4. Review Cloudflare Pages deployment logs for any errors
