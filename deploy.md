# 免费 SSL 证书部署教程

使用 Let's Encrypt + Certbot 为 Nginx 反向代理的域名配置免费 HTTPS。

## 前置条件

- 域名 DNS 已解析到目标服务器 IP
- 服务器已安装 Nginx，且 80 端口已开放（防火墙/安全组）
- 有服务器的 SSH 访问权限（root 或 sudo）

---

## 第一步：确认 DNS 解析

在本地或任意机器上检查域名是否指向正确的服务器：

```bash
# 方式一：dig
dig +short your-domain.com A

# 方式二：nslookup
nslookup your-domain.com
```

确认返回的 IP 是目标服务器的公网 IP。如果不是，先去 DNS 管理后台修改 A 记录。

---

## 第二步：SSH 登录并检查环境

```bash
ssh root@your-server-ip
```

### 2.1 确认 Nginx 正在运行且 80 端口已监听

```bash
ss -tlnp | grep ':80'
```

应该看到 `0.0.0.0:80` 在 LISTEN 状态。

### 2.2 确认 Nginx 配置中已包含该域名

```bash
grep -rn "your-domain.com" /etc/nginx/
```

如果没有，先在 Nginx 中添加该域名的 server 块（见下方"附录：Nginx HTTP 基础配置"）。

### 2.3 测试 Nginx 配置并重载

```bash
nginx -t && systemctl reload nginx
```

---

## 第三步：安装 Certbot

### Ubuntu 18.04+ / Debian（推荐 snap）

```bash
snap install core
snap refresh core
snap install --classic certbot
```

### CentOS / RHEL

```bash
yum install -y epel-release
yum install -y certbot
```

验证安装：

```bash
certbot --version
```

---

## 第四步：获取 SSL 证书

### 方式一：standalone 模式（推荐，兼容性最好）

适用场景：Nginx 没有安装 certbot 插件，或者插件版本不兼容。

```bash
# 1. 临时停止 Nginx（释放 80 端口给 certbot 验证用）
systemctl stop nginx

# 2. 获取证书
certbot certonly --standalone \
  -d your-domain.com \
  --non-interactive \
  --agree-tos \
  --email your-email@example.com

# 3. 立即启动 Nginx
systemctl start nginx
```

证书保存位置：

- 完整证书链：`/etc/letsencrypt/live/your-domain.com/fullchain.pem`
- 私钥：`/etc/letsencrypt/live/your-domain.com/privkey.pem`

### 方式二：nginx 插件模式（需安装 python3-certbot-nginx）

```bash
# 安装 nginx 插件
apt install -y python3-certbot-nginx   # Debian/Ubuntu

# 一键获取证书并自动修改 nginx 配置
certbot --nginx -d your-domain.com --non-interactive --agree-tos --email your-email@example.com
```

注意：此方式会自动修改 Nginx 配置，但可能不会保留你原有的自定义设置（如 WebSocket、超时等）。建议用方式一手动控制配置。

### 方式三：webroot 模式（不需要停 Nginx）

```bash
certbot certonly --webroot \
  -w /var/www/html \
  -d your-domain.com \
  --non-interactive \
  --agree-tos \
  --email your-email@example.com
```

---

## 第五步：修改 Nginx 配置启用 HTTPS

### 5.1 备份现有配置

```bash
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak.$(date +%Y%m%d)
```

### 5.2 修改 server 块

将原来只有 80 端口的 server 块改为以下两个块：

**原始配置（HTTP only）：**

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**修改后（HTTP 重定向 + HTTPS）：**

```nginx
# HTTP → 自动跳转 HTTPS
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

# HTTPS 主服务
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书路径
    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.3 如果有 WebSocket 支持

在 HTTPS server 块的 location 中额外添加：

```nginx
# WebSocket 支持
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;
```

### 5.4 测试并重载

```bash
nginx -t && systemctl reload nginx
```

如果报错，检查：

- 证书路径是否存在：`ls /etc/letsencrypt/live/your-domain.com/`
- 443 端口是否被占用：`ss -tlnp | grep 443`
- 防火墙是否开放了 443 端口（见下方"防火墙"章节）

---

## 第六步：验证

```bash
# 测试 HTTPS
curl -sI https://your-domain.com/ | head -5
# 应返回 HTTP/2 200

# 测试 HTTP 重定向
curl -sI http://your-domain.com/ | head -5
# 应返回 301 + Location: https://...

