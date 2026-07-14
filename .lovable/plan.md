## Scope

Three coordinated changes across admin + user app.

### 1. Admin → Planos tab (CRUD)

Rewrite `PlansTab` in `src/routes/_app.admin.tsx`:

- Table columns: Name, Slug, Price, Period, Popular ⭐, Free badge, Active toggle, Max Restaurants (0 = "Ilimitado"), Max Orders/mês, Ordem, Actions (Editar / Excluir).
- "Novo plano" button opens a Dialog form with all fields:
  - Basic: name, slug (unique/alphanumeric+hyphen), price (≥0), period (dropdown: monthly/yearly/one_time/free).
  - Flags: active, popular, is_free.
  - Capabilities: menu_sync, auto_accept (checkboxes) — stored in the plan payload (backend field names `menu_sync`, `auto_accept`; will send both at root and inside a `capabilities` object to be safe).
  - Features: textarea, one per line → `string[]`.
  - Limits: max_restaurants, max_orders_per_month (0 = ilimitado, min 0).
  - Sort: display_order.
- Uses existing `getPlansAdmin / createPlan / updatePlanDB / deletePlan` from `src/lib/api.ts`. Extend `DBPlan` and `DBPlanInput` types to include `billing_period`, `menu_sync`, `auto_accept`, `capabilities`.
- Delete → AlertDialog confirmation; success toast + refresh.

### 2. Admin → Usuários tab (edit user plan/status)

Enhance `UsersTab`:

- Add "Ações" column with Editar button.
- Edit dialog shows read-only: id, name, email, created_at.
- Editable: plan (dropdown loaded from active plans via `getPlansPublic()`), active toggle, payment_status dropdown.
- PUT `/admin/users/:id` with `{ plan, active, payment_status }`. Add `updateAdminUser` helper.
- Deactivation confirmation dialog.

### 3. User-facing plan gating

New helpers in `src/lib/api.ts`:
- `UsageResponse` type + `getUsage()` → `GET /usage`.
- `PlanErrorPayload` discriminator on `ApiError.payload` for the four 403 errors.

New context `src/lib/usage-context.tsx`:
- Provides usage + refresh, mounted inside `_app.tsx` layout.
- Fetches on mount and on `window` focus.

New component `src/components/plan-limit-modal.tsx`:
- Listens to a global event bus (`window.dispatchEvent(new CustomEvent("plan-gate", { detail }))`) fired from `request()` in `api.ts` when 403 with one of the four known error codes arrives.
- Renders the four modals (Feature Not Available, Plan Limit Reached, Account Inactive, Trial Expired) with correct CTAs (navigate to `/checkout` or mailto support).

Wire gating into existing UI:
- `src/routes/_app.integrations.tsx` / `_app.menu-manager.tsx`: locate menu_sync + auto_accept toggles/buttons and disable when capability false, with Tooltip "Disponível no plano X".
- `src/routes/_app.restaurants.tsx`: show `restaurants_count / max_restaurants` counter + "Limite atingido" badge; over_limit banner with "Ver planos" → `/checkout`.
- `src/routes/_app.orders.tsx`: show `orders_this_month / max_orders_month` counter; over_limit banner.

### Technical notes

- No new packages required (shadcn Dialog/AlertDialog/Select/Switch/Tooltip already available).
- All admin calls already carry Bearer via `authToken` in `request()`.
- Gating modal is centralized so any API 403 anywhere in the app surfaces it — no per-call handling needed.
- 0 for limits displays as "Ilimitado" and never triggers "Limit reached".

### Out of scope

- Building a full public pricing/upgrade page (existing `/checkout` is used as the upgrade destination).
- Backend changes.
- Over-limit *blocking* (only warns; backend enforces).
