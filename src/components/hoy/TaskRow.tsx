import { daysUntil, dueText } from "@/lib/date";
import { catLabel } from "@/lib/tasks";
import type { Task } from "@/lib/types";

export default function TaskRow({
  task,
  showTime,
  onToggle,
  onDelete,
}: {
  task: Task;
  showTime?: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const soon = task.due_date !== null && (daysUntil(task.due_date) ?? 99) <= 2;
  const showTimeBit = showTime && (task.due_time || task.due_date);

  return (
    <div className={`task-row ${task.done ? "done" : ""}`}>
      <input type="checkbox" checked={task.done} onChange={() => onToggle(task.id)} />
      <span className="task-title">{task.title}</span>
      <span className="task-meta">
        {showTimeBit && (
          <span className={`time-chip ${soon ? "due-soon" : ""}`}>
            {task.due_time ? task.due_time.slice(0, 5) + " " : ""}
            {task.due_date ? "· " + dueText(task.due_date) : ""}
          </span>
        )}
        <span className={`chip chip-${task.category}`}>{catLabel[task.category]}</span>
      </span>
      <span className="task-del" onClick={() => onDelete(task.id)}>
        ✕
      </span>
    </div>
  );
}
