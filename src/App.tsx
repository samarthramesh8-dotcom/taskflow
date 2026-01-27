import { useEffect, useMemo, useRef, useState } from "react"
import Profile from "./components/Profile"
import "./App.css"

type Task = {
  id: number
  text: string
  done: boolean
  dueDate?: string
  priority: "low" | "medium" | "high"
  createdAt: number
}

type Filter = "all" | "active" | "done" | "today" | "overdue" | "high"

const STORAGE_KEY = "my-app.tasks.v2"

function calculateTaskScore(task: Task): number {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  let score = 0
  if (task.priority === 'high') score += 3
  if (task.dueDate === today) score += 2
  if (task.dueDate && task.dueDate < today) score += 1
  const ageDays = (now.getTime() - task.createdAt) / (1000 * 60 * 60 * 24)
  if (ageDays > 3) score += 1
  return score
}

function filterTasks(tasks: Task[], filter: Filter): Task[] {
  const today = new Date().toISOString().split('T')[0]
  switch (filter) {
    case "active": return tasks.filter(t => !t.done)
    case "done": return tasks.filter(t => t.done)
    case "today": return tasks.filter(t => t.dueDate === today && !t.done)
    case "overdue": return tasks.filter(t => t.dueDate && t.dueDate < today && !t.done)
    case "high": return tasks.filter(t => t.priority === "high" && !t.done)
    default: return tasks
  }
}

function safeParseTasks(raw: string | null): Task[] | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return null

    // Basic validation/normalization
    const tasks: Task[] = data
      .map((t: any) => ({
        id: typeof t?.id === "number" ? t.id : Number(t?.id),
        text: typeof t?.text === "string" ? t.text : "",
        done: Boolean(t?.done),
        dueDate: typeof t?.dueDate === "string" ? t.dueDate : undefined,
        priority: ["low", "medium", "high"].includes(t?.priority) ? t.priority : "medium",
        createdAt: typeof t?.createdAt === "number" ? t.createdAt : Date.now(),
      }))
      .filter((t) => Number.isFinite(t.id) && t.text.length > 0)

    return tasks
  } catch {
    return null
  }
}

