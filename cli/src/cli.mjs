// Entry point: argument dispatch, help and the interactive menu.
import { createInterface } from "node:readline/promises";
import { parseArgs } from "./args.mjs";
import * as commands from "./commands.mjs";
import { bold, cyan, dim, error, green, magenta, table, yellow } from "./format.mjs";
import { configDir } from "./store.mjs";

export const VERSION = "1.0.0";

const HELP = `${bold("Script Library")} — каталог скриптов Null’s Brawl из терминала.

${bold("Использование")}
  script-library                       интерактивное меню
  script-library <команда> [параметры]

${bold("Каталог")}
  list [--search q] [--author @x] [--sort new|old|updated|az|za] [--limit 20]
  search <текст> [--scope all|title|author|description|uuid]
  authors                              список авторов
  author <@handle|uuid>                скрипты автора
  show <uuid|ссылка>                   карточка скрипта
  recent                               недавно открытые

${bold("Аккаунт")}
  login --user <имя> --password <пароль>
  logout                               удалить сохранённую сессию
  whoami                               кто вошёл
  sync                                 синхронизировать общие настройки
  mine                                 свои скрипты
  favorites                            избранное
  favorite <uuid>                      добавить или убрать из избранного

${bold("Код")}
  code <uuid> [--out файл]             показать или сохранить код
  download <uuid> [--out папка]        скачать .lua
  new --name "Имя" --file script.lua [--description "..."]
  publish <uuid>                       опубликовать черновик
  delete <uuid> --yes                  удалить свой скрипт

${bold("Бой")}
  params                               все 32 параметра
  battle <uuid> [--set "Уровень боя=5"] [--ban 5,7] [--save] [--link] [--launch]
  import-battle "nullsbrawl://…"       разобрать ссылку на бой

${bold("Прочее")}
  update [--installed 1.7.25]          последний релиз приложения
  doctor                               проверить окружение
  config [--set ключ=значение]         настройки

${bold("Общие параметры")}
  --json                               машинный вывод
  --refresh                            обновить каталог, не используя кэш
  --quiet                              без пояснений

${bold("Примеры")}
  script-library search "защита сейфа" --limit 5
  script-library battle 01a1796b-7367-7d34-8f74-a49118c053cb --set "Уровень боя=11" --launch
  script-library download @evserym --out ./scripts

Настройки: ${configDir()}
`;

const COMMANDS = {
  list: flags => commands.list(flags),
  ls: flags => commands.list(flags),
  search: (flags, positionals) => commands.searchCommand(positionals.join(" "), flags),
  authors: flags => commands.authors(flags),
  author: (flags, positionals) => commands.author(positionals[0], flags),
  show: (flags, positionals) => commands.show(positionals[0], flags),
  code: (flags, positionals) => commands.code(positionals[0], flags),
  download: (flags, positionals) => commands.download(positionals[0], flags),
  recent: flags => commands.recent(flags),
  login: flags => commands.login(flags),
  logout: flags => commands.logout(flags),
  whoami: flags => commands.whoami(flags),
  sync: flags => commands.sync(flags),
  mine: flags => commands.mine(flags),
  favorites: flags => commands.favorites(flags),
  favorite: (flags, positionals) => commands.favorite(positionals[0], flags),
  new: flags => commands.create(flags),
  publish: (flags, positionals) => commands.publish(positionals[0], flags),
  delete: (flags, positionals) => commands.remove(positionals[0], flags),
  params: flags => commands.params(flags),
  battle: (flags, positionals) => commands.battle(positionals[0], flags),
  "import-battle": (flags, positionals) => commands.importBattle(positionals[0], flags),
  update: flags => commands.update(flags),
  doctor: flags => commands.doctor(flags),
  config: flags => commands.config(flags),
};

export async function run(argv) {
  const { positionals, flags, lists } = parseArgs(argv);
  const [name, ...rest] = positionals;
  if (flags.version || flags.v) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (flags.help || flags.h) {
    process.stdout.write(HELP);
    return 0;
  }
  if (!name) {
    process.stdout.write(HELP);
    return 1;
  }
  const handler = COMMANDS[name];
  if (!handler) {
    error(`Неизвестная команда: ${name}`);
    process.stdout.write(HELP);
    return 2;
  }
  return handler({ ...flags, ...lists }, rest);
}

/** Simple menu for `script-library` without arguments. */
export async function interactive() {
  if (!process.stdin.isTTY) {
    process.stdout.write(HELP);
    return 1;
  }
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      process.stdout.write(`\n${bold("Script Library")} ${dim(VERSION)}\n`);
      process.stdout.write(table(["#", "Действие"], [
        ["1", "Библиотека"],
        ["2", "Поиск"],
        ["3", "Авторы"],
        ["4", "Избранное"],
        ["5", "Недавние"],
        ["6", "Мои скрипты"],
        ["7", "Войти"],
        ["8", "Проверить окружение"],
        ["0", "Выход"],
      ], { maxWidth: 40 }) + "\n");
      const choice = (await terminal.question(`${cyan("Выбор")} `)).trim();
      if (choice === "0" || choice === "q") return 0;
      try {
        if (choice === "1") await commands.list({ limit: 20 });
        else if (choice === "2") {
          const query = await terminal.question("Запрос: ");
          if (query.trim()) await commands.searchCommand(query.trim(), { limit: 20 });
        } else if (choice === "3") await commands.authors({});
        else if (choice === "4") await commands.favorites({});
        else if (choice === "5") await commands.recent({});
        else if (choice === "6") await commands.mine({});
        else if (choice === "7") {
          const user = (await terminal.question("Имя пользователя: ")).trim();
          const password = (await terminal.question("Пароль: ")).trim();
          if (user && password) await commands.login({ user, password });
        } else if (choice === "8") await commands.doctor({});
        else process.stdout.write(dim("Нет такого пункта.\n"));
      } catch (failure) {
        error(failure.message);
      }
    }
  } finally {
    terminal.close();
  }
}
