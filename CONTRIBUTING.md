# Contributing to Next.js Starter Template

Thank you for your interest in contributing to this project! This guide will help you get started with development, especially when using GitHub Codespaces.

## Development Setup

### Using GitHub Codespaces

This repository is configured to work seamlessly with GitHub Codespaces. When you open this project in Codespaces:

1. The development environment will be automatically configured
2. Dependencies will be installed
3. You'll have access to all necessary tools

### Local Development

If you prefer to work locally:

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run linting
npm run lint

# Build the project
npm run build
```

## Git Authentication

### Git Authentication for Local Development

If you're working locally (not in Codespaces), you'll need to configure Git authentication before you can push changes:

#### Prerequisites

Before you begin, ensure you have Git configured with your credentials:

```bash
# Configure your Git username and email
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

#### Option A: HTTPS with Personal Access Token (Recommended)

1. Create a [Personal Access Token](https://github.com/settings/tokens) with `repo` scope
2. Configure Git to use the token:
   ```bash
   # Store credentials (will prompt for username and token on first push)
   git config --global credential.helper store
   # Or for macOS
   git config --global credential.helper osxkeychain
   # Or for Windows
   git config --global credential.helper wincred
   ```
3. When prompted for credentials:
   - Username: Your GitHub username
   - Password: Your Personal Access Token (not your GitHub password)

#### Option B: SSH Authentication

1. [Generate an SSH key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)
2. [Add the SSH key to your GitHub account](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account)
3. Update the remote URL:
   ```bash
   git remote set-url origin git@github.com:wdhunter465/next-starter-template.git
   ```

For more detailed instructions on local Git setup, see the troubleshooting section below.

## Git Authentication in Codespaces

### Quick Reference

For complete instructions on setting up GitHub token permissions in Codespaces, see:

📖 **[docs/TROUBLESHOOTING.md - Git Authentication Issues](./docs/TROUBLESHOOTING.md#git-authentication-issues)**

This guide covers:

- Creating Personal Access Tokens with proper scopes
- Configuring Codespaces secrets (recommended for persistent setup)
- Manual token configuration for individual Codespaces
- All troubleshooting scenarios
- Security best practices

### Common Issue: Git Push Failures

If you encounter errors when trying to push to the repository in Codespaces, such as:

- "Authentication failed"
- "Permission denied"
- Git not prompting for credentials

This typically happens because the Codespaces implicit token doesn't have Git CLI permissions.

### 🔴 Codespaces Won't Let You Log Out?

If you're experiencing issues where **Codespaces isn't letting you log out** to sign back in with your account-level token, see:

👉 **[docs/TROUBLESHOOTING.md - Codespaces Won't Let You Log Out](./docs/TROUBLESHOOTING.md#codespaces-wont-let-you-log-out)**

### Solution: Using a Personal Access Token (PAT)

To resolve Git authentication issues in Codespaces:

#### 1. Create a Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Or visit: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give your token a descriptive name (e.g., "Codespaces Development")
4. Set an expiration period (recommended: 90 days or custom)
5. Select the following scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
   - `write:packages` (if you work with packages)
6. Click "Generate token"
7. **Important**: Copy the token immediately - you won't be able to see it again!

#### 2. Configure Git in Codespaces

Once you have your PAT, configure Git in your Codespace:

```bash
# Clear any existing credentials
git config --global --unset credential.helper

# Configure Git to use your token
git config --global credential.helper store

# Now when you push, Git will prompt for credentials
# Username: your-github-username
# Password: paste-your-PAT-here
```

Alternatively, you can update the remote URL to include your credentials:

```bash
# Remove the existing remote
git remote remove origin

# Add the remote with your credentials
git remote add origin https://YOUR_USERNAME:YOUR_PAT@github.com/wdhunter465/next-starter-template.git
```

⚠️ **Security Note**: Never commit tokens to your repository!

#### 3. Alternative: Use GitHub CLI (Interactive)

GitHub Codespaces comes with GitHub CLI (`gh`) pre-installed:

```bash
# Authenticate with GitHub CLI
gh auth login

# Choose GitHub.com
# Choose HTTPS as your preferred protocol
# Authenticate with your browser or paste an authentication token

# After authentication, Git operations will work automatically
```

### Clearing Git Cache in Codespaces

If you need to clear cached credentials:

```bash
# Clear credential helper cache
git credential-cache exit

# Or clear the stored credentials
rm ~/.git-credentials

# Reconfigure credential helper
git config --global credential.helper store
```

### Troubleshooting

#### Issue: "fatal: could not read Username"

**Solution**: Ensure you've configured Git with your credentials or authenticated via `gh auth login`.

#### Issue: "remote: Permission to repository denied"

**Solutions**:

1. Verify your PAT has the correct scopes (especially `repo`)
2. Ensure the PAT hasn't expired
3. Try regenerating the PAT and updating your credentials

#### Issue: "Support for password authentication was removed"

**Solution**: GitHub no longer accepts passwords for Git operations. You must use a Personal Access Token (PAT) instead.

#### Issue: Codespaces crashed or extensions keep restarting

**Solution**: See the [Codespaces Issues](docs/TROUBLESHOOTING.md#codespace-crashed-or-frozen) section for comprehensive troubleshooting steps.

### Local Git Authentication Troubleshooting

#### Issue: Git doesn't prompt for username/password

**Solution**: Reconfigure or clear the credential helper:

```bash
# Clear stored credentials
git credential reject
# Type: protocol=https, host=github.com, and press Enter twice

# Or unset the helper temporarily
git config --unset credential.helper

# Then configure it again
git config --global credential.helper store  # Linux
git config --global credential.helper osxkeychain  # macOS
git config --global credential.helper wincred  # Windows
```

#### Issue: "Authentication failed" when pushing (local development)

**Solutions**:

1. If using HTTPS with Personal Access Token:
   - Ensure your token has the `repo` scope
   - Token may have expired - generate a new one
   - Clear cached credentials:

     ```bash
     # macOS
     git credential-osxkeychain erase
     # Then enter: protocol=https, host=github.com, and press Enter twice

     # Linux
     git credential-cache exit

     # Windows - Open Credential Manager and remove GitHub credentials
     ```

2. If using SSH:
   - Verify your SSH key is added to GitHub
   - Test connection: `ssh -T git@github.com`
   - Ensure SSH agent is running: `eval "$(ssh-agent -s)"`
   - Add your key: `ssh-add ~/.ssh/id_ed25519`

#### Issue: "Permission denied (publickey)" when using SSH

**Solution**:

1. Verify your SSH key is added to your GitHub account
2. Check the SSH agent has your key:
   ```bash
   ssh-add -l
   ```
3. If not listed, add it:
   ```bash
   ssh-add ~/.ssh/id_ed25519
   ```

## Pull Request Guidelines

1. **Fork the repository** (if you're an external contributor)
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes** with clear, descriptive commit messages
4. **Test your changes**: Run `npm run lint` and `npm run build`
5. **Push to your fork**: Use the authentication methods described above
6. **Open a Pull Request** with a clear description of your changes

## Code Style

This project uses:

- **ESLint** for linting (configuration in `eslint.config.mjs`)
- **TypeScript** for type safety
- **Prettier** formatting (via Next.js defaults)

Run linting before committing:

```bash
npm run lint
```

## Questions or Issues?

If you encounter any problems not covered in this guide, please:

1. Check existing GitHub Issues
2. Open a new issue with detailed information about your problem
3. Include error messages, steps to reproduce, and your environment details

Thank you for contributing! 🎉
