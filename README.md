# fwallow — 域名/IP 白名单端口转发（fw4）

OpenWrt 软件包：让「端口转发」只允许白名单客户端连接——白名单由**静态 IP/CIDR**和**域名解析出的 IP**组成。域名 IP 每 10 分钟自动刷新（cron），WAN 重拨时立即刷新（hotplug）。

底层完全复用 fw4 原生能力：`config ipset`（nftables 命名集合 + `loadfile` + `reload_set`）+ `config redirect` 的 `option ipset` 引用。fw4 核心零改动。

## 包结构

```
I:\firewall4\
├── README.md
├── feeds.conf.example          # 加入 OpenWrt feeds 的方法
├── fwallow/                     # 后端包（脚本 + 配置，PKGARCH=all）
│   ├── Makefile
│   └── files/
│       ├── etc/config/fwallow               # 用户配置（conffile）
│       ├── etc/crontabs/root                # 每 10 分钟刷新域名（conffile）
│       ├── etc/hotplug.d/iface/20-fwallow   # WAN 重拨刷新
│       ├── etc/init.d/fwallow               # procd：监视配置变更自动同步
│       ├── etc/uci-defaults/fwallow         # 首次安装启用服务
│       └── usr/bin/
│           ├── fwallow-sync                 # 生成 firewall 的 ipset/redirect 段
│           └── fwallow-update               # 解析域名→loadfile→fw4 reload-sets
└── luci-app-fwallow/            # LuCI 前端包（页面在 网络→防火墙→域名白名单转发）
    ├── Makefile
    ├── htdocs/luci-static/resources/view/fwallow/overview.js
    └── root/usr/share/luci/menu.d/luci-app-fwallow.json
```

## 一、编译出 .ipk

方式 A（完整源码树，推荐）：
```sh
git clone https://git.openwrt.org/openwrt/openwrt.git
cd openwrt
echo "src-git fwallow https://github.com/YOURNAME/fwallow-feed.git" >> feeds.conf
./scripts/feeds update -a && ./scripts/feeds install -a
make menuconfig          # Network → fwallow、luci-app-fwallow 选中为 <M> 或 <*>
make package/fwallow/compile V=s
make package/luci-app-fwallow/compile V=s
```

方式 B（只用 SDK 交叉编译，不需要完整源码树）：
```sh
# 下载对应固件版本的 SDK，如 openwrt-sdk-24.10.x-<arch>_gcc-*.tar.xz
tar xf openwrt-sdk-*.tar.xz && cd openwrt-sdk-*
# 在 SDK 里建 feeds 或直接把本目录拷入 package/ 后：
./scripts/feeds update -a
./scripts/feeds install -a
make package/fwallow/compile V=s
make package/luci-app-fwallow/compile V=s
```

两个 .ipk 会出现在 `bin/packages/<架构>/`（本包为 `all`，可装到任意架构）：
`fwallow_0.1.0-1_all.ipk`、`luci-app-fwallow_0.1.0-1_all.ipk`

## 二、发布（做成 opkg 软件源）

把**编译输出的 `bin/packages/<架构>/` 整个目录**上传到任意静态服务器（或 GitHub Releases），该目录里已经有 OpenWrt 自动生成的索引文件（`Packages` / `Packages.gz`）。之后每次改代码重新编译，把新的 .ipk 覆盖上传即可——**不用重装，路由器端 `opkg upgrade` 就能更新**。

> 手工维护索引（不重新编译、直接替换某个 .ipk）时才需要：
> `opkg-make-index .`（opkg-utils 提供，SDK 的 `staging_dir/host/bin/` 下也有）。

## 三、路由器端安装 / 更新

```sh
# 1) 添加软件源（URL 换成你的托管地址）
cat >> /etc/opkg/customfeeds.conf <<'EOF'
src/gz fwallow https://example.com/fwallow/packages
EOF

# 2) 安装
opkg update
opkg install luci-app-fwallow fwallow

# 3) 以后更新（发布新版后）
opkg update
opkg list-upgradable        # 应看到 fwallow / luci-app-fwallow
opkg upgrade fwallow luci-app-fwallow
```

`/etc/config/fwallow` 与 `/etc/crontabs/root` 声明为 conffile，**upgrade 不会覆盖你在设备上改过的配置**。

## 四、使用

LuCI：`网络 → 防火墙 → 域名白名单转发`

每个转发规则直接配置自己的白名单，**支持任意多个域名 + 任意多个 IP/CIDR（并集放行）**：