export default function App() {
  const [count, setCount] = useState(0)

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = safeParseTasks(localStorage.getItem(STORAGE_KEY))
    return (
      saved ?? [
        { id: 1, text: "Learn React basics", done: false, priority: "medium" as const, createdAt: Date.now() - 86400000 * 4 },
        { id: 2, text: "Build a mini project", done: false, priority: "high" as const, createdAt: Date.now() - 86400000 },
      ]
    )
  })

  const [input, setInput] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  const [addDueDate, setAddDueDate] = useState("")
  const [addPriority, setAddPriority] = useState<"low" | "medium" | "high">("medium")

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState("")
  const [editingDueDate, setEditingDueDate] = useState("")
  const [editingPriority, setEditingPriority] = useState<"low" | "medium" | "high">("medium")

  const [focusMode, setFocusMode] = useState(() => localStorage.getItem('focusMode') === 'true')

  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Persist tasks whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  // Persist focus mode
  useEffect(() => {
    localStorage.setItem('focusMode', focusMode.toString())
  }, [focusMode])

  // Keyboard shortcut for adding task
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName
      if (
        e.key.toLowerCase() === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        editingId === null &&
        tag !== "INPUT" &&
        tag !== "TEXTAREA"
      ) {
        inputRef.current?.focus()
        inputRef.current?.select()
      }
      if (
        e.key.toLowerCase() === "f" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey &&
        editingId === null &&
        tag !== "INPUT" &&
        tag !== "TEXTAREA"
      ) {
        setFocusMode(v => !v)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editingId])

  function addTask(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return

    const dueDate = addDueDate || undefined
    setTasks([{ id: Date.now(), text, done: false, dueDate, priority: addPriority, createdAt: Date.now() }, ...tasks])
    setInput("")
    setAddDueDate("")
    setAddPriority("medium")
  }

  function toggleTask(id: number) {
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  function deleteTask(id: number) {
    setTasks(tasks.filter((t) => t.id !== id))
  }

  function clearDone() {
    setTasks(tasks.filter((t) => !t.done))
  }

  function handleExport() {
    const today = new Date().toISOString().split('T')[0]
    const data = JSON.stringify(tasks, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tasks-${today}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string)
        if (!Array.isArray(data)) throw new Error()
        for (const t of data) {
          if (
            typeof t.id !== 'number' ||
            typeof t.text !== 'string' ||
            typeof t.done !== 'boolean' ||
            (t.dueDate !== undefined && typeof t.dueDate !== 'string') ||
            !['low', 'medium', 'high'].includes(t.priority) ||
            typeof t.createdAt !== 'number'
          ) {
            throw new Error()
          }
        }
        setTasks(data as Task[])
      } catch {
        alert('Invalid task file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((t) => t.done).length
    const active = total - done
    return { total, done, active }
  }, [tasks])

  const taskScores = useMemo(() => {
    return tasks.map(task => ({
      task,
      score: calculateTaskScore(task)
    }))
  }, [tasks])

  const visibleTasks = useMemo(() => {
    if (focusMode) {
      return taskScores.filter(ts => !ts.task.done).sort((a, b) => b.score - a.score).slice(0, 5).map(ts => ts.task)
    }
    return filterTasks(tasks, filter)
  }, [tasks, filter, focusMode, taskScores])

  const nextUpTasks = useMemo(() => {
    const high = tasks.filter(t => t.priority === "high" && !t.done)
    const today = new Date().toISOString().split('T')[0]
    const dueToday = tasks.filter(t => t.dueDate === today && !t.done)
    const active = tasks.filter(t => !t.done)
    const oldest = active.length > 0 ? [ [...active].sort((a, b) => a.createdAt - b.createdAt)[0] ] : []
    const combined = [...high, ...dueToday, ...oldest]
    const unique = combined.filter((t, i, arr) => arr.findIndex(u => u.id === t.id) === i)
    return unique.slice(0, 3)
  }, [tasks])

  const bestTaskId = useMemo(() => {
    const activeTaskScores = taskScores.filter(ts => !ts.task.done)
    if (activeTaskScores.length === 0) return null
    const maxScore = Math.max(...activeTaskScores.map(ts => ts.score))
    const best = activeTaskScores.find(ts => ts.score === maxScore)
    return best ? best.task.id : null
  }, [taskScores])

  return (
    <div className="app">
      <div className="bg" />

      <header className="topbar">
        <div className="brand">
          <div className="logo" aria-hidden />
          <div>
            <div className="brandTitle">TaskFlow</div>
            <div className="brandSub">Smart task management with focus mode</div>
          </div>
        </div>

        <div className="pillRow">
          <div className="pill">
            <span className="pillLabel">Total</span>
            <span className="pillValue">{stats.total}</span>
          </div>
          <div className="pill">
            <span className="pillLabel">Active</span>
            <span className="pillValue">{stats.active}</span>
          </div>
          <div className="pill">
            <span className="pillLabel">Done</span>
            <span className="pillValue">{stats.done}</span>
          </div>
        </div>
      </header>

      <main className="grid">
        {/* Left card */}
        <section className="card">
          <div className="cardHeader">
            <div>
              <h2 className="cardTitle">Profile</h2>
              <p className="cardSub">Reusable component + props</p>
            </div>
          </div>

          <div className="cardBody">
            <div className="profileWrap">
              <Profile name="Samarth" major="Computer Science" />
            </div>

            <div className="divider" />

            <div className="sectionHeader">
              <div>
                <h3 className="sectionTitle">Counter</h3>
                <p className="sectionSub">State updates drive UI</p>
              </div>
              <div className="counterValue" aria-label="Counter value">
                {count}
              </div>
            </div>

            <div className="btnRow">
              <button className="btn btnPrimary" onClick={() => setCount((c) => c + 1)}>
                +1
              </button>
              <button className="btn btnGhost" onClick={() => setCount(0)}>
                Reset
              </button>
            </div>
          </div>
        </section>

        {/* Right card */}
        <section className="card cardTall">
          <div className="cardHeader">
            <div>
              <h2 className="cardTitle">Tasks</h2>
              <p className="cardSub">{focusMode ? "Showing top 5 most important tasks" : "Forms • lists • immutable updates"}</p>
            </div>

            <div className="taskHeaderControls">
              <button className="btn btnGhost btnSmall" onClick={() => setFocusMode(v => !v)}>
                Focus Mode
              </button>
              <button className="btn btnGhost btnSmall" onClick={handleExport}>
                Export
              </button>
              <button className="btn btnGhost btnSmall" onClick={() => fileInputRef.current?.click()}>
                Import
              </button>
              <div className={`segmented ${focusMode ? 'isDimmed' : ''}`} role="tablist" aria-label="Task filter">
                <button
                  className={`segBtn ${filter === "all" ? "isActive" : ""}`}
                  onClick={() => { setFocusMode(false); setFilter("all"); }}
                  type="button"
                >
                  All
                </button>
                <button
                  className={`segBtn ${filter === "active" ? "isActive" : ""}`}
                  onClick={() => { setFocusMode(false); setFilter("active"); }}
                  type="button"
                >
                  Active
                </button>
                <button
                  className={`segBtn ${filter === "done" ? "isActive" : ""}`}
                  onClick={() => { setFocusMode(false); setFilter("done"); }}
                  type="button"
                >
                  Done
                </button>
                <button
                  className={`segBtn ${filter === "today" ? "isActive" : ""}`}
                  onClick={() => { setFocusMode(false); setFilter("today"); }}
                  type="button"
                >
                  Today
                </button>
                <button
                  className={`segBtn ${filter === "overdue" ? "isActive" : ""}`}
                  onClick={() => { setFocusMode(false); setFilter("overdue"); }}
                  type="button"
                >
                  Overdue
                </button>
                <button
                  className={`segBtn ${filter === "high" ? "isActive" : ""}`}
                  onClick={() => { setFocusMode(false); setFilter("high"); }}
                  type="button"
                >
                  High
                </button>
              </div>
            </div>
          </div>

          <div className="cardBody">
            <form className="addForm" onSubmit={addTask}>
              <div className="inputWrap">
                <span className="inputIcon" aria-hidden>
                  +
                </span>
                <input
                  ref={inputRef}
                  className="input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Add a task (e.g., ship this to GitHub)"
                  maxLength={60}
                />
              </div>
              <div className="addOptions">
                <input
                  type="date"
                  value={addDueDate}
                  onChange={(e) => setAddDueDate(e.target.value)}
                  className="editDate"
                />
                <select
                  value={addPriority}
                  onChange={(e) => setAddPriority(e.target.value as "low" | "medium" | "high")}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <button className="btn btnPrimary" type="submit">
                Add
              </button>
            </form>

            <div className="shortcutHint">Press N to quickly add a task</div>

            {nextUpTasks.length > 0 && (
              <div className="nextUp">
                <h3>Next Up</h3>
                <p className="nextUpHint">Picked based on urgency, priority, and age</p>
                <ul>
                  {nextUpTasks.map((t) => (
                    <li key={t.id}>
                      {t.text}{t.id === bestTaskId ? " (Best next)" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={`listHeader ${focusMode ? 'isDimmed' : ''}`}>
              <div className="muted">
                Showing <b>{visibleTasks.length}</b> of <b>{tasks.length}</b>
              </div>
              <button
                className="btn btnGhost btnSmall"
                onClick={clearDone}
                type="button"
                disabled={stats.done === 0}
              >
                Clear done
              </button>
            </div>

            <ul className="list">
              {visibleTasks.length === 0 ? (
                <li className="empty">
                  <div className="emptyTitle">
                    {focusMode
                      ? "No high-impact tasks found."
                      : tasks.filter((t) => !t.done).length === 0
                      ? tasks.length === 0
                        ? "You’re clear. Add something meaningful."
                        : "Everything’s complete. Ship or rest."
                      : "Nothing here. Add a task or switch filters."
                    }
                  </div>
                  <div className="emptySub">Switch filters or add a task to get started.</div>
                </li>
              ) : (
                visibleTasks.map((t) => (
                  <li key={t.id} className={`item ${t.done ? "isDone" : ""} ${t.id === bestTaskId ? "bestTask" : ""}`}>
                    <button
                      className={`check ${t.done ? "checked" : ""}`}
                      onClick={() => toggleTask(t.id)}
                      type="button"
                      aria-label={t.done ? "Mark as not done" : "Mark as done"}
                    >
                      <span className="checkDot" />
                    </button>

                    <div className="itemMain">
                      {editingId === t.id ? (
                        <div className="editForm">
                          <input
                            className="input"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const trimmed = editingText.trim()
                                if (trimmed) {
                                  setTasks(tasks.map((task) => (task.id === t.id ? { ...task, text: trimmed, dueDate: editingDueDate || undefined, priority: editingPriority } : task)))
                                }
                                setEditingId(null)
                                setEditingText("")
                                setEditingDueDate("")
                                setEditingPriority("medium")
                              } else if (e.key === 'Escape') {
                                setEditingId(null)
                                setEditingText("")
                                setEditingDueDate("")
                                setEditingPriority("medium")
                              }
                            }}
                            autoFocus
                          />
                          <div className="editRow">
                            <input
                              type="date"
                              value={editingDueDate}
                              onChange={(e) => setEditingDueDate(e.target.value)}
                              className="editDate"
                            />
                            <select
                              value={editingPriority}
                              onChange={(e) => setEditingPriority(e.target.value as "low" | "medium" | "high")}
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>
                          <div className="editActions">
                            <button
                              className="btn btnPrimary"
                              onClick={() => {
                                const trimmed = editingText.trim()
                                if (trimmed) {
                                  setTasks(tasks.map((task) => (task.id === t.id ? { ...task, text: trimmed, dueDate: editingDueDate || undefined, priority: editingPriority } : task)))
                                }
                                setEditingId(null)
                                setEditingText("")
                                setEditingDueDate("")
                                setEditingPriority("medium")
                              }}
                              type="button"
                            >
                              Save
                            </button>
                            <button
                              className="btn btnGhost"
                              onClick={() => {
                                setEditingId(null)
                                setEditingText("")
                                setEditingDueDate("")
                                setEditingPriority("medium")
                              }}
                              type="button"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="itemText"
                          onDoubleClick={() => {
                            setEditingId(t.id)
                            setEditingText(t.text)
                            setEditingDueDate(t.dueDate || "")
                            setEditingPriority(t.priority)
                          }}
                        >
                          {t.text}
                        </div>
                      )}
                      {t.id === bestTaskId && <div className="bestLabel">Best next task</div>}
                      <div className="itemMeta">{t.done ? "Done" : "In progress"}</div>
                    </div>

                    <button
                      className="iconBtn"
                      onClick={() => deleteTask(t.id)}
                      type="button"
                      aria-label="Delete task"
                    >
                      ✕
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span className="muted">Tip:</span> Tasks now persist via localStorage.
      </footer>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hiddenFileInput"
        onChange={handleImport}
      />
    </div>
  )
}
