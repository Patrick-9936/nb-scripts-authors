# Script Library CLI

Каталог скриптов Null’s Brawl из терминала: поиск, просмотр кода, избранное,
настройка боя и запуск игры. Работает на **Windows, Linux и macOS**, на любом
Node 18+ — без зависимостей и без сборки.

```bash
npm install -g script-library-cli
script-library doctor
```

## Возможности

- **Каталог** — 21 автор и все опубликованные скрипты, список авторов читается
  из репозитория, поэтому новые авторы появляются без обновления пакета.
- **Поиск** — по названию, автору, описанию и UUID, с сортировкой и лимитом.
- **Код** — просмотр и скачивание `.lua` после входа в аккаунт Null’s.
- **Свои скрипты** — создание черновика, публикация, удаление.
- **Бой** — все 32 параметра, блокировка бойцов, сохранение конфигурации и
  ссылка `nullsbrawl://`, которую открывает игра.
- **Избранное и недавние** — хранятся локально.
- **`--json`** — машинный вывод для скриптов и конвейеров.

## Установка

```bash
npm install -g script-library-cli      # Windows, Linux, macOS
npx script-library-cli list            # без установки
```

Требуется Node 18 или новее. Проверить окружение:

```bash
script-library doctor
```

## Быстрый старт

```bash
# что есть в каталоге
script-library list --limit 10

# поиск
script-library search "защита сейфа"
script-library search "d2rkmean" --scope author

# авторы
script-library authors
script-library author @codwcool

# карточка скрипта
script-library show 01a1260f-3d94-763c-9ece-b1ec0e0583ba
```

## Аккаунт

Код скриптов и свои скрипты доступны после входа:

```bash
script-library login --user "имя" --password "пароль"
script-library whoami
script-library mine
script-library logout
```

Для автоматизации можно не передавать пароль в командной строке:

```bash
export SCRIPT_LIBRARY_USER="имя"
export SCRIPT_LIBRARY_PASSWORD="пароль"
script-library login
```

Сессия сохраняется в файл с правами только для владельца
(`~/.config/script-library/session.json` на Linux, `%APPDATA%\script-library`
на Windows). Пароль не сохраняется. `script-library logout` удаляет сессию.

## Код и скачивание

```bash
script-library code 01a1260f --out script.lua
script-library download @codwcool --out ./scripts
```

## Свой скрипт

```bash
script-library new --name "Мой скрипт" --file script.lua --description "Описание от 32 символов"
script-library publish 01a1260f-3d94-763c-9ece-b1ec0e0583ba
script-library delete 01a1260f-3d94-763c-9ece-b1ec0e0583ba --yes
```

## Бой

Посмотреть все параметры:

```bash
script-library params
```

Настроить и получить ссылку:

```bash
script-library battle 01a1260f \
  --set "Уровень боя=5" \
  --set "Скорость движения, %=150" \
  --ban 5,7 \
  --save \
  --link
```

`--set` принимает название параметра, часть названия или номер (0–31).
`--ban` принимает бойцов через запятую, `--unban` снимает все блокировки.
`--save` запоминает конфигурацию для этого скрипта, `--reset` возвращает
значения по умолчанию.

Открыть игру сразу:

```bash
script-library battle 01a1260f --set "Уровень боя=5" --launch
```

На Windows ссылку открывает `start`, на Linux — `xdg-open`. Если графической
сессии нет, ссылка просто печатается.

Разобрать чужую ссылку на бой:

```bash
script-library import-battle "nullsbrawl://createAndJoinRoom?roomname=params:v2:…"
```

## Обновление приложения

```bash
script-library update --installed 1.7.24
```

## Настройки

```bash
script-library config
script-library config --set downloadDir=/home/user/scripts
script-library config --set api=https://scripting.nulls.gg/api
```

Ключи: `registry`, `api`, `downloadDir`. Файл настроек лежит рядом с сессией.

## Общие параметры

| Параметр | Действие |
| --- | --- |
| `--json` | машинный вывод, пригодный для `jq` |
| `--refresh` | обновить каталог, не используя кэш |
| `--quiet` | без пояснений |
| `--limit N` | сколько строк показать |
| `--sort new\|old\|updated\|az\|za` | сортировка |
| `--scope all\|title\|author\|description\|uuid` | где искать |

Каталог кэшируется на 10 минут, поэтому повторные команды отвечают мгновенно.

## Коды возврата

| Код | Значение |
| --- | --- |
| `0` | успех |
| `1` | ошибка: нет входа, скрипт не найден, сервис недоступен |
| `2` | неверная команда или параметры |

## Примеры для скриптов

```bash
# десять самых свежих скриптов в виде JSON
script-library list --sort new --limit 10 --json | jq -r '.scripts[] | "\(.name)\t@\(.author_username)"'

# скачать всё из избранного
script-library favorites --json | jq -r '.scripts[].uuid' | while read -r id; do
  script-library download "$id"
done
```

## Как это работает

CLI обращается к `scripting.nulls.gg` напрямую: в терминале нет браузера, а
значит нет и ограничений CORS. Список авторов читается из ветки
`android-script-library`. Кодирование ссылки на бой совпадает с Android-приложением,
поэтому конфигурацию можно переносить между ними.

## Ограничения

- Запуск боя требует, чтобы автор скрипта был подтверждён в Null’s Connect.
  Если нет, сервис отвечает отказом, и CLI объясняет причину.
- Просмотр кода и свои скрипты требуют входа в аккаунт Null’s.
- Публичного API для статистики у CLI нет: она доступна владельцу проекта в
  приложении и на сайте.

## Лицензия

MIT
