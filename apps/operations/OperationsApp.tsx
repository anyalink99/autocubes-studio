import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookMarked,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Filter,
  FolderKanban,
  Heart,
  LayoutDashboard,
  Library,
  Link2,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  Activity,
  calculateProgress,
  Lead,
  LeadStage,
  LibraryItem,
  leadStages,
  OperationsState,
  projectStages,
  ReviewItem,
  ReviewStatus,
  StudioProject,
  Task,
  uid,
  today,
} from "../../packages/core/operations";
import {
  initialOperationsState,
  loadOperationsState,
  storageKey,
} from "./data";
import { syncStatusLabel, useServerSync } from "../shared/useServerSync";

type View = "overview" | "crm" | "projects" | "reviews" | "library";

const money = (value: number) =>
  value
    ? new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "RUB",
        maximumFractionDigits: 0,
      }).format(value)
    : "Внутренний";
const shortDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "short",
      }).format(new Date(`${value}T12:00:00`))
    : "Без срока";
const relativeDate = (value: string) => {
  const diff = Math.ceil(
    (new Date(`${value}T23:59:59`).getTime() - Date.now()) / 86400000,
  );
  if (diff < 0) return `Просрочено ${Math.abs(diff)} д.`;
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Завтра";
  return `Через ${diff} д.`;
};
const reviewLabels: Record<ReviewStatus, string> = {
  draft: "Черновик",
  review: "На проверке",
  changes: "Нужны правки",
  approved: "Согласовано",
};

const useOperations = () => {
  const [state, setState] = useState<OperationsState>(loadOperationsState);
  const syncStatus = useServerSync("operations", state, (remote) => {
    if (remote?.version === 1 && Array.isArray(remote.leads) && Array.isArray(remote.projects) && Array.isArray(remote.reviews) && Array.isArray(remote.library)) setState(remote);
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (error) {
      console.error("Operations data could not be saved", error);
    }
  }, [state]);
  return [state, setState, syncStatus] as const;
};

