import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import AiAssistantCard from "../components/AiAssistantCard";
import { useInventory } from "../hooks/useInventory";
import { useTasks } from "../hooks/useTasks";

export default function Assistant() {
  const [params] = useSearchParams();
  const initialQuestion = params.get("q") ?? "";

  const { data: inventory = [], upsertItem } = useInventory();
  const { data: tasks = [], createTask } = useTasks();

  const addInventoryFromAi = (item: Record<string, any>) =>
    new Promise<void>((resolve, reject) => {
      upsertItem.mutate(item, {
        onSuccess: () => resolve(),
        onError: (err) => reject(err),
      });
    });

  const addTaskFromAi = (task: Record<string, any>) =>
    new Promise<void>((resolve, reject) => {
      createTask.mutate(task, {
        onSuccess: () => resolve(),
        onError: (err) => reject(err),
      });
    });

  const description = useMemo(
    () => `אפשר לשאול שאלות על קניות ולבקש יצירת משימות. כרגע ${inventory.length} פריטים במלאי ו-${tasks.length} משימות במערכת.`,
    [inventory.length, tasks.length]
  );

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-theme">צ'אט עם הסוכן</h2>
        <p className="text-theme-muted text-sm mt-1">{description}</p>
      </div>

      <AiAssistantCard
        standalone
        initialMessage={initialQuestion}
        inventory={inventory as Array<Record<string, any>>}
        tasks={tasks as Array<Record<string, any>>}
        onAddInventoryItem={addInventoryFromAi}
        onAddTask={addTaskFromAi}
      />
    </div>
  );
}

