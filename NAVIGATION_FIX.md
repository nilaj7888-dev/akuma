# Navigation Flow Fix - Summary

## Changes Made (2026-09-02)

### 1. **Landing Screen** (`components/landing-screen.tsx`)
- **Added role selection cards** directly on the landing page
- Users now choose MERCHANT or CONSUMER **before** any authentication
- **Added AKUMA logo click handler** → navigates to `/`
- Removed "Sign in" button from nav (role selection is now the primary CTA)

### 2. **Onboarding Screen** (`components/onboarding-screen.tsx`)
- **Added `onBack` prop** to allow navigation back from first onboarding question
- **Fixed Back button behavior**:
  - If `index > 0`: go to previous question (existing behavior)
  - If `index === 0` and `onBack` exists: call `onBack()` to return to role selection
- **Added AKUMA logo click handler** → navigates to `/`
- Made logo clickable by wrapping in button

### 3. **Auth Screen** (`components/auth-screen.tsx`)
- **Added "Back to home" button** in role selection screen
- **Added AKUMA logo click handler** → navigates to `/`
- Removed "You can change this later" text (roles are now selected on landing, not post-login)

### 4. **Main Page** (`app/page.tsx`)
- **Complete rewrite** with state machine pattern
- States: `loading | landing | auth | onboarding | redirecting`
- **New flow**:
  1. `/` → Landing page with MERCHANT/CONSUMER cards
  2. Click MERCHANT → Auth → Merchant onboarding → `/dashboard`
  3. Click CONSUMER → Auth → Consumer onboarding → `/shop`
  4. Returning users with completed onboarding → auto-redirect to their area
- **Proper state management** for role selection across navigation
- **Back button support** throughout the flow

## Navigation Flow

### Fresh User Journey
```
/ (Landing)
  ↓ Click "Merchant"
Auth/Login
  ↓ Sign in
Merchant Onboarding
  ↓ Complete setup
/dashboard
```

### Consumer Journey
```
/ (Landing)
  ↓ Click "Consumer"
Auth/Login
  ↓ Sign in
Consumer Onboarding
  ↓ Complete setup
/shop
```

### Returning User
```
/ (Landing)
  ↓ Auto-detect session
Redirecting...
  ↓
/dashboard (if MERCHANT) or /shop (if CONSUMER)
```

## Back Button Behavior

- **Landing → Merchant → Back**: Returns to Landing
- **Landing → Consumer → Back**: Returns to Landing
- **Auth screen → Back to home**: Returns to Landing
- **Onboarding Q1 → Back**: Returns to Auth/Role selection
- **Onboarding Q2+ → Back**: Returns to previous question
- **Dashboard/Shop → AKUMA logo**: Returns to Landing (then auto-redirects if logged in)

## AKUMA Logo Click

All screens now support clicking the AKUMA logo to return to `/`:
- Landing screen ✓
- Auth screen ✓
- Onboarding screen ✓

Note: If user is logged in with completed onboarding, clicking logo on landing triggers auto-redirect to their workspace.

## Files Modified

1. `app/page.tsx` - Complete rewrite with state machine
2. `components/landing-screen.tsx` - Added role cards and navigation
3. `components/onboarding-screen.tsx` - Added back navigation and logo handler
4. `components/auth-screen.tsx` - Added back button and logo handler

## Files NOT Modified

- All API routes (preserved)
- Database schemas (preserved)
- Dashboard pages (preserved)
- Shop pages (preserved)
- All merchant/consumer features (preserved)

## TypeScript Status

✓ All types pass (`npm run typecheck`)

## Test Checklist

- [ ] `/` shows landing page with Merchant/Consumer cards
- [ ] Click Merchant → Auth screen
- [ ] Click Consumer → Auth screen  
- [ ] Sign in as Merchant → Merchant onboarding
- [ ] Sign in as Consumer → Consumer onboarding
- [ ] Complete Merchant onboarding → `/dashboard`
- [ ] Complete Consumer onboarding → `/shop`
- [ ] Click Back from Auth → returns to Landing
- [ ] Click Back from Onboarding Q1 → returns to Auth
- [ ] Click AKUMA logo from any screen → returns to `/`
- [ ] Refresh `/dashboard` → stays on dashboard
- [ ] Refresh `/shop` → stays on shop
- [ ] Returning user on `/` → auto-redirects to their area