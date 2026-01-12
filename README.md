# Slasshy - Military-Grade Secure Storage

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A zero-knowledge encrypted vault that stores your sensitive data (passwords, IDs, links, notes) on Google Drive using **steganography** - hiding encrypted data inside innocent-looking images.

## Features

- 🔐 **AES-256-GCM Encryption** - Military-grade authenticated encryption
- 🔑 **Argon2id Key Derivation** - Memory-hard KDF resistant to brute force
- 🖼️ **Steganography** - Hide encrypted data inside PNG images
- ☁️ **Google Drive Sync** - Secure cloud backup that looks like normal photos
- 🕵️ **Zero-Knowledge** - Your master password never leaves your device
- 🎭 **Obfuscation** - Random filenames, decoy files, fragmentation

## How It Works

1. Your data is encrypted with AES-256-GCM
2. Encrypted data is hidden inside PNG images using LSB steganography
3. Images are renamed to look like normal photos (`IMG_20260113_143022.png`)
4. Uploaded to Google Drive - appears as regular photo backups
5. **Even Google cannot see what you're storing**

## Installation

```bash
# Clone the repository
git clone https://github.com/SlasshyOverhere/slasshy-secure-cli.git
cd slasshy-secure-cli

# Install dependencies
npm install

# Build
npm run build

# Run
node dist/index.js --help
```

## Quick Start

```bash
# Initialize your vault
slasshy init

# Add a secret entry
slasshy add

# List all entries
slasshy list

# Retrieve an entry
slasshy get "GitHub" --copy

# Connect to Google Drive
slasshy auth

# Sync to Drive (with your carrier images)
slasshy sync --carrier-dir "./my-images"

# Lock vault (clears keys from memory)
slasshy lock
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize a new encrypted vault |
| `add` | Add a new entry |
| `get <search>` | Retrieve an entry |
| `list` | List all entries |
| `delete <search>` | Delete an entry |
| `auth` | Authenticate with Google Drive |
| `sync` | Sync vault with Google Drive |
| `status` | Show vault status |
| `lock` | Lock vault and clear keys |

## OAuth Server Setup (For Google Drive Sync)

The CLI uses a backend OAuth server for Google Drive authentication. You can:

### Option 1: Use Default Server
The CLI defaults to `https://slasshy-oauth.onrender.com` (you'll need to deploy this yourself)

### Option 2: Deploy Your Own Server

1. Go to `server/` directory
2. Deploy to Render, Railway, or any Node.js host
3. Set environment variables:
   - `GOOGLE_CLIENT_ID` - From Google Cloud Console
   - `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
   - `SERVER_URL` - Your deployed server URL

4. Point CLI to your server:
   ```bash
   slasshy auth --server https://your-server.com
   ```

## Security

- **Encryption**: AES-256-GCM (NIST approved)
- **Key Derivation**: Argon2id (64MB memory, 3 iterations)
- **Steganography**: LSB embedding in RGB channels
- **Token Storage**: Encrypted with your master key
- **Memory**: Secure wiping after use
- **Auto-lock**: Configurable timeout

## Project Structure

```
slasshy-cli-secure/
├── src/
│   ├── crypto/         # Encryption, KDF, memory guard
│   ├── steganography/  # PNG LSB embedding
│   ├── obfuscation/    # Filename, fragmentation, decoys
│   ├── storage/
│   │   ├── vault/      # Local encrypted vault
│   │   └── drive/      # Google Drive integration
│   └── cli/            # CLI commands
├── server/             # OAuth backend server
└── dist/               # Compiled JavaScript
```

## License

MIT License - see [LICENSE](LICENSE)

## Disclaimer

This tool is for personal use. Always keep backups of your master password. If you lose it, your data cannot be recovered.