- **允许的域名**：可加多个；每个域名解析出的所有 IP 都会加入白名单，每 10 分钟自动刷新、WAN 重拨立即刷新
- **允许的静态 IP**：可加多个，支持单个 IP 或 CIDR 网段，始终放行

UCI 示例（一个规则、两个域名、两个 IP）：

```
config forward 'web'
	option name 'web allowlist'
	option proto 'tcp'
	option src_dport '80'
	option dest_ip '192.168.1.100'
	option dest_port '80'
	list domain 'example.com'
	list domain 'cdn.example.net'
	list ip '203.0.113.8'
	list ip '198.51.100.0/24'
```

效果：只有来源 IP 命中集合（`example.com`、`cdn.example.net` 解析出的所有 IP ∪ 两个静态 IP）的客户端才能访问 `192.168.1.100:80`；其余来源走 wan 区默认策略被拒。

保存后自动生效：procd 监视 `/etc/config/fwallow` → `fwallow-sync` 生成 firewall 的 ipset/redirect 段 → `uci commit firewall` 触发 fw4 reload；随后 `fwallow-update` 解析域名 → `fw4 reload-sets` 刷新集合元素。

## 五、验证

```sh
fw4 print | grep fwallow          # 应看到 ip saddr @fwallow_<组> ... redirect to ...
nft list set inet fw4 fwallow_g1  # 集合内应为已解析的 IP
# 白名单外来源访问外部端口 → 拒绝；白名单内 → 正常转发
```

## 六、StoreOS / iStoreOS 安装说明

StoreOS 25.12.5（如构建号 2026092410）即 iStoreOS，基于 OpenWrt 25.12，默认 fw4，本包依赖直接满足。

方法 1（推荐，支持直接更新）— opkg 软件源，配合第七节的 GitHub Actions 自动发布：

```sh
# 路由器端添加软件源（URL 换成你的 gh-pages 地址，如 https://yangyunim.github.io/yyopenwrt/）
echo "src/gz fwallow https://yangyunim.github.io/yyopenwrt/" >> /etc/opkg/customfeeds.conf
opkg update && opkg install luci-app-fwallow fwallow
# 之后每次发布新版：
opkg update && opkg upgrade fwallow luci-app-fwallow
```

方法 2 — iStore 商店手动安装：下载 `.ipk` 后在 系统 → iStore 商店 上传安装（每次更新需手动重新上传）。

说明：本包会自动启用 busybox cron（域名每 10 分钟刷新）；若固件未装 cron，刷新仍由 WAN 重拨 hotplug 保证。

## 七、GitHub Actions 自动构建发布

仓库内 `.github/workflows/build.yml` 已提供全自动发版流程（轻量路径：用 opkg-utils 的 `ipkg-build` 直接打包纯脚本/JS 包，无需 OpenWrt 编译环境）：

1. 把本目录推送到 GitHub 仓库，并在仓库 Settings → Pages 里启用 GitHub Pages（Source 选 gh-pages 分支）。
2. 改代码后递增两个 Makefile 里的 `PKG_VERSION` / `PKG_RELEASE`，然后：
   ```sh
   git add -A && git commit -m "release 0.1.0"
   git tag v0.2.1 && git push && git push --tags
   ```
3. Actions 自动：打包 `fwallow_<ver>_all.ipk` 与 `luci-app-fwallow_<ver>_all.ipk` → 生成 `Packages` 索引 → 发布到 gh-pages → 挂到 Release。
4. 路由器端 `opkg update && opkg upgrade fwallow luci-app-fwallow` 完成更新。

> 若未来加入需要编译的 C 代码，改用标准路径：OpenWrt 源码树（含 iStoreOS 源码）`make package/<名>/compile`，见第一节。

## 八、已知限制

- 当前只处理 IPv4（`family ipv4`，集合类型 `ipv4_addr`）；IPv6 需扩展（ipset family ipv6 + AAAA 解析）。
- 域名解析依赖 `dig`（dnsutils 包）或 busybox `nslookup`；解析失败时集合保持旧元素，日志见系统日志。
- 要求 wan 区默认 input/forward 非 ACCEPT（OpenWrt 默认 REJECT/DROP），白名单外的连接才会被拒。
- 若日志出现 `Named set ... does not exist`，说明集合尚未创建，执行一次 `/etc/init.d/firewall reload` 即可（正常情况下 fwallow-sync 已自动完成）。
