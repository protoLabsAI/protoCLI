# Keep proto working toward a goal

Set a completion condition with `/goal` and proto keeps working across turns until the condition is met. After every turn a small fast model checks the transcript against your condition; if it isn't satisfied yet, proto starts another turn instead of returning control. The goal clears automatically once the condition is met.

Use a goal for substantial work with a verifiable end state:

- Migrating a module to a new API until every call site compiles and tests pass
- Implementing a design doc until all acceptance criteria hold
- Splitting a large file into focused modules until each is under a size budget
- Working through a labeled issue backlog until the queue is empty

## Set a goal

Run `/goal` followed by the condition you want satisfied.

```
/goal all tests in test/auth pass and the lint step is clean
```

Setting a goal starts a turn immediately, with the condition itself as the directive — you do not need to send a separate prompt. While the goal is active, the evaluator's most recent reason is shown on `/goal` so you can see what proto is working toward.

> [!note]
> One goal can be active per session. Running `/goal <new condition>` replaces the previous one.

The condition can be up to 4,000 characters. To bound how long a goal runs, include a clause like `or stop after 20 turns` directly in the condition.

## Write an effective condition

The evaluator only sees what proto has surfaced in the transcript — tool calls and the final assistant message. Write the condition so that proto's own output can demonstrate it.

A good condition usually has:

- **One measurable end state**: a test result, a build exit code, a file count, an empty queue.
- **A stated check**: how proto should prove it, such as `npm test exits 0` or `git status is clean`.
- **Constraints that matter**: anything that must not change on the way there, such as `no other test file is modified`.

"All tests in `test/auth` pass" works because proto runs the tests and the result lands in the transcript for the evaluator to read. "The code is good" does not, because nothing in the transcript can prove it.

## Check status

Run `/goal` with no arguments to inspect the current state.

```
/goal
```

If a goal is active, the status shows the condition, how long it has been running, how many turns have been evaluated, the tokens spent on evaluation so far, and the evaluator's most recent reason. If no goal is active but one was achieved earlier in the session, the status shows the achieved condition along with how long it took.

## Clear a goal

Run `/goal clear` to remove an active goal before its condition is met. Any of `stop`, `off`, `reset`, `none`, and `cancel` are accepted as aliases for `clear`. Starting a new conversation with `/clear` also removes any active goal.

```
/goal clear
```

## How evaluation works

Each time the main agent finishes a turn, the condition and the conversation so far are sent to your configured content generator for a one-shot evaluator call. The evaluator returns a yes-or-no decision and a short reason. A "no" tells proto to keep working and includes the reason as guidance for the next turn; a "yes" clears the goal and records the achieved entry on `/goal`.

The evaluator does not call tools, so it can only judge what proto has already surfaced in the conversation. If the evaluator can't tell from the transcript, treat it as "no" and ask for the missing evidence.

## How `/goal` differs from `/loop`

| Trigger for next turn | `/goal`                                     | `/loop`                                          |
| --------------------- | ------------------------------------------- | ------------------------------------------------ |
| When it fires         | Previous turn ends                          | A time interval elapses                          |
| When it stops         | The evaluator confirms the condition is met | You cancel it, or proto decides the work is done |
| Best for              | Verifiable end states                       | Polling / babysitting on a cadence               |

See [Schedule prompts](./scheduled-tasks.md) for `/loop`.

## See also

- [Schedule prompts](./scheduled-tasks.md) — re-run a prompt on a time interval
- [Use hooks](./use-hooks.md) — write your own Stop hook when you need custom evaluation logic
