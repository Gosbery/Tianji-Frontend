"use client";

import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { useState } from "react";
import type { ResearchTask } from "@/lib/types";

type Props = {
  tasks: ResearchTask[];
  activeTaskId?: string;
  creating: boolean;
  onCreate: () => void;
  onSelect: (taskId: string) => void;
  onRename: (taskId: string, title: string) => Promise<void>;
  onArchive: (taskId: string) => Promise<void>;
  onRestore: (taskId: string) => Promise<void>;
};

const STATUS_LABEL = {
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
} as const;

export function TaskSidebar({
  tasks,
  activeTaskId,
  creating,
  onCreate,
  onSelect,
  onRename,
  onArchive,
  onRestore,
}: Props) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [title, setTitle] = useState("");
  const current = tasks.filter((task) => !task.archived);
  const archived = tasks.filter((task) => task.archived);

  const taskRow = (task: ResearchTask, isArchived: boolean) => {
    const status = task.active_job?.status;
    const busy = status === "queued" || status === "running";
    return (
      <div
        key={task.id}
        className={`task-row ${task.id === activeTaskId && !creating ? "active" : ""}`}
      >
        {editingId === task.id ? (
          <form
            className="task-rename"
            onSubmit={(event) => {
              event.preventDefault();
              const value = title.trim();
              if (!value) return;
              void onRename(task.id, value).then(() => setEditingId(undefined));
            }}
          >
            <input
              aria-label="任务标题"
              value={title}
              maxLength={120}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
            />
            <button type="submit" title="保存" aria-label="保存任务标题"><Check size={14} /></button>
            <button type="button" title="取消" aria-label="取消重命名" onClick={() => setEditingId(undefined)}><X size={14} /></button>
          </form>
        ) : (
          <>
            <button type="button" className="task-select" onClick={() => onSelect(task.id)}>
              <span className="task-title">{task.title}</span>
              <span className="task-meta">
                <span>{task.expert_name}</span>
                {status && (
                  <span className={`task-status ${status}`}>
                    {busy && <LoaderCircle size={11} className="spin" aria-hidden="true" />}
                    {STATUS_LABEL[status]}
                  </span>
                )}
              </span>
            </button>
            <div className="task-actions">
              {!isArchived && (
                <button
                  type="button"
                  title="重命名"
                  aria-label={`重命名 ${task.title}`}
                  onClick={() => { setEditingId(task.id); setTitle(task.title); }}
                ><Pencil size={13} /></button>
              )}
              <button
                type="button"
                title={isArchived ? "恢复" : "归档"}
                aria-label={`${isArchived ? "恢复" : "归档"} ${task.title}`}
                onClick={() => void (isArchived ? onRestore(task.id) : onArchive(task.id))}
              >{isArchived ? <RotateCcw size={13} /> : <Archive size={13} />}</button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <aside className="task-sidebar" aria-label="命理任务">
      <div className="task-sidebar-heading">
        <span>命理任务</span>
        <button type="button" title="新建任务" aria-label="新建任务" onClick={onCreate}>
          <Plus size={17} />
        </button>
      </div>
      <div className="task-list">
        {current.length === 0 && <p className="task-empty">暂无任务</p>}
        {current.map((task) => taskRow(task, false))}
      </div>
      {archived.length > 0 && (
        <div className="archive-group">
          <button
            type="button"
            className="archive-toggle"
            aria-expanded={archiveOpen}
            onClick={() => setArchiveOpen((value) => !value)}
          >
            {archiveOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            已归档 <span>{archived.length}</span>
          </button>
          {archiveOpen && <div className="task-list archived">{archived.map((task) => taskRow(task, true))}</div>}
        </div>
      )}
    </aside>
  );
}
