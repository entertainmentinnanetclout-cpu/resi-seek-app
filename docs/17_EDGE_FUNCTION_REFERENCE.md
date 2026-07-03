# 17. Edge Function Reference

All functions are deployed to the Lovable Cloud project gateway (`vmqqkebojldjsyxcewdb`).
**Standard Caller**: `src/lib/lovableFunctions.ts` -> `invokeEdgeFunction`.

## 1. Resident Portal Operations

### `create-residence-portal-user`
- **Action**: Provisions a new Auth user and links them to a `residence_id`.
- **Trigger**: Admin Operations Hub -> Portals.
- **Security**: Restricted to `admin` role.

### `update-application-status`
- **Action**: Atomic update of status, insertion into activity log, and notification trigger.
- **Trigger**: Residence Portal -> Application Detail.
- **Security**: Restricted to `residence_portal` or `admin`.

## 2. Utility Services

### `resbot-ai`
- **Action**: Handles AI chat queries for students regarding accommodation and NSFAS.
- **Trigger**: `ResBot` UI component.

### `generate-booking-slip`
- **Action**: Generates a PDF/HTML booking slip for students who have been approved.
- **Trigger**: Student Dashboard -> Applications.

### `download-handover-pack`
- **Action**: Zips student documents and data for university submission.
- **Trigger**: Residence Portal -> Analytics/Exports.

## 3. Financial Services

### `yoco-checkout`
- **Action**: Creates a checkout session with Yoco gateway.
- **Used By**: Marketplace/Hamper Checkout.

### `referral-capture`
- **Action**: Backend verification of referral codes to prevent fraud.
- **Used By**: Authentication flow.
