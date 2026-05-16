export type UUID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // ISO 8601

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskType = "priority" | "time_sensitive";
export type TaskModule = "general" | "inventory" | "baby" | "finance" | "medical";
export type TaskSourceType = "manual" | "recurring" | "inventory_threshold" | "milestone";

export interface Household {
  id: UUID;
  name: string;
  createdAt: ISODateTime;
}

export interface User {
  id: UUID; // mirrors auth.users.id
  householdId: UUID;
  displayName: string;
  email?: string;
  role: "owner" | "member";
  createdAt: ISODateTime;
}

export interface Task {
  id: UUID;
  householdId: UUID;
  title: string;
  description: string | null;
  module: TaskModule;
  taskType: TaskType;
  status: TaskStatus;
  priorityLevel: 1 | 2 | 3 | 4 | 5 | null;
  dueAt: ISODateTime | null;
  scheduledStartAt: ISODateTime | null;
  scheduledEndAt: ISODateTime | null;
  isRecurring: boolean;
  recurrenceRule: string | null;
  sourceType: TaskSourceType;
  sourceEntity: "inventory" | "milestone" | null;
  sourceId: UUID | null;
  createdBy: UUID;
  assignedTo: UUID | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface InventoryItem {
  id: UUID;
  householdId: UUID;
  name: string;
  unit: string;
  quantity: number;
  criticalThreshold: number;
  autoRestockTask: boolean;
  notes: string | null;
  lastBelowThresholdAt: ISODateTime | null;
  updatedBy: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type BabyLogType = "feeding" | "diaper_change" | "sleep" | "note";

export interface Child {
  id: UUID;
  householdId: UUID;
  name: string;
  birthDate: ISODate;
  createdAt: ISODateTime;
}

export interface BabyLog {
  id: UUID;
  householdId: UUID;
  childId: UUID;
  logType: BabyLogType;
  eventAt: ISODateTime;
  amount: number | null;
  unit: string | null;
  notes: string | null;
  recordedBy: UUID;
  createdAt: ISODateTime;
}

export interface Appointment {
  id: UUID;
  householdId: UUID;
  childId: UUID | null;
  title: string;
  providerName: string | null;
  startsAt: ISODateTime;
  endsAt: ISODateTime | null;
  location: string | null;
  notes: string | null;
  status: "scheduled" | "completed" | "cancelled";
  createdBy: UUID;
  createdAt: ISODateTime;
}

export type TransactionType = "income" | "expense";

export interface Category {
  id: UUID;
  householdId: UUID;
  transactionType: TransactionType;
  name: string;
  isSystem: boolean;
  createdAt: ISODateTime;
}

export interface Transaction {
  id: UUID;
  householdId: UUID;
  ownerUserId: UUID;
  enteredBy: UUID;
  categoryId: UUID;
  transactionType: TransactionType;
  amount: number;
  isFixed: boolean;
  transactionDate: ISODate;
  notes: string | null;
  createdAt: ISODateTime;
}

export interface DashboardSnapshot {
  todayTimeSensitiveTasks: Task[];
  lowInventoryItems: InventoryItem[];
  currentMonthlyBalance: number;
  nextDoctorAppointment: Appointment | null;
}

