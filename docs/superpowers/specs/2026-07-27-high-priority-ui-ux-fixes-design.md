# High-Priority UI/UX Fixes Design

**Date:** 2026-07-27  
**Status:** Approved

## Goal

Resolve the highest-impact layout, interaction, authentication, feedback, and accessibility defects found in the merchant web app, admin app, and customer uni-app while preserving the existing visual systems and avoiding unrelated brand or performance refactors.

## Scope

### Merchant web app

- Keep the existing desktop sidebar behavior.
- On small screens, expose navigation through a modal drawer with a backdrop, close affordance, route-change dismissal, and Escape-key dismissal.
- Make the application content region vertically scrollable at every viewport size.
- Connect controls that already have valid destinations to those routes.
- Disable unfinished controls and label them as under development instead of presenting inert actions.
- Replace raw authentication errors with user-facing Chinese messages and announce errors to assistive technology.

### Admin app

- Map known authentication failures to concise Chinese messages while retaining a safe fallback for unknown failures.
- Ensure login errors are announced as alerts.
- Keep the approved admin visual design unchanged.

### Customer uni-app

- Allow guest access to the home and menu experiences.
- Require authentication for checkout, order history, and profile/account management.
- Preserve the intended destination when redirecting to login, then return the customer after successful authentication.
- Render the signed-in customer's available account data; render a clear login/register guest state otherwise.
- Remove fixed mock identity and asset claims from customer-facing member areas.
- Disable checkout when the cart is empty.
- Add useful next actions to empty order and recommendation states.
- Add explicit input labels, alert semantics, keyboard-operable semantics for important interactive surfaces where supported, and improve clearly insufficient text contrast.

## Interaction Model

### Guest authentication flow

1. The customer may enter and browse home and menu pages without a session.
2. A protected action calls a single authentication guard with the current destination.
3. If no valid session can be restored, the guard opens the login page with an encoded return target.
4. Successful login validates the return target against known internal page paths and relaunches or redirects there.
5. Invalid or missing return targets fall back to the profile page.

### Merchant mobile navigation

1. The header menu button opens a mobile-only drawer below/alongside the existing application shell.
2. The drawer traps the primary navigation visually, provides an overlay, and closes on overlay click, explicit close, Escape, or successful navigation.
3. Desktop collapse state and mobile open state remain separate so a mobile interaction cannot accidentally collapse the desktop sidebar.

## Data and Error Handling

- Authentication errors are normalized in frontend helpers rather than exposing backend English strings directly.
- Known invalid-credential, expired-session, and network cases receive actionable Chinese messages.
- Unknown errors use a neutral fallback and remain available to diagnostics through existing logging behavior.
- Customer identity comes from the customer authentication store/session. Missing optional fields use neutral labels rather than fabricated values.
- Empty lists and unavailable assets are presented as empty or unavailable, never as fixed demo balances.

## Testing Strategy

- Add focused failing tests before each behavior change.
- Merchant tests cover separate desktop/mobile sidebar state, drawer dismissal, scrollable shell, route controls, and error normalization.
- Customer tests cover protected-route redirects, safe return-target handling, guest/member rendering, empty-cart checkout prevention, and empty-state actions.
- Run existing tests for admin, web, and uni-app after focused tests pass.
- Build all three frontends using the repository-declared pnpm version.
- Perform desktop and mobile visual regression checks on the affected flows in the in-app browser.

## Out of Scope

- Brand-color consolidation across products.
- Replacing the complete icon system.
- Implementing unfinished backend business modules.
- Bundle splitting or broad performance refactoring.
- Unrelated changes under `packages/observability`.
