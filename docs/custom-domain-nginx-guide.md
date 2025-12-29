# 自定义域名 Nginx 部署指南

> 如何使用 Nginx 为站点托管和云函数配置自定义域名

---

## 📋 目录

1. [当前功能概述](#当前功能概述)
2. [三种部署方案对比](#三种部署方案对比)
3. [Nginx 配置方案（推荐）](#nginx-配置方案推荐)
4. [站点托管专用配置](#站点托管专用配置)
5. [SSL 证书配置](#ssl-证书配置)
6. [动态域名管理](#动态域名管理)
7. [性能优化](#性能优化)

---

## 当前功能概述

### 系统已有的自定义域名功能

**数据模型**：`custom_domains` 集合

```typescript
interface CustomDomain {
  _id: ObjectId
  userId: ObjectId
  domain: string           // 自定义域名 (如 api.example.com)
  targetPath?: string      // 指向特定函数路径
  verified: boolean        // DNS 验证状态
  lastVerifiedAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

**已实现功能**：
- ✅ DNS CNAME 验证
- ✅ 域名到用户的映射
- ✅ 应用层域名路由
- ✅ targetPath 支持（指向特定云函数）

**当前限制**：
- ⚠️ 主要针对云函数，未完全集成站点托管
- ⚠️ 每个请求都查询数据库（性能可优化）
- ⚠️ 需要手动添加 CNAME 记录

---

## 三种部署方案对比

### 方案 1：纯应用层处理（当前实现）

**架构**：
```
用户 → Express 中间件 → 查询数据库 → 路由到云函数/站点
```

**优点**：
- ✅ 无需额外配置
- ✅ 完全由应用控制
- ✅ 易于调试

**缺点**：
- ❌ 每个请求都查数据库
- ❌ 无 SSL 终止
- ❌ 无静态资源缓存

---

### 方案 2：Nginx + 应用层（推荐）⭐

**架构**：
```
用户 → Nginx (SSL终止 + 缓存) → Express → 查询数据库 → 路由
```

**优点**：
- ✅ SSL 在 Nginx 层处理（性能好）
- ✅ 静态资源缓存
- ✅ Gzip 压缩
- ✅ 应用层保持灵活性
- ✅ 支持动态添加域名

**缺点**：
- ⚠️ 仍需查询数据库（可加缓存）

---

### 方案 3：Nginx 动态配置（高级）

**架构**：
```
用户 → Nginx + Lua → 查询 Redis 缓存 → Express
```

**优点**：
- ✅ 最高性能
- ✅ Redis 缓存域名映射
- ✅ Nginx 层直接路由

**缺点**：
- ❌ 需要 OpenResty
- ❌ 配置复杂
- ❌ 维护成本高

---

## Nginx 配置方案（推荐）

### 基础配置

#### 1. 主配置文件 `/etc/nginx/nginx.conf`

```nginx
http {
    # 日志格式
    log_format custom_domain '$remote_addr - $host [$time_local] '
                           '"$request" $status $body_bytes_sent '
                           '"$http_referer" "$http_user_agent"';

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript
               application/json application/javascript application/xml+rss
               application/rss+xml font/truetype font/opentype
               application/vnd.ms-fontobject image/svg+xml;

    # 上游服务器（Simple IDE）
    upstream simple_ide {
        server 127.0.0.1:3000;
        keepalive 32;
    }

    # 包含站点配置
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

---

#### 2. 系统域名配置 `/etc/nginx/sites-available/simple-ide.conf`

```nginx
# HTTP 自动跳转 HTTPS
server {
    listen 80;
    server_name your-domain.com;

    # ACME 验证（Let's Encrypt）
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 主站
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 日志
    access_log /var/log/nginx/simple-ide.access.log custom_domain;
    error_log /var/log/nginx/simple-ide.error.log;

    # 客户端上传限制
    client_max_body_size 100M;

    # WebSocket 支持（LSP）
    location /_/lsp {
        proxy_pass http://simple_ide;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # API 路由
    location /api/ {
        proxy_pass http://simple_ide;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 云函数调用
    location /invoke/ {
        proxy_pass http://simple_ide;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 站点托管（静态文件缓存）
    location /site/ {
        proxy_pass http://simple_ide;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 静态资源缓存
        proxy_cache_bypass $http_cache_control;
        add_header X-Cache-Status $upstream_cache_status;

        # CSS/JS/图片缓存 1 天
        location ~* \.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$ {
            proxy_pass http://simple_ide;
            proxy_cache_valid 200 1d;
            expires 1d;
            add_header Cache-Control "public, immutable";
        }

        # HTML 不缓存
        location ~* \.html$ {
            proxy_pass http://simple_ide;
            add_header Cache-Control "no-cache, no-store, must-revalidate";
        }
    }

    # 前端应用（IDE）
    location / {
        proxy_pass http://simple_ide;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

#### 3. 自定义域名模板 `/etc/nginx/sites-available/custom-domain-template.conf`

```nginx
# HTTP 跳转 HTTPS
server {
    listen 80;
    server_name api.example.com;  # 替换为实际域名

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS 配置
server {
    listen 443 ssl http2;
    server_name api.example.com;  # 替换为实际域名

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    # SSL 配置（继承主配置）
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 日志
    access_log /var/log/nginx/custom-api.example.com.access.log custom_domain;
    error_log /var/log/nginx/custom-api.example.com.error.log;

    # 传递原始 Host 头（重要！）
    location / {
        proxy_pass http://simple_ide;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;  # 保留原始域名
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Original-Host $host;  # 额外标记
    }
}
```

---

## 站点托管专用配置

### 方案 A：直接映射到用户站点

**适用场景**：`myblog.com` → 用户的站点根目录

```nginx
server {
    listen 443 ssl http2;
    server_name myblog.com;

    ssl_certificate /etc/letsencrypt/live/myblog.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/myblog.com/privkey.pem;

    # 重写路径：myblog.com/* → /site/{userId}/*
    location / {
        # 方案 1：应用层处理（推荐）
        # 直接传递给应用，应用根据 Host 查询 userId
        proxy_pass http://simple_ide;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 方案 2：Nginx 硬编码（不推荐，需要手动配置）
        # rewrite ^(.*)$ /site/507f1f77bcf86cd799439011$1 break;
        # proxy_pass http://simple_ide;
    }

    # API 调用代理（如果站点需要调用云函数）
    location /invoke/ {
        proxy_pass http://simple_ide;
        proxy_set_header Host your-domain.com;  # 使用系统域名
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

### 方案 B：子域名映射到特定页面

**适用场景**：`blog.example.com` → `/site/{userId}/blog/`

```nginx
server {
    listen 443 ssl http2;
    server_name blog.example.com;

    ssl_certificate /etc/letsencrypt/live/blog.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/blog.example.com/privkey.pem;

    location / {
        # 应用层处理（推荐）
        proxy_pass http://simple_ide;
        proxy_set_header Host $host;
        proxy_set_header X-Custom-Path blog;  # 传递路径提示
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## SSL 证书配置

### 使用 Certbot 自动申请（推荐）

```bash
# 1. 安装 Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# 2. 申请证书（主域名）
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 3. 申请证书（自定义域名）
sudo certbot --nginx -d api.example.com

# 4. 自动续期（添加到 crontab）
sudo crontab -e
# 添加：
0 3 * * * /usr/bin/certbot renew --quiet --post-hook "systemctl reload nginx"
```

---

### 通配符证书（支持任意子域名）

```bash
# 使用 DNS 验证申请通配符证书
sudo certbot certonly --manual \
  --preferred-challenges=dns \
  --email your@email.com \
  --server https://acme-v02.api.letsencrypt.org/directory \
  --agree-tos \
  -d "*.your-domain.com" \
  -d "your-domain.com"

# 按提示添加 TXT 记录到 DNS
# 记录名：_acme-challenge.your-domain.com
# 记录值：（Certbot 提供的随机字符串）
```

---

## 动态域名管理

### 后端增强：支持站点托管映射

修改 `src/server/index.ts` 中的自定义域名中间件：

```typescript
// 自定义域名路由中间件
app.use(async (req, res, next) => {
  const host = req.hostname
  const systemDomain = customDomainService.getSystemDomain().replace(/:\d+$/, '')

  // 跳过系统域名和 localhost
  if (host === systemDomain || host === 'localhost' || host === '127.0.0.1') {
    return next()
  }

  // 跳过系统路径
  if (req.path.startsWith('/api/') || req.path.startsWith('/_/') || req.path === '/health') {
    return next()
  }

  try {
    const customDomain = await customDomainService.findDomainByHost(host)

    if (customDomain && customDomain.verified) {
      // ✨ 新增：判断是站点托管还是云函数
      if (customDomain.targetType === 'site') {
        // 映射到站点托管：重写为 /site/{userId}/
        req.url = `/site/${customDomain.userId.toHexString()}${req.path}`
      } else {
        // 映射到云函数（原有逻辑）
        const targetPath = customDomain.targetPath || req.path.replace(/^\//, '')
        req.url = '/invoke/' + targetPath.replace(/^\//, '')
      }

      // 标记为自定义域名请求
      ;(req as any).customDomain = customDomain
    }
  } catch (err) {
    console.error('Custom domain lookup error:', err)
  }

  next()
})
```

---

### 数据模型扩展

```typescript
export interface CustomDomain {
  _id: ObjectId
  userId: ObjectId
  domain: string
  targetType: 'function' | 'site'  // ✨ 新增：区分类型
  targetPath?: string               // 云函数路径 或 站点子路径
  verified: boolean
  createdAt: Date
  updatedAt: Date
}
```

---

### Nginx 配置生成脚本

```bash
#!/bin/bash
# generate-nginx-config.sh
# 根据数据库中的自定义域名自动生成 Nginx 配置

DOMAIN=$1
USER_ID=$2
TARGET_TYPE=$3  # site 或 function

if [ -z "$DOMAIN" ] || [ -z "$USER_ID" ]; then
    echo "Usage: $0 <domain> <user_id> [site|function]"
    exit 1
fi

TARGET_TYPE=${TARGET_TYPE:-site}

cat > "/etc/nginx/sites-available/$DOMAIN.conf" <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    location / { return 301 https://\$server_name\$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    location / {
        proxy_pass http://simple_ide;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# 启用配置
ln -sf "/etc/nginx/sites-available/$DOMAIN.conf" "/etc/nginx/sites-enabled/"

# 申请证书
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@your-domain.com

# 重载 Nginx
nginx -t && systemctl reload nginx

echo "✅ Nginx configuration created for $DOMAIN"
```

---

## 性能优化

### 1. Redis 缓存域名映射

```typescript
import Redis from 'ioredis'

const redis = new Redis()

export async function findDomainByHost(host: string): Promise<CustomDomain | null> {
  // 尝试从 Redis 获取
  const cached = await redis.get(`domain:${host}`)
  if (cached) {
    return JSON.parse(cached)
  }

  // 从数据库查询
  const domain = await db.collection<CustomDomain>('custom_domains').findOne({
    domain: host,
    verified: true
  })

  // 缓存 5 分钟
  if (domain) {
    await redis.setex(`domain:${host}`, 300, JSON.stringify(domain))
  }

  return domain
}
```

---

### 2. Nginx 缓存配置

```nginx
http {
    # 缓存路径
    proxy_cache_path /var/cache/nginx/simple_ide
                     levels=1:2
                     keys_zone=simple_ide_cache:10m
                     max_size=1g
                     inactive=60m
                     use_temp_path=off;

    server {
        # 启用缓存
        location /site/ {
            proxy_cache simple_ide_cache;
            proxy_cache_valid 200 1h;
            proxy_cache_use_stale error timeout updating http_500 http_502 http_503;
            proxy_cache_background_update on;
            add_header X-Cache-Status $upstream_cache_status;

            proxy_pass http://simple_ide;
        }
    }
}
```

---

### 3. HTTP/2 推送

```nginx
server {
    listen 443 ssl http2;

    # 推送关键资源
    location = /site/123/index.html {
        proxy_pass http://simple_ide;

        # 推送 CSS 和 JS
        http2_push /site/123/css/style.css;
        http2_push /site/123/js/app.js;
    }
}
```

---

## 完整部署流程

### 1. 系统域名配置

```bash
# 安装 Nginx
sudo apt-get install nginx

# 复制主配置
sudo cp docs/nginx/simple-ide.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/simple-ide.conf /etc/nginx/sites-enabled/

# 修改配置中的域名
sudo vim /etc/nginx/sites-available/simple-ide.conf
# 替换 your-domain.com 为实际域名

# 申请 SSL 证书
sudo certbot --nginx -d your-domain.com

# 测试并重载
sudo nginx -t
sudo systemctl reload nginx
```

---

### 2. 添加自定义域名（通过 API）

```bash
# 用户添加自定义域名
curl -X POST https://your-domain.com/api/custom-domains \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "myblog.com",
    "targetType": "site"
  }'

# 返回提示：请添加 CNAME 记录
# CNAME: myblog.com → your-domain.com
```

---

### 3. DNS 配置

```
类型   主机记录          记录值
CNAME  myblog.com       your-domain.com
CNAME  api.example.com  your-domain.com
```

---

### 4. 验证并生成 Nginx 配置

```bash
# 验证 DNS
curl -X POST https://your-domain.com/api/custom-domains/<id>/verify \
  -H "Authorization: Bearer <token>"

# 生成 Nginx 配置（自动化脚本）
./generate-nginx-config.sh myblog.com <user_id> site

# 或手动创建配置文件
sudo cp custom-domain-template.conf /etc/nginx/sites-available/myblog.com.conf
sudo vim /etc/nginx/sites-available/myblog.com.conf
# 修改 server_name 和 SSL 路径
```

---

### 5. 测试访问

```bash
# 测试 HTTPS
curl -I https://myblog.com

# 应该返回站点内容
curl https://myblog.com
```

---

## 故障排查

### 问题 1：502 Bad Gateway

```bash
# 检查上游服务器
curl http://127.0.0.1:3000/health

# 检查 Nginx 日志
sudo tail -f /var/log/nginx/error.log

# 检查防火墙
sudo ufw status
```

---

### 问题 2：SSL 证书错误

```bash
# 检查证书有效期
sudo certbot certificates

# 手动续期
sudo certbot renew --dry-run

# 强制续期
sudo certbot renew --force-renewal
```

---

### 问题 3：自定义域名不生效

```bash
# 检查 DNS 解析
dig myblog.com
nslookup myblog.com

# 检查数据库记录
mongo
> use simple_ide
> db.custom_domains.find({ domain: "myblog.com" })

# 检查应用日志
pm2 logs simple-ide
```

---

## 总结

### 推荐方案：Nginx + 应用层

**优点**：
✅ **性能优秀**：SSL 终止、缓存、压缩
✅ **灵活性高**：应用层控制路由逻辑
✅ **易于维护**：配置模板化
✅ **自动化**：脚本生成配置

**工作流程**：
1. 用户通过 API 添加自定义域名
2. 系统验证 DNS CNAME 记录
3. 管理员/脚本生成 Nginx 配置
4. Certbot 自动申请 SSL 证书
5. Nginx 代理请求到应用
6. 应用根据 Host 头查询映射
7. 返回对应用户的站点/函数

---

**下一步**：实现 Nginx 配置自动生成 API
