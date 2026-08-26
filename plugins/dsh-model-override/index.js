/**
 * dsh-model-override — override the DSH default model via DSH_MODEL env var.
 *
 * MIT License — see LICENSE.
 *
 * Format: DSH_MODEL=provider/model[@effort]
 *   effort is passed through to the adapter as-is; if the adapter doesn't
 *   support effort for that model, it ignores or errors on its own.
 *
 *   We use "@" not ":" because some model ids contain ":" (e.g.
 *   poolside/laguna-s-2.1:free). "#" is also unusable (shell comment).
 *
 *   When no effort is specified, reasoningEffort is NOT carried over from
 *   the default model — the adapter picks its own default for the new model.
 */

export const name = "dsh-model-override"
export const inject = ["agentDefaultModel"]

function parseModelEnv() {
  const raw = process.env.DSH_MODEL
  if (!raw || raw.trim().length === 0) return null

  const trimmed = raw.trim()
  const slashIndex = trimmed.indexOf("/")
  if (slashIndex <= 0) {
    console.error(
      "dsh-model-override: DSH_MODEL=\"" + trimmed + "\" has no \"/\" separator; expected provider/model — ignoring"
    )
    return null
  }

  const provider = trimmed.slice(0, slashIndex)
  let rest = trimmed.slice(slashIndex + 1)

  // Split off optional trailing "@effort"
  let reasoningEffort = undefined
  const atIndex = rest.indexOf("@")
  if (atIndex > 0 && atIndex < rest.length - 1) {
    reasoningEffort = rest.slice(atIndex + 1)
    rest = rest.slice(0, atIndex)
  }

  const model = rest

  if (!provider || !model) {
    console.error(
      "dsh-model-override: DSH_MODEL=\"" + trimmed + "\" has empty provider or model — ignoring"
    )
    return null
  }

  return { provider, model, reasoningEffort }
}

export function apply(ctx) {
  const override = parseModelEnv()
  if (!override) return

  const { provider, model, reasoningEffort } = override
  const svc = ctx.agentDefaultModel
  const original = svc.currentSelection.bind(svc)

  svc.currentSelection = () => {
    // Start clean — don't inherit anything from the default model.
    const result = { provider, model }
    // Only set effort when explicitly specified
    if (reasoningEffort !== undefined) {
      result.reasoningEffort = reasoningEffort
    }
    return result
  }

  const effortStr = reasoningEffort ? " (effort: " + reasoningEffort + ")" : ""
  console.error(
    "dsh-model-override: default model overridden to " + provider + "/" + model + effortStr
  )
}
