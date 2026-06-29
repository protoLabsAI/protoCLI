# Cron Scheduling (`cron_create`, `cron_list`, `cron_delete`)

Schedule prompts to be enqueued at future times. Supports both one-shot reminders and recurring schedules using standard cron expressions.

## `cron_create`

Creates a new cron job.

| Parameter   | Required | Description                                                           |
| ----------- | -------- | --------------------------------------------------------------------- |
| `cron`      | Yes      | Standard 5-field cron expression in local time (e.g. `"*/5 * * * *"`) |
| `prompt`    | Yes      | The prompt to enqueue at each fire time                               |
| `recurring` | No       | `true` (default) for recurring, `false` for one-shot                  |

### Cron expression format

Standard 5-field cron: `minute hour day-of-month month day-of-week`.

- `*/5 * * * *` — every 5 minutes
- `0 9 * * *` — every day at 9am
- `30 14 28 2 *` — Feb 28 at 2:30pm (one-shot with `recurring: false`)

### One-shot vs recurring

- **One-shot** (`recurring: false`): fires once at the next match, then auto-deletes. Use for "remind me at X" requests.
- **Recurring** (default): fires on every cron match until deleted or auto-expired after 3 days.

### Runtime behavior

- Jobs only fire while the REPL is idle (not mid-query).
- Jobs persist across sessions and are saved to disk.
- Recurring jobs auto-expire after 3 days.

## `cron_list`

Lists all active cron jobs scheduled via `cron_create` in the current session. No parameters required.

## `cron_delete`

Cancels a cron job by ID. Removes it from the session store.

| Parameter | Required | Description                      |
| --------- | -------- | -------------------------------- |
| `id`      | Yes      | Job ID returned by `cron_create` |

## Slash command

The `/loop` command provides an interactive interface for scheduling recurring prompts. See [Reference → Commands](../commands) for details.

## See Also

- [Guides → Schedule Prompts](../../guides/scheduled-tasks) — Setup and usage examples
