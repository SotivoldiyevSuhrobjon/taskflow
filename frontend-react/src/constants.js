export const STATUSES = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
];

export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.key, s.label]));

// Status faqat bir qadam o'zgaradi (backend ham shuni talab qiladi)
export const MOVES = {
  pending: [{ to: "in_progress", text: "Start", cls: "primary" }],
  in_progress: [
    { to: "pending", text: "Back", cls: "ghost" },
    { to: "completed", text: "Complete", cls: "primary" },
  ],
  completed: [{ to: "in_progress", text: "Reopen", cls: "ghost" }],
};
