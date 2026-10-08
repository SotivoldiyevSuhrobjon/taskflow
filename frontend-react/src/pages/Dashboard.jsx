import { useState } from "react";
import Header from "../components/Header";
import TaskBoard from "../components/TaskBoard";
import TaskFilters from "../components/TaskFilters";
import TaskModal from "../components/TaskModal";
import { NotificationsProvider } from "../context/NotificationsContext";
import { TasksProvider } from "../context/TasksContext";

export default function Dashboard() {
  const [view, setView] = useState(() => localStorage.getItem("view") || "kanban");
  const [modalOpen, setModalOpen] = useState(false);

  const changeView = (v) => {
    localStorage.setItem("view", v);
    setView(v);
  };

  return (
    <NotificationsProvider>
      <TasksProvider>
        <Header view={view} onViewChange={changeView} />
        <main className="page">
          <TaskFilters onNew={() => setModalOpen(true)} />
          <TaskBoard view={view} />
        </main>
        <TaskModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </TasksProvider>
    </NotificationsProvider>
  );
}
