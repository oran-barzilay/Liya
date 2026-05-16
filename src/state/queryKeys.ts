import type { UUID } from "../types/domain";

export const queryKeys = {
  tasks: (householdId: UUID) => ["tasks", householdId] as const,
  inventory: (householdId: UUID) => ["inventory", householdId] as const,
  babyLogs: (householdId: UUID, childId?: UUID) =>
    ["baby_logs", householdId, childId ?? "all"] as const,
  appointments: (householdId: UUID) => ["appointments", householdId] as const,
  transactions: (householdId: UUID, month: string) =>
    ["transactions", householdId, month] as const,
  categories: (householdId: UUID) => ["categories", householdId] as const,
  dashboard: (householdId: UUID, date: string) =>
    ["dashboard", householdId, date] as const,
};

