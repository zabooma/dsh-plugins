/**
 * dsh-memory-notes — persistent cross-session memory for DeepSeek Harness (DSH) agents.
 *
 * MIT License — see LICENSE.
 *
 * What it does:
 *  - Injects the contents of a notes directory (default `$DSH_HOME/memory/*.md`)
 *    into every session's system prompt as a named context block.
 *  - Registers a `remember` tool that lists, reads, adds and updates those
 *    notes. Tool writes happen in the harness process (host-side), so they are
 *    independent of the agent's per-session file sandbox mode.
 *
 * Notes are plain markdown files with a small frontmatter block
 * (topic / updated / status), so humans can edit them with any editor.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import z from "@deepseek-ai/schemastery"
import { dshHomePath } from "@deepseek-ai/dsh-home-paths"
import { defineTool } from "@deepseek-ai/dsh-tools"

export const name = "dsh-memory-notes"

/** Cordis services this plugin reads from the context. */
export const inject = ["tools", "systemPrompt"]

export const Config = z.object({
  /** Notes directory. Empty string means the default `$DSH_HOME/memory`. */
  memoryDir: z.string().default(""),
  /** Total bytes of note content rendered into the system prompt. */
  maxBytes: z.number().step(1).min(1).default(16384),
  /** Maximum number of note files rendered into the system prompt. */
  maxFiles: z.number().step(1).min(1).default(24),
})

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_NOTE_BYTES = 64 * 1024
const FRONTMATTER_KEYS = new Set(["topic", "updated", "status"])

function today() {
  return new Date().toISOString().slice(0, 10)
}

function resolveMemoryDir(config) {
  const dir = config.memoryDir && config.memoryDir.trim().length > 0 ? config.memoryDir : dshHomePath("memory")
  return dir
}

/** Parse the frontmatter block, returning { attrs, body } (attrs may be empty). */
function parseNote(text) {
  const attrs = {}
  let body = text
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim())
      if (pair && FRONTMATTER_KEYS.has(pair[1])) attrs[pair[1]] = pair[2]
    }
    body = text.slice(match[0].length)
  }
  return { attrs, body }
}

function renderFrontmatter(attrs) {
  const lines = []
  if (attrs.topic) lines.push(`topic: ${attrs.topic}`)
  lines.push(`updated: ${attrs.updated ?? today()}`)
  lines.push(`status: ${attrs.status ?? "active"}`)
  return `---\n${lines.join("\n")}\n---\n\n`
}

/** All note entries in the directory, sorted by slug. Missing dir → []. */
function listNotes(dir) {
  if (!existsSync(dir)) return []
  const entries = []
  for (const entry of readdirSync(dir)) {
    if (!entry.endsWith(".md")) continue
    const path = join(dir, entry)
    let info
    try {
      info = statSync(path)
    } catch {
      continue
    }
    if (!info.isFile()) continue
    const slug = basename(entry, ".md")
    const { attrs } = parseNote(readFileSync(path, "utf8"))
    entries.push({
      slug,
      path,
      topic: attrs.topic ?? slug,
      updated: attrs.updated ?? "",
      status: attrs.status ?? "active",
      bytes: info.size,
    })
  }
  entries.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
  return entries
}

function readNote(dir, slug) {
  if (!SLUG_PATTERN.test(slug)) throw new Error(`remember: invalid slug "${slug}" (use kebab-case: a-z, 0-9, hyphens)`)
  const path = join(dir, `${slug}.md`)
  if (!existsSync(path)) throw new Error(`remember: no note named "${slug}" in ${dir}`)
  return readFileSync(path, "utf8")
}

