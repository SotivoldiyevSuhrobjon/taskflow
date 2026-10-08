import { useEffect, useState } from "react";
import { STATUSES } from "../constants";
import { useTasks } from "../context/TasksContext";

const FILTERS = [{ key: "", label: "All" }, ...STATUSES];

export default function TaskFilters({ onNew }) {
  const { filter, setFilter, setSearch } = useTasks();
  const [text, setText] = useState("");

  // qidiruv: 300ms debounce
  useEffect(() => {
    const id = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text, setSearch]);

  return (
    <div className="toolbar">
      <div className="tabs filters" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`tab ${filter === f.key ? "active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <input
        type="search"
        id="search"
        placeholder="Search by title"
        aria-label="Search by title"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button className="btn primary" onClick={onNew}>
        New task
      </button>
    </div>
  );
}
