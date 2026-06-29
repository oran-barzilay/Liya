import type { UUID } from "../types/domain";

export const queryKeys = {
  tasks: (householdId: UUID) => ["tasks", householdId] as const,
  inventory: (householdId: UUID) => ["inventory", householdId] as const,
  inventoryCategories: (householdId: UUID) => ["inventory_categories", householdId] as const,
  babyLogs: (householdId: UUID, childId?: UUID) =>
    ["baby_logs", householdId, childId ?? "all"] as const,
  appointments: (householdId: UUID) => ["appointments", householdId] as const,
  transactions: (householdId: UUID, month: string) =>
    ["transactions", householdId, month] as const,
  categories: (householdId: UUID) => ["categories", householdId] as const,
  creditImports: (householdId: UUID, month?: string) =>
    ["credit_imports", householdId, month ?? "all"] as const,
  creditTransactions: (householdId: UUID, month: string) =>
    ["credit_transactions", householdId, month] as const,
  businessMappings: (householdId: UUID) => ["business_mappings", householdId] as const,
  analytics: (householdId: UUID, months: number) =>
    ["analytics", householdId, months] as const,
  dashboard: (householdId: UUID, date: string) =>
    ["dashboard", householdId, date] as const,
};

