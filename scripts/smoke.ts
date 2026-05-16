import type { CreateTaskInput, DashboardApiResponse } from "../src/types/api";

const seedTask: CreateTaskInput = {
  householdId: "00000000-0000-0000-0000-000000000001",
  title: "Change baby sheets",
  description: "Nightly hygiene task",
  module: "baby",
  taskType: "time_sensitive",
  status: "todo",
  priorityLevel: 2,
  dueAt: null,
  scheduledStartAt: new Date().toISOString(),
  scheduledEndAt: null,
  isRecurring: true,
  recurrenceRule: "FREQ=DAILY;BYHOUR=21;BYMINUTE=00",
  sourceType: "recurring",
  sourceEntity: null,
  sourceId: null,
  createdBy: "00000000-0000-0000-0000-000000000001",
  assignedTo: null,
};

const dashboard: DashboardApiResponse = {
  todayTimeSensitiveTasks: [],
  lowInventoryItems: [],
  currentMonthlyBalance: 0,
  nextDoctorAppointment: null,
  generatedAt: new Date().toISOString(),
};

console.log("Smoke check: typed models initialized", {
  seedTaskTitle: seedTask.title,
  generatedAt: dashboard.generatedAt,
});

