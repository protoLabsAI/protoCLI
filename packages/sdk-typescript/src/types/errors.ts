/**
 * Typed error variants thrown by the SDK. Each is a regular `Error`
 * subclass with a stable `name` field so consumers can route on it
 * across module boundaries (instanceof can be unreliable when multiple
 * SDK copies are loaded).
 *
 * Programming bugs (invalid arg shape, double-iteration of a stream,
 * etc.) intentionally stay as plain `Error` — the typed variants here
 * are for runtime conditions a caller might want to handle differently
 * (e.g. retry, surface to user, fall back).
 */

export class AbortError extends Error {
  constructor(message = 'Operation aborted') {
    super(message);
    this.name = 'AbortError';
    Object.setPrototypeOf(this, AbortError.prototype);
  }
}

export function isAbortError(error: unknown): error is AbortError {
  return matchesName(error, 'AbortError');
}

/**
 * The SDK could not locate the proto CLI binary on disk. Usually means
 * the package is installed wrong, the consumer is running from a
 * directory the SDK can't resolve from, or `pathToQwenExecutable` was
 * given but points at nothing.
 */
export class CliNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliNotFoundError';
    Object.setPrototypeOf(this, CliNotFoundError.prototype);
  }
}

export function isCliNotFoundError(error: unknown): error is CliNotFoundError {
  return matchesName(error, 'CliNotFoundError');
}

/**
 * The CLI subprocess started but exited (or failed to become ready)
 * before the first message was exchanged. This is the surface the SDK
 * sees when the CLI itself crashes during startup — bad settings,
 * missing auth, unsupported platform. Carries the exit code if known.
 */
export class CliInitError extends Error {
  readonly exitCode: number | null;
  readonly stderr: string | undefined;

  constructor(
    message: string,
    options: { exitCode?: number | null; stderr?: string } = {},
  ) {
    super(message);
    this.name = 'CliInitError';
    this.exitCode = options.exitCode ?? null;
    this.stderr = options.stderr;
    Object.setPrototypeOf(this, CliInitError.prototype);
  }
}

export function isCliInitError(error: unknown): error is CliInitError {
  return matchesName(error, 'CliInitError');
}

/**
 * An already-running CLI subprocess died, was killed, or its stdio
 * stream became unusable mid-session. Distinct from `CliInitError`,
 * which fires before the session is established.
 */
export class TransportError extends Error {
  readonly exitCode: number | null;

  constructor(message: string, options: { exitCode?: number | null } = {}) {
    super(message);
    this.name = 'TransportError';
    this.exitCode = options.exitCode ?? null;
    Object.setPrototypeOf(this, TransportError.prototype);
  }
}

export function isTransportError(error: unknown): error is TransportError {
  return matchesName(error, 'TransportError');
}

/**
 * The CLI's stdin stream is closed, so we can't deliver more input.
 * Usually means the CLI exited cleanly while we still had pending
 * writes; not always recoverable, but distinguishable from a hard
 * transport failure.
 */
export class InputClosedError extends Error {
  constructor(message = 'Input stream closed') {
    super(message);
    this.name = 'InputClosedError';
    Object.setPrototypeOf(this, InputClosedError.prototype);
  }
}

export function isInputClosedError(error: unknown): error is InputClosedError {
  return matchesName(error, 'InputClosedError');
}

function matchesName(error: unknown, name: string): boolean {
  return (
    error instanceof Error && 'name' in error && (error as Error).name === name
  );
}
