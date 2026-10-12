include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-fwallow
PKG_VERSION:=0.2.0
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=fwallow developer <you@example.com>

LUCI_TITLE:=Domain/IP allowlist for firewall port forwards (UI)
LUCI_DEPENDS:=+fwallow +luci-app-firewall +luci-base
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