# 确认 443 端口在监听
ss -tlnp | grep ':443'
```

---

## 第七步：配置自动续期

Let's Encrypt 证书有效期 90 天，需自动续期。

### 方式一：crontab（通用，推荐）

```bash
(crontab -l 2>/dev/null; echo '0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"') | crontab -
```

每天凌晨 3 点检查并续期，成功后自动重载 Nginx。

验证 crontab 已添加：

```bash
crontab -l | grep certbot
```

### 方式二：systemd timer（如果 certbot 自动创建了）

```bash
systemctl list-timers | grep certbot
```

### 测试续期（模拟运行，不实际续期）

```bash
certbot renew --dry-run
```

---

## 第八步：前端代码检查（混合内容问题）

部署 HTTPS 后，如果页面是通过 HTTPS 加载的，浏览器会阻止页面中的 HTTP 请求（混合内容/Mixed Content）。

### 需要检查的前端代码

搜索项目中是否硬编码了 `http://` 的 API 请求：

```bash
grep -rn "http://" src/ | grep -v "www.w3.org\|svg\|localhost"
```

### 修复方案

**HTTP 请求**：将 `http://` 改为协议相对路径 `//`

```javascript
// ❌ 旧
url: `http://${host}:${port}/api/login`

// ✅ 新（自动匹配当前页面协议）
url: `//${host}:${port}/api/login`
```

**WebSocket**：根据当前页面协议动态选择 ws/wss

```javascript
// ❌ 旧
new WebSocket(`ws://${host}:${port}/ws`)

// ✅ 新
new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${host}:${port}/ws`)
```

### 重新构建部署

修复后重新构建前端并部署：

```bash
npm run build
# 如果前端是嵌入到 Go 二进制中，还需重新编译
go build -o app .
```

---

## 附录：Nginx HTTP 基础配置

如果你的 Nginx 还没有配置目标域名，在获取证书前先添加一个最简 HTTP 配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

放到 `/etc/nginx/nginx.conf` 的 `http {}` 块内，或创建 `/etc/nginx/conf.d/your-domain.conf`，然后：

```bash
nginx -t && systemctl reload nginx
```

---

## 附录：防火墙开放端口

### UFW（Ubuntu）

```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload
```

### firewalld（CentOS）

```bash
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --reload
```

### 云服务商安全组

登录云服务商控制台（腾讯云/阿里云/AWS 等），在安全组规则中添加入站规则：

- 端口：80、443
- 协议：TCP
- 来源：0.0.0.0/0

---

## 常见问题

**Q: `certbot: command not found`**

重新安装 certbot，或检查是否在 PATH 中：`which certbot` 或 `/snap/bin/certbot`

**Q: certbot 验证失败，返回 404 或超时**

1. 检查 DNS：`dig +short your-domain.com` 是否指向当前服务器
2. 检查 80 端口是否可达：从外部 `curl http://your-domain.com/`
3. 检查防火墙/安全组是否放行 80 端口

**Q: `nginx -t` 报错 `unknown directive "ssl_certificate"`**

Nginx 编译时没有包含 SSL 模块。安装完整版：

```bash
apt install -y nginx-full    # Debian/Ubuntu
```

**Q: 页面加载后浏览器控制台报 `Mixed Content` 警告**

参考第八步，检查前端代码中是否有硬编码的 `http://` 请求。

**Q: 证书到期了没自动续期**

手动检查：`certbot renew --dry-run`

排查 crontab：`crontab -l | grep certbot`

排查 cron 日志：`grep certbot /var/log/syslog`

---

## 实际案例参考

以下是在 `nix` 服务器（Ubuntu 18.04, 43.163.198.106）上为 `tapsss.initenc.cn` 配置 SSL 的完整命令记录：

```bash
# 1. SSH
ssh nix

# 2. 检查
ss -tlnp | grep ':80'
grep -rn 'tapsss.initenc.cn' /etc/nginx/

# 3. 安装 certbot（snap）
snap install core
snap refresh core
snap install --classic certbot

# 4. 获取证书
systemctl stop nginx
certbot certonly --standalone -d tapsss.initenc.cn --non-interactive --agree-tos --email admin@initenc.cn
systemctl start nginx

# 5. 修改 /etc/nginx/nginx.conf，将 HTTP server 块替换为 HTTP 重定向 + HTTPS 块

# 6. 重载
nginx -t && systemctl reload nginx

# 7. 自动续期
(crontab -l 2>/dev/null; echo '0 3 * * * certbot renew --quiet --post-hook "systemctl reload nginx"') | crontab -

# 8. 验证
curl -sI https://tapsss.initenc.cn/ | head -5
curl -sI http://tapsss.initenc.cn/ | head -5
```
