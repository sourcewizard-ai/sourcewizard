# SourceWizard CLI - Callback-Based Authentication

## Quick Start

### Callback-Based Authentication (Recommended)

```bash
# Default callback-based authentication
sourcewizard login

# Use custom login page URL
sourcewizard login --url https://your-app.com/login
```

This will:

1. 🌐 Start a local callback server on a random port
2. 🔗 Open your browser to the login page (external or default)
3. 📡 Display the callback URL for integration
4. ⏳ Wait for authentication callback from the login page
5. ✅ Automatically save your session
6. 🔒 Securely close the server

### CLI-Based Login (Alternative)

```bash
# Force CLI-based authentication
sourcewizard login --cli

# Or provide credentials directly
sourcewizard login -e your@email.com -p yourpassword
```

## Authentication Flow

### Callback Authentication Experience

1. **Command**: Run `sourcewizard login`
2. **Server Starts**: Local callback server starts on random port
3. **Display URL**: CLI shows the callback endpoint URL
4. **External Web App**: Use your web application to authenticate
5. **Callback**: Web app posts tokens to the callback URL
6. **Success**: CLI receives tokens and continues authenticated

### Visual Flow

```
Terminal                           Browser → External Web App
--------                           -------------------------
$ sourcewizard login          →   [Browser Opens]
🌐 Starting auth server...         ┌─────────────────────────┐
🔗 Server running on port 3847     │  🧙‍♂️ Your Login Page   │
📡 Callback endpoint:              │                         │
   localhost:3847/auth/callback    │ Email: [_____]          │
🌐 Opening browser...              │ Pass:  [_____]          │
🔗 Login page opened:              │   [Sign In]             │
   https://your-app.com/login      └─────────────────────────┘
⏳ Waiting for callback...                   ↓
                                   [POST to callback URL]
✅ Successfully logged in!
Welcome back, user@ex.com
```

## Integration with Web Applications

### For Web Application Developers

Your web application should integrate with the CLI authentication as follows:

1. **Display Instructions**: Show users the callback URL when they're logging in via CLI
2. **Handle Authentication**: Use your preferred auth method (Supabase, OAuth, etc.)
3. **Send Callback**: POST authentication data to the callback URL

### Example Integration

```javascript
// After successful authentication in your web app
const callbackUrl = "http://localhost:3847/auth/callback"; // From CLI output

// The server has CORS enabled, so this cross-origin request will work
fetch(callbackUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: {
      id: user.id,
      email: user.email,
    },
  }),
})
  .then((response) => response.json())
  .then((data) => {
    if (data.success) {
      console.log("✅ CLI authentication successful!");
      // Optionally show success message to user
      alert("You can now return to your CLI terminal");
    } else {
      console.error("❌ CLI authentication failed:", data.error);
    }
  })
  .catch((error) => {
    console.error("❌ Network error:", error);
  });
```

### Required Callback Data

The callback endpoint expects:

```typescript
{
  access_token: string; // JWT access token
  refresh_token: string; // JWT refresh token
  expires_at: number; // Unix timestamp
  user: {
    id: string; // User ID
    email: string; // User email
  }
}
```

## Features

- **🎯 Random Ports**: No port conflicts, system chooses available port
- **🔐 Secure**: Tokens stay on localhost, auto-cleanup
- **🔄 Stateless**: Each login session is independent
- **⚡ Fast**: Lightweight callback server
- **🛡️ Safe**: 5-minute timeout, graceful error handling
- **🔙 Fallback**: Automatic CLI fallback if callback fails
- **🔗 Integration Ready**: Works with any web application
- **🌐 CORS Enabled**: Supports cross-origin requests from web pages

## Troubleshooting

### Callback Authentication Issues

If callback authentication fails, the CLI automatically falls back to CLI-based authentication:

```bash
🚀 Starting web-based authentication...
🌐 Starting authentication server...
🔗 Authentication server running on port 3847
❌ Web login failed: Authentication timeout

⚠️  Falling back to CLI login...
📝 Using CLI-based authentication...
Email: your@email.com
Password: ********
```

### Common Issues

1. **Port conflicts**: System automatically chooses available ports
2. **Timeout**: 5-minute limit for authentication callback
3. **Invalid callback data**: Check required fields in POST request
4. **Network issues**: CLI fallback handles connectivity problems

### Force CLI Mode

For headless servers or if you prefer CLI authentication:

```bash
sourcewizard login --cli
```

### Testing the Callback Endpoint

You can test the callback endpoint manually:

```bash
# Start CLI login
sourcewizard login

# In another terminal, test the callback
curl -X POST http://localhost:PORT/auth/callback \
  -H "Content-Type: application/json" \
  -d '{
    "access_token": "your-access-token",
    "refresh_token": "your-refresh-token",
    "expires_at": 1234567890,
    "user": {
      "id": "user-id",
      "email": "user@example.com"
    }
  }'
```

## Security

- **Local Only**: Server only binds to localhost (127.0.0.1)
- **Random Ports**: System-assigned ports reduce conflicts and exposure
- **Auto Cleanup**: Server automatically stops after authentication
- **Timeout Protection**: 5-minute maximum authentication window
- **No Persistence**: No permanent web server or open ports
- **Token Security**: Secure token exchange over localhost only
- **Per-Session Isolation**: Each login gets its own server instance
- **CORS Enabled**: Allows cross-origin requests but only on localhost

## Benefits Over CLI-Only Auth

| Feature              | CLI Auth               | Callback Auth          |
| -------------------- | ---------------------- | ---------------------- |
| Password Visibility  | ⚠️ Visible in terminal | ✅ Hidden in web app   |
| Port Conflicts       | ✅ N/A                 | ✅ Auto-assigned ports |
| External Integration | ❌ Not possible        | ✅ Web app integration |
| OAuth Support        | ❌ Not possible        | ✅ Via web application |
| 2FA Support          | ❌ Not possible        | ✅ Via web application |
| User Trust           | ⚠️ CLI credentials     | ✅ Familiar web flow   |
| Stateless            | ✅ Yes                 | ✅ Per-session servers |

## Advanced Usage

### Custom Port Range

While the system chooses random ports, you can specify a starting port:

```javascript
// In your application code
const webAuthServer = new WebAuthServer();
const port = await webAuthServer.start(8000); // Starts at 8000 or higher
```

### Health Check

Check if the authentication server is running:

```bash
curl http://localhost:PORT/health
```

Response:

```json
{
  "status": "ok",
  "message": "Auth server is running",
  "port": 3847
}
```

The callback-based authentication provides a flexible, secure, and integration-friendly approach while maintaining full backward compatibility with CLI-based authentication.
