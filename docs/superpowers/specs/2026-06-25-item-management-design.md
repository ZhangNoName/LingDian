# Item Management Design

## Goal

Build the first usable item-management and ordering loop for the `item-manage` branch: admin users can manage categories, item pricing, descriptions, images, and availability; the miniapp reads live items and creates orders; the admin order list reflects those orders.

## Current State

- `backend/` already uses NestJS, Prisma, MySQL, and response envelopes.
- Prisma already has `Store`, `Category`, `Product`, `ProductSKU`, selection, and order models.
- `ProductsService` can read products, update SKU price/stock, and sync SKU/selection config.
- `OrdersService` can create orders and list/update/delete them, but currently decrements SKU stock and rejects insufficient inventory.
- `MenuController` and `StoresController` return hard-coded data.
- `admin/` is still the default Vite/Vue screen.
- `uniapp/` has polished screens, but menu, spec, checkout, and order pages read `src/data/mock.ts`.

## Scope

This branch implements a practical demo ordering flow, not a full production commerce system.

In scope:

- Category list, create, update, and visibility controls.
- Product list, create, update, and availability controls.
- Product fields: name, description, image URL, category, base price, default SKU price, status, featured flag, and stock field entry.
- Local image upload endpoint for admin-managed product images.
- Miniapp live menu and product-detail reads.
- Miniapp cart, checkout, order creation, order history, and order detail against the backend.
- Fixed demo-token authentication so the miniapp can place orders before real login exists.
- Admin order list synchronized from backend orders.

Out of scope:

- Real WeChat login, user accounts, role permissions, and token issuing.
- Real payment.
- Real inventory deduction, inventory reservation, low-stock warnings, and stock failure.
- Full SKU/selection authoring UI beyond a simple default SKU and existing product config compatibility.

## Authentication

Use a thin demo auth path until login exists.

- Miniapp stores `demo-token` locally at startup.
- Miniapp request helpers attach `Authorization: Bearer demo-token`.
- Backend exposes a tiny auth helper that accepts `demo-token`.
- Order creation may omit customer fields; when the token is accepted, backend fills:
  - `customerName`: `演示用户`
  - `mobile`: `13800000000`
- Existing explicit `customerName` and `mobile` request fields still work for API compatibility.

This is intentionally easy to remove when real login lands.

## Backend Design

### Catalog API

Add backend DTOs and service methods for admin catalog management.

Endpoints:

- `GET /api/categories`
- `POST /api/categories`
- `PATCH /api/categories/:id`
- `GET /api/products`
- `POST /api/products`
- `PATCH /api/products/:id`
- `PATCH /api/products/:id/status`
- `POST /api/uploads/product-image`

Category response fields:

- `id`
- `store_id`
- `name`
- `sort_order`
- `is_visible`

Product response fields extend the current mapper with:

- `description`
- `image_url`
- `price`
- `stock`
- `is_featured`
- `category_id`
- `status`
- `is_active`
- `skus`
- `selection_groups`

Product create behavior:

- Resolve the current demo store.
- Create product with one default active SKU.
- Set product `price` equal to the default SKU price.
- Preserve stock fields but do not make stock control part of ordering.

Product update behavior:

- Update name, description, category, image URL, featured flag, stock field, and default SKU price.
- Refresh product summary price and stock after SKU changes.

Status behavior:

- `ACTIVE` means visible/orderable in miniapp.
- `SOLD_OUT`, `DRAFT`, and `ARCHIVED` are hidden from the miniapp menu.
- The admin can still see and edit all statuses.

Image upload behavior:

- Use Nest multipart upload with local disk storage.
- Store files under `backend/uploads/products/`.
- Serve uploaded files under `/uploads/products/<filename>`.
- Return `{ url }`, where `url` is usable by admin and miniapp.

### Menu API

Replace hard-coded menu data with database-backed reads.

`GET /api/menu/current` returns:

- Current store data.
- Visible categories ordered by `sortOrder`.
- Only products with `status = ACTIVE`.
- Only active SKUs.
- Product detail data needed by miniapp spec selection.

### Order API

Update `OrdersService.createOrder`:

- Accept demo-token context when customer fields are omitted.
- Require SKUs to be active and their products to be `ACTIVE`.
- Do not decrement stock or reject insufficient stock.
- Preserve the stock fields in responses and admin UI.
- Continue creating order items and selection snapshots from current SKU/selection data.

## Admin Design

Replace `admin/src/App.vue` with a real workbench.

Layout:

- Left column: category list and category editor.
- Main column: product table and product editor.
- Right column or lower section: synchronized order list.

Product controls:

- Name input.
- Category select.
- Price input.
- Description textarea.
- Image URL input.
- File upload button.
- Status select with `DRAFT`, `ACTIVE`, `SOLD_OUT`, `ARCHIVED`.
- Featured toggle.
- Stock input retained as a future inventory entry.
- Save button.

Order controls:

- Refresh order list.
- Show order number, status, customer, amount, items, and created time.

The UI should be dense and operational, not a marketing page.

## Miniapp Design

Add a small API layer under `uniapp/src/services/`.

Files:

- `auth.ts`: ensure and read demo token.
- `request.ts`: response envelope handling and Authorization header.
- `catalog.ts`: menu and product detail calls.
- `cart.ts`: local cart state.
- `orders.ts`: create order, list orders, read order detail.

Page changes:

- Home page reads live featured products.
- Order/menu page reads live categories and active products.
- Spec page reads product detail by route `id`.
- Checkout page reads cart and submits order.
- History page reads backend order list.
- Order detail page reads backend order detail.

## Data Flow

1. Admin creates or edits a category.
2. Admin creates or edits a product, uploads an image, sets price and status `ACTIVE`.
3. Miniapp loads `/api/menu/current` with `demo-token`.
4. User selects product, confirms spec/quantity, and adds it to local cart.
5. Checkout submits `/api/order/create` with cart SKUs and demo token.
6. Backend creates order without inventory deduction.
7. Miniapp redirects to order history/detail.
8. Admin refreshes orders and sees the new order.

## Error Handling

- Missing or invalid demo token on miniapp-only flows returns unauthorized once auth is wired.
- Products that are not active cannot be ordered.
- Missing category/product/SKU returns a clear not-found error.
- Upload rejects missing files and returns a readable error.
- Miniapp request helper unwraps `{ code, msg, data }` and shows `msg` on failure.

## Verification

Required checks:

- Backend TypeScript build succeeds.
- Admin build succeeds.
- Uniapp type check succeeds.
- Simulated API flow succeeds:
  - Product/category can be created or updated.
  - Product can be activated.
  - Menu includes active product and excludes inactive product.
  - Order can be created with `demo-token` even when stock is zero.
  - Order list includes the new order.