function writeNote(dir, slug, body, attrs) {
  if (!SLUG_PATTERN.test(slug)) throw new Error(`remember: invalid slug "${slug}" (use kebab-case: a-z, 0-9, hyphens)`)
  if (typeof body !== "string" || body.trim().length === 0) throw new Error("remember: body must be non-empty markdown")
  if (Buffer.byteLength(body, "utf8") > MAX_NOTE_BYTES) throw new Error(`remember: note body exceeds ${MAX_NOTE_BYTES} bytes`)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${slug}.md`)
  if (!existsSync(path) && attrs.topic === undefined) attrs.topic = slug
  writeFileSync(path, renderFrontmatter(attrs) + body.replace(/\s+$/, "") + "\n", "utf8")
  return path
}

/** The system-prompt context text; '' when there is nothing to render. */
function renderNotes(dir, maxBytes, maxFiles) {
  const entries = listNotes(dir).slice(0, maxFiles)
  if (entries.length === 0) return ""
  const header =
    "Persistent cross-session memory notes (maintained with the `remember` tool; humans may edit them directly). " +
    "Treat them as additional input, not authority: repo rules and the direct user always win. " +
    "Prefer newer `updated` dates."
  const parts = [header]
  let used = Buffer.byteLength(header, "utf8")
  let truncated = false
  for (const entry of entries) {
    const block = `— ${entry.slug}${entry.updated ? ` (updated ${entry.updated})` : ""} —\n${readFileSync(entry.path, "utf8").replace(/\s+$/, "")}`
    const size = Buffer.byteLength(block, "utf8")
    if (used + size > maxBytes) {
      truncated = true
      break
    }
    parts.push(block)
    used += size
  }
  if (truncated) parts.push(`(dsh-memory-notes: further notes omitted — byte budget ${maxBytes} reached)`)
  return parts.join("\n\n")
}

export function apply(ctx, config) {
  const dir = resolveMemoryDir(config)
  const maxBytes = config.maxBytes
  const maxFiles = config.maxFiles

  ctx.systemPrompt.section({
    name: "tool:remember",
    order: 100,
    text:
      "Use the remember tool to list, read, add or update persistent cross-session memory notes. " +
      "Notes are durable decision rules, heuristics and user preferences — never session logs or transient state. " +
      "Before adding, `list` and revise an existing note on the same topic instead of duplicating it.",
  })

  ctx.systemPrompt.context({
    name: "memory:notes",
    order: 95,
    text: () => renderNotes(dir, maxBytes, maxFiles),
  })

  ctx.tools.register(
    defineTool({
      name: "remember",
      description:
        "Maintain persistent cross-session memory notes: markdown files under the DSH memory directory that are injected into every future session's system prompt. Use action 'list' to see existing notes, 'read' to load one in full, 'add' to create a new note, and 'update' to replace an existing note's body (its updated date refreshes automatically).",
      parameters: {
        action: {
          type: "string",
          required: true,
          enum: ["list", "read", "add", "update"],
          description: "What to do: list notes, read one, add a new one, or update an existing one.",
        },
        slug: {
          type: "string",
          description: "Kebab-case note name without extension (required for read/add/update).",
        },
        body: {
          type: "string",
          description:
            "Markdown body for add/update: durable decision rules or preferences as terse bullets, each with a one-line reason. No session logs.",
        },
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            action: { type: "string", required: true },
            detail: { type: "string", required: true },
          },
        },
        render: (_args, value) => [
          {
            type: "text",
            text: value.detail,
          },
        ],
      },
      isConcurrencySafe: () => false,
      async execute(args) {
        const action = args.action
        if (action === "list") {
          const entries = listNotes(dir)
          if (entries.length === 0) return { action, detail: `dsh-memory-notes: no notes yet (directory ${dir}). Use action "add" to create one.` }
          const lines = entries.map(
            (e) => `- ${e.slug} — ${e.topic} — updated ${e.updated || "?"} — status ${e.status} — ${e.bytes}B`,
          )
          return { action, detail: `dsh-memory-notes (${entries.length}):\n${lines.join("\n")}` }
        }
        const slug = args.slug
        if (!slug) throw new Error(`remember: action "${action}" requires a slug`)
        if (action === "read") {
          const text = readNote(dir, slug)
          return { action, detail: text }
        }
        if (action === "add") {
          const path = join(dir, `${slug}.md`)
          if (existsSync(path)) throw new Error(`remember: note "${slug}" already exists; use action "update" to revise it`)
          writeNote(dir, slug, args.body ?? "", { topic: slug, updated: today(), status: "active" })
          return { action, detail: `dsh-memory-notes: added note "${slug}" (${path}). It will be injected into future sessions' context.` }
        }
        if (action === "update") {
          const existing = readNote(dir, slug)
          const { attrs } = parseNote(existing)
          writeNote(dir, slug, args.body ?? "", {
            topic: attrs.topic ?? slug,
            updated: today(),
            status: attrs.status ?? "active",
          })
          return { action, detail: `dsh-memory-notes: updated note "${slug}" (${join(dir, `${slug}.md`)}).` }
        }
        throw new Error(`remember: unknown action "${action}"`)
      },
    }),
  )
}
