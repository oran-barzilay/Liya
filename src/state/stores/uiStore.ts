import { create } from "zustand";

type TaskBoardView = "kanban" | "list" | "timeline";

interface UiState {
  selectedDate: string;
  taskBoardView: TaskBoardView;
  showCompletedTasks: boolean;
  setSelectedDate: (date: string) => void;
  setTaskBoardView: (view: TaskBoardView) => void;
  toggleShowCompletedTasks: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  selectedDate: new Date().toISOString().slice(0, 10),
  taskBoardView: "kanban",
  showCompletedTasks: false,
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setTaskBoardView: (taskBoardView) => set({ taskBoardView }),
  toggleShowCompletedTasks: () =>
    set((state) => ({ showCompletedTasks: !state.showCompletedTasks })),
}));

