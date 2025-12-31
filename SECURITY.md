# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Froggie Frame, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email security concerns to the project maintainers
3. Include detailed steps to reproduce the vulnerability
4. Allow reasonable time for a fix before public disclosure

## Security Features

### Authentication

- **Password Requirements**: Minimum 8 characters with uppercase, lowercase, and numbers
- **Password Hashing**: Supabase Auth uses bcrypt with appropriate work factors
- **Two-Factor Authentication**: Time-based OTP (TOTP) support using industry-standard algorithms
- **Session Management**: Secure, HTTP-only cookies with appropriate expiration

### Authorization

- **Row Level Security (RLS)**: All database tables have RLS policies ensuring users can only access their own data
- **API Key Authentication**: Pi Frame devices use hashed API keys stored securely
- **Ownership Verification**: All operations verify resource ownership before proceeding

### Data Protection

- **HTTPS Only**: All communications are encrypted in transit
- **Secure Headers**: Content Security Policy, X-Frame-Options, HSTS, and other security headers
- **Input Validation**: Zod schemas validate all user input on both client and server
- **SQL Injection Prevention**: Parameterized queries via Supabase client

### API Security

- **Rate Limiting**: Consider implementing rate limiting on authentication endpoints
- **API Key Hashing**: API keys are stored as SHA-256 hashes, never in plain text
- **Key Rotation**: Users can revoke and regenerate API keys at any time

## Security Headers

The application sets the following security headers:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## Best Practices for Deployment

### Environment Variables

Never commit secrets to source control. Use environment variables:

```bash
# Required for web app
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only!
```

### Supabase Configuration

1. **Enable RLS on all tables** (migrations do this automatically)
2. **Restrict Auth providers** to only those you need
3. **Configure email verification** to prevent account abuse
4. **Set up database backups** in Supabase dashboard

### Vercel Deployment

1. Set environment variables in Vercel dashboard
2. Enable Vercel's security features (DDoS protection, etc.)
3. Configure custom domain with HTTPS
4. Review and restrict deployment access

### Raspberry Pi Security

1. **Keep Pi OS updated**: Run `sudo apt update && sudo apt upgrade` regularly
2. **Secure SSH**: Disable password auth, use key-based authentication
3. **Firewall**: Enable UFW and only allow necessary ports
4. **API Key Storage**: Config file permissions should be 600 (owner read/write only)

## Dependency Security

- Regularly update dependencies to patch vulnerabilities
- Use `npm audit` to check for known vulnerabilities
- Consider using Dependabot or similar for automated updates

## Code Review Checklist

When contributing, ensure:

- [ ] No secrets or credentials in code
- [ ] User input is validated and sanitized
- [ ] Database queries use parameterized statements
- [ ] Authentication checks are in place for protected routes
- [ ] Error messages don't leak sensitive information
- [ ] File uploads are validated (type, size, content)

## Known Limitations

- OTP secrets are stored in base32 format; consider additional encryption at rest
- Session tokens in localStorage (client-side) are accessible to JavaScript
- File uploads are validated by MIME type, which can be spoofed

## Security Updates

Security updates will be released as soon as possible after vulnerabilities are confirmed. Watch the repository releases for security patches.
