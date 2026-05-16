# Inventory -> Task Automation (Supabase)

## Recommended Path: PostgreSQL Trigger (Primary)

Use a database trigger because it executes inside the same transaction that updates inventory.

### Flow

1. User updates `inventory.quantity` (manual edit, mobile UI, bulk import).
2. `trg_inventory_restock_task` fires (`BEFORE INSERT OR UPDATE`).
3. `create_restock_task()` checks:
   - `auto_restock_task = true`
   - `quantity < critical_threshold`
4. Function deduplicates by searching existing open tasks where:
   - `source_type = 'inventory_threshold'`
   - `source_entity = 'inventory'`
   - `source_id = inventory.id`
   - `status IN ('todo', 'in_progress')`
5. If no open restock task exists, insert a task into `tasks`.

### Why Trigger First

- Strong consistency: inventory and task creation happen atomically.
- No network hop: lower latency than calling external logic.
- No scheduler drift: runs exactly when data changes.

## Optional Path: Edge Function (Secondary)

Use an Edge Function only for side effects after task creation, such as notifications.

- Trigger writes task in DB.
- Realtime or webhook calls Edge Function.
- Edge Function sends push/email/WhatsApp alerts.

This separation keeps critical business rules in SQL and external integrations in Edge Functions.

