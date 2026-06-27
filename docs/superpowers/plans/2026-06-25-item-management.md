# Item Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a usable admin-managed catalog and miniapp ordering loop with demo-token authentication and order synchronization.

**Architecture:** Use the existing NestJS/Prisma backend as the source of truth for catalog and orders. Add small typed API layers in admin and uniapp, keeping UI state local and simple. Preserve stock fields but remove inventory blocking from order creation.

**Tech Stack:** NestJS, Prisma, MySQL, Vue 3, Vite, uni-app, TypeScript.

---

## File Structure

- `backend/src/modules/products/`: extend product/category/catalog service behavior and DTOs.
- `backend/src/modules/menu/`: replace hard-coded menu response with live catalog read.
- `backend/src/modules/orders/`: allow demo-token order creation and remove stock deduction.
- `backend/src/modules/auth/`: demo-token helper and optional decorator/utility.
- `backend/uploads/products/`: local uploaded product images.
- `admin/src/`: replace starter page with operational catalog/order workbench.
- `uniapp/src/services/`: miniapp auth, request, catalog, cart, and order helpers.
- `uniapp/src/pages/`: switch menu/spec/checkout/history/detail pages from mock data to services.

## Tasks

- [ ] Add backend DTOs and tests for catalog create/update/status payloads.
- [ ] Implement category and product management endpoints.
- [ ] Add local product-image upload and static file serving.
- [ ] Replace menu API with database-backed active catalog response.
- [ ] Add demo-token support and update order creation to avoid inventory blocking.
- [ ] Build admin catalog and order workbench.
- [ ] Add miniapp service layer and demo token bootstrap.
- [ ] Wire miniapp menu/spec/cart/checkout/order pages to backend data.
- [ ] Run backend/admin/uniapp verification and simulate the full order flow.

## TDD Anchors

- Backend product service tests prove product creation creates a default SKU and status changes affect menu visibility.
- Backend order service tests prove zero stock does not block order creation and inactive products cannot be ordered.
- Miniapp service tests are limited to pure mappers/helpers where possible because uni-app page runtime is harder to isolate here.

