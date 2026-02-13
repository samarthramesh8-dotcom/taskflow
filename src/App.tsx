// App.tsx
import { useEffect, useState, useMemo } from "react"
import "./App.css"
import { login, register } from "./api"

type Priority = "low" | "medium" | "high"
type Category = "general" | "work" | "personal" | "shopping" | "health"

interface Task {
  id: number
  text: string
  description?: string
  done: boolean
  priority: Priority
  category: Category
  due_date?: string
  due_at?: string
  created_at: string
  updated_at: string
  dueAt?: string
}

type Filter = "all" | "active" | "done"
type SortBy = "created" | "priority" | "due_date" | "category"
type DueFilter = "all" | "today" | "upcoming" | "overdue"

interface Stats {
  total: number
  completed: number
  pending: number
  high_priority: number
}

// Client-side validation helpers - MUST match backend rules exactly
const validateEmailClient = (email: string): string | null => {
  if (!email || email.trim().length === 0) {
    return 'Email is required'
  }
  if (email.trim().length > 254) {
    return 'Email is too long (max 254 characters)'
  }
  const trimmed = email.trim()
  if (!trimmed.includes('@') || trimmed.split('@').length !== 2) {
    return 'Please enter a valid email address'
  }
  const [localPart, domain] = trimmed.split('@')
  if (!localPart || localPart.length === 0) {
    return 'Please enter a valid email address'
  }
  if (!domain || domain.length === 0 || !domain.includes('.')) {
    return 'Please enter a valid email address'
  }
  return null
}