const IconButton = ({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) => (
  <button
    className="ops-icon-button"
    title={label}
    aria-label={label}
    onClick={onClick}
  >
    {children}
  </button>
);

const Empty = ({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
}) => (
  <div className="ops-empty">
    <CircleDot size={28} />
    <strong>{title}</strong>
    <p>{text}</p>
    {action}
  </div>
);

const Modal = ({
  title,
  eyebrow,
  children,
  onClose,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  onClose: () => void;
}) => (
  <div
    className="ops-modal-backdrop"
    role="presentation"
    onMouseDown={(event) => event.target === event.currentTarget && onClose()}
  >
    <section
      className="ops-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header>
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <IconButton label="Закрыть" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </header>
      {children}
    </section>
  </div>
);

const Header = ({
  view,
  title,
  description,
  action,
}: {
  view: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) => (
  <header className="ops-page-header">
    <div>
      <span className="ops-eyebrow">{view}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {action && <div className="ops-header-action">{action}</div>}
  </header>
);

const Overview = ({
  state,
  openView,
}: {
  state: OperationsState;
  openView: (view: View) => void;
}) => {
  const tasks = state.projects.flatMap((project) =>
    project.phases.flatMap((phase) =>
      phase.tasks.map((task) => ({ ...task, project: project.title })),
    ),
  );
  const upcoming = tasks
    .filter((task) => !task.done)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
    .slice(0, 6);
  const activeValue = state.leads
    .filter((lead) => !["lost", "won"].includes(lead.stage))
    .reduce((sum, lead) => sum + lead.value, 0);
  const unresolved = state.reviews.reduce(
    (sum, item) =>
      sum + item.comments.filter((comment) => !comment.resolved).length,
    0,
  );
  return (
    <>
      <Header
        view="Сегодня в студии"
        title="Студия сегодня"
        description="Что требует ответа, где есть риск и какой следующий шаг двигает работу вперёд."
      />
      <section className="ops-stat-grid">
        <button onClick={() => openView("crm")}>
          <span>Активный пайплайн</span>
          <strong>{money(activeValue)}</strong>
          <small>
            {
              state.leads.filter(
                (lead) => !["lost", "won"].includes(lead.stage),
              ).length
            }{" "}
            потенциальных проектов <ArrowUpRight size={13} />
          </small>
        </button>
        <button onClick={() => openView("projects")}>
          <span>Проекты в работе</span>
          <strong>
            {String(
              state.projects.filter((project) => project.status === "active")
                .length,
            ).padStart(2, "0")}
          </strong>
          <small>
            {
              state.projects.filter((project) => project.health !== "good")
                .length
            }{" "}
            требуют внимания <ArrowUpRight size={13} />
          </small>
        </button>
        <button onClick={() => openView("reviews")}>
          <span>Открытые комментарии</span>
          <strong>{String(unresolved).padStart(2, "0")}</strong>
          <small>
            {
              state.reviews.filter((review) => review.status === "review")
                .length
            }{" "}
            материалов на проверке <ArrowUpRight size={13} />
          </small>
        </button>
        <button onClick={() => openView("library")}>
          <span>Библиотека</span>
          <strong>{String(state.library.length).padStart(2, "0")}</strong>
          <small>
            {state.library.filter((item) => item.favorite).length} избранных
            решений <ArrowUpRight size={13} />
          </small>
        </button>
      </section>
      <section className="ops-overview-grid">
        <div className="ops-panel ops-focus-panel">
          <div className="ops-panel-heading">
            <div>
              <span className="ops-eyebrow">Фокус</span>
              <h2>Следующие действия</h2>
            </div>
            <button onClick={() => openView("projects")}>
              Все задачи <ArrowRight size={14} />
            </button>
          </div>
          <div className="ops-task-list">
            {upcoming.map((task) => (
              <div className="ops-task-row" key={task.id}>
                <span className={`ops-priority ${task.priority}`} />
                <div>
                  <strong>{task.title}</strong>
                  <small>
                    {task.project} · {task.assignee}
                  </small>
                </div>
                <time
                  className={
                    new Date(task.dueAt) < new Date(today()) ? "overdue" : ""
                  }
                >
                  {relativeDate(task.dueAt)}
                </time>
              </div>
            ))}
            {!upcoming.length && (
              <Empty
                title="На сегодня всё"
                text="Новых задач со сроком пока нет."
              />
            )}
          </div>
        </div>
        <div className="ops-panel ops-pulse-panel">
          <div className="ops-panel-heading">
            <div>
              <span className="ops-eyebrow">Пульс</span>
              <h2>Проекты</h2>
            </div>
          </div>
          {state.projects
            .filter((project) => project.status === "active")
            .slice(0, 4)
            .map((project) => (
              <button
                className="ops-project-pulse"
                key={project.id}
                onClick={() => openView("projects")}
              >
                <span className={`ops-health ${project.health}`} />
                <div>
                  <strong>{project.title}</strong>
                  <small>
                    {project.client} ·{" "}
                    {
                      projectStages.find((stage) => stage.id === project.stage)
                        ?.title
                    }
                  </small>
                </div>
                <div className="ops-progress">
                  <i style={{ width: `${calculateProgress(project)}%` }} />
                </div>
                <b>{calculateProgress(project)}%</b>
              </button>
            ))}
        </div>
      </section>
      <section className="ops-panel ops-next-actions">
        <div className="ops-panel-heading">
          <div>
            <span className="ops-eyebrow">Продажи</span>
            <h2>Кому нужно ответить</h2>
          </div>
          <button onClick={() => openView("crm")}>
            Открыть CRM <ArrowRight size={14} />
          </button>
        </div>
        <div className="ops-action-strip">
          {state.leads
            .filter((lead) => lead.nextAction)
            .sort((a, b) => a.nextActionAt.localeCompare(b.nextActionAt))
            .slice(0, 4)
            .map((lead) => (
              <button key={lead.id} onClick={() => openView("crm")}>
                <span>{shortDate(lead.nextActionAt)}</span>
                <strong>{lead.company}</strong>
                <p>{lead.nextAction}</p>
                <small>
                  {lead.channel} · {money(lead.value)}
                </small>
              </button>
            ))}
        </div>
      </section>
    </>
  );
};

const LeadForm = ({
  onSave,
  onClose,
}: {
  onSave: (lead: Lead) => void;
  onClose: () => void;
}) => {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const lead: Lead = {
      id: uid("lead"),
      company: String(form.get("company")),
      contact: String(form.get("contact")),
      channel: String(form.get("channel")),
      source: String(form.get("source")),
      stage: "new",
      value: Number(form.get("value")) || 0,
      nextAction: String(form.get("nextAction")),
      nextActionAt: String(form.get("nextActionAt")),
      tags: String(form.get("tags"))
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes: String(form.get("notes")),
      activities: [],
      createdAt: new Date().toISOString(),
    };
    onSave(lead);
  };
  return (
    <Modal title="Новый контакт" eyebrow="CRM" onClose={onClose}>
      <form className="ops-form" onSubmit={submit}>
        <label className="wide">
          <span>Компания *</span>
          <input
            name="company"
            required
            autoFocus
            placeholder="Название компании"
          />
        </label>
        <label>
          <span>Контакт</span>
          <input name="contact" placeholder="Имя и роль" />
        </label>
        <label>
          <span>Канал</span>
          <select name="channel">
            <option>Telegram</option>
            <option>Instagram</option>
            <option>WhatsApp</option>
            <option>Email</option>
            <option>Сайт</option>
          </select>
        </label>
        <label>
          <span>Источник</span>
          <input name="source" placeholder="Рекомендация, исходящий..." />
        </label>
        <label>
          <span>Потенциал, ₽</span>
          <input name="value" type="number" min="0" placeholder="200000" />
        </label>
        <label className="wide">
          <span>Следующее действие</span>
          <input name="nextAction" placeholder="Отправить кейсы" />
        </label>
        <label>
          <span>Когда</span>
          <input name="nextActionAt" type="date" defaultValue={today()} />
        </label>
        <label>
          <span>Теги через запятую</span>
          <input name="tags" placeholder="сайт, айдентика" />
        </label>
        <label className="wide">
          <span>Контекст</span>
          <textarea
            name="notes"
            rows={4}
            placeholder="Что важно не потерять после разговора"
          />
        </label>
        <footer>
          <button type="button" className="ops-button ghost" onClick={onClose}>
            Отмена
          </button>
          <button className="ops-button primary">
            <Plus size={15} />
            Добавить контакт
          </button>
        </footer>
      </form>
    </Modal>
  );
};

const LeadDrawer = ({
  lead,
  update,
  convert,
  close,
}: {
  lead: Lead;
  update: (lead: Lead) => void;
  convert: () => void;
  close: () => void;
}) => {
  const [note, setNote] = useState("");
  const addActivity = () => {
    if (!note.trim()) return;
    update({
      ...lead,
      activities: [
        {
          id: uid("activity"),
          text: note.trim(),
          kind: "note",
          createdAt: new Date().toISOString(),
        },
        ...lead.activities,
      ],
    });
    setNote("");
  };
  return (
    <div
      className="ops-drawer-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <aside className="ops-drawer">
        <header>
          <span className="ops-eyebrow">Карточка контакта</span>
          <IconButton label="Закрыть" onClick={close}>
            <X size={18} />
          </IconButton>
          <h2>{lead.company}</h2>
          <p>
            {lead.contact || "Контакт не указан"} · {lead.channel}
          </p>
        </header>
        <div className="ops-drawer-stage">
          <label>
            <span>Этап</span>
            <select
              value={lead.stage}
              onChange={(event) =>
                update({ ...lead, stage: event.target.value as LeadStage })
              }
            >
              {leadStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.title}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span>Потенциал</span>
            <strong>{money(lead.value)}</strong>
          </div>
        </div>
        <section>
          <h3>Следующий шаг</h3>
          <input
            value={lead.nextAction}
            onChange={(event) =>
              update({ ...lead, nextAction: event.target.value })
            }
          />
          <input
            type="date"
            value={lead.nextActionAt}
            onChange={(event) =>
              update({ ...lead, nextActionAt: event.target.value })
            }
          />
        </section>
        <section>
          <h3>Контекст</h3>
          <textarea
            rows={5}
            value={lead.notes}
            onChange={(event) => update({ ...lead, notes: event.target.value })}
          />
          <div className="ops-tags">
            {lead.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </section>
        <section className="ops-activity">
          <h3>История</h3>
          <div className="ops-note-input">
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addActivity()}
              placeholder="Добавить заметку..."
            />
            <button onClick={addActivity}>
              <Send size={15} />
            </button>
          </div>
          {lead.activities.map((activity) => (
            <div className="ops-activity-row" key={activity.id}>
              <i />
              <div>
                <p>{activity.text}</p>
                <time>
                  {new Intl.DateTimeFormat("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(activity.createdAt))}
                </time>
              </div>
            </div>
          ))}
        </section>
        <footer>
          <button className="ops-button primary" onClick={convert}>
            <BriefcaseBusiness size={15} />
            Создать проект
          </button>
        </footer>
      </aside>
    </div>
  );
};

const LegacyCRM = ({
  state,
  setState,
}: {
  state: OperationsState;
  setState: React.Dispatch<React.SetStateAction<OperationsState>>;
}) => {
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState("");
  const selected = state.leads.find((lead) => lead.id === selectedId);
  const visible = state.leads.filter((lead) =>
    `${lead.company} ${lead.contact} ${lead.tags.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const updateLead = (next: Lead) =>
    setState((current) => ({
      ...current,
      leads: current.leads.map((lead) => (lead.id === next.id ? next : lead)),
    }));
  const convert = (lead: Lead) => {
    const project: StudioProject = {
      id: uid("project"),
      title: lead.company,
      client: lead.company,
      stage: "brief",
      status: "active",
      health: "good",
      progress: 0,
      owner: "Стас",
      deadline: "",
      budget: lead.value,
      description: lead.notes,
      phases: projectStages.map((phase, index) => ({
        ...phase,
        done: false,
        tasks: index
          ? []
          : [
              {
                id: uid("task"),
                title: "Провести стартовый созвон",
                done: false,
                assignee: "Стас",
                dueAt: lead.nextActionAt || today(),
                priority: "high",
              },
            ],
      })),
      deliverables: [],
      activity: [
        {
          id: uid("activity"),
          text: "Проект создан из CRM",
          createdAt: new Date().toISOString(),
          kind: "status",
        },
      ],
      createdAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      projects: [project, ...current.projects],
      leads: current.leads.map((item) =>
        item.id === lead.id ? { ...item, stage: "won" } : item,
      ),
    }));
    setSelectedId(undefined);
  };
  return (
    <>
      <Header
        view="Продажи"
        title="CRM"
        description="Следующий шаг важнее длинной истории. Каждый контакт должен двигаться или закрываться."
        action={
          <button
            className="ops-button primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={15} />
            Новый контакт
          </button>
        }
      />
      <div className="ops-toolbar">
        <label className="ops-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Компания, контакт или тег"
          />
        </label>
        <span>
          {visible.length} контактов ·{" "}
          {money(visible.reduce((sum, lead) => sum + lead.value, 0))}
        </span>
      </div>
      <section className="ops-pipeline">
        {leadStages.map((stage) => {
          const leads = visible.filter((lead) => lead.stage === stage.id);
          return (
            <div
              className={`ops-pipeline-column stage-${stage.id}`}
              key={stage.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const id = event.dataTransfer.getData("text/lead-id");
                setState((current) => ({
                  ...current,
                  leads: current.leads.map((lead) =>
                    lead.id === id ? { ...lead, stage: stage.id } : lead,
                  ),
                }));
              }}
            >
              <header>
                <span>{stage.title}</span>
                <b>{leads.length}</b>
              </header>
              <div className="ops-lead-stack">
                {leads.map((lead) => (
                  <button
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData("text/lead-id", lead.id)
                    }
                    className="ops-lead-card"
                    key={lead.id}
                    onClick={() => setSelectedId(lead.id)}
                  >
                    <div>
                      <strong>{lead.company}</strong>
                      <MoreHorizontal size={16} />
                    </div>
                    <p>{lead.nextAction || "Добавьте следующий шаг"}</p>
                    <span
                      className={
                        lead.nextActionAt &&
                        new Date(lead.nextActionAt) < new Date(today())
                          ? "overdue"
                          : ""
                      }
                    >
                      <Clock3 size={12} />
                      {lead.nextActionAt
                        ? relativeDate(lead.nextActionAt)
                        : "Без срока"}
                    </span>
                    <footer>
                      <b>{money(lead.value)}</b>
                      <small>{lead.channel}</small>
                    </footer>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>
      {creating && (
        <LeadForm
          onClose={() => setCreating(false)}
          onSave={(lead) => {
            setState((current) => ({
              ...current,
              leads: [lead, ...current.leads],
            }));
            setCreating(false);
          }}
        />
      )}
      {selected && (
        <LeadDrawer
          lead={selected}
          update={updateLead}
          convert={() => convert(selected)}
          close={() => setSelectedId(undefined)}
        />
      )}
    </>
  );
};

const CRM = ({
  state,
  setState,
}: {
  state: OperationsState;
  setState: React.Dispatch<React.SetStateAction<OperationsState>>;
}) => {
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [timing, setTiming] = useState<"all" | "overdue" | "today">("all");
  const [mode, setMode] = useState<"list" | "board">("list");
  const [selectedId, setSelectedId] = useState<string | undefined>(
    new URLSearchParams(location.search).get("lead") ||
      (window.matchMedia("(max-width: 800px)").matches
        ? undefined
        : state.leads[0]?.id),
  );
  const [note, setNote] = useState("");
  useEffect(() => {
    const sync = () =>
      setSelectedId(
        new URLSearchParams(location.search).get("lead") || undefined,
      );
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const updateLead = (next: Lead) =>
    setState((current) => ({
      ...current,
      leads: current.leads.map((lead) => (lead.id === next.id ? next : lead)),
    }));
  const matchesTiming = (lead: Lead) => {
    if (timing === "all") return true;
    if (!lead.nextActionAt) return false;
    if (timing === "today") return lead.nextActionAt === today();
    return lead.nextActionAt < today();
  };
  const visible = useMemo(
    () =>
      state.leads
        .filter((lead) => stageFilter === "all" || lead.stage === stageFilter)
        .filter(matchesTiming)
        .filter((lead) =>
          `${lead.company} ${lead.contact} ${lead.channel} ${lead.tags.join(" ")}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
        .sort((a, b) =>
          (a.nextActionAt || "9999").localeCompare(b.nextActionAt || "9999"),
        ),
    [state.leads, stageFilter, timing, query],
  );
  const selected = state.leads.find((lead) => lead.id === selectedId);

  useEffect(() => {
    if (selectedId && visible.some((lead) => lead.id === selectedId)) return;
    setSelectedId(
      window.matchMedia("(max-width: 800px)").matches
        ? undefined
        : visible[0]?.id,
    );
  }, [visible, selectedId]);

  const addNote = () => {
    if (!selected || !note.trim()) return;
    updateLead({
      ...selected,
      activities: [
        {
          id: uid("activity"),
          text: note.trim(),
          kind: "note",
          createdAt: new Date().toISOString(),
        },
        ...selected.activities,
      ],
    });
    setNote("");
  };
  const convert = (lead: Lead) => {
    const existing = state.projects.find(
      (project) => project.client.toLowerCase() === lead.company.toLowerCase(),
    );
    if (existing) {
      updateLead({
        ...lead,
        stage: "won",
        activities: [
          {
            id: uid("activity"),
            text: `Связан с существующим проектом «${existing.title}»`,
            kind: "status",
            createdAt: new Date().toISOString(),
          },
          ...lead.activities,
        ],
      });
      return;
    }
    const project: StudioProject = {
      id: uid("project"),
      title: lead.company,
      client: lead.company,
      stage: "brief",
      status: "active",
      health: "good",
      progress: 0,
      owner: "Стас",
      deadline: lead.nextActionAt || "",
      budget: lead.value,
      description: lead.notes,
      phases: projectStages.map((phase, index) => ({
        ...phase,
        done: false,
        tasks: index
          ? []
          : [
              {
                id: uid("task"),
                title: "Провести стартовый созвон",
                done: false,
                assignee: "Стас",
                dueAt: lead.nextActionAt || today(),
                priority: "high",
              },
            ],
      })),
      deliverables: [],
      activity: [
        {
          id: uid("activity"),
          text: "Проект создан из CRM",
          createdAt: new Date().toISOString(),
          kind: "status",
        },
      ],
      createdAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      projects: [project, ...current.projects],
      leads: current.leads.map((item) =>
        item.id === lead.id ? { ...item, stage: "won" } : item,
      ),
    }));
  };
  const removeLead = (lead: Lead) => {
    if (!confirm(`Удалить контакт «${lead.company}»?`)) return;
    setState((current) => ({
      ...current,
      leads: current.leads.filter((item) => item.id !== lead.id),
    }));
    setSelectedId(undefined);
  };

  return (
    <>
      <Header
        view="Продажи"
        title="CRM"
        description="Вся работа с контактами на одном экране: кому ответить, что обещали и какой следующий шаг."
        action={
          <button
            className="ops-button primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={15} /> Новый контакт
          </button>
        }
      />
      <div className="crm-controlbar">
        <label className="ops-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Компания, человек, канал или тег"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Очистить поиск">
              <X size={13} />
            </button>
          )}
        </label>
        <div className="crm-timing-filter">
          {(["all", "today", "overdue"] as const).map((value) => (
            <button
              className={timing === value ? "active" : ""}
              key={value}
              onClick={() => setTiming(value)}
            >
              {value === "all"
                ? "Все сроки"
                : value === "today"
                  ? "Сегодня"
                  : "Просрочено"}
            </button>
          ))}
        </div>
        <div className="ops-segment">
          <button
            className={mode === "list" ? "active" : ""}
            onClick={() => setMode("list")}
          >
            <ListChecks size={14} /> Список
          </button>
          <button
            className={mode === "board" ? "active" : ""}
            onClick={() => setMode("board")}
          >
            <FolderKanban size={14} /> Доска
          </button>
        </div>
      </div>
      <div className="crm-stage-strip">
        <button
          className={stageFilter === "all" ? "active" : ""}
          onClick={() => setStageFilter("all")}
        >
          <span>Весь пайплайн</span>
          <b>{state.leads.length}</b>
          <small>
            {money(state.leads.reduce((sum, lead) => sum + lead.value, 0))}
          </small>
        </button>
        {leadStages.map((stage) => {
          const items = state.leads.filter((lead) => lead.stage === stage.id);
          return (
            <button
              key={stage.id}
              className={stageFilter === stage.id ? "active" : ""}
              onClick={() => setStageFilter(stage.id)}
            >
              <span>{stage.title}</span>
              <b>{items.length}</b>
              <small>
                {money(items.reduce((sum, lead) => sum + lead.value, 0))}
              </small>
            </button>
          );
        })}
      </div>

      {mode === "list" ? (
        <div className={`crm-workbench ${selected ? "has-inspector" : ""}`}>
          <section className="crm-lead-list">
            <header>
              <span>Компания</span>
              <span>Этап</span>
              <span>Следующий шаг</span>
              <span>Срок</span>
              <span>Потенциал</span>
            </header>
            {visible.map((lead) => (
              <button
                className={lead.id === selectedId ? "active" : ""}
                key={lead.id}
                onClick={() => setSelectedId(lead.id)}
              >
                <span className="crm-company">
                  <b>{lead.company}</b>
                  <small>{lead.contact || lead.channel}</small>
                </span>
                <span>
                  <i className={`crm-stage-dot stage-${lead.stage}`} />
                  {leadStages.find((stage) => stage.id === lead.stage)?.title}
                </span>
                <span>{lead.nextAction || "Следующий шаг не задан"}</span>
                <time className={lead.nextActionAt < today() ? "overdue" : ""}>
                  {lead.nextActionAt
                    ? relativeDate(lead.nextActionAt)
                    : "Без срока"}
                </time>
                <strong>{money(lead.value)}</strong>
              </button>
            ))}
            {!visible.length && (
              <Empty
                title="Нет контактов"
                text="Сбросьте фильтры или добавьте новый контакт."
                action={
                  <button
                    className="ops-button primary"
                    onClick={() => setCreating(true)}
                  >
                    <Plus size={14} /> Добавить
                  </button>
                }
              />
            )}
          </section>
          {selected && (
            <aside className="crm-inspector">
              <header>
                <div>
                  <span className="ops-eyebrow">Карточка контакта</span>
                  <h2>{selected.company}</h2>
                  <p>{selected.contact || "Контакт не указан"}</p>
                </div>
                <IconButton
                  label="Закрыть карточку"
                  onClick={() => setSelectedId(undefined)}
                >
                  <X size={16} />
                </IconButton>
              </header>
              <div className="crm-inspector-scroll">
                <section className="crm-stage-picker">
                  <span>Этап сделки</span>
                  <div>
                    {leadStages.map((stage) => (
                      <button
                        title={stage.title}
                        className={selected.stage === stage.id ? "active" : ""}
                        key={stage.id}
                        onClick={() =>
                          updateLead({ ...selected, stage: stage.id })
                        }
                      >
                        {stage.title}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="crm-field-grid">
                  <label>
                    <span>Контакт</span>
                    <input
                      value={selected.contact}
                      onChange={(event) =>
                        updateLead({ ...selected, contact: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Канал</span>
                    <input
                      value={selected.channel}
                      onChange={(event) =>
                        updateLead({ ...selected, channel: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span>Потенциал, ₽</span>
                    <input
                      type="number"
                      value={selected.value}
                      onChange={(event) =>
                        updateLead({
                          ...selected,
                          value: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Следующий шаг</span>
                    <input
                      value={selected.nextAction}
                      onChange={(event) =>
                        updateLead({
                          ...selected,
                          nextAction: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Срок</span>
                    <input
                      type="date"
                      value={selected.nextActionAt}
                      onChange={(event) =>
                        updateLead({
                          ...selected,
                          nextActionAt: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="wide">
                    <span>Контекст</span>
                    <textarea
                      rows={3}
                      value={selected.notes}
                      onChange={(event) =>
                        updateLead({ ...selected, notes: event.target.value })
                      }
                    />
                  </label>
                </section>
                <section className="crm-history">
                  <header>
                    <span>История</span>
                    <b>{selected.activities.length}</b>
                  </header>
                  <div className="ops-note-input">
                    <input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && addNote()}
                      placeholder="Записать результат разговора"
                    />
                    <button onClick={addNote} aria-label="Добавить заметку">
                      <Send size={14} />
                    </button>
                  </div>
                  {selected.activities.map((activity) => (
                    <article key={activity.id}>
                      <i />
                      <div>
                        <p>{activity.text}</p>
                        <time>
                          {new Intl.DateTimeFormat("ru-RU", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(activity.createdAt))}
                        </time>
                      </div>
                    </article>
                  ))}
                </section>
              </div>
              <footer>
                <button
                  className="ops-button primary"
                  onClick={() => convert(selected)}
                >
                  <BriefcaseBusiness size={14} />
                  {selected.stage === "won"
                    ? "Проект связан"
                    : "Создать проект"}
                </button>
                <IconButton
                  label="Удалить контакт"
                  onClick={() => removeLead(selected)}
                >
                  <Trash2 size={15} />
                </IconButton>
              </footer>
            </aside>
          )}
        </div>
      ) : (
        <section className="crm-board-v2">
          {leadStages.map((stage) => (
            <div className={`stage-${stage.id}`} key={stage.id}>
              <header>
                <span>{stage.title}</span>
                <b>
                  {visible.filter((lead) => lead.stage === stage.id).length}
                </b>
              </header>
              {visible
                .filter((lead) => lead.stage === stage.id)
                .map((lead) => (
                  <article key={lead.id}>
                    <button
                      onClick={() => {
                        setMode("list");
                        setSelectedId(lead.id);
                      }}
                    >
                      <strong>{lead.company}</strong>
                      <p>{lead.nextAction || "Добавьте следующий шаг"}</p>
                    </button>
                    <footer>
                      <span>{money(lead.value)}</span>
                      <select
                        aria-label={`Этап ${lead.company}`}
                        value={lead.stage}
                        onChange={(event) =>
                          updateLead({
                            ...lead,
                            stage: event.target.value as LeadStage,
                          })
                        }
                      >
                        {leadStages.map((option) => (
                          <option value={option.id} key={option.id}>
                            {option.title}
                          </option>
                        ))}
                      </select>
                    </footer>
                  </article>
                ))}
            </div>
          ))}
        </section>
      )}
      {creating && (
        <LeadForm
          onClose={() => setCreating(false)}
          onSave={(lead) => {
            setState((current) => ({
              ...current,
              leads: [lead, ...current.leads],
            }));
            setCreating(false);
            setSelectedId(lead.id);
          }}
        />
      )}
    </>
  );
};

const ProjectForm = ({
  onSave,
  onClose,
}: {
  onSave: (project: StudioProject) => void;
  onClose: () => void;
}) => {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      id: uid("project"),
      title: String(form.get("title")),
      client: String(form.get("client")),
      stage: "brief",
      status: "active",
      health: "good",
      progress: 0,
      owner: String(form.get("owner")),
      deadline: String(form.get("deadline")),
      budget: Number(form.get("budget")) || 0,
      description: String(form.get("description")),
      phases: projectStages.map((phase) => ({
        ...phase,
        done: false,
        tasks: [],
      })),
      deliverables: [],
      activity: [],
      createdAt: new Date().toISOString(),
    });
  };
  return (
    <Modal title="Новый проект" eyebrow="Project OS" onClose={onClose}>
      <form className="ops-form" onSubmit={submit}>
        <label className="wide">
          <span>Название *</span>
          <input
            name="title"
            required
            autoFocus
            placeholder="Название проекта"
          />
        </label>
        <label>
          <span>Клиент</span>
          <input name="client" />
        </label>
        <label>
          <span>Владелец</span>
          <input name="owner" defaultValue="Стас" />
        </label>
        <label>
          <span>Дедлайн</span>
          <input name="deadline" type="date" />
        </label>
        <label>
          <span>Бюджет, ₽</span>
          <input name="budget" type="number" />
        </label>
        <label className="wide">
          <span>Задача проекта</span>
          <textarea name="description" rows={4} />
        </label>
        <footer>
          <button type="button" className="ops-button ghost" onClick={onClose}>
            Отмена
          </button>
          <button className="ops-button primary">
            <Plus size={15} />
            Создать проект
          </button>
        </footer>
      </form>
    </Modal>
  );
};

const ProjectWorkspace = ({
  project,
  update,
  close,
}: {
  project: StudioProject;
  update: (project: StudioProject) => void;
  close: () => void;
}) => {
  const [phaseId, setPhaseId] = useState(project.stage);
  const [taskTitle, setTaskTitle] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const phase =
    project.phases.find((item) => item.id === phaseId) || project.phases[0];
  const updateTask = (task: Task) =>
    update({
      ...project,
      phases: project.phases.map((item) =>
        item.id === phase.id
          ? {
              ...item,
              tasks: item.tasks.map((entry) =>
                entry.id === task.id ? task : entry,
              ),
            }
          : item,
      ),
    });
  const addTask = () => {
    if (!taskTitle.trim()) return;
    update({
      ...project,
      phases: project.phases.map((item) =>
        item.id === phase.id
          ? {
              ...item,
              tasks: [
                ...item.tasks,
                {
                  id: uid("task"),
                  title: taskTitle.trim(),
                  done: false,
                  assignee: project.owner,
                  dueAt: project.deadline || today(),
                  priority: "medium",
                },
              ],
            }
          : item,
      ),
    });
    setTaskTitle("");
  };
  const completePhase = () => {
    if (phase.done) {
      update({
        ...project,
        stage: phase.id,
        phases: project.phases.map((item) =>
          item.id === phase.id ? { ...item, done: false } : item,
        ),
        activity: [
          {
            id: uid("activity"),
            text: `Этап «${phase.title}» возвращён в работу`,
            kind: "status",
            createdAt: new Date().toISOString(),
          },
          ...project.activity,
        ],
      });
      return;
    }
    const unfinished = phase.tasks.filter((task) => !task.done);
    if (
      unfinished.length &&
      !confirm(
        `На этапе осталось задач: ${unfinished.length}. Всё равно завершить?`,
      )
    )
      return;
    const index = project.phases.findIndex((item) => item.id === phase.id);
    const next = project.phases[index + 1];
    update({
      ...project,
      stage: next?.id || phase.id,
      status: next ? project.status : "completed",
      phases: project.phases.map((item) =>
        item.id === phase.id ? { ...item, done: true } : item,
      ),
      activity: [
        {
          id: uid("activity"),
          text: next
            ? `Этап «${phase.title}» завершён · следующий: «${next.title}»`
            : `Проект завершён на этапе «${phase.title}»`,
          kind: "status",
          createdAt: new Date().toISOString(),
        },
        ...project.activity,
      ],
    });
    if (next) setPhaseId(next.id);
  };
  return (
    <div className="ops-workspace">
      <header className="ops-workspace-header">
        <button onClick={close}>
          <ArrowLeft size={16} />
          Все проекты
        </button>
        <div className="ops-workspace-actions">
          <a
            className="ops-button ghost"
            href={`/?review=${project.id}`}
            target="_blank"
          >
            <Eye size={15} />
            Клиентский вид
          </a>
          <IconButton
            label="Настройки проекта"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={17} />
          </IconButton>
        </div>
      </header>
      <section className="ops-project-hero">
        <div>
          <span className="ops-eyebrow">{project.client}</span>
          <h1>{project.title}</h1>
          <p>{project.description}</p>
        </div>
        <div className="ops-project-facts">
          <div>
            <span>Владелец</span>
            <strong>{project.owner}</strong>
          </div>
          <div>
            <span>Дедлайн</span>
            <strong>{shortDate(project.deadline)}</strong>
          </div>
          <div>
            <span>Бюджет</span>
            <strong>{money(project.budget)}</strong>
          </div>
          <div>
            <span>Готовность</span>
            <strong>{calculateProgress(project)}%</strong>
          </div>
        </div>
      </section>
      <nav className="ops-phase-rail" aria-label="Этапы проекта">
        {project.phases.map((item, index) => (
          <button
            className={`${item.id === phase.id ? "active" : ""} ${item.done ? "done" : ""}`}
            key={item.id}
            onClick={() => setPhaseId(item.id)}
          >
            <i>
              {item.done ? (
                <Check size={12} />
              ) : (
                String(index + 1).padStart(2, "0")
              )}
            </i>
            <span>{item.title}</span>
            <small>
              {item.tasks.filter((task) => task.done).length}/
              {item.tasks.length}
            </small>
          </button>
        ))}
      </nav>
      <div className="ops-project-columns">
        <section className="ops-panel ops-phase-work">
          <div className="ops-panel-heading">
            <div>
              <span className="ops-eyebrow">Текущий этап</span>
              <h2>{phase.title}</h2>
            </div>
            <button onClick={completePhase}>
              {phase.done ? "Вернуть в работу" : "Завершить этап"}{" "}
              <CheckCircle2 size={14} />
            </button>
          </div>
          <div className="ops-project-task-list">
            {phase.tasks.map((task) => (
              <div
                className={`ops-project-task ${task.done ? "done" : ""}`}
                key={task.id}
              >
                <button
                  onClick={() => updateTask({ ...task, done: !task.done })}
                >
                  {task.done ? <Check size={14} /> : null}
                </button>
                <input
                  value={task.title}
                  onChange={(event) =>
                    updateTask({ ...task, title: event.target.value })
                  }
                />
                <select
                  value={task.assignee}
                  onChange={(event) =>
                    updateTask({ ...task, assignee: event.target.value })
                  }
                >
                  <option>Стас</option>
                  <option>Рома</option>
                  <option>Команда</option>
                </select>
                <input
                  type="date"
                  value={task.dueAt}
                  onChange={(event) =>
                    updateTask({ ...task, dueAt: event.target.value })
                  }
                />
                <select
                  value={task.priority}
                  onChange={(event) =>
                    updateTask({
                      ...task,
                      priority: event.target.value as Task["priority"],
                    })
                  }
                >
                  <option value="low">Низкий</option>
                  <option value="medium">Средний</option>
                  <option value="high">Высокий</option>
                </select>
                <IconButton
                  label="Удалить"
                  onClick={() =>
                    update({
                      ...project,
                      phases: project.phases.map((item) =>
                        item.id === phase.id
                          ? {
                              ...item,
                              tasks: item.tasks.filter(
                                (entry) => entry.id !== task.id,
                              ),
                            }
                          : item,
                      ),
                    })
                  }
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            ))}
          </div>
          <div className="ops-add-task">
            <Plus size={15} />
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addTask()}
              placeholder="Добавить задачу на этот этап"
            />
            <button onClick={addTask}>Добавить</button>
          </div>
        </section>
        <aside className="ops-project-side">
          <section className="ops-panel">
            <div className="ops-panel-heading">
              <div>
                <span className="ops-eyebrow">Материалы</span>
                <h2>Результаты</h2>
              </div>
              <a href="/?view=reviews">
                <Plus size={14} />
              </a>
            </div>
            {project.deliverables.map((item) => (
              <a className="ops-deliverable" href={item.url} key={item.id}>
                <span>
                  <Link2 size={15} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    v{item.version} · {reviewLabels[item.status]}
                  </small>
                </div>
                <ArrowUpRight size={14} />
              </a>
            ))}
            {!project.deliverables.length && (
              <p className="ops-small-empty">
                Ссылки на макеты, документы и сборки появятся здесь.
              </p>
            )}
          </section>
          <section className="ops-panel">
            <div className="ops-panel-heading">
              <div>
                <span className="ops-eyebrow">Журнал</span>
                <h2>Последние события</h2>
              </div>
            </div>
            {project.activity.map((item) => (
              <div className="ops-mini-activity" key={item.id}>
                <i />
                <p>{item.text}</p>
              </div>
            ))}
            {!project.activity.length && (
              <p className="ops-small-empty">История проекта пока пуста.</p>
            )}
          </section>
        </aside>
      </div>
      {settingsOpen && (
        <Modal
          title="Настройки проекта"
          eyebrow="Project OS"
          onClose={() => setSettingsOpen(false)}
        >
          <form
            className="ops-form"
            onSubmit={(event) => {
              event.preventDefault();
              setSettingsOpen(false);
            }}
          >
            <label className="wide">
              <span>Название</span>
              <input
                value={project.title}
                onChange={(event) =>
                  update({ ...project, title: event.target.value })
                }
              />
            </label>
            <label>
              <span>Клиент</span>
              <input
                value={project.client}
                onChange={(event) =>
                  update({ ...project, client: event.target.value })
                }
              />
            </label>
            <label>
              <span>Владелец</span>
              <input
                value={project.owner}
                onChange={(event) =>
                  update({ ...project, owner: event.target.value })
                }
              />
            </label>
            <label>
              <span>Дедлайн</span>
              <input
                type="date"
                value={project.deadline}
                onChange={(event) =>
                  update({ ...project, deadline: event.target.value })
                }
              />
            </label>
            <label>
              <span>Бюджет, ₽</span>
              <input
                type="number"
                value={project.budget}
                onChange={(event) =>
                  update({ ...project, budget: Number(event.target.value) })
                }
              />
            </label>
            <label>
              <span>Состояние</span>
              <select
                value={project.health}
                onChange={(event) =>
                  update({
                    ...project,
                    health: event.target.value as StudioProject["health"],
                  })
                }
              >
                <option value="good">В порядке</option>
                <option value="attention">Нужно внимание</option>
                <option value="risk">Есть риск</option>
              </select>
            </label>
            <label>
              <span>Статус</span>
              <select
                value={project.status}
                onChange={(event) =>
                  update({
                    ...project,
                    status: event.target.value as StudioProject["status"],
                  })
                }
              >
                <option value="active">Активный</option>
                <option value="paused">На паузе</option>
                <option value="completed">Завершён</option>
              </select>
            </label>
            <label className="wide">
              <span>Задача проекта</span>
              <textarea
                rows={4}
                value={project.description}
                onChange={(event) =>
                  update({ ...project, description: event.target.value })
                }
              />
            </label>
            <footer>
              <button
                type="button"
                className="ops-button ghost"
                onClick={() => setSettingsOpen(false)}
              >
                Закрыть
              </button>
              <button className="ops-button primary">
                <Check size={14} /> Готово
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </div>
  );
};

const Projects = ({
  state,
  setState,
}: {
  state: OperationsState;
  setState: React.Dispatch<React.SetStateAction<OperationsState>>;
}) => {
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | undefined>(
    new URLSearchParams(location.search).get("project") || undefined,
  );
  const [mode, setMode] = useState<"cards" | "board">("cards");
  useEffect(() => {
    const sync = () =>
      setSelected(
        new URLSearchParams(location.search).get("project") || undefined,
      );
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const project = state.projects.find((item) => item.id === selected);
  const openProject = (id?: string) => {
    setSelected(id);
    history.pushState(
      null,
      "",
      id
        ? `/?view=projects&project=${encodeURIComponent(id)}`
        : "/?view=projects",
    );
  };
  const update = (next: StudioProject) =>
    setState((current) => ({
      ...current,
      projects: current.projects.map((item) =>
        item.id === next.id ? next : item,
      ),
    }));
  if (project)
    return (
      <ProjectWorkspace
        project={project}
        update={update}
        close={() => openProject(undefined)}
      />
    );
  return (
    <>
      <Header
        view="Производство"
        title="Проекты"
        description="Понятный маршрут от брифа до запуска, ответственные и результаты каждого этапа."
        action={
          <button
            className="ops-button primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={15} />
            Новый проект
          </button>
        }
      />
      <div className="ops-toolbar">
        <div className="ops-segment">
          <button
            className={mode === "cards" ? "active" : ""}
            onClick={() => setMode("cards")}
          >
            <LayoutDashboard size={14} />
            Обзор
          </button>
          <button
            className={mode === "board" ? "active" : ""}
            onClick={() => setMode("board")}
          >
            <FolderKanban size={14} />
            По этапам
          </button>
        </div>
        <span>
          {state.projects.filter((item) => item.status === "active").length}{" "}
          активных ·{" "}
          {state.projects.filter((item) => item.health !== "good").length}{" "}
          требуют внимания
        </span>
      </div>
      {mode === "cards" ? (
        <section className="ops-project-grid">
          {state.projects.map((item) => (
            <button
              className="ops-project-card"
              key={item.id}
              onClick={() => openProject(item.id)}
            >
              <header>
                <span className={`ops-health ${item.health}`} />
                <span>{item.client}</span>
                <ArrowUpRight size={16} />
              </header>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <div className="ops-project-meta">
                <span>
                  <UserRound size={13} />
                  {item.owner}
                </span>
                <span>
                  <CalendarDays size={13} />
                  {shortDate(item.deadline)}
                </span>
              </div>
              <div className="ops-card-progress">
                <div>
                  <i style={{ width: `${calculateProgress(item)}%` }} />
                </div>
                <b>{calculateProgress(item)}%</b>
              </div>
              <footer>
                <span>
                  {
                    projectStages.find((stage) => stage.id === item.stage)
                      ?.title
                  }
                </span>
                <strong>{money(item.budget)}</strong>
              </footer>
            </button>
          ))}
        </section>
      ) : (
        <section className="ops-project-board">
          {projectStages.map((stage) => (
            <div key={stage.id}>
              <header>
                <span>{stage.title}</span>
                <b>
                  {
                    state.projects.filter((item) => item.stage === stage.id)
                      .length
                  }
                </b>
              </header>
              {state.projects
                .filter((item) => item.stage === stage.id)
                .map((item) => (
                  <button key={item.id} onClick={() => openProject(item.id)}>
                    <strong>{item.title}</strong>
                    <small>
                      {item.owner} · {shortDate(item.deadline)}
                    </small>
                    <div>
                      <i style={{ width: `${calculateProgress(item)}%` }} />
                    </div>
                  </button>
                ))}
            </div>
          ))}
        </section>
      )}
      {creating && (
        <ProjectForm
          onClose={() => setCreating(false)}
          onSave={(item) => {
            setState((current) => ({
              ...current,
              projects: [item, ...current.projects],
            }));
            setCreating(false);
            openProject(item.id);
          }}
        />
      )}
    </>
  );
};

const ReviewForm = ({
  projects,
  onSave,
  onClose,
}: {
  projects: StudioProject[];
  onSave: (item: ReviewItem) => void;
  onClose: () => void;
}) => {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      id: uid("review"),
      projectId: String(form.get("projectId")),
      title: String(form.get("title")),
      description: String(form.get("description")),
      url: String(form.get("url")),
      preview: String(form.get("preview")),
      version: 1,
      status: "draft",
      comments: [],
      updatedAt: new Date().toISOString(),
    });
  };
  return (
    <Modal title="Добавить материал" eyebrow="Согласование" onClose={onClose}>
      <form className="ops-form" onSubmit={submit}>
        <label className="wide">
          <span>Название *</span>
          <input name="title" required autoFocus />
        </label>
        <label>
          <span>Проект</span>
          <select name="projectId">
            {projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Ссылка на работу</span>
          <input name="url" placeholder="https://..." />
        </label>
        <label className="wide">
          <span>Превью</span>
          <input
            name="preview"
            placeholder="URL изображения или локальный путь"
          />
        </label>
        <label className="wide">
          <span>Что проверяем</span>
          <textarea name="description" rows={3} />
        </label>
        <footer>
          <button type="button" className="ops-button ghost" onClick={onClose}>
            Отмена
          </button>
          <button className="ops-button primary">
            <Plus size={15} />
            Добавить
          </button>
        </footer>
      </form>
    </Modal>
  );
};

const ReviewWorkspace = ({
  item,
  project,
  update,
  close,
}: {
  item: ReviewItem;
  project?: StudioProject;
  update: (item: ReviewItem) => void;
  close: () => void;
}) => {
  const [comment, setComment] = useState("");
  const [pin, setPin] = useState<{ x: number; y: number }>();
  const previewRef = useRef<HTMLDivElement>(null);
  const addComment = () => {
    if (!comment.trim()) return;
    update({
      ...item,
      comments: [
        ...item.comments,
        {
          id: uid("comment"),
          author: "Стас",
          text: comment.trim(),
          createdAt: new Date().toISOString(),
          resolved: false,
          x: pin?.x,
          y: pin?.y,
        },
      ],
      updatedAt: new Date().toISOString(),
    });
    setComment("");
    setPin(undefined);
  };
  return (
    <div className="ops-review-workspace">
      <header>
        <button onClick={close}>
          <ArrowLeft size={16} />
          Все материалы
        </button>
        <div>
          <select
            value={item.status}
            onChange={(event) =>
              update({ ...item, status: event.target.value as ReviewStatus })
            }
          >
            {Object.entries(reviewLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <a className="ops-button ghost" href={item.url} target="_blank">
            <ExternalLink size={15} />
            Открыть оригинал
          </a>
        </div>
      </header>
      <div className="ops-review-layout">
        <main>
          <div className="ops-review-title">
            <div>
              <span className="ops-eyebrow">
                {project?.title || "Проект"} · Версия {item.version}
              </span>
              <h1>{item.title}</h1>
              <p>{item.description}</p>
            </div>
            <span className={`ops-review-status ${item.status}`}>
              {reviewLabels[item.status]}
            </span>
          </div>
          <div
            className="ops-review-canvas"
            ref={previewRef}
            onClick={(event) => {
              const rect = previewRef.current?.getBoundingClientRect();
              if (rect)
                setPin({
                  x: Math.round(
                    ((event.clientX - rect.left) / rect.width) * 100,
                  ),
                  y: Math.round(
                    ((event.clientY - rect.top) / rect.height) * 100,
                  ),
                });
            }}
          >
            {item.preview ? (
              <img src={item.preview} alt={item.title} />
            ) : (
              <div className="ops-review-placeholder">
                <Upload size={30} />
                <strong>Добавьте ссылку на превью</strong>
              </div>
            )}
            {item.comments
              .filter((entry) => entry.x !== undefined && entry.y !== undefined)
              .map((entry, index) => (
                <button
                  title={entry.text}
                  className={`ops-review-pin ${entry.resolved ? "resolved" : ""}`}
                  style={{ left: `${entry.x}%`, top: `${entry.y}%` }}
                  key={entry.id}
                >
                  {index + 1}
                </button>
              ))}
            {pin && (
              <i
                className="ops-review-new-pin"
                style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              >
                <Plus size={13} />
              </i>
            )}
          </div>
          <p className="ops-canvas-help">
            <CircleDot size={13} />
            Нажмите на макет, чтобы привязать комментарий к точке.
          </p>
        </main>
        <aside>
          <header>
            <div>
              <span className="ops-eyebrow">Обсуждение</span>
              <h2>
                {item.comments.filter((entry) => !entry.resolved).length}{" "}
                открытых
              </h2>
            </div>
            <MessageSquare size={18} />
          </header>
          <div className="ops-comment-list">
            {item.comments.map((entry, index) => (
              <article
                className={entry.resolved ? "resolved" : ""}
                key={entry.id}
              >
                <header>
                  <b>{entry.x !== undefined ? index + 1 : "—"}</b>
                  <div>
                    <strong>{entry.author}</strong>
                    <time>
                      {new Intl.DateTimeFormat("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(entry.createdAt))}
                    </time>
                  </div>
                  <button
                    onClick={() =>
                      update({
                        ...item,
                        comments: item.comments.map((comment) =>
                          comment.id === entry.id
                            ? { ...comment, resolved: !comment.resolved }
                            : comment,
                        ),
                      })
                    }
                  >
                    {entry.resolved ? "Вернуть" : "Решено"}
                  </button>
                </header>
                <p>{entry.text}</p>
              </article>
            ))}
            {!item.comments.length && (
              <Empty
                title="Комментариев нет"
                text="Нажмите на превью или напишите общий комментарий."
              />
            )}
          </div>
          <div className="ops-comment-compose">
            {pin && (
              <span>
                Точка {pin.x}% × {pin.y}%{" "}
                <button onClick={() => setPin(undefined)}>
                  <X size={12} />
                </button>
              </span>
            )}
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Что нужно изменить?"
            />
            <button className="ops-button primary" onClick={addComment}>
              <Send size={14} />
              Отправить
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

const LegacyReviews = ({
  state,
  setState,
}: {
  state: OperationsState;
  setState: React.Dispatch<React.SetStateAction<OperationsState>>;
}) => {
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string>();
  const item = state.reviews.find((entry) => entry.id === selected);
  const update = (next: ReviewItem) =>
    setState((current) => ({
      ...current,
      reviews: current.reviews.map((entry) =>
        entry.id === next.id ? next : entry,
      ),
    }));
  if (item)
    return (
      <ReviewWorkspace
        item={item}
        project={state.projects.find(
          (project) => project.id === item.projectId,
        )}
        update={update}
        close={() => setSelected(undefined)}
      />
    );
  return (
    <>
      <Header
        view="Клиентский портал"
        title="Согласования"
        description="Версии, комментарии прямо на макете и однозначный статус каждого результата."
        action={
          <button
            className="ops-button primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={15} />
            Добавить материал
          </button>
        }
      />
      <section className="ops-review-summary">
        <div>
          <span>На проверке</span>
          <strong>
            {
              state.reviews.filter((review) => review.status === "review")
                .length
            }
          </strong>
        </div>
        <div>
          <span>Нужны правки</span>
          <strong>
            {
              state.reviews.filter((review) => review.status === "changes")
                .length
            }
          </strong>
        </div>
        <div>
          <span>Согласовано</span>
          <strong>
            {
              state.reviews.filter((review) => review.status === "approved")
                .length
            }
          </strong>
        </div>
        <div>
          <span>Комментарии</span>
          <strong>
            {state.reviews.reduce(
              (sum, review) =>
                sum +
                review.comments.filter((comment) => !comment.resolved).length,
              0,
            )}
          </strong>
        </div>
      </section>
      <section className="ops-review-grid">
        {state.reviews.map((review) => (
          <button
            className="ops-review-card"
            key={review.id}
            onClick={() => setSelected(review.id)}
          >
            <div className="ops-review-thumb">
              {review.preview ? (
                <img src={review.preview} alt="" />
              ) : (
                <Eye size={25} />
              )}
              <span className={`ops-review-status ${review.status}`}>
                {reviewLabels[review.status]}
              </span>
            </div>
            <div>
              <span>
                {state.projects.find(
                  (project) => project.id === review.projectId,
                )?.title || "Проект"}{" "}
                · v{review.version}
              </span>
              <h2>{review.title}</h2>
              <p>{review.description}</p>
              <footer>
                <span>
                  <MessageSquare size={13} />
                  {
                    review.comments.filter((comment) => !comment.resolved)
                      .length
                  }{" "}
                  открытых
                </span>
                <ArrowUpRight size={15} />
              </footer>
            </div>
          </button>
        ))}
      </section>
      {creating && (
        <ReviewForm
          projects={state.projects}
          onClose={() => setCreating(false)}
          onSave={(review) => {
            setState((current) => ({
              ...current,
              reviews: [review, ...current.reviews],
            }));
            setCreating(false);
            setSelected(review.id);
          }}
        />
      )}
    </>
  );
};

const Reviews = ({
  state,
  setState,
}: {
  state: OperationsState;
  setState: React.Dispatch<React.SetStateAction<OperationsState>>;
}) => {
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    new URLSearchParams(location.search).get("item") || state.reviews[0]?.id,
  );
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [comment, setComment] = useState("");
  const [pin, setPin] = useState<{ x: number; y: number }>();
  const [zoom, setZoom] = useState(1);
  const [versioning, setVersioning] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const sync = () =>
      setSelectedId(
        new URLSearchParams(location.search).get("item") || undefined,
      );
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const stageRef = useRef<HTMLDivElement>(null);

  const visible = state.reviews.filter(
    (item) =>
      (projectFilter === "all" || item.projectId === projectFilter) &&
      (statusFilter === "all" || item.status === statusFilter),
  );
  const item = state.reviews.find((entry) => entry.id === selectedId);
  const project = state.projects.find((entry) => entry.id === item?.projectId);
  const selectItem = (id?: string) => {
    setSelectedId(id);
    history.pushState(
      null,
      "",
      id ? `/?view=reviews&item=${encodeURIComponent(id)}` : "/?view=reviews",
    );
  };
  const update = (next: ReviewItem) =>
    setState((current) => ({
      ...current,
      reviews: current.reviews.map((entry) =>
        entry.id === next.id ? next : entry,
      ),
    }));

  useEffect(() => {
    if (selectedId && visible.some((entry) => entry.id === selectedId)) return;
    setSelectedId(visible[0]?.id);
  }, [visible, selectedId]);
  useEffect(() => {
    setPin(undefined);
    setZoom(1);
  }, [selectedId]);

  const addComment = () => {
    if (!item || !comment.trim()) return;
    update({
      ...item,
      status: item.status === "approved" ? "changes" : item.status,
      comments: [
        ...item.comments,
        {
          id: uid("comment"),
          author: "Стас",
          text: comment.trim(),
          createdAt: new Date().toISOString(),
          resolved: false,
          x: pin?.x,
          y: pin?.y,
        },
      ],
      updatedAt: new Date().toISOString(),
    });
    setComment("");
    setPin(undefined);
  };
  const copyClientLink = async () => {
    if (!project) return;
    const link = `${location.origin}/?review=${encodeURIComponent(project.id)}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };
  const removeItem = () => {
    if (!item || !confirm(`Удалить материал «${item.title}»?`)) return;
    setState((current) => ({
      ...current,
      reviews: current.reviews.filter((entry) => entry.id !== item.id),
    }));
    selectItem(undefined);
  };

  return (
    <div className="review-desk">
      <header className="review-desk-header">
        <div>
          <span className="ops-eyebrow">Согласования</span>
          <h1>Ревью материалов</h1>
          <p>Один экран для версии, точечных правок и решения клиента.</p>
        </div>
        <div className="review-desk-metrics">
          <span>
            <b>
              {
                state.reviews.filter((entry) => entry.status === "review")
                  .length
              }
            </b>
            На проверке
          </span>
          <span>
            <b>
              {
                state.reviews.filter((entry) => entry.status === "changes")
                  .length
              }
            </b>
            С правками
          </span>
          <span>
            <b>
              {state.reviews.reduce(
                (sum, entry) =>
                  sum +
                  entry.comments.filter((value) => !value.resolved).length,
                0,
              )}
            </b>
            Открытых
          </span>
        </div>
        <button
          className="ops-button primary"
          onClick={() => setCreating(true)}
        >
          <Plus size={15} /> Материал
        </button>
      </header>
      <div className="review-desk-layout">
        <aside className="review-queue">
          <div className="review-queue-filters">
            <select
              aria-label="Проект"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option value="all">Все проекты</option>
              {state.projects.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.title}
                </option>
              ))}
            </select>
            <select
              aria-label="Статус"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as ReviewStatus | "all")
              }
            >
              <option value="all">Все статусы</option>
              {Object.entries(reviewLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="review-queue-list">
            {visible.map((entry) => {
              const open = entry.comments.filter(
                (value) => !value.resolved,
              ).length;
              return (
                <button
                  className={entry.id === selectedId ? "active" : ""}
                  onClick={() => selectItem(entry.id)}
                  key={entry.id}
                >
                  <span className="review-queue-thumb">
                    {entry.preview ? (
                      <img src={entry.preview} alt="" />
                    ) : (
                      <Eye size={18} />
                    )}
                  </span>
                  <span>
                    <strong>{entry.title}</strong>
                    <small>
                      v{entry.version} · {reviewLabels[entry.status]}
                    </small>
                  </span>
                  {open > 0 && <b>{open}</b>}
                </button>
              );
            })}
            {!visible.length && (
              <Empty
                title="Материалов нет"
                text="Измените фильтры или добавьте материал."
              />
            )}
          </div>
        </aside>

        {item ? (
          <main className="review-stage">
            <header className="review-stage-toolbar">
              <div>
                <strong>{item.title}</strong>
                <span>
                  {project?.title || "Без проекта"} · версия {item.version}
                </span>
              </div>
              <div className="review-toolbar-actions">
                <select
                  aria-label="Статус материала"
                  value={item.status}
                  onChange={(event) =>
                    update({
                      ...item,
                      status: event.target.value as ReviewStatus,
                    })
                  }
                >
                  {Object.entries(reviewLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <div className="review-zoom">
                  <button
                    onClick={() =>
                      setZoom((value) => Math.max(0.5, value - 0.1))
                    }
                  >
                    −
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button
                    onClick={() => setZoom((value) => Math.min(2, value + 0.1))}
                  >
                    +
                  </button>
                  <button onClick={() => setZoom(1)}>Вписать</button>
                </div>
                <IconButton
                  label={
                    copied
                      ? "Ссылка скопирована"
                      : "Скопировать клиентскую ссылку"
                  }
                  onClick={copyClientLink}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </IconButton>
                <a
                  className="ops-icon-button"
                  href={item.url}
                  target="_blank"
                  title="Открыть оригинал"
                >
                  <ExternalLink size={15} />
                </a>
                <IconButton label="Удалить материал" onClick={removeItem}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </header>
            <div className="review-stage-viewport">
              <div
                className="review-artboard"
                ref={stageRef}
                style={{ transform: `scale(${zoom})` }}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest(".ops-review-pin"))
                    return;
                  const rect = stageRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setPin({
                    x: Math.round(
                      ((event.clientX - rect.left) / rect.width) * 100,
                    ),
                    y: Math.round(
                      ((event.clientY - rect.top) / rect.height) * 100,
                    ),
                  });
                }}
              >
                {item.preview ? (
                  <img src={item.preview} alt={item.title} />
                ) : (
                  <div className="ops-review-placeholder">
                    <Upload size={28} />
                    <strong>Нет превью</strong>
                  </div>
                )}
                {item.comments
                  .filter(
                    (entry) => entry.x !== undefined && entry.y !== undefined,
                  )
                  .map((entry, index) => (
                    <button
                      className={`ops-review-pin ${entry.resolved ? "resolved" : ""}`}
                      title={entry.text}
                      style={{ left: `${entry.x}%`, top: `${entry.y}%` }}
                      key={entry.id}
                    >
                      {index + 1}
                    </button>
                  ))}
                {pin && (
                  <i
                    className="ops-review-new-pin"
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  >
                    <Plus size={12} />
                  </i>
                )}
              </div>
            </div>
            <footer className="review-stage-footer">
              <span>
                <CircleDot size={12} /> Нажмите на превью, чтобы поставить точку
              </span>
              <div>
                <button onClick={() => setVersioning(true)}>
                  <Plus size={13} /> Новая версия
                </button>
                <time>
                  Обновлено{" "}
                  {new Intl.DateTimeFormat("ru-RU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(item.updatedAt))}
                </time>
              </div>
            </footer>
          </main>
        ) : (
          <main className="review-stage review-stage-empty">
            <Empty
              title="Выберите материал"
              text="Слева находятся все материалы текущей выборки."
            />
          </main>
        )}

        <aside className="review-comments-panel">
          <header>
            <div>
              <span className="ops-eyebrow">Комментарии</span>
              <h2>
                {item?.comments.filter((entry) => !entry.resolved).length || 0}{" "}
                открытых
              </h2>
            </div>
            <MessageSquare size={17} />
          </header>
          <div className="review-comments-list">
            {item?.comments.map((entry, index) => (
              <article
                className={entry.resolved ? "resolved" : ""}
                key={entry.id}
              >
                <header>
                  <b>{entry.x === undefined ? "—" : index + 1}</b>
                  <span>
                    <strong>{entry.author}</strong>
                    <time>
                      {new Intl.DateTimeFormat("ru-RU", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(entry.createdAt))}
                    </time>
                  </span>
                  <button
                    onClick={() =>
                      update({
                        ...item,
                        comments: item.comments.map((value) =>
                          value.id === entry.id
                            ? { ...value, resolved: !value.resolved }
                            : value,
                        ),
                      })
                    }
                  >
                    {entry.resolved ? "Вернуть" : "Решено"}
                  </button>
                </header>
                <p>{entry.text}</p>
              </article>
            ))}
            {item && !item.comments.length && (
              <Empty
                title="Комментариев нет"
                text="Нажмите на превью или оставьте общий комментарий."
              />
            )}
          </div>
          <div className="review-compose-v2">
            {pin && (
              <span>
                Точка {pin.x}% × {pin.y}%{" "}
                <button onClick={() => setPin(undefined)}>
                  <X size={11} />
                </button>
              </span>
            )}
            <textarea
              disabled={!item}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter")
                  addComment();
              }}
              placeholder="Что нужно изменить?"
            />
            <button
              className="ops-button primary"
              disabled={!item || !comment.trim()}
              onClick={addComment}
            >
              <Send size={14} /> Отправить <kbd>Ctrl ↵</kbd>
            </button>
          </div>
        </aside>
      </div>
      {versioning && item && (
        <Modal
          title={`Новая версия · v${item.version + 1}`}
          eyebrow="Согласование"
          onClose={() => setVersioning(false)}
        >
          <form
            className="ops-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              update({
                ...item,
                version: item.version + 1,
                status: "draft",
                preview: String(form.get("preview")),
                url: String(form.get("url")),
                description: String(form.get("description")),
                updatedAt: new Date().toISOString(),
              });
              setVersioning(false);
            }}
          >
            <label className="wide">
              <span>Превью новой версии</span>
              <input
                name="preview"
                defaultValue={item.preview}
                placeholder="URL изображения"
              />
            </label>
            <label className="wide">
              <span>Ссылка на оригинал</span>
              <input
                name="url"
                defaultValue={item.url}
                placeholder="https://..."
              />
            </label>
            <label className="wide">
              <span>Что изменилось</span>
              <textarea
                name="description"
                rows={4}
                defaultValue={item.description}
              />
            </label>
            <footer>
              <button
                type="button"
                className="ops-button ghost"
                onClick={() => setVersioning(false)}
              >
                Отмена
              </button>
              <button className="ops-button primary">
                <Plus size={14} />
                Создать v{item.version + 1}
              </button>
            </footer>
          </form>
        </Modal>
      )}
      {creating && (
        <ReviewForm
          projects={state.projects}
          onClose={() => setCreating(false)}
          onSave={(review) => {
            setState((current) => ({
              ...current,
              reviews: [review, ...current.reviews],
            }));
            setCreating(false);
            selectItem(review.id);
          }}
        />
      )}
    </div>
  );
};

const LibraryForm = ({
  onSave,
  onClose,
}: {
  onSave: (item: LibraryItem) => void;
  onClose: () => void;
}) => {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({
      id: uid("library"),
      title: String(form.get("title")),
      description: String(form.get("description")),
      url: String(form.get("url")),
      preview: String(form.get("preview")),
      category: String(form.get("category")) as LibraryItem["category"],
      technology: String(form.get("technology"))
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      tags: String(form.get("tags"))
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      code: String(form.get("code")),
      license: String(form.get("license")),
      favorite: false,
      projects: [],
      createdAt: new Date().toISOString(),
    });
  };
  return (
    <Modal title="Сохранить решение" eyebrow="Библиотека" onClose={onClose}>
      <form className="ops-form" onSubmit={submit}>
        <label className="wide">
          <span>Название *</span>
          <input name="title" required autoFocus />
        </label>
        <label>
          <span>Тип</span>
          <select name="category">
            <option value="site">Сайт</option>
            <option value="section">Секция</option>
            <option value="animation">Анимация</option>
            <option value="component">Компонент</option>
            <option value="identity">Айдентика</option>
            <option value="form">Форма</option>
            <option value="3d">3D</option>
          </select>
        </label>
        <label>
          <span>Источник</span>
          <input name="url" placeholder="https://..." />
        </label>
        <label className="wide">
          <span>Превью</span>
          <input name="preview" placeholder="URL изображения" />
        </label>
        <label className="wide">
          <span>Почему сохранили</span>
          <textarea name="description" rows={3} />
        </label>
        <label>
          <span>Технологии</span>
          <input name="technology" placeholder="React, GSAP" />
        </label>
        <label>
          <span>Теги</span>
          <input name="tags" placeholder="hero, b2b, light" />
        </label>
        <label className="wide">
          <span>Код или заметка</span>
          <textarea name="code" rows={5} />
        </label>
        <label className="wide">
          <span>Лицензия</span>
          <input
            name="license"
            placeholder="Источник / условия использования"
          />
        </label>
        <footer>
          <button type="button" className="ops-button ghost" onClick={onClose}>
            Отмена
          </button>
          <button className="ops-button primary">
            <BookMarked size={15} />
            Сохранить
          </button>
        </footer>
      </form>
    </Modal>
  );
};

const LibraryView = ({
  state,
  setState,
}: {
  state: OperationsState;
  setState: React.Dispatch<React.SetStateAction<OperationsState>>;
}) => {
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<string | undefined>(
    new URLSearchParams(location.search).get("library") || undefined,
  );
  useEffect(() => {
    const sync = () =>
      setSelected(
        new URLSearchParams(location.search).get("library") || undefined,
      );
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const item = state.library.find((entry) => entry.id === selected);
  const categories: Array<{ id: string; label: string }> = [
    { id: "all", label: "Все" },
    { id: "favorite", label: "Избранное" },
    { id: "site", label: "Сайты" },
    { id: "section", label: "Секции" },
    { id: "animation", label: "Анимации" },
    { id: "component", label: "Компоненты" },
    { id: "identity", label: "Айдентика" },
    { id: "form", label: "Формы" },
    { id: "3d", label: "3D" },
  ];
  const visible = state.library.filter(
    (entry) =>
      (category === "all" ||
        (category === "favorite"
          ? entry.favorite
          : entry.category === category)) &&
      `${entry.title} ${entry.description} ${entry.tags.join(" ")} ${entry.technology.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const update = (next: LibraryItem) =>
    setState((current) => ({
      ...current,
      library: current.library.map((entry) =>
        entry.id === next.id ? next : entry,
      ),
    }));
  return (
    <>
      <Header
        view="Рабочая память"
        title="Библиотека"
        description="Не коллекция случайных ссылок, а переиспользуемые решения с контекстом, кодом и источником."
        action={
          <button
            className="ops-button primary"
            onClick={() => setCreating(true)}
          >
            <Plus size={15} />
            Сохранить решение
          </button>
        }
      />
      <div className="ops-library-toolbar">
        <label className="ops-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по идее, технологии или тегу"
          />
        </label>
        <div className="ops-chip-row">
          {categories.map((entry) => (
            <button
              className={category === entry.id ? "active" : ""}
              key={entry.id}
              onClick={() => setCategory(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
      <section className="ops-library-grid">
        {visible.map((entry) => (
          <article className="ops-library-card" key={entry.id}>
            <button
              className="ops-library-preview"
              onClick={() => setSelected(entry.id)}
            >
              {entry.preview ? (
                <img src={entry.preview} alt="" />
              ) : (
                <Code2 size={30} />
              )}
              <span>
                {categories.find((item) => item.id === entry.category)?.label}
              </span>
            </button>
            <div className="ops-library-card-body">
              <header>
                <button onClick={() => setSelected(entry.id)}>
                  <h2>{entry.title}</h2>
                </button>
                <IconButton
                  label={
                    entry.favorite ? "Убрать из избранного" : "В избранное"
                  }
                  onClick={() =>
                    update({ ...entry, favorite: !entry.favorite })
                  }
                >
                  <Heart
                    size={16}
                    fill={entry.favorite ? "currentColor" : "none"}
                  />
                </IconButton>
              </header>
              <p>{entry.description}</p>
              <div className="ops-tags">
                {entry.tags.slice(0, 3).map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <footer>
                <span>{entry.technology.join(" · ") || "Без технологии"}</span>
                <button onClick={() => setSelected(entry.id)}>
                  Подробнее <ArrowRight size={13} />
                </button>
              </footer>
            </div>
          </article>
        ))}
      </section>
      {!visible.length && (
        <Empty
          title="Ничего не найдено"
          text="Измените запрос или сохраните новое решение."
        />
      )}
      {creating && (
        <LibraryForm
          onClose={() => setCreating(false)}
          onSave={(entry) => {
            setState((current) => ({
              ...current,
              library: [entry, ...current.library],
            }));
            setCreating(false);
            setSelected(entry.id);
          }}
        />
      )}
      {item && (
        <Modal
          title={item.title}
          eyebrow={
            categories.find((entry) => entry.id === item.category)?.label ||
            "Библиотека"
          }
          onClose={() => setSelected(undefined)}
        >
          <div className="ops-library-detail">
            {item.preview && <img src={item.preview} alt="" />}
            <div className="library-edit-fields">
              <label>
                <span>Почему сохранили</span>
                <textarea
                  rows={3}
                  value={item.description}
                  onChange={(event) =>
                    update({ ...item, description: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Источник</span>
                <input
                  value={item.url}
                  onChange={(event) =>
                    update({ ...item, url: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Теги через запятую</span>
                <input
                  value={item.tags.join(", ")}
                  onChange={(event) =>
                    update({
                      ...item,
                      tags: event.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            </div>
            <div className="ops-detail-grid">
              <div>
                <span>Технологии</span>
                <strong>{item.technology.join(", ") || "Не указаны"}</strong>
              </div>
              <div>
                <span>Лицензия</span>
                <strong>{item.license || "Не указана"}</strong>
              </div>
            </div>
            <div className="library-project-links">
              <span>Используется в проектах</span>
              <div>
                {state.projects.map((project) => {
                  const linked = item.projects.includes(project.id);
                  return (
                    <button
                      className={linked ? "active" : ""}
                      key={project.id}
                      onClick={() =>
                        update({
                          ...item,
                          projects: linked
                            ? item.projects.filter((id) => id !== project.id)
                            : [...item.projects, project.id],
                        })
                      }
                    >
                      {linked ? <Check size={12} /> : <Plus size={12} />}
                      {project.title}
                    </button>
                  );
                })}
              </div>
            </div>
            {item.code && (
              <div className="ops-code">
                <header>
                  <span>Код / заметка</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(item.code)}
                  >
                    <Copy size={13} />
                    Копировать
                  </button>
                </header>
                <pre>{item.code}</pre>
              </div>
            )}
            <footer>
              <IconButton
                label="Удалить из библиотеки"
                onClick={() => {
                  if (!confirm(`Удалить «${item.title}» из библиотеки?`))
                    return;
                  setState((current) => ({
                    ...current,
                    library: current.library.filter(
                      (entry) => entry.id !== item.id,
                    ),
                  }));
                  setSelected(undefined);
                }}
              >
                <Trash2 size={15} />
              </IconButton>
              <a className="ops-button ghost" href={item.url} target="_blank">
                <ExternalLink size={15} />
                Открыть источник
              </a>
              <button
                className="ops-button primary"
                onClick={() => update({ ...item, favorite: !item.favorite })}
              >
                <Heart
                  size={15}
                  fill={item.favorite ? "currentColor" : "none"}
                />
                {item.favorite ? "В избранном" : "В избранное"}
              </button>
            </footer>
          </div>
        </Modal>
      )}
    </>
  );
};

const LegacyClientPortal = ({
  project,
  reviews,
  setState,
}: {
  project: StudioProject;
  reviews: ReviewItem[];
  setState: React.Dispatch<React.SetStateAction<OperationsState>>;
}) => {
  const [selectedId, setSelectedId] = useState(reviews[0]?.id);
  const [author, setAuthor] = useState("Клиент");
  const [text, setText] = useState("");
  const selected = reviews.find((item) => item.id === selectedId);
  const update = (next: ReviewItem) =>
    setState((current) => ({
      ...current,
      reviews: current.reviews.map((item) =>
        item.id === next.id ? next : item,
      ),
    }));
  const send = () => {
    if (!selected || !text.trim()) return;
    update({
      ...selected,
      status: selected.status === "approved" ? "changes" : selected.status,
      comments: [
        ...selected.comments,
        {
          id: uid("comment"),
          author: author.trim() || "Клиент",
          text: text.trim(),
          createdAt: new Date().toISOString(),
          resolved: false,
        },
      ],
      updatedAt: new Date().toISOString(),
    });
    setText("");
  };
  return (
    <div className="client-portal">
      <header>
        <a href="/">
          <img src="/assets/brand/autocubes.svg" alt="" />
          <span>autocubes</span>
        </a>
        <div>
          <span>Пространство согласования</span>
          <b>{project.client}</b>
        </div>
      </header>
      <main>
        <section className="client-portal-heading">
          <span>Проект / {project.title}</span>
          <h1>
            Материалы
            <br />
            на согласование
          </h1>
          <p>
            Посмотрите актуальные версии, оставьте комментарий или согласуйте
            результат. Все решения сохраняются в истории проекта.
          </p>
        </section>
        <nav>
          {reviews.map((item, index) => (
            <button
              className={item.id === selectedId ? "active" : ""}
              onClick={() => setSelectedId(item.id)}
              key={item.id}
            >
              <i>{String(index + 1).padStart(2, "0")}</i>
              <span>
                {item.title}
                <small>Версия {item.version}</small>
              </span>
              <b className={`ops-review-status ${item.status}`}>
                {reviewLabels[item.status]}
              </b>
            </button>
          ))}
        </nav>
        {selected ? (
          <section className="client-review">
            <div className="client-review-preview">
              {selected.preview ? (
                <img src={selected.preview} alt={selected.title} />
              ) : (
                <Eye size={32} />
              )}
            </div>
            <aside>
              <span className="ops-eyebrow">Версия {selected.version}</span>
              <h2>{selected.title}</h2>
              <p>{selected.description}</p>
              <div className="client-review-actions">
                <button
                  className="ops-button primary"
                  onClick={() =>
                    update({
                      ...selected,
                      status: "approved",
                      updatedAt: new Date().toISOString(),
                    })
                  }
                >
                  <CheckCircle2 size={15} />
                  {selected.status === "approved"
                    ? "Согласовано"
                    : "Согласовать"}
                </button>
                <a
                  className="ops-button ghost"
                  href={selected.url}
                  target="_blank"
                >
                  <ExternalLink size={15} />
                  Открыть
                </a>
              </div>
              <div className="client-comments">
                <header>
                  <strong>Обсуждение</strong>
                  <span>
                    {selected.comments.filter((item) => !item.resolved).length}{" "}
                    открытых
                  </span>
                </header>
                {selected.comments.map((comment) => (
                  <article key={comment.id}>
                    <div>
                      <b>{comment.author.slice(0, 1).toUpperCase()}</b>
                      <span>
                        <strong>{comment.author}</strong>
                        <time>
                          {new Intl.DateTimeFormat("ru-RU", {
                            day: "numeric",
                            month: "short",
                          }).format(new Date(comment.createdAt))}
                        </time>
                      </span>
                    </div>
                    <p>{comment.text}</p>
                  </article>
                ))}
                <div className="client-compose">
                  <input
                    value={author}
                    onChange={(event) => setAuthor(event.target.value)}
                    placeholder="Ваше имя"
                  />
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Напишите, что нужно изменить..."
                  />
                  <button onClick={send}>
                    <Send size={14} />
                    Отправить комментарий
                  </button>
                </div>
              </div>
            </aside>
          </section>
        ) : (
          <Empty
            title="Материалов пока нет"
            text="Команда добавит сюда актуальные версии."
          />
        )}
      </main>
    </div>
  );
};

const ClientPortal = ({
  project,
  reviews,
  setState,
}: {
  project: StudioProject;
  reviews: ReviewItem[];
  setState: React.Dispatch<React.SetStateAction<OperationsState>>;
}) => {
  const [selectedId, setSelectedId] = useState(reviews[0]?.id);
  const [author, setAuthor] = useState(
    () => localStorage.getItem("autocubes-review-author") || "",
  );
  const [text, setText] = useState("");
  const [pin, setPin] = useState<{ x: number; y: number }>();
  const previewRef = useRef<HTMLDivElement>(null);
  const selected = reviews.find((item) => item.id === selectedId);
  const update = (next: ReviewItem) =>
    setState((current) => ({
      ...current,
      reviews: current.reviews.map((item) =>
        item.id === next.id ? next : item,
      ),
    }));
  useEffect(() => setPin(undefined), [selectedId]);
  const send = () => {
    if (!selected || !text.trim()) return;
    const name = author.trim() || "Клиент";
    localStorage.setItem("autocubes-review-author", name);
    update({
      ...selected,
      status: selected.status === "approved" ? "changes" : selected.status,
      comments: [
        ...selected.comments,
        {
          id: uid("comment"),
          author: name,
          text: text.trim(),
          createdAt: new Date().toISOString(),
          resolved: false,
          x: pin?.x,
          y: pin?.y,
        },
      ],
      updatedAt: new Date().toISOString(),
    });
    setText("");
    setPin(undefined);
  };
  const approve = () => {
    if (!selected) return;
    update({
      ...selected,
      status: "approved",
      comments: [
        ...selected.comments,
        {
          id: uid("comment"),
          author: author.trim() || "Клиент",
          text: `Версия ${selected.version} согласована`,
          createdAt: new Date().toISOString(),
          resolved: true,
        },
      ],
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="client-review-app">
      <header className="client-review-topbar">
        <a href="/">
          <img src="/assets/brand/autocubes.svg" alt="" />
          <span>autocubes</span>
        </a>
        <div>
          <span>Согласование</span>
          <b>{project.title}</b>
        </div>
        <span className="client-review-progress">
          {reviews.filter((item) => item.status === "approved").length}/
          {reviews.length} согласовано
        </span>
      </header>
      <div className="client-review-layout-v2">
        <aside className="client-materials">
          <header>
            <span>Материалы</span>
            <b>{reviews.length}</b>
          </header>
          <div>
            {reviews.map((item, index) => (
              <button
                className={item.id === selectedId ? "active" : ""}
                onClick={() => setSelectedId(item.id)}
                key={item.id}
              >
                <i>{String(index + 1).padStart(2, "0")}</i>
                <span>
                  <strong>{item.title}</strong>
                  <small>Версия {item.version}</small>
                </span>
                {item.status === "approved" ? (
                  <CheckCircle2 size={15} />
                ) : (
                  <span className={`client-status-dot ${item.status}`} />
                )}
              </button>
            ))}
          </div>
          <footer>
            <p>Все комментарии и решения сохраняются в истории проекта.</p>
          </footer>
        </aside>
        <main className="client-preview-area">
          {selected ? (
            <>
              <header>
                <div>
                  <span>
                    {project.client} · версия {selected.version}
                  </span>
                  <h1>{selected.title}</h1>
                </div>
                <span className={`ops-review-status ${selected.status}`}>
                  {reviewLabels[selected.status]}
                </span>
              </header>
              <div
                className="client-preview-canvas"
                ref={previewRef}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest(".ops-review-pin"))
                    return;
                  const rect = previewRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setPin({
                    x: Math.round(
                      ((event.clientX - rect.left) / rect.width) * 100,
                    ),
                    y: Math.round(
                      ((event.clientY - rect.top) / rect.height) * 100,
                    ),
                  });
                }}
              >
                {selected.preview ? (
                  <img src={selected.preview} alt={selected.title} />
                ) : (
                  <Empty
                    title="Превью не добавлено"
                    text="Откройте оригинал по ссылке справа."
                  />
                )}
                {selected.comments
                  .filter(
                    (comment) =>
                      comment.x !== undefined && comment.y !== undefined,
                  )
                  .map((comment, index) => (
                    <button
                      key={comment.id}
                      className={`ops-review-pin ${comment.resolved ? "resolved" : ""}`}
                      style={{ left: `${comment.x}%`, top: `${comment.y}%` }}
                      title={comment.text}
                    >
                      {index + 1}
                    </button>
                  ))}
                {pin && (
                  <i
                    className="ops-review-new-pin"
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                  >
                    <Plus size={12} />
                  </i>
                )}
              </div>
              <footer>
                <CircleDot size={12} /> Нажмите на изображение, чтобы указать
                место правки
              </footer>
            </>
          ) : (
            <Empty
              title="Материалов пока нет"
              text="Команда добавит сюда актуальные версии."
            />
          )}
        </main>
        <aside className="client-decision-panel">
          {selected && (
            <>
              <section className="client-decision-summary">
                <span className="ops-eyebrow">Решение</span>
                <p>{selected.description}</p>
                <div>
                  <button
                    className="ops-button primary"
                    onClick={approve}
                    disabled={selected.status === "approved"}
                  >
                    <CheckCircle2 size={15} />
                    {selected.status === "approved"
                      ? "Согласовано"
                      : "Согласовать версию"}
                  </button>
                  <a
                    className="ops-icon-button"
                    href={selected.url}
                    target="_blank"
                    title="Открыть оригинал"
                  >
                    <ExternalLink size={15} />
                  </a>
                </div>
              </section>
              <section className="client-thread-v2">
                <header>
                  <strong>Обсуждение</strong>
                  <span>
                    {selected.comments.filter((item) => !item.resolved).length}{" "}
                    открытых
                  </span>
                </header>
                <div className="client-thread-list">
                  {selected.comments.map((comment) => (
                    <article
                      className={comment.resolved ? "resolved" : ""}
                      key={comment.id}
                    >
                      <header>
                        <b>{comment.author.slice(0, 1).toUpperCase()}</b>
                        <span>
                          <strong>{comment.author}</strong>
                          <time>
                            {new Intl.DateTimeFormat("ru-RU", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(comment.createdAt))}
                          </time>
                        </span>
                      </header>
                      <p>{comment.text}</p>
                    </article>
                  ))}
                </div>
                <div className="client-compose-v2">
                  {pin && (
                    <span>
                      Комментарий к точке {pin.x}% × {pin.y}%{" "}
                      <button onClick={() => setPin(undefined)}>
                        <X size={11} />
                      </button>
                    </span>
                  )}
                  <input
                    value={author}
                    onChange={(event) => setAuthor(event.target.value)}
                    placeholder="Ваше имя"
                  />
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        (event.ctrlKey || event.metaKey) &&
                        event.key === "Enter"
                      )
                        send();
                    }}
                    placeholder="Что нужно изменить?"
                  />
                  <button onClick={send} disabled={!text.trim()}>
                    <Send size={14} /> Отправить
                  </button>
                </div>
              </section>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export const OperationsApp = () => {
  const [state, setState, syncStatus] = useOperations();
  const params = new URLSearchParams(location.search);
  const initialView = (params.get("view") as View) || "overview";
  const [view, setView] = useState<View>(
    ["overview", "crm", "projects", "reviews", "library"].includes(initialView)
      ? initialView
      : "overview",
  );
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const commandResults = useMemo(() => {
    const pages = [
      {
        id: "overview",
        title: "Обзор",
        meta: "Раздел",
        href: "/",
        Icon: LayoutDashboard,
      },
      {
        id: "crm",
        title: "CRM",
        meta: "Раздел",
        href: "/?view=crm",
        Icon: UsersRound,
      },
      {
        id: "projects",
        title: "Проекты",
        meta: "Раздел",
        href: "/?view=projects",
        Icon: FolderKanban,
      },
      {
        id: "reviews",
        title: "Согласования",
        meta: "Раздел",
        href: "/?view=reviews",
        Icon: MessageSquare,
      },
      {
        id: "library",
        title: "Библиотека",
        meta: "Раздел",
        href: "/?view=library",
        Icon: Library,
      },
    ];
    const objects = [
      ...state.leads.map((lead) => ({
        id: lead.id,
        title: lead.company,
        meta: `CRM · ${lead.contact || lead.channel}`,
        href: `/?view=crm&lead=${encodeURIComponent(lead.id)}`,
        Icon: UsersRound,
      })),
      ...state.projects.map((project) => ({
        id: project.id,
        title: project.title,
        meta: `Проект · ${project.client}`,
        href: `/?view=projects&project=${encodeURIComponent(project.id)}`,
        Icon: FolderKanban,
      })),
      ...state.reviews.map((review) => ({
        id: review.id,
        title: review.title,
        meta: `Согласование · v${review.version}`,
        href: `/?view=reviews&item=${encodeURIComponent(review.id)}`,
        Icon: MessageSquare,
      })),
      ...state.library.map((item) => ({
        id: item.id,
        title: item.title,
        meta: `Библиотека · ${item.category}`,
        href: `/?view=library&library=${encodeURIComponent(item.id)}`,
        Icon: Library,
      })),
    ];
    const query = commandQuery.trim().toLowerCase();
    return [...pages, ...objects]
      .filter(
        (item) =>
          !query || `${item.title} ${item.meta}`.toLowerCase().includes(query),
      )
      .slice(0, 12);
  }, [state, commandQuery]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    const syncFromHistory = () => {
      const next = new URLSearchParams(location.search).get(
        "view",
      ) as View | null;
      setView(
        next && ["crm", "projects", "reviews", "library"].includes(next)
          ? next
          : "overview",
      );
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);
  const navigate = (next: View) => {
    setView(next);
    history.pushState(null, "", next === "overview" ? "/" : `/?view=${next}`);
    window.scrollTo(0, 0);
  };
  const exportData = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }),
    );
    link.download = `autocubes-operations-${today()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const importData = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as OperationsState;
      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.leads) ||
        !Array.isArray(parsed.projects) ||
        !Array.isArray(parsed.reviews) ||
        !Array.isArray(parsed.library)
      )
        throw new Error("Файл не похож на экспорт Autocubes Operations");
      if (!confirm("Заменить текущие локальные данные импортированными?"))
        return;
      setState(parsed);
      navigate("overview");
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Не удалось прочитать файл",
      );
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };
  const reviewProjectId = params.get("review");
  const reviewProject = state.projects.find(
    (project) => project.id === reviewProjectId,
  );
  if (reviewProject)
    return (
      <ClientPortal
        project={reviewProject}
        reviews={state.reviews.filter(
          (review) => review.projectId === reviewProject.id,
        )}
        setState={setState}
      />
    );
  return (
    <div className="ops-shell">
      <aside className="ops-sidebar">
        <a className="ops-brand" href="/">
          <img src="/assets/brand/autocubes.svg" alt="" />
          <span>autocubes</span>
          <b>studio</b>
        </a>
        <nav>
          <span>Управление</span>
          <button
            className={view === "overview" ? "active" : ""}
            onClick={() => navigate("overview")}
          >
            <LayoutDashboard size={16} />
            Обзор
          </button>
          <button
            className={view === "crm" ? "active" : ""}
            onClick={() => navigate("crm")}
          >
            <UsersRound size={16} />
            CRM
            <b>{state.leads.filter((lead) => lead.stage === "new").length}</b>
          </button>
          <button
            className={view === "projects" ? "active" : ""}
            onClick={() => navigate("projects")}
          >
            <FolderKanban size={16} />
            Проекты
          </button>
          <button
            className={view === "reviews" ? "active" : ""}
            onClick={() => navigate("reviews")}
          >
            <MessageSquare size={16} />
            Согласования
            <b>
              {state.reviews.reduce(
                (sum, item) =>
                  sum +
                  item.comments.filter((comment) => !comment.resolved).length,
                0,
              )}
            </b>
          </button>
          <button
            className={view === "library" ? "active" : ""}
            onClick={() => navigate("library")}
          >
            <Library size={16} />
            Библиотека
          </button>
          <span>Инструменты</span>
          <a href="/editor.html">
            <Sparkles size={16} />
            Motion Desk
            <ArrowUpRight size={13} />
          </a>
          <a href="/apps/identity/identity-lab.html">
            <ClipboardCheck size={16} />
            Identity Lab
            <ArrowUpRight size={13} />
          </a>
          <a href="/documents.html">
            <ListChecks size={16} />
            Документы
            <ArrowUpRight size={13} />
          </a>
        </nav>
        <footer>
          <button onClick={() => importRef.current?.click()}>
            <Upload size={15} />
            Импорт данных
          </button>
          <button onClick={exportData}>
            <Download size={15} />
            Экспорт данных
          </button>
          <span>
            <i />
            {syncStatusLabel[syncStatus]}
          </span>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => importData(event.target.files?.[0])}
          />
        </footer>
      </aside>
      <main className="ops-main">
        <div className="ops-topbar">
          <button
            className="ops-command-trigger"
            onClick={() => setCommandOpen(true)}
          >
            <Search size={14} />
            Найти или открыть...<kbd>Ctrl K</kbd>
          </button>
          <div>
            <span>
              {new Intl.DateTimeFormat("ru-RU", {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date())}
            </span>
            <span className="ops-avatar">AC</span>
          </div>
        </div>
        <div className="ops-content">
          {view === "overview" && (
            <Overview state={state} openView={navigate} />
          )}{" "}
          {view === "crm" && <CRM state={state} setState={setState} />}{" "}
          {view === "projects" && (
            <Projects state={state} setState={setState} />
          )}{" "}
          {view === "reviews" && <Reviews state={state} setState={setState} />}{" "}
          {view === "library" && (
            <LibraryView state={state} setState={setState} />
          )}
        </div>
      </main>
      {commandOpen && (
        <div
          className="ops-command-backdrop"
          onMouseDown={() => setCommandOpen(false)}
        >
          <div
            className="ops-command"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <label>
              <Search size={17} />
              <input
                autoFocus
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setCommandOpen(false);
                  if (event.key === "Enter" && commandResults[0])
                    location.assign(commandResults[0].href);
                }}
                placeholder="Проект, клиент, материал или инструмент..."
              />
              {commandQuery && (
                <button
                  className="ops-command-clear"
                  onClick={() => setCommandQuery("")}
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <span>
              {commandQuery
                ? `Найдено: ${commandResults.length}`
                : "Быстрый переход"}
            </span>
            {commandResults.map(({ id, title, meta, href, Icon }) => (
              <button
                key={`${href}-${id}`}
                onClick={() => {
                  location.assign(href);
                }}
              >
                <Icon size={16} />
                <span className="ops-command-result">
                  <strong>{title}</strong>
                  <small>{meta}</small>
                </span>
                <ArrowRight size={14} />
              </button>
            ))}
            {!commandResults.length && (
              <div className="ops-command-empty">
                Ничего не найдено. Проверьте запрос.
              </div>
            )}
            <span>Действия</span>
            <button onClick={() => importRef.current?.click()}>
              <Upload size={16} />
              Импортировать данные
            </button>
            <button onClick={exportData}>
              <Download size={16} />
              Экспортировать рабочие данные
            </button>
            <button
              onClick={() => {
                if (
                  confirm(
                    "Вернуть демонстрационные данные? Текущие изменения будут удалены.",
                  )
                ) {
                  setState(initialOperationsState);
                  setCommandOpen(false);
                }
              }}
            >
              <Trash2 size={16} />
              Сбросить локальные данные
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
