#!/usr/bin/env python3
"""Author registry helper for list.txt.

The registry is a plain text file with one author per line in the form
``N. <profile-url>`` separated by blank lines. Both the Android app and the
web catalog read it, so this script keeps the format stable and validates every
entry against the live scripting API before it is committed.

Usage:
    authors.py list
    authors.py validate
    authors.py add    <url-or-handle>
    authors.py remove <url-or-handle-or-index>
    authors.py edit   <url-or-handle-or-index> <new-url-or-handle>
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "list.txt"
API = "https://scripting.nulls.gg/api"
USER_AGENT = "Script-Library/1.7.23 (+https://github.com/Patrick-9936/nb-scripts-authors)"
HOSTS = ("scripting.nulls.gg", "scripting.donutquine.dev")
UUID = re.compile(r"^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$")
HANDLE = re.compile(r"^[A-Za-z0-9_.-]{1,64}$")
ENTRY = re.compile(r"^\s*\d+\.\s*(\S+)\s*$")


class RegistryError(Exception):
    pass


def fetch(path: str, method: str = "GET", body: dict | None = None, timeout: int = 20):
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
        with urllib.request.urlopen(request, timeout=timeout) as response:
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
        raise RegistryError(f"Сервис недоступен: {error}") from error


def parse(text: str) -> list[str]:
    entries = []
    for line in text.splitlines():
        if not line.strip():
            continue
        match = ENTRY.match(line)
        if not match:
            raise RegistryError(f"Некорректная строка в list.txt: {line!r}")
        entries.append(match.group(1))
    return entries


def format_registry(entries: list[str]) -> str:
    if not entries:
        return ""
    blocks = [f"{index}. {url}" for index, url in enumerate(entries, start=1)]
    return "\n\n".join(blocks) + "\n"


def read_registry() -> list[str]:
    return parse(REGISTRY.read_text(encoding="utf-8"))


def write_registry(entries: list[str]) -> None:
    REGISTRY.write_text(format_registry(entries), encoding="utf-8")


def normalize(value: str) -> tuple[str, str]:
    """Return (kind, value) where kind is 'handle' or 'uuid'."""
    text = (value or "").strip()
    if not text:
        raise RegistryError("Пустое значение автора")
    if text.startswith("@"):
        text = text[1:]
    if UUID.match(text):
        return "uuid", text.lower()
    if HANDLE.match(text) and "://" not in text:
        return "handle", text.lower()
    parsed = urllib.parse.urlparse(text)
    if parsed.scheme not in ("http", "https") or parsed.hostname not in HOSTS:
        raise RegistryError(f"Ожидается ссылка на профиль в {HOSTS[0]} или {HOSTS[1]}: {value!r}")
    segments = [segment for segment in parsed.path.split("/") if segment]
    if not segments:
        raise RegistryError(f"В ссылке нет профиля автора: {value!r}")
    last = segments[-1]
    if last.startswith("@"):
        last = last[1:]
    if UUID.match(last):
        return "uuid", last.lower()
    if HANDLE.match(last):
        return "handle", last.lower()
    raise RegistryError(f"Не удалось разобрать автора из ссылки: {value!r}")


def canonical(kind: str, value: str) -> str:
    if kind == "uuid":
        return f"https://scripting.nulls.gg/users/{value}"
    return f"https://scripting.nulls.gg/@{value}"


def resolve(kind: str, value: str) -> dict:
    path = f"/users/{value}" if kind == "uuid" else f"/users/@{urllib.parse.quote(value)}"
    status, payload = fetch(path)
    if status != 200:
        raise RegistryError(f"Автор не найден ({status}): {value}")
    uuid = str(payload.get("user_id") or payload.get("uuid") or "")
    if not UUID.match(uuid):
        raise RegistryError(f"Сервис вернул некорректный профиль для {value}: {payload}")
    return {
        "uuid": uuid.lower(),
        "username": str(payload.get("username") or value),
        "name": str(payload.get("name") or ""),
    }


def locate(entries: list[str], target: str) -> int:
    text = (target or "").strip()
    if text.isdigit():
        index = int(text) - 1
        if 0 <= index < len(entries):
            return index
        raise RegistryError(f"Номер {text} вне диапазона 1..{len(entries)}")
    kind, value = normalize(text)
    for index, url in enumerate(entries):
        try:
            entry_kind, entry_value = normalize(url)
        except RegistryError:
            continue
        if entry_value == value:
            return index
    raise RegistryError(f"Автор не найден в list.txt: {target!r}")


def command_list() -> int:
    entries = read_registry()
    for index, url in enumerate(entries, start=1):
        print(f"{index}. {url}")
    print(f"Всего: {len(entries)}")
    return 0


def command_validate() -> int:
    entries = read_registry()
    seen: dict[str, int] = {}
    problems: list[str] = []
    for index, url in enumerate(entries, start=1):
        try:
            kind, value = normalize(url)
        except RegistryError as error:
            problems.append(f"{index}. {url}: {error}")
            continue
        if value in seen:
            problems.append(f"{index}. {url}: дубликат записи {seen[value]}")
        seen[value] = index
        try:
            profile = resolve(kind, value)
        except RegistryError as error:
            problems.append(f"{index}. {url}: {error}")
            continue
        status, payload = fetch(f"/users/{profile['uuid']}/scripts")
        if status != 200 or not isinstance(payload.get("scripts"), list):
            problems.append(f"{index}. {url}: список скриптов недоступен ({status})")
        print(f"ok  {index}. {url} -> {profile['uuid']} ({len(payload.get('scripts') or [])} скриптов)")
    if problems:
        print("\nПроблемы:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1
    print(f"\nВсе {len(entries)} записей корректны.")
    return 0


def command_add(value: str) -> int:
    entries = read_registry()
    kind, target = normalize(value)
    profile = resolve(kind, target)
    url = canonical(kind, target)
    for existing in entries:
        try:
            existing_kind, existing_value = normalize(existing)
        except RegistryError:
            continue
        if existing_value == target or existing_value == profile["uuid"]:
            print(f"Автор уже в списке: {existing}")
            return 0
    entries.append(url)
    write_registry(entries)
    print(f"Добавлен {url} ({profile['name']} / @{profile['username']}), всего {len(entries)}")
    return 0


def command_remove(target: str) -> int:
    entries = read_registry()
    index = locate(entries, target)
    removed = entries.pop(index)
    write_registry(entries)
    print(f"Удалён {removed}, осталось {len(entries)}")
    return 0


def command_edit(target: str, replacement: str) -> int:
    entries = read_registry()
    index = locate(entries, target)
    kind, value = normalize(replacement)
    profile = resolve(kind, value)
    url = canonical(kind, value)
    for position, existing in enumerate(entries):
        if position == index:
            continue
        try:
            _, existing_value = normalize(existing)
        except RegistryError:
            continue
        if existing_value in (value, profile["uuid"]):
            raise RegistryError(f"Такая запись уже есть в list.txt: {existing}")
    previous = entries[index]
    entries[index] = url
    write_registry(entries)
    print(f"Заменён {previous} -> {url} ({profile['name']} / @{profile['username']})")
    return 0


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    action, rest = argv[1], argv[2:]
    try:
        if action == "list":
            return command_list()
        if action == "validate":
            return command_validate()
        if action == "add":
            if not rest:
                raise RegistryError("Укажите ссылку или @handle")
            return command_add(rest[0])
        if action == "remove":
            if not rest:
                raise RegistryError("Укажите ссылку, @handle или номер")
            return command_remove(rest[0])
        if action == "edit":
            if len(rest) < 2:
                raise RegistryError("Укажите что заменить и на что")
            return command_edit(rest[0], rest[1])
    except RegistryError as error:
        print(f"Ошибка: {error}", file=sys.stderr)
        return 1
    print(f"Неизвестное действие: {action}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
