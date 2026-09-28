# Общее для скриптов развёртывания. Подключается через `. deploy/lib.sh`.
#
# Контур — это поддомен, база, роль в ней, секрет сессий и ветка, из которой
# берётся код. Демо крутит боевой код на моковых данных, тест — код из dev.

APP_DIR=/opt/waterdrinkers
DEPLOY_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_DIR=$(cd "$DEPLOY_DIR/.." && pwd)

# contour_vars <prod|demo|test> — задаёт C_REF, C_SUB, C_DB, C_ROLE,
# C_PASSWORD_VAR, C_SECRET_VAR.
contour_vars() {
  case "$1" in
    prod) C_REF=main; C_SUB=puzyrik;      C_DB=waterdrinkers;      C_ROLE=waterdrinkers; C_PASSWORD_VAR=POSTGRES_PASSWORD; C_SECRET_VAR=SESSION_SECRET ;;
    demo) C_REF=main; C_SUB=demo-puzyrik; C_DB=waterdrinkers_demo; C_ROLE=wd_demo;       C_PASSWORD_VAR=DEMO_DB_PASSWORD;  C_SECRET_VAR=DEMO_SESSION_SECRET ;;
    test) C_REF=dev;  C_SUB=test-puzyrik; C_DB=waterdrinkers_test; C_ROLE=wd_test;       C_PASSWORD_VAR=TEST_DB_PASSWORD;  C_SECRET_VAR=TEST_SESSION_SECRET ;;
    *) echo "неизвестный контур «$1»: prod, demo или test" >&2; return 2 ;;
  esac
}

# remote_env <host> <VAR> — значение переменной из .env на сервере.
remote_env() {
  ssh "$1" "grep -E '^$2=' $APP_DIR/.env | head -1 | cut -d= -f2-"
}

# checkout_ref <ref> — ревизия во временной папке, готовая к запуску prisma и
# tsx: node_modules берётся из репозитория ссылкой, клиент Prisma генерируется
# под схему этой ревизии. Печатает путь. Удаление — на вызывающем (trap).
#
# Нужна, чтобы миграции и сиды выполнял код той же ветки, что крутится на
# контуре, а не то, что сейчас открыто в рабочей копии.
checkout_ref() {
  local ref=$1 dir
  git -C "$REPO_DIR" rev-parse --verify --quiet "$ref^{commit}" >/dev/null \
    || { echo "ветки или коммита «$ref» нет в репозитории" >&2; return 1; }
  dir=$(mktemp -d "${TMPDIR:-/tmp}/wd-$ref.XXXXXX")
  git -C "$REPO_DIR" archive --format=tar "$ref" | tar -x -C "$dir"
  ln -s "$REPO_DIR/node_modules" "$dir/node_modules"
  (cd "$dir" && DATABASE_URL=postgresql://gen@localhost/gen npx prisma generate >/dev/null)
  echo "$dir"
}
