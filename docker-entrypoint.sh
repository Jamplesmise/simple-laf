#!/bin/sh
set -e

# 如果挂载的 node_modules 为空，从备份恢复
if [ ! -f "/app/node_modules/.initialized" ]; then
  echo "Initializing node_modules from backup..."
  if [ -d "/app/node_modules_backup" ] && [ "$(ls -A /app/node_modules_backup 2>/dev/null)" ]; then
    cp -r /app/node_modules_backup/. /app/node_modules/
    touch /app/node_modules/.initialized
    echo "Done."
  else
    echo "ERROR: node_modules_backup is empty or missing!"
    exit 1
  fi
fi

exec "$@"
