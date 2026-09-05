# AKUMA AI Commerce - Demo Scenarios

## Overview
Production-ready AI commerce platform with:
- Merchant AI agent (Groq-powered)
- Consumer shopping assistant
- Real buyer-merchant matching
- Razorpay payment integration
- Google Maps location services
- Real-time notifications
- Complete audit trail

## Demo Scenarios

### 1. Merchant Flow
1. **Sign in** → Merchant dashboard
2. **View opportunities** → See AI-generated and buyer demand matches
3. **Create product** → `/dashboard/catalog`
4. **Set location** → `/dashboard/policies` (enable delivery radius)
5. **AI analysis** → Ask "what are my top opportunities?" in Agent tab
6. **Negotiate** → Monitor incoming buyer interests, respond with offers
7. **Track orders** → Dashboard shows real order counts and revenue

### 2. Consumer Flow
1. **Sign in as buyer** → Shop page
2. **Browse products** → AI-powered search in "Ask AKUMA"
3. **Create buyer interest** → Express interest in product, triggers merchant notification
4. **Negotiate price** → Use AI to request better pricing
5. **Checkout** → Real Razorpay payment flow
6. **Track orders** → Real order history with status

### 3. AI Agent Scenarios

**Merchant AI:**
- "What are my best selling products?" → Uses real sales data
- "Find cross-sell opportunities" → Analyzes purchase patterns
- "Should I run a discount?" → Checks guardrails and margins
- "Match me with buyers" → Finds local buyers interested in products

**Consumer AI:**
- "I need gaming headphones around ₹5000" → Category-aware search
- "Can you negotiate this price?" → Respects merchant policies
- "Show me similar products" → Real product recommendations
- "What's my order status?" → Checks actual order database

## Technical Integration Points

### ✅ Working Features
- Real payment verification (Razorpay)
- Google Places location autocomplete
- Buyer-merchant matching with distance calculation
- Category-aware AI prompts (electronics, fashion, food, etc.)
- Email notification consent collection
- Negotiation policy enforcement
- Product image AI analysis
- Offer expiry automation
- Real database as source of truth
- Complete audit trail (orders, payments, negotiations)
- Multi-window session persistence

### API Endpoints
- `/api/merchant/buyer-matches` → Find matching buyers within delivery range
- `/api/consumer/buyer-interest` → Create buyer interests
- `/api/consumer/checkout/verify-payment` → Razorpay verification
- `/api/products/analyze-image` → AI vision product analysis
- `/api/user/context` → Get business context for AI
- `/api/cron/expire-offers` → Automated expiry of old offers

### AI Configuration
  Groq required: set `GROQ_API_KEY` in `.env.local` (`npm install groq-sdk` first)
  AI uses:
  - Merchant business goals for prioritization
  - Delivery radius for location matching
  - Negotiation preferences (YES_AUTOMATICALLY/ASK_ME_FIRST/NO_NEGOTIATION)
  - Category-specific questioning patterns

## Quick Start
1. `npm install`
2. `npx prisma db push`
3. `npm run dev`
4. Visit `http://localhost:3000`
5. Use demo credentials (email: nilaj123, password: 1234)

## Production Deployment
- Set environment variables (RAZORPAY_KEY_ID/SECRET, GOOGLE_PLACES_API_KEY)
- Configure database (PostgreSQL)
- Set CRON_SECRET for scheduled jobs
- Enable Resend for emails (or disable by skipping email config)

## Testing Checklist
- [ ] Merchant onboarding → sets location, delivery radius, negotiation policy
- [ ] Buyer interest creation → triggers merchant notification
- [ ] Payment verification → real Razorpay status checking
- [ ] AI chat → both merchant and consumer flows
- [ ] Dashboard opportunities → shows real buyer matches
- [ ] Navigation flows → cart → checkout → orders