const validatePasswordClient = (password: string): string | null => {
  if (!password || password.length === 0) {
    return 'Password is required'
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters'
  }
  if (password.length > 128) {
    return 'Password is too long (max 128 characters)'
  }
  return null
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [input, setInput] = useState("")
  const [description, setDescription] = useState("")
  const [filter, setFilter] = useState<Filter>("all")
  const [sortBy, setSortBy] = useState<SortBy>("priority")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<Category | "all">("all")
  const [selectedPriority, setSelectedPriority] = useState<Priority>("medium")
  const [dueDate, setDueDate] = useState("")
  const [dueTime, setDueTime] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState<string | null>(localStorage.getItem("auth_token"))
  const [authMode, setAuthMode] = useState<"login" | "register">("login")
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [dueFilter, setDueFilter] = useState<DueFilter>("all")
  const [authErrors, setAuthErrors] = useState<{ email?: string; password?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const categories: Category[] = ["general", "work", "personal", "shopping", "health"]

  const API_URL = import.meta.env.VITE_API_URL
  
  // Fail fast if API_URL is not configured
  useEffect(() => {
    if (import.meta.env.PROD && !API_URL) {
      console.error('[App] CRITICAL: VITE_API_URL not set in production')
      setError('API configuration error. Please contact support.')
    }
  }, [API_URL])

  // Log API configuration on mount
  useEffect(() => {
    console.log('[App] Startup:', {
      mode: import.meta.env.MODE,
      prod: import.meta.env.PROD,
      dev: import.meta.env.DEV,
      apiUrl: API_URL || '(using Vite proxy)',
      apiUrlDefined: !!API_URL
    })
  }, [])

  // Helper function for API calls with robust JSON handling
  const apiFetch = async (endpoint: string, options?: RequestInit) => {
    // Ensure API_URL is available
    if (import.meta.env.PROD && !API_URL) {
      throw new Error('API configuration error: VITE_API_URL not set')
    }

    const url = `${API_URL}${endpoint}`
    console.log(`[API] ${options?.method || 'GET'} ${url}`, {
      apiUrl: API_URL,
      endpoint,
      fullUrl: url
    })
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers
        }
      })
      
      const contentType = response.headers.get('content-type')
      console.log(`[API] Response: ${response.status} ${response.statusText}`, {
        contentType
      })
      
      // Get response text
      const text = await response.text()
      console.log(`[API] Response body:`, text.substring(0, 500))
      
      // Check if response is JSON
      if (!contentType || !contentType.includes('application/json')) {
        console.error('[API] Non-JSON response:', {
          status: response.status,
          contentType: contentType || 'none',
          body: text.substring(0, 200)
        })
        throw new Error(`Server returned ${contentType || 'unknown'} (${response.status})`)
      }
      
      // Parse JSON safely
      let data
      try {
        data = text ? JSON.parse(text) : {}
      } catch (parseError) {
        console.error('[API] JSON parse failed:', text.substring(0, 200))
        throw new Error(`Invalid JSON response (${response.status})`)
      }
      
      // Check response status
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized")
        }
        console.error('[API] Error response:', data)
        throw new Error(data.error || `Request failed (${response.status})`)
      }
      
      return data
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('[API] Network error - backend unreachable')
        throw new Error('Cannot connect to server')
      }
      throw error
    }
  }

  useEffect(() => {
    if (!token) return
    fetchTasks()
    fetchStats()
  }, [token, dueFilter])

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (showUserMenu && !target.closest('.user-menu-wrapper')) {
        setShowUserMenu(false)
      }
    }
    if (showUserMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showUserMenu])

  const fetchTasks = async () => {
    try {
      setLoading(true)
      setError(null)

      const endpoint =
        dueFilter === "all" ? "/api/tasks" : `/api/tasks/${dueFilter}`

      const data = await apiFetch(endpoint, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      })

      setTasks(data)
    } catch (err) {
      console.error("Fetch tasks error:", err)
      if (err instanceof Error && err.message === "Unauthorized") {
        handleLogout()
        return
      }
      setError(err instanceof Error ? err.message : "Failed to fetch tasks")
    } finally {
      setLoading(false)
      setInitialLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const data = await apiFetch('/api/tasks/stats', {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      })
      
      setStats(data)
    } catch (err) {
      console.error("Stats error:", err)
      if (err instanceof Error && err.message === "Unauthorized") {
        handleLogout()
      }
    }
  }

  const seedSampleTasks = async () => {
    try {
      setLoading(true)
      
      await apiFetch('/api/tasks/seed', {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      })
      
      await fetchTasks()
      await fetchStats()
      setSuccessMessage("Sample tasks added successfully")
    } catch (err) {
      console.error("Seed error:", err)
      setError(err instanceof Error ? err.message : "Failed to add sample tasks")
    } finally {
      setLoading(false)
    }
  }

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return

    try {
      setLoading(true)

      const dueAtIso = buildDueAtIso(dueDate, dueTime)

      const newTask = await apiFetch('/api/tasks', {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text,
          description: description.trim() || undefined,
          priority: selectedPriority,
          category: selectedCategory === "all" ? "general" : selectedCategory,
          due_date: dueDate || undefined,
          due_at: dueAtIso
        })
      })

      setTasks([newTask, ...tasks])
      setInput("")
      setDescription("")
      setDueDate("")
      setDueTime("")
      setSelectedPriority("medium")
      setShowAddForm(false)
      setError(null)
      setSuccessMessage("Task created")
      await fetchStats()
    } catch (err) {
      console.error("Add task error:", err)
      setError(err instanceof Error ? err.message : "Failed to create task")
    } finally {
      setLoading(false)
    }
  }

  const updateTask = async (id: number, updates: Partial<Task>) => {
    const originalTask = tasks.find(t => t.id === id)
    if (!originalTask) return

    setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t))

    try {
      const updatedTask = await apiFetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(updates)
      })

      setTasks(tasks.map(t => t.id === id ? updatedTask : t))
      setEditingTask(null)
      setError(null)
      setSuccessMessage("Task updated")
      await fetchStats()
    } catch (err) {
      setTasks(tasks.map(t => t.id === id ? originalTask : t))
      console.error("Update task error:", err)
      setError(err instanceof Error ? err.message : "Failed to update task")
    }
  }

  const toggleTask = async (id: number) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return

    setTasks(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t))
    
    try {
      const updatedTask = await apiFetch(`/api/tasks/${id}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ done: !task.done })
      })

      setTasks(tasks.map(t => t.id === id ? updatedTask : t))
      await fetchStats()
    } catch (err) {
      setTasks(tasks.map(t => t.id === id ? task : t))
      console.error("Toggle task error:", err)
      setError("Failed to update task status")
    }
  }

  const deleteTask = async (id: number) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    
    if (!confirm(`Delete "${task.text}"?`)) return

    const originalTasks = [...tasks]
    setTasks(tasks.filter(t => t.id !== id))

    try {
      await apiFetch(`/api/tasks/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      })

      setError(null)
      setSuccessMessage("Task deleted")
      await fetchStats()
    } catch (err) {
      setTasks(originalTasks)
      console.error("Delete task error:", err)
      setError("Failed to delete task")
    }
  }

  const buildDueAtIso = (date: string, time: string) => {
    if (!date) return undefined
    const effectiveTime = time || "09:00"
    const [hours, minutes] = effectiveTime.split(":").map(Number)
    const d = new Date(date)
    d.setHours(hours, minutes, 0, 0)
    return d.toISOString()
  }

  const formatDueTime = (iso?: string) => {
    if (!iso) return ""
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }

  const toTimeInput = (iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    const hh = String(d.getHours()).padStart(2, "0")
    const mm = String(d.getMinutes()).padStart(2, "0")
    return `${hh}:${mm}`
  }

  const kpiStats = useMemo(() => {
    const total = tasks.length
    const completed = tasks.filter(t => t.done).length
    const pending = tasks.filter(t => !t.done).length
    const high_priority = tasks.filter(t => t.priority === 'high' && !t.done).length
    return { total, completed, pending, high_priority }
  }, [tasks])

  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks
    if (filter === "active") filtered = filtered.filter(t => !t.done)
    if (filter === "done") filtered = filtered.filter(t => t.done)
    if (selectedCategory !== "all") {
      filtered = filtered.filter(t => t.category === selectedCategory)
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.text.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      )
    }
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "priority") {
        const priorityOrder = { high: 0, medium: 1, low: 2 }
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      if (sortBy === "due_date") {
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      }
      if (sortBy === "category") {
        return a.category.localeCompare(b.category)
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return sorted
  }, [tasks, filter, selectedCategory, searchQuery, sortBy])

  const handleRegister = async (email: string, password: string) => {
    console.log('[Register] Handler called', { email, submitting: isSubmitting })
    
    if (isSubmitting) {
      console.warn('[Register] Already submitting, ignoring duplicate request')
      return
    }

    setAuthErrors({})
    setIsSubmitting(true)
    
    console.log('[Register] Starting registration:', { 
      email, 
      password: '***',
      apiUrl: API_URL 
    })
    
    const emailError = validateEmailClient(email)
    const passwordError = validatePasswordClient(password)
    
    console.log('[Register] Validation:', { emailError, passwordError })
    
    if (emailError || passwordError) {
      setAuthErrors({
        email: emailError || undefined,
        password: passwordError || undefined
      })
      setIsSubmitting(false)
      return
    }

    try {
      console.log('[Register] API call starting...')
      const data = await register(email, password)

      console.log('[Register] API success:', { token: data.token ? '***' : 'missing', email: data.user?.email })
      setToken(data.token)
      localStorage.setItem("auth_token", data.token)
      setError(null)
      setAuthErrors({})
    } catch (err) {
      console.error("[Register] API error:", err)
      handleAuthError(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogin = async (email: string, password: string) => {
    console.log('[Login] Handler called', { email, submitting: isSubmitting })
    
    if (isSubmitting) {
      console.warn('[Login] Already submitting, ignoring duplicate request')
      return
    }

    setAuthErrors({})
    setIsSubmitting(true)
    
    console.log('[Login] Starting login:', { 
      email, 
      password: '***',
      apiUrl: API_URL 
    })
    
    const emailError = validateEmailClient(email)
    const passwordError = validatePasswordClient(password)
    
    console.log('[Login] Validation:', { emailError, passwordError })
    
    if (emailError || passwordError) {
      setAuthErrors({
        email: emailError || undefined,
        password: passwordError || undefined
      })
      setIsSubmitting(false)
      return
    }

    try {
      console.log('[Login] API call starting...')
      const data = await login(email, password)

      console.log('[Login] API success:', { token: data.token ? '***' : 'missing', email: data.user?.email })
      setToken(data.token)
      localStorage.setItem("auth_token", data.token)
      setError(null)
      setAuthErrors({})
    } catch (err) {
      console.error("[Login] API error:", err)
      handleAuthError(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAuthError = (err: unknown) => {
    if (err instanceof Error) {
      const message = err.message
      try {
        const parsed = JSON.parse(message)
        if (parsed.field && parsed.error) {
          setAuthErrors({ [parsed.field]: parsed.error })
          return
        }
      } catch {
        // Not JSON
      }
      setError(message)
    } else {
      setError("Request failed")
    }
  }

  const handleLogout = () => {
    setToken(null)
    localStorage.removeItem("auth_token")
    setTasks([])
    setStats(null)
    setError(null)
    setShowUserMenu(false)
  }

  const getCategoryIcon = (category: Category) => {
    const icons = {
      work: "💼",
      personal: "🏠",
      shopping: "🛒",
      health: "💪",
      general: "📝"
    }
    return icons[category]
  }

  const isOverdue = (dueDate?: string, dueAt?: string) => {
    const value = dueAt || dueDate
    if (!value) return false
    return new Date(value) < new Date() && new Date(value).toDateString() !== new Date().toDateString()
  }

  const displayedStats = stats ?? kpiStats
  const completionRate = displayedStats.total > 0 ? Math.round((displayedStats.completed / displayedStats.total) * 100) : 0

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const searchInput = document.querySelector('.search-input') as HTMLInputElement
        if (searchInput) searchInput.focus()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        if (!showAddForm && !editingTask) {
          setShowAddForm(true)
        }
      }
      if (e.key === 'Escape') {
        if (showAddForm) setShowAddForm(false)
        if (editingTask) setEditingTask(null)
        if (showUserMenu) setShowUserMenu(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showAddForm, editingTask, showUserMenu])

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">✨</div>
            <h1>Task Master</h1>
            <p>Organize your work, achieve your goals</p>
          </div>
          <div className="auth-tabs">
            <button 
              className={authMode === "login" ? "active" : ""} 
              onClick={() => {
                setAuthMode("login")
                setAuthErrors({})
                setError(null)
              }}
              disabled={isSubmitting}
            >
              Sign In
            </button>
            <button 
              className={authMode === "register" ? "active" : ""} 
              onClick={() => {
                setAuthMode("register")
                setAuthErrors({})
                setError(null)
              }}
              disabled={isSubmitting}
            >
              Sign Up
            </button>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault()
            console.log('[Form] Submit event fired, isSubmitting:', isSubmitting)
            
            const form = e.target as HTMLFormElement
            const email = (form.elements.namedItem("email") as HTMLInputElement).value
            const password = (form.elements.namedItem("password") as HTMLInputElement).value
            
            console.log('[Form] Form values:', { email, password: '***' })
            
            if (authMode === "login") {
              handleLogin(email, password)
            } else {
              handleRegister(email, password)
            }
          }}>
            <div className="form-group">
              <label>Email</label>
              <input 
                name="email" 
                type="email" 
                placeholder="you@example.com" 
                required 
                disabled={isSubmitting}
                className={authErrors.email ? 'input-error' : ''}
                onChange={() => {
                  if (authErrors.email) {
                    setAuthErrors({ ...authErrors, email: undefined })
                  }
                }}
              />
              {authErrors.email && (
                <div className="field-error">{authErrors.email}</div>
              )}
            </div>
            <div className="form-group">
              <label>Password</label>
              <input 
                name="password" 
                type="password" 
                placeholder="••••••••" 
                required 
                minLength={8}
                disabled={isSubmitting}
                className={authErrors.password ? 'input-error' : ''}
                onChange={() => {
                  if (authErrors.password) {
                    setAuthErrors({ ...authErrors, password: undefined })
                  }
                }}
              />
              {authErrors.password && (
                <div className="field-error">{authErrors.password}</div>
              )}
            </div>
            <button 
              type="submit" 
              className="btn-auth-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (authMode === "login" ? "Signing In..." : "Creating Account...") : (authMode === "login" ? "Sign In" : "Create Account")}
            </button>
          </form>
          {error && <div className="auth-error">{error}</div>}
        </div>
      </div>
    )
  }

  const userEmail = token ? JSON.parse(atob(token.split('.')[1])).email : ""

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="navbar">
        <div className="navbar-container">
          <div className="navbar-brand">
            <span className="brand-icon">✨</span>
            <span className="brand-name">Task Master</span>
          </div>
          <div className="navbar-actions">
            <div className="user-menu-wrapper">
              <button className="user-menu-trigger" onClick={() => setShowUserMenu(!showUserMenu)}>
                <div className="user-avatar">{userEmail.charAt(0).toUpperCase()}</div>
                <span className="user-email">{userEmail}</span>
                <svg className="chevron" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                </svg>
              </button>
              {showUserMenu && (
                <>
                  <div className="user-dropdown-overlay" onClick={() => setShowUserMenu(false)}></div>
                  <div className="user-dropdown">
                    <div className="user-dropdown-header">
                      <div className="user-avatar-large">{userEmail.charAt(0).toUpperCase()}</div>
                      <div>
                        <div className="user-dropdown-email">{userEmail}</div>
                        <div className="user-dropdown-plan">Free Plan</div>
                      </div>
                    </div>
                    <div className="user-dropdown-divider"></div>
                    <button className="user-dropdown-item" onClick={handleLogout}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-container">
          
          {/* Page Header */}
          <div className="page-header">
            <div className="page-header-text">
              <h1 className="page-title">Dashboard</h1>
              <p className="page-subtitle">Track and manage all your tasks in one place</p>
            </div>
            <button className="btn-primary-large" onClick={() => setShowAddForm(true)} disabled={loading}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              New Task
            </button>
          </div>

          {/* KPI Cards */}
          {!initialLoading && (
            <div className="kpi-section">
              <div className="kpi-card kpi-card-primary">
                <div className="kpi-icon-wrapper">
                  <svg className="kpi-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="kpi-content">
                  <div className="kpi-label">Total Tasks</div>
                  <div className="kpi-value">{displayedStats.total}</div>
                  <div className="kpi-meta">All tasks</div>
                </div>
              </div>

              <div className="kpi-card kpi-card-warning">
                <div className="kpi-icon-wrapper">
                  <svg className="kpi-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="kpi-content">
                  <div className="kpi-label">In Progress</div>
                  <div className="kpi-value">{displayedStats.pending}</div>
                  <div className="kpi-meta">Active tasks</div>
                </div>
              </div>

              <div className="kpi-card kpi-card-success">
                <div className="kpi-icon-wrapper">
                  <svg className="kpi-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="kpi-content">
                  <div className="kpi-label">Completed</div>
                  <div className="kpi-value">{displayedStats.completed}</div>
                  <div className="kpi-meta">{completionRate}% complete</div>
                </div>
              </div>

              <div className="kpi-card kpi-card-danger">
                <div className="kpi-icon-wrapper">
                  <svg className="kpi-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="kpi-content">
                  <div className="kpi-label">High Priority</div>
                  <div className="kpi-value">{displayedStats.high_priority}</div>
                  <div className="kpi-meta">Needs attention</div>
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="controls-wrapper">
            <div className="search-wrapper">
              <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M9 17A8 8 0 109 1a8 8 0 000 16zM17 17l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                type="text"
                placeholder="Search tasks... (⌘K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filters-wrapper">
              <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="filter-select">
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="done">Completed</option>
              </select>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as Category | "all")} className="filter-select">
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                ))}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="filter-select">
                <option value="priority">Priority</option>
                <option value="due_date">Due Date</option>
                <option value="category">Category</option>
                <option value="created">Created</option>
              </select>
              <button
                className={dueFilter === "today" ? "btn-secondary" : "btn-secondary"}
                onClick={() => setDueFilter("today")}
              >
                Today
              </button>
              <button
                className={dueFilter === "upcoming" ? "btn-secondary" : "btn-secondary"}
                onClick={() => setDueFilter("upcoming")}
              >
                Upcoming
              </button>
              <button
                className={dueFilter === "overdue" ? "btn-secondary" : "btn-secondary"}
                onClick={() => setDueFilter("overdue")}
              >
                Overdue
              </button>
              <button
                className={dueFilter === "all" ? "btn-secondary" : "btn-secondary"}
                onClick={() => setDueFilter("all")}
              >
                All
              </button>
            </div>
          </div>

          {/* Task Content */}
          {initialLoading || (loading && tasks.length === 0) ? (
            <div className="task-table">
              <div className="task-table-header">
                <div className="col-status"></div>
                <div className="col-task">Task</div>
                <div className="col-category">Category</div>
                <div className="col-priority">Priority</div>
                <div className="col-due">Due Date</div>
                <div className="col-actions">Actions</div>
              </div>
              {[1, 2, 3].map(i => (
                <div key={i} className="task-row skeleton-row">
                  <div className="skeleton-shimmer"></div>
                </div>
              ))}
            </div>
          ) : filteredAndSortedTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-illustration">
                <svg width="160" height="160" viewBox="0 0 160 160" fill="none">
                  <circle cx="80" cy="80" r="60" fill="url(#gradient1)" opacity="0.1"/>
                  <rect x="50" y="50" width="60" height="70" rx="4" stroke="url(#gradient1)" strokeWidth="3"/>
                  <line x1="60" y1="70" x2="100" y2="70" stroke="url(#gradient1)" strokeWidth="3" strokeLinecap="round"/>
                  <line x1="60" y1="85" x2="100" y2="85" stroke="url(#gradient1)" strokeWidth="3" strokeLinecap="round"/>
                  <line x1="60" y1="100" x2="85" y2="100" stroke="url(#gradient1)" strokeWidth="3" strokeLinecap="round"/>
                  <defs>
                    <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#6366f1"/>
                      <stop offset="100%" stopColor="#8b5cf6"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <h2 className="empty-title">
                {tasks.length === 0 
                  ? 'No tasks yet'
                  : 'No tasks match your filters'
                }
              </h2>
              <p className="empty-description">
                {tasks.length === 0
                  ? 'Get started by creating your first task. Stay organized and achieve your goals one step at a time.'
                  : 'Try adjusting your search query or filters to find what you\'re looking for.'
                }
              </p>
              <div className="empty-actions">
                {tasks.length === 0 ? (
                  <>
                    <button onClick={() => setShowAddForm(true)} className="btn-primary-large">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 5v10M5 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Create Your First Task
                    </button>
                    <button className="btn-secondary" onClick={seedSampleTasks} disabled={loading}>
                      Add Sample Tasks
                    </button>
                  </>
                ) : (
                  <button onClick={() => {
                    setSearchQuery('')
                    setFilter('all')
                    setSelectedCategory('all')
                  }} className="btn-secondary">
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="task-table">
                <div className="task-table-header">
                  <div className="col-status"></div>
                  <div className="col-task">Task</div>
                  <div className="col-category">Category</div>
                  <div className="col-priority">Priority</div>
                  <div className="col-due">Due Date</div>
                  <div className="col-actions">Actions</div>
                </div>
                {filteredAndSortedTasks.map(task => (
                  <div key={task.id} className={`task-row ${task.done ? 'task-row-done' : ''}`}>
                    <div className="col-status">
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => toggleTask(task.id)}
                        className="task-checkbox"
                        disabled={loading}
                      />
                    </div>
                    <div className="col-task">
                      <div className="task-title">{task.text}</div>
                      {task.description && <div className="task-description">{task.description}</div>}
                    </div>
                    <div className="col-category">
                      <span className="badge badge-category">
                        {getCategoryIcon(task.category)} {task.category}
                      </span>
                    </div>
                    <div className="col-priority">
                      <span className={`badge badge-priority badge-${task.priority}`}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="col-due">
                      {task.due_date || task.due_at ? (
                        <span className={isOverdue(task.due_date, task.due_at) ? 'due-date-overdue' : 'due-date'}>
                          {task.due_at
                            ? new Date(task.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : new Date(task.due_date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {task.due_at ? ` • ${formatDueTime(task.due_at)}` : ""}
                        </span>
                      ) : (
                        <span className="due-date-none">—</span>
                      )}
                    </div>
                    <div className="col-actions">
                      <button onClick={() => setEditingTask(task)} className="action-btn" title="Edit task" disabled={loading}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M11.333 2A1.886 1.886 0 0114 4.667L4.667 14H2v-2.667L11.333 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button onClick={() => deleteTask(task.id)} className="action-btn action-btn-danger" title="Delete task" disabled={loading}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="table-footer">
                Showing {filteredAndSortedTasks.length} of {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Success Toast */}
      {successMessage && (
        <div className="toast toast-success">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M16.667 5L7.5 14.167 3.333 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="toast-close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="toast toast-error">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM10 6v4M10 14h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="toast-close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Task</h2>
              <button onClick={() => setShowAddForm(false)} className="modal-close">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <form onSubmit={addTask} className="modal-form">
              <div className="form-group">
                <label>Task Title</label>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="What needs to be done?"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Description <span className="label-optional">(Optional)</span></label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add more details..."
                  rows={3}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value as Priority)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={selectedCategory === "all" ? "general" : selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as Category)}>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="form-group">
                  <label>Due Time</label>
                  <input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAddForm(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="modal-overlay" onClick={() => setEditingTask(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Task</h2>
              <button onClick={() => setEditingTask(null)} className="modal-close">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault()
              const form = e.target as HTMLFormElement
              const formData = new FormData(form)
              updateTask(editingTask.id, {
                text: formData.get('text') as string,
                description: formData.get('description') as string || undefined,
                priority: formData.get('priority') as Priority,
                category: formData.get('category') as Category,
                due_date: formData.get('due_date') as string || undefined,
                due_at: buildDueAtIso(
                  formData.get('due_date') as string,
                  formData.get('due_time') as string
                )
              })
            }} className="modal-form">
              <div className="form-group">
                <label>Task Title</label>
                <input name="text" defaultValue={editingTask.text} required />
              </div>
              <div className="form-group">
                <label>Description <span className="label-optional">(Optional)</span></label>
                <textarea name="description" defaultValue={editingTask.description} rows={3} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select name="priority" defaultValue={editingTask.priority}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select name="category" defaultValue={editingTask.category}>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input name="due_date" type="date" defaultValue={editingTask.due_date} />
                </div>
                <div className="form-group">
                  <label>Due Time</label>
                  <input
                    name="due_time"
                    type="time"
                    defaultValue={toTimeInput(editingTask.due_at)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setEditingTask(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
