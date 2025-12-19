#!/bin/sh
set -e

# 如果挂载的 node_modules 为空，从备份恢复
if [ ! -f "/app/node_modules/.initialized" ]; then
  echo "Initializing node_modules from backup..."
  cp -r /app/node_modules_backup/* /app/node_modules/
  touch /app/node_modules/.initialized
  echo "Done."
fi

exec "$@"
