include $(TOPDIR)/rules.mk

PKG_NAME:=fwallow
PKG_VERSION:=0.2.0
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=fwallow developer <you@example.com>
PKG_URL:=https://example.com/fwallow

include $(INCLUDE_DIR)/package.mk

define Package/fwallow
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Domain/IP allowlist for firewall port forwards (fw4)
  URL:=https://example.com/fwallow
  DEPENDS:=+firewall4
  PKGARCH:=all
endef

# 用户配置文件与定时任务标记为 conffile：
# opkg upgrade 时保留设备上已有修改，不被新版覆盖
define Package/fwallow/conffiles
/etc/config/fwallow
/etc/crontabs/root
endef

define Package/fwallow/description
  Generates fw4 ipset + redirect rules so that port forwards only
  accept connections from an allowlist (static IPs/CIDRs plus IPs
  resolved from configured domains). Domains are refreshed by
  fwallow-update via cron and WAN reconnect hotplug.
endef

define Package/fwallow/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DIR) $(1)/etc/crontabs
	$(INSTALL_DIR) $(1)/etc/hotplug.d/iface
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_DIR) $(1)/etc/fwallow.d
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/etc/init.d/fwallow $(1)/etc/init.d/fwallow
	$(INSTALL_BIN) ./files/usr/bin/fwallow-sync $(1)/usr/bin/fwallow-sync
	$(INSTALL_BIN) ./files/usr/bin/fwallow-update $(1)/usr/bin/fwallow-update
	$(INSTALL_BIN) ./files/etc/hotplug.d/iface/20-fwallow $(1)/etc/hotplug.d/iface/20-fwallow
	$(INSTALL_BIN) ./files/etc/uci-defaults/fwallow $(1)/etc/uci-defaults/fwallow
	$(INSTALL_DATA) ./files/etc/config/fwallow $(1)/etc/config/fwallow
	$(INSTALL_DATA) ./files/etc/crontabs/root $(1)/etc/crontabs/root
endef

$(eval $(call BuildPackage,fwallow))
