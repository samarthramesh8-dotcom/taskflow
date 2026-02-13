const API_URL = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, "") || "";

function requireApiUrl(): string {
  if (API_URL) {
    return API_URL;
  }
  const isLocal =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  if (import.meta.env.DEV || isLocal) {
    return "";
  }
  throw new Error("VITE_API_URL is required");
}

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
  dueAt?: string;
  createdAt: number;
};

export async function register(email: string, password: string): Promise<{
  token: string;
  user: { email: string };
}> {
  const baseUrl = requireApiUrl();
  const res = await fetch(`${baseUrl}/auth/register`, {
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
  const baseUrl = requireApiUrl();
  const res = await fetch(`${baseUrl}/auth/login`, {
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
  const baseUrl = requireApiUrl();
  const res = await fetch(`${baseUrl}/tasks`, {
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
  const baseUrl = requireApiUrl();
  const res = await fetch(`${baseUrl}/tasks`, {
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
  const baseUrl = requireApiUrl();
  const res = await fetch(`${baseUrl}/tasks/${id}`, {
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
  const baseUrl = requireApiUrl();
  const res = await fetch(`${baseUrl}/tasks/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    throw new Error("Failed to delete task");
  }
}
