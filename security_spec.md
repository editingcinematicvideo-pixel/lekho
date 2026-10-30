# LEKHO Multi-Tenant POS — Firestore Security Specification

## 1. Authentication & Identity Verification
- All database access requires Firebase Authentication (`request.auth != null`).
- Unauthenticated requests are denied globally across all collections.
- Client-side demo PIN backdoors (`1234`, `5555`, `2222`, `9999`) are eliminated from authentication flows.

## 2. Super Admin Verification (Zero Email-Matching Trust)
- Super Admin privileges are **never** granted by matching an email string on the client or in rules.
- Super Admin status is verified exclusively via `/platform_admins/{uid}`:
  - `exists(/databases/$(database)/documents/platform_admins/$(request.auth.uid))`
  - `get(/databases/$(database)/documents/platform_admins/$(request.auth.uid)).data.active == true`
  - `get(/databases/$(database)/documents/platform_admins/$(request.auth.uid)).data.role == 'super_admin'`
- `/platform_admins/{adminUid}` enforces `allow create, update, delete: if false;` so no user or client script can ever self-promote to `super_admin`. Only the project owner via Firebase Console can create a document in `platform_admins`.

## 3. Multi-Tenant Data Isolation (`shops/{shopId}`)
- Every shop document `/shops/{shopId}` stores:
  - `ownerUid`: The immutable UID of the Shop Owner who created the store.
  - `memberUids`: Array of Firebase Auth UIDs authorized to access the store.
  - `memberRoles`: Map of `{ [uid]: 'shop_owner' | 'manager' | 'salesman' }`.
- Every subcollection under `/shops/{shopId}/...` (`products`, `invoices`, `expenses`, `drawers`, `staff`, `resellers`, `orders`, `data`) enforces:
  - The caller's `request.auth.uid` must be in the parent shop's `memberUids` or match `ownerUid` (or be a verified `isSuperAdmin()`).
  - Every written document in a shop subcollection must have `request.resource.data.shopId == shopId`.

## 4. Role-Based Access Control (RBAC) & Privilege Escalation Prevention
- **User Profile (`/users/{userId}`)**:
  - Users can only read/create/update their own `/users/{userId}` document (`request.auth.uid == userId`).
  - On `create`: `role` must be in `['shop_owner', 'manager', 'salesman']` (never `'super_admin'`), and `uid == request.auth.uid`.
  - On `update`: Users cannot alter `uid`, `role`, `shopId`, or `createdAt` once bound to a shop.
- **Tenant Shop (`/shops/{shopId}`)**:
  - On `create`: `ownerUid == request.auth.uid`, `request.auth.uid in memberUids`, and `memberRoles[request.auth.uid] == 'shop_owner'`.
  - On `update`: Only `ownerUid == request.auth.uid` (or `isSuperAdmin()`) can update shop settings. Even the Shop Owner cannot alter `id`, `ownerUid`, `createdAt`, or self-approve `subscription.status` / `subscription.plan` (only `isSuperAdmin()` can modify subscription approval status).
- **Subcollections (`/shops/{shopId}/...`)**:
  - **Shop Owner (`shop_owner`)**: Full CRUD within their own `shopId`.
  - **Manager (`manager`)**: Read/Create/Update products, invoices, expenses, drawers, resellers, and orders within their own `shopId`. Cannot delete shop or modify staff roles.
  - **Salesman (`salesman`)**: Read shop data, create invoices/expenses/orders, and update product stock/drawers during POS billing within their own `shopId`. Cannot delete products, invoices, or expenses, and cannot modify store settings or staff.
