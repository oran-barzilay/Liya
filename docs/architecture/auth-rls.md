# Auth and RLS for Two-User Household

## Auth Model

- Use Supabase Auth email/password or magic links for Oran and Linoy.
- On first sign-in, create one `households` row and two `users` rows linked to `auth.users.id`.
- Every business table carries `household_id`.

## Authorization Rules

- `users` can see users in the same household.
- Every CRUD on core tables is restricted to `household_id = current_household_id()`.
- `current_household_id()` resolves from `users` by `auth.uid()`.

## Practical Setup Sequence

1. Apply migration.
2. Create first account (owner).
3. Insert household + owner profile.
4. Invite second account and map to same household.
5. Validate with two sessions that cross-household access is denied.

