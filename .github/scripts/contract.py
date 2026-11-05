#!/usr/bin/env python3
"""Live API contract check for the Null's scripting service.

The app and the web catalog depend on the shape of the public scripting API.
When the service renames a field (``uuid`` -> ``user_id``/``script_id`` happened
once already) every client breaks silently. This script probes the endpoints the
clients actually use, compares the observed field names with a committed
baseline and writes a short report.

Exit code 0 - everything matches the baseline.
Exit code 1 - an endpoint failed or its shape changed; the workflow opens an issue.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "list.txt"
BASELINE = ROOT / ".github" / "api-contract.json"
REPORT = ROOT / "contract-report.md"
API = "https://scripting.nulls.gg/api"
USER_AGENT = "Script-Library/1.7.23 (+https://github.com/Patrick-9936/nb-scripts-authors)"
UUID = re.compile(r"^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$")
ENTRY = re.compile(r"^\s*\d+\.\s*(\S+)\s*$")
TIMEOUT = 25


class Probe:
    def __init__(self) -> None:
        self.problems: list[str] = []
        self.observed: dict[str, list[str]] = {}
        self.notes: list[str] = []

    def fail(self, message: str) -> None:
        self.problems.append(message)

    def note(self, message: str) -> None:
        self.notes.append(message)

    def request(self, path: str, method: str = "GET", body: dict | None = None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(
            API + path,
            data=data,
            method=method,
            headers={
            "accept": "application/json",
            "content-type": "application/json",
            "user-agent": USER_AGENT,
        },
        )
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                payload = response.read().decode("utf-8", "replace")
                return response.status, (json.loads(payload) if payload.strip() else {})
        except urllib.error.HTTPError as error:
            payload = error.read().decode("utf-8", "replace")
            try:
                parsed = json.loads(payload) if payload.strip() else {}
            except json.JSONDecodeError:
                parsed = {"error": payload[:200]}
            return error.code, parsed
        except (urllib.error.URLError, TimeoutError) as error:
            return 0, {"error": str(error)}

    def shape(self, label: str, payload, sample=None) -> None:
        """Record the top-level field names of a response."""
        if not isinstance(payload, dict):
            self.fail(f"{label}: ожидался объект, получено {type(payload).__name__}")
            return
        keys = sorted(payload.keys())
        self.observed[label] = keys
        if sample is not None:
            self.observed[label + " []"] = sample


def registry_entries() -> list[str]:
    entries = []
    for line in REGISTRY.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        match = ENTRY.match(line)
        if not match:
            raise SystemExit(f"Некорректная строка в list.txt: {line!r}")
        entries.append(match.group(1))
    return entries


def author_path(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    segments = [segment for segment in parsed.path.split("/") if segment]
    if not segments:
        raise ValueError(f"нет профиля в {url}")
    last = segments[-1]
    if UUID.match(last):
        return f"/users/{last.lower()}"
    return f"/users/@{urllib.parse.quote(last.lstrip('@'))}"


def main() -> int:
    probe = Probe()
    entries = registry_entries()
    probe.note(f"Записей в list.txt: {len(entries)}")

    resolved: list[tuple[str, str]] = []
    for url in entries:
        try:
            path = author_path(url)
        except ValueError as error:
            probe.fail(f"{url}: {error}")
            continue
        status, payload = probe.request(path)
        if status != 200:
            probe.fail(f"GET {path} -> {status} {payload.get('error', '')}")
            continue
        uuid = str(payload.get("user_id") or payload.get("uuid") or "")
        if not UUID.match(uuid):
            probe.fail(f"GET {path}: нет корректного user_id/uuid в ответе {sorted(payload.keys())}")
            continue
        resolved.append((url, uuid.lower()))
        probe.shape("GET /users/{handle|uuid}", payload)

    if not resolved:
        probe.fail("Ни один автор из list.txt не разрешился")

    script_id = None
    for url, uuid in resolved:
        status, payload = probe.request(f"/users/{uuid}/scripts")
        if status != 200 or not isinstance(payload.get("scripts"), list):
            probe.fail(f"GET /users/{{id}}/scripts -> {status}")
            continue
        probe.shape("GET /users/{id}/scripts", payload)
        scripts = payload["scripts"]
        if scripts and isinstance(scripts[0], dict):
            probe.observed["GET /users/{id}/scripts []"] = sorted(scripts[0].keys())
        for item in scripts:
            if isinstance(item, dict) and item.get("published_at"):
                candidate = str(item.get("script_id") or item.get("uuid") or "")
                if UUID.match(candidate):
                    script_id = candidate
                    break
        if script_id:
            break

    if not script_id:
        probe.fail("Не найден ни один опубликованный скрипт для проверки")
    else:
        status, payload = probe.request(f"/scripts/{script_id}")
        if status != 200:
            probe.fail(f"GET /scripts/{{id}} -> {status} {payload.get('error', '')}")
        else:
            probe.shape("GET /scripts/{id}", payload)
            if not (payload.get("script_id") or payload.get("uuid")):
                probe.fail("GET /scripts/{id}: в ответе нет script_id/uuid")

        status, payload = probe.request(f"/scripts/{script_id}/parameters")
        if status != 200 or not isinstance(payload.get("parameters"), list):
            probe.fail(f"GET /scripts/{{id}}/parameters -> {status}")
        else:
            probe.shape("GET /scripts/{id}/parameters", payload)
            parameters = payload["parameters"]
            if not parameters or not isinstance(parameters[0], dict):
                probe.fail("GET /scripts/{id}/parameters: пустой список параметров")
            else:
                probe.observed["GET /scripts/{id}/parameters []"] = sorted(parameters[0].keys())
                if len(parameters) < 32:
                    probe.fail(f"Параметров боя меньше 32: {len(parameters)}")

        status, payload = probe.request(f"/scripts/{script_id}/share", "POST", {})
        if status != 200:
            probe.fail(f"POST /scripts/{{id}}/share -> {status} {payload.get('error', '')}")
        else:
            probe.shape("POST /scripts/{id}/share", payload)
            if not payload.get("token"):
                probe.fail("POST /scripts/{id}/share: нет token в ответе")

    baseline = {}
    if BASELINE.exists():
        try:
            baseline = json.loads(BASELINE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            probe.fail("Базовый файл .github/api-contract.json повреждён")

    if "--write-baseline" in sys.argv:
        BASELINE.parent.mkdir(parents=True, exist_ok=True)
        BASELINE.write_text(
            json.dumps(
                {
                    "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "endpoints": probe.observed,
                },
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
        print(f"Базовый файл обновлён: {BASELINE}")
        return 0

    previous = baseline.get("endpoints", {})
    changes: list[str] = []
    for label, keys in sorted(probe.observed.items()):
        if label not in previous:
            changes.append(f"новый эндпоинт/поля: {label} -> {keys}")
            continue
        added = sorted(set(keys) - set(previous[label]))
        removed = sorted(set(previous[label]) - set(keys))
        if added:
            changes.append(f"{label}: появились поля {added}")
        if removed:
            changes.append(f"{label}: пропали поля {removed}")

    lines = [
        "# Проверка контракта API",
        "",
        f"Время: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        f"Проверено авторов: {len(resolved)} из {len(entries)}",
        "",
    ]
    if probe.notes:
        lines += ["## Заметки", ""] + [f"- {note}" for note in probe.notes] + [""]
    if changes:
        lines += ["## Изменения схемы", ""] + [f"- {change}" for change in changes] + [""]
    if probe.problems:
        lines += ["## Ошибки", ""] + [f"- {problem}" for problem in probe.problems] + [""]
    if not changes and not probe.problems:
        lines += ["Схема совпадает с базовой, ошибок нет.", ""]
    REPORT.write_text("\n".join(lines), encoding="utf-8")

    print("\n".join(lines))
    if probe.problems:
        print(f"\nОшибок: {len(probe.problems)}", file=sys.stderr)
        return 1
    if changes:
        print(f"\nИзменений схемы: {len(changes)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
