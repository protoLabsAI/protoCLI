"""bench_mcp — Terminal-bench helper MCP server.

Gives proto agents mid-task access to task specs, live verifier feedback,
and verifier import analysis. Runs on host at port 8400, reachable from
eval containers via http://192.168.4.195:8400/sse.
"""

import ast
import subprocess
import tomllib
from pathlib import Path

from fastmcp import FastMCP

CACHE_ROOT = Path.home() / ".cache/harbor/tasks/packages/terminal-bench"
PORT = 8400

mcp = FastMCP("bench-mcp")


def _find_task_dir(task_name: str) -> Path:
    """Resolve short or qualified task name to its cached hash directory."""
    short = task_name.split("/")[-1]  # strip "terminal-bench/" prefix if present
    candidates = list(CACHE_ROOT.glob(f"{short}/*/task.toml"))
    if not candidates:
        available = sorted(p.parent.parent.name for p in CACHE_ROOT.glob("*/*/task.toml"))
        raise FileNotFoundError(
            f"No cached task found for {task_name!r}. "
            f"Available tasks: {available[:10]}"
        )
    return candidates[0].parent


@mcp.tool()
def get_task_spec(task_name: str) -> dict:
    """Return the task spec (task.toml) and all test file contents.

    Call this first to understand exactly what the verifier checks and
    which libraries/functions it uses before writing your solution.

    Args:
        task_name: Short name like "fix-git" or qualified "terminal-bench/fix-git"
    """
    task_dir = _find_task_dir(task_name)

    with open(task_dir / "task.toml", "rb") as f:
        spec = tomllib.load(f)

    instruction = ""
    if (task_dir / "instruction.md").exists():
        instruction = (task_dir / "instruction.md").read_text()

    tests: dict[str, str] = {}
    tests_dir = task_dir / "tests"
    if tests_dir.exists():
        for test_file in sorted(tests_dir.iterdir()):
            if test_file.is_file():
                try:
                    tests[test_file.name] = test_file.read_text(errors="replace")
                except PermissionError:
                    tests[test_file.name] = "<permission denied>"

    return {
        "task_name": task_name,
        "spec": spec,
        "instruction": instruction,
        "tests": tests,
    }


@mcp.tool()
def run_verifier(container_id: str) -> dict:
    """Run the verifier tests against current /app state inside the container.

    Use this before claiming the task is complete. The results tell you
    exactly which assertions pass or fail so you can fix remaining issues.

    Args:
        container_id: The 12-char hex string returned by `hostname` inside the container.
    """
    cmd = (
        "python3 -m pytest /tests/test_outputs.py -v --tb=short 2>&1"
        " || "
        "(which uvx >/dev/null 2>&1 && uvx -p 3.13 pytest /tests/test_outputs.py -v --tb=short 2>&1)"
    )
    try:
        result = subprocess.run(
            ["docker", "exec", container_id, "bash", "-c", cmd],
            capture_output=True,
            text=True,
            timeout=90,
        )
        output = (result.stdout + result.stderr).strip()
        # pytest exit code 0 = all passed, 1 = some failed, 2+ = error
        all_passed = result.returncode == 0
        return {
            "container_id": container_id,
            "passed": all_passed,
            "exit_code": result.returncode,
            "output": output,
        }
    except subprocess.TimeoutExpired:
        return {
            "container_id": container_id,
            "passed": False,
            "error": "Timed out after 90s",
        }
    except Exception as exc:
        return {
            "container_id": container_id,
            "passed": False,
            "error": str(exc),
        }


@mcp.tool()
def get_verifier_imports(task_name: str) -> dict:
    """Parse the verifier test files and return every import statement.

    Use this to identify exactly which library functions the verifier uses
    (e.g. oligotm vs BioPython MeltingTemp) so your solution matches them.

    Args:
        task_name: Short name like "fix-git" or qualified "terminal-bench/fix-git"
    """
    task_dir = _find_task_dir(task_name)
    imports: dict[str, list[str]] = {}

    for test_file in sorted((task_dir / "tests").glob("*.py")):
        stmts: list[str] = []
        try:
            tree = ast.parse(test_file.read_text())
        except SyntaxError as e:
            imports[test_file.name] = [f"<syntax error: {e}>"]
            continue

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    stmts.append(f"import {alias.name}")
            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                names = ", ".join(a.name for a in node.names)
                stmts.append(f"from {module} import {names}")

        imports[test_file.name] = stmts

    return {"task_name": task_name, "imports": imports}


if __name__ == "__main__":
    mcp.run(transport="sse", host="0.0.0.0", port=PORT)
