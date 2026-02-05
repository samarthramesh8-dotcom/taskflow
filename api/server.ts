// server.ts
import "dotenv/config"
import express from "express"
import cors from "cors"
import { Pool } from "pg"
import { randomUUID } from "crypto"
// @ts-ignore
import authRoutes from "../../server/auth.js"

const app = express()

// CORS:
// Set FRONTEND_ORIGIN in Render like:
// FRONTEND_ORIGIN=https://your-vercel-app.vercel.app
// or multiple:
// FRONTEND_ORIGIN=http://localhost:5173,https://your-vercel-app.vercel.app
const originEnv = process.env.FRONTEND_ORIGIN?.trim()
const allowedOrigins = originEnv
  ? originEnv.split(",").map((s) => s.trim()).filter(Boolean)
  : null

app.use(
  cors(
    allowedOrigins
      ? { origin: allowedOrigins }
      : undefined // if not set, allow all (good for early debugging)
  )
)

app.use(express.json())

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1")
    res.json({ ok: true })
  } catch {
    res.status(500).json({ ok: false, error: "db not reachable" })
  }
})

app.get("/tasks", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        text,
        done,
        priority,
        due_date AS "dueDate",
        EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt"
      FROM tasks
      ORDER BY created_at DESC
    `)
    res.json(rows)
  } catch {
    res.status(500).json({ error: "failed to fetch tasks" })
  }
})

app.post("/tasks", async (req, res) => {
  try {
    const { text, priority, dueDate } = req.body as {
      text?: string
      priority?: "low" | "medium" | "high"
      dueDate?: string
    }

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "text required" })
    }

    const id = randomUUID()

    const { rows } = await pool.query(
      `
      INSERT INTO tasks (id, text, priority, due_date)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        text,
        done,
        priority,
        due_date AS "dueDate",
        EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt"
      `,
      [id, text.trim(), priority ?? "medium", dueDate ? new Date(dueDate) : null]
    )

    res.status(201).json(rows[0])
  } catch {
    res.status(500).json({ error: "failed to create task" })
  }
})

app.put("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params
    const { text, done, priority, dueDate } = req.body as {
      text?: string
      done?: boolean
      priority?: "low" | "medium" | "high"
      dueDate?: string | null
    }

    const fields: string[] = []
    const values: any[] = []
    let i = 1

    if (typeof text === "string") {
      fields.push(`text = $${i++}`)
      values.push(text.trim())
    }
    if (typeof done === "boolean") {
      fields.push(`done = $${i++}`)
      values.push(done)
    }
    if (typeof priority === "string") {
      fields.push(`priority = $${i++}`)
      values.push(priority)
    }
    if (dueDate === null) {
      fields.push(`due_date = NULL`)
    } else if (typeof dueDate === "string") {
      fields.push(`due_date = $${i++}`)
      values.push(new Date(dueDate))
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "no fields to update" })
    }

    fields.push(`updated_at = NOW()`)
    values.push(id)

    const { rows } = await pool.query(
      `
      UPDATE tasks
      SET ${fields.join(", ")}
      WHERE id = $${i}
      RETURNING
        id,
        text,
        done,
        priority,
        due_date AS "dueDate",
        EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt"
      `,
      values
    )

    if (!rows[0]) {
      return res.status(404).json({ error: "not found" })
    }

    res.json(rows[0])
  } catch {
    res.status(500).json({ error: "failed to update task" })
  }
})

app.delete("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params
    const result = await pool.query(`DELETE FROM tasks WHERE id = $1`, [id])

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "not found" })
    }

    res.status(204).send()
  } catch {
    res.status(500).json({ error: "failed to delete task" })
  }
})

app.use("/auth", authRoutes)
app.use("/api/auth", authRoutes)

const port = Number(process.env.PORT || 4000)
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`)
})
