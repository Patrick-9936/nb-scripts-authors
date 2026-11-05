Первый выпуск командной строки Script Library.

Установка без реестра пакетов:

```bash
# один файл, ничего устанавливать не нужно
curl -LO https://github.com/Patrick-9936/nb-scripts-authors/releases/download/cli-v1.0.0/script-library.mjs
node script-library.mjs list

# или как глобальная команда из архива
npm install -g https://github.com/Patrick-9936/nb-scripts-authors/releases/download/cli-v1.0.0/script-library-cli-1.0.0.tgz
script-library doctor
```

Что умеет:

- каталог авторов и скриптов, поиск по названию, автору, описанию и UUID;
- просмотр и скачивание кода после входа в аккаунт Null’s;
- свои скрипты: создание, публикация, удаление;
- все 32 параметра боя, блокировка бойцов, сохранение конфигурации;
- ссылка `nullsbrawl://`, совпадающая с приложением и сайтом;
- избранное и недавние скрипты;
- `--json` для скриптов и конвейеров.

Работает на Windows, Linux и macOS на Node 18 или новее. Зависимостей нет.
