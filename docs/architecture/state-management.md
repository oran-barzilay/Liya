# State Management Strategy

## Split by Responsibility

- **Server state**: `@tanstack/react-query`
  - Fetching, caching, retries, invalidation.
  - Query keys are centralized in `src/state/queryKeys.ts`.
- **Client/UI state**: `zustand`
  - View mode, selected date, local filters, panel toggles.
  - Store is in `src/state/stores/uiStore.ts`.
- **Realtime sync**: Supabase channels
  - Use `bindHouseholdRealtime()` in `src/state/supabase/realtime.ts`.
  - Invalidate affected queries when table changes arrive.

## Query Boundaries

- Dashboard widgets should read from dedicated dashboard query key.
- Module screens should read module-specific keys (`tasks`, `inventory`, `transactions`, etc.).
- Mutations should optimistically update local cache where safe, then fallback to invalidation.

## Offline/Latency Guidance

- Keep stale time modest for dashboard (15-60s) and longer for static lists (categories).
- Use realtime updates to refresh instead of aggressive polling.

