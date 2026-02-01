const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export type Task = {
  id: string;
  text: string;
  done: boolean;
  priority: "low" | "medium" | "high";
  dueDate?: string;
  createdAt: number;
};

export async function register(email: string, password: string): Promise<{
  token: string;
  user: { email: string };
}> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Registration failed");
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<{
  token: string;
  user: { email: string };
}> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Login failed");
  }
  return res.json();
}

/* =======================
   READ
======================= */
export async function getTasks(): Promise<Task[]> {
  const res = await fetch(`${API_URL}/tasks`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    throw new Error("Failed to fetch tasks");
  }
  return res.json();
}

/* =======================
   CREATE
======================= */
export async function createTask(
  data: { text: string; priority: "low" | "medium" | "high"; dueDate?: string }
): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to create task");
  }
  return res.json();
}

/* =======================
   UPDATE
   (NOTE: dueDate CAN be null)
======================= */
export type TaskUpdate = Partial<
  Pick<Task, "text" | "done" | "priority">
> & {
  dueDate?: string | null;
};

export async function updateTask(
  id: string,
  data: Partial<Task>
): Promise<Task> {
  const res = await fetch(`${API_URL}/tasks/${id}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    throw new Error("Failed to update task");
  }
  return res.json();
}

/* =======================
   DELETE
======================= */
export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/tasks/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    throw new Error("Failed to delete task");
  }
}
