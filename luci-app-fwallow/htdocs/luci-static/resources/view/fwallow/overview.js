'use strict';
'require view';
'require form';
'require uci';

return view.extend({
	load() {
		return Promise.all([
			uci.load('fwallow')
		]);
	},

	render() {
		let m, s, o;

		m = new form.Map('fwallow', _('Firewall - Domain/IP Allowlist Port Forwards'),
			_('Each rule below forwards an external port to an internal host, but only accepts connections whose source IP is in the rule\'s allowlist: the union of all IPs resolved from the listed domains plus all listed static IPs/CIDRs. Other clients fall through to the default WAN zone policy and are rejected.'));

		s = m.section(form.GridSection, 'forward', _('Port Forwards (allowlist restricted)'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable  = true;
		s.cloneable = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = true;

		o = s.option(form.ListValue, 'proto', _('Protocol'));
		o.value('tcp', 'TCP');
		o.value('udp', 'UDP');
		o.value('tcpudp', 'TCP + UDP');
		o.default = 'tcp';

		o = s.option(form.Value, 'src_dport', _('External port'),
			_('Port on the router (WAN side) that is forwarded.'));
		o.datatype = 'portrange';
		o.rmempty = true;

		o = s.option(form.Value, 'dest_ip', _('Internal IP address'),
			_('Redirect matched incoming traffic to this internal host.'));
		o.datatype = 'ipaddr';
		o.rmempty = false;

		o = s.option(form.Value, 'dest_port', _('Internal port'),
			_('Port on the internal host.'));
		o.datatype = 'portrange';
		o.rmempty = true;

		o = s.option(form.DynamicList, 'domain', _('Allowed domains'),
			_('Add multiple domains. All IPs resolved from these domains are allowed (refreshed every 10 minutes and on WAN reconnect).'));
		o.datatype = 'hostname';
		o.rmempty = true;

		o = s.option(form.DynamicList, 'ip', _('Allowed static IPs'),
			_('Add multiple IPs or CIDR networks that are always allowed.'));
		o.datatype = 'or(cidr,ipaddr)';
		o.rmempty = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '1';

		return m.render();
	}
});
