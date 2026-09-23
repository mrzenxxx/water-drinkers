#!/usr/bin/env bash
# Однократная подготовка сервера (Ubuntu 24.04). Запускается от root на
# сервере; повторный запуск безопасен — каждый шаг проверяет, не сделан ли он.
#
#   scp deploy/server-setup.sh root@IP:/tmp/ && ssh root@IP bash /tmp/server-setup.sh
#
# Файрвол скрипт намеренно не включает: на сервере работает ViPNet Client
# со своими правилами iptables, и ufw поверх них может отрезать и VPN, и SSH.
# Защита держится на том, что наружу опубликованы только 80 и 443 (Caddy),
# а база слушает 127.0.0.1 (compose.yml).

set -euo pipefail

APP_DIR=/opt/waterdrinkers
BACKUP_DIR=/var/backups/waterdrinkers

# Подкачка: при 1 ГБ памяти без неё пик нагрузки кончается OOM-killer'ом,
# который выберет самый толстый процесс — Postgres или Node.
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
# Подкачка — страховка, а не рабочая память: без этого ядро выгружает
# страницы Postgres задолго до нехватки.
sysctl -q vm.swappiness=10
echo 'vm.swappiness=10' > /etc/sysctl.d/90-waterdrinkers.conf

if ! command -v docker >/dev/null; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2
  systemctl enable --now docker
fi

# Журналы контейнеров иначе растут без предела и однажды съедают диск.
if [ ! -f /etc/docker/daemon.json ]; then
  cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
  systemctl restart docker
fi

mkdir -p "$APP_DIR" "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Ежедневная копия базы в 03:30 по времени сервера.
cat > /etc/cron.d/waterdrinkers-backup <<CRON
30 3 * * * root $APP_DIR/backup.sh >> /var/log/waterdrinkers-backup.log 2>&1
CRON

echo
echo "Готово. Память и подкачка:"
free -h
docker --version
docker compose version
