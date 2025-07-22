# CLI Authentication Design

## Overview

The CLI authentication system uses Supabase Auth to provide secure user authentication with persistent sessions. This enables users to manage their personal packages and code snippets securely.

## Architecture

### Components

1. **SupabaseAuth** (`src/shared/supabase-client.ts`)

   - Wraps Supabase client for authentication operations
   - Handles sign in, sign up, sign out, and session management

2. **TokenStorage** (`src/shared/token-storage.ts`)

   - Stores authentication tokens locally in `~/.config/sourcewizard/auth.json`
   - Handles token persistence between CLI sessions
   - Automatically expires and cleans up invalid tokens

3. **CLIAuth** (`src/shared/cli-auth.ts`)

   - Main authentication service that combines Supabase auth with token storage
   - Provides high-level auth operations for CLI commands
   - Handles session restoration on CLI startup

4. **MCPPackageCLI** (`src/cli/index.ts`)
   - Extended with authentication commands: `login`, `signup`, `logout`, `whoami`
   - Initializes authentication on startup
   - Provides user-friendly prompts for credentials

## Configuration

The CLI is pre-configured with Supabase credentials to work out of the box. No environment variables are required.

### Supabase Configuration

The following constants are hardcoded in `src/shared/supabase-client.ts`:

- **Project URL**: `https://sfcheddgbldthfcxoaqn.supabase.co`
- **Anonymous Key**: Embedded as constant (public key, safe for client-side use)

## CLI Commands

### Authentication Commands

- `sourcewizard login` - Login with email/password
- `sourcewizard signup` - Create new account
- `sourcewizard logout` - Sign out and clear tokens
- `sourcewizard whoami` - Show current user info

### Usage Examples

```bash
# Create a new account
sourcewizard signup

# Interactive login (prompts for email/password)
sourcewizard login

# Login with options
sourcewizard login --email user@example.com --password mypassword

# Check authentication status
sourcewizard whoami

# Logout
sourcewizard logout
```

## Security Features

### Token Storage

- Tokens stored in user's config directory with restrictive permissions (600)
- Automatic cleanup of expired tokens
- Session restoration on CLI startup

### Authentication Flow

1. User provides credentials via CLI
2. Supabase validates credentials and returns JWT tokens
3. Tokens stored locally with expiration metadata
4. Subsequent CLI operations use stored tokens
5. Invalid/expired tokens automatically cleared

### Database Security

- Row Level Security (RLS) enabled on packages table
- Users can only access their own packages
- All operations require valid authentication

## Error Handling

The system handles various error scenarios:

- **Invalid credentials**: Clear error message, prompts for retry
- **Network issues**: Graceful degradation with helpful messages
- **Token expiration**: Automatic cleanup and re-authentication prompt
- **Supabase service errors**: Propagated with context

## Future Enhancements

Potential improvements for the authentication system:

1. **Multi-factor Authentication**: Add TOTP support
2. **OAuth Integration**: Support GitHub, Google login
3. **Session Management**: List and revoke active sessions
4. **Team Features**: Organization-based access control
5. **API Keys**: Generate API keys for automation
