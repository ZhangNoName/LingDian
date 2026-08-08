# Miniapp mobile UI design QA

## Scope and references

- Home reference: `C:/Users/haha/Documents/xwechat_files/wxid_rb3jllo62dsy22_7e0e/temp/RWTemp/2026-08/9e20f478899dc29eb19741386f9343c8/3e0811b7d30c07381a09745bab78ab81.jpg` (`920x2048`).
- Ordering reference: `C:/Users/haha/Documents/xwechat_files/wxid_rb3jllo62dsy22_7e0e/temp/RWTemp/2026-08/9e20f478899dc29eb19741386f9343c8/9dce58356da308d3fa498b98e002f63a.jpg` (`920x2048`).
- Login reference: `C:/Users/haha/Documents/xwechat_files/wxid_rb3jllo62dsy22_7e0e/temp/RWTemp/2026-08/9e20f478899dc29eb19741386f9343c8/9d8ef38a4f83f3045fd18f1da3b1fe9c.jpg` (`920x2048`).
- Implementation viewport: `375x835` CSS px for the primary comparison, plus `375x667`, `375x568`, and ordering at `320x568` for resilience checks.
- H5 preview: `http://localhost:5174/`.

## Combined comparison inputs

- Home: `.superpowers/sdd/2026-08-08-miniapp-mobile-ui-polish/screenshots/compare-home.png`.
- Ordering: `.superpowers/sdd/2026-08-08-miniapp-mobile-ui-polish/screenshots/compare-menu.png`.
- Login: `.superpowers/sdd/2026-08-08-miniapp-mobile-ui-polish/screenshots/compare-login.png`.
- Raw implementation captures: `home-375x835.png`, `menu-375x835-final.png`, and `login-375x835.png` in the same screenshot directory.

The home comparison also includes the exact generated implementation asset because the in-app browser screenshot backend did not paint `uni-image` raster layers. Runtime inspection confirmed the image request completed, reported `2172x724` natural dimensions, and occupied the intended `336x120` hero rectangle; the local asset was separately opened at original resolution. Product images exhibited the same screenshot-backend limitation. No image load error was emitted.

## Fidelity and layout results

- Home: the new top hero reserves a stable 3:1 image slot; the member strip, service cards, recommendation card, CTA, and bottom navigation preserve the reference hierarchy. The new hero asset uses the existing deep-red, cream, and warm food palette.
- Ordering: the left category rail remains `156rpx`; active indication is clearer; the right pane supports loading, error/retry, empty, and ready states. The floating cart is inset and fully rounded instead of clipping against the viewport edge.
- Login: the content group is centered in the viewport, constrained to `680rpx`, and remains complete on short screens. The green verification treatment was replaced with the product's red/soft-red palette.
- Icons: bottom navigation uses one Lucide family at `42rpx` (`21px` at the primary viewport). Each tab has an approximately `44.3px` high touch region, an increase over the reference implementation.
- Typography and surfaces: card radii, white surfaces, muted copy, red primary actions, warm-gold secondary copy, and shadows are consistent across the three target pages.

## Responsive and overflow evidence

- Home, ordering, and login each reported `documentElement.scrollWidth = 375` with a `375px` viewport.
- Ordering cart bounds at `375px`: left `12px`, right `363.33px`, width `351.33px`; checkout label remained fully visible.
- Ordering at `320x568` reported `scrollWidth = 320`; cart bounds remained inside the viewport and the disabled checkout label remained visible.
- A long backend fixture category (`Codex????1782348703093`) initially wrapped in the narrow rail. It was fixed with a class-only single-line ellipsis; the final element reports `clientWidth 58px`, `scrollWidth 144px`, `white-space: nowrap`, and `text-overflow: ellipsis`.
- Login content bounds at `375x835`: top `241.82px`, bottom `593.51px`, width `327.33px`. It remained fully contained at `375x667` and `375x568`.

## Interaction and state checks

- Bottom tabs switched between Home and Ordering with the correct active state.
- Home's dine-in service action navigated to `/pages/order/order`.
- Selecting a product navigated to `/pages/spec/spec?id=...`; the visible back control returned to Ordering.
- Profile and Orders tabs redirected unauthenticated users to Login with the encoded return route preserved.
- Login phone focus applied the visible brand-red focus ring (`rgb(237, 28, 36) 0 0 0 1.5px`).
- Submitting a phone number without a verification code stayed on Login and displayed `请输入手机号和验证码`.
- Unit coverage verified menu-state precedence for loading, error, empty, and ready states. The browser verified the ready state and loading skeleton; the supplied Ordering reference represented an empty-data state, so the side-by-side comparison intentionally uses different data states while retaining the same viewport and shell geometry.

## Console and accessibility

- Browser console: no runtime errors. The only warning is the existing Vue Router deprecated-import warning from the dependency bundle.
- Quantity controls have explicit `减少数量` and `增加数量` accessible names.
- Decorative icons are hidden where adjacent visible labels provide the name; icon-only controls retain accessible labels.
- Login focus indicators and verification/disabled control text were contrast-reviewed and corrected.

## Verification history

- Initial icon review found missing quantity-control labels; fixed and re-reviewed clean.
- Ordering review found the framework's disabled-button background override; fixed and re-reviewed clean.
- Login review found low-contrast focus and control text; fixed and re-reviewed clean.
- Browser QA found long category data wrapping in the sidebar; fixed, reloaded, and confirmed with final screenshot and geometry evidence.
- Final automated pass before browser QA: Vitest `8` files / `29` tests passed, layout tests `13/13` passed, type-check passed, and H5 build passed.

No actionable P0, P1, or P2 design findings remain.

final result: passed
