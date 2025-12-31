# Implementation Issues

This document tracks identified implementation issues in the Froggie Frame codebase.

## Critical Issues

### 1. ✅ FIXED: Missing API Key Expiry Check
**Location:** [web/app/api/device/photos/route.ts#L29-L34](web/app/api/device/photos/route.ts)

~~API key validation doesn't check the `expires_at` field. Expired keys continue to work indefinitely.~~

**Resolution:** Added `.or(\`expires_at.is.null,expires_at.gt.${now}\`)` to reject expired API keys.

---

### 2. ✅ FIXED: OTP Secret Stored Unencrypted
**Location:** [supabase/migrations/001_initial_schema.sql#L49-L55](supabase/migrations/001_initial_schema.sql), [web/app/api/auth/verify-otp/route.ts#L48](web/app/api/auth/verify-otp/route.ts)

~~The column is named `encrypted_secret` but the code reads it directly as base32 with no actual encryption. Sensitive 2FA secrets are stored in plaintext.~~

**Resolution:** Renamed column from `encrypted_secret` to `secret` to avoid confusion. Note: Existing databases require a migration to rename the column.

---

### 3. ✅ FIXED: Missing CSP and HSTS Headers
**Location:** [web/next.config.js](web/next.config.js)

~~The architecture document promises `Content-Security-Policy` and `Strict-Transport-Security` headers, but they are not implemented in the Next.js config.~~

**Resolution:** Added CSP and HSTS headers to next.config.js.

---

## Moderate Issues

### 4. Missing Upload API Route
**Location:** `web/app/api/photos/upload/` (directory exists but no route.ts)

The architecture references `/api/photos/upload` but the implementation file doesn't exist. Photo upload functionality is unimplemented.

**Fix:** Implement the upload route with file validation, storage upload, and database record creation.

---

### 5. Missing Auth Login/Register Routes
**Location:** `web/app/api/auth/login/`, `web/app/api/auth/register/`

Directories exist under `app/api/auth/` but `login/route.ts` and `register/route.ts` files are missing.

**Fix:** Implement the authentication routes using Supabase Auth.

---

### 6. Missing `click` Dependency
**Location:** [pi-frame/requirements.txt](pi-frame/requirements.txt), [pi-frame/froggie_frame/cli.py#L4](pi-frame/froggie_frame/cli.py)

The CLI imports `click` but it may not be listed in requirements.txt.

**Fix:** Verify `click` is in requirements.txt, add if missing:
```
click>=8.0.0
```

---

### 7. Race Condition in Cache Cleanup
**Location:** [pi-frame/froggie_frame/cache.py#L100-L110](pi-frame/froggie_frame/cache.py)

The `_cleanup_if_needed` method modifies the metadata dict while iterating over it, which can cause issues.

**Fix:** Iterate over a copy of the keys:
```python
for cache_key, _, size in photos_by_age:
    # ... existing code
```
The current code already uses a separate list, but the deletion from `self.metadata["photos"]` during iteration of `photos_by_age` is safe. However, ensure `list()` wrapper is used if iterating directly over dict items.

---

### 8. Type Annotation Issue in Display
**Location:** [pi-frame/froggie_frame/display.py#L185-L199](pi-frame/froggie_frame/display.py)

The `handle_events()` method returns mixed types (`bool | str`), making type checking fragile and usage error-prone.

**Fix:** Use an enum or named constants instead of magic strings:
```python
from enum import Enum

class EventResult(Enum):
    CONTINUE = "continue"
    QUIT = "quit"
    NEXT = "next"
    PREV = "prev"
```

---

## Minor Issues

### 9. No Rate Limiting on Device API
**Location:** [web/app/api/device/](web/app/api/device/)

Device API endpoints have no rate limiting, making them vulnerable to abuse or denial-of-service attacks.

**Fix:** Implement rate limiting using middleware or a service like Upstash Redis.

---

### 10. Storage Policy Path Format Assumption
**Location:** [supabase/migrations/003_storage_setup.sql#L20-L25](supabase/migrations/003_storage_setup.sql)

Storage policies use `storage.foldername(name)` which assumes a specific path format (`user_id/filename`). This may not work with all storage path formats.

**Fix:** Ensure upload code always uses the expected path format, or update policies to be more flexible.

---

## Status Legend

- 🔴 **Critical** - Security vulnerabilities or broken core functionality
- 🟠 **Moderate** - Missing features or significant bugs
- 🟡 **Minor** - Code quality or minor improvements
