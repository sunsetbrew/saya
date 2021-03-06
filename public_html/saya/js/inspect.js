/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 No Face Press, LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
require([
    'dojo/ready','dijit/registry', 'dojo/dom', 'dojo/on', 'dojo/parser',
    'dojo/dom-style', '3p/handlebars', "dojo/request/xhr", "dojo/_base/lang",
    "gridx/core/model/cache/Sync", "gridx/Grid", "gridx/modules/Tree",
    "gridx/modules/SingleSort", "gridx/modules/Filter", "gridx/modules/Bar",
    "gridx/support/Summary", "gridx/support/QuickFilter", "gridx/modules/VirtualVScroller",
    'dojo/store/Memory', 'dijit/layout/TabContainer', 'dijit/layout/ContentPane', 'dojo/domReady!'
], function(ready,registry, dojoDom, on, parser,
    domStyle, HandleBars, xhr, lang,
    Cache, Grid, Tree,
    SingleSort, Filter, Bar,
    Summary, QuickFilter, VirtualVScroller,
    Memory, TabContainer, ContentPane) {


    var wjt = {
        init: function() {
        	this.content = registry.byId("tabs");
	}
    };

    var dom = {
        ipflag: dojoDom.byId("ipflag-template"),
        userflag: dojoDom.byId("userflag-template"),
        probeflag: dojoDom.byId("probeflag-template"),
        flag: dojoDom.byId("flag")
    };

    var userflag = HandleBars.compile(dom.userflag.innerHTML);
    var ipflag = HandleBars.compile(dom.ipflag.innerHTML);
    var probeflag = HandleBars.compile(dom.probeflag.innerHTML);

    var showFlag = function(x, y) {
        var offset = 24;
        var rect = dom.flag.getBoundingClientRect();
        if (x <= window.innerWidth * 2 / 3) {
            x += offset;
        } else {
            x -= rect.width + offset;
        }
        if (y <= window.innerHeight * 2 / 3) {
            y += offset;
        } else {
            y -= rect.height + offset;
        }
        domStyle.set(dom.flag, "left", x + 'px');
        domStyle.set(dom.flag, "top", y + 'px');
    };

    var hideFlag = function() {
        domStyle.set(dom.flag, "left", 10000 + 'px');
    };

    var getData = function() {

        return xhr("cgi/inspect.pl", {
            handleAs: "json"
        });
    };

    var createTabContainer = function(data) {
        if (!data.agent || !data.agent.usergroups || data.agent.usergroups.length == 0) {
		var panel = new ContentPane({
         		title: "Access Restricted",
			content: '<div class="errmsg">You are not authorized to view this content.</div>'

   		 });
		wjt.content.addChild(panel);
	    return;
        }
	var groups = {};
        for (var i = 0; i < data.suspects.length; i++) {
	    var group = data.suspects[i];
	    if (!(group.group_id in groups)) {
		groups[group.group_id] = 1;
		var panel = new ContentPane({
         		title: group.group_label,
			content: '<div id="grp' + group.group_id + '" />'

   		 });
		wjt.content.addChild(panel);
		   createSuspectsGrid("grp" + group.group_id, group, group.users, data.dupips, data.ips, data.probes);
		}
	    }
    };

    var createSuspectsGrid = function(panel, group, users, dupips, ips, probes) {


        var sharedIps = {};
        for (var i = 0; i < dupips.length; i++) {
            var dip = dupips[i];
            sharedIps[dip.ip] = {
                users: dip.users
            };
            var usernames = [];
            for (var j = 0; j < dip.users.length; j++) {
                usernames.push( dip.users[j] );
            }
            sharedIps[dip.ip].usernames = usernames;
        }

        var rowIndex = [];
        var mem = [];
        for (var i = 0; i < users.length; i++) {

            var suspect = users[i];
            var host = null;
            var entry;
            var children;

            for (var j = 0; j < suspect.log.length; j++) {
                var log = suspect.log[j];
                if (log.host != host) {
                    host = log.host;
                    children = [];
                    entry = {
                        id: rowIndex.length,
                        userid: suspect.userid,
                        user: suspect.user,
                        group_label: suspect.group_label,
                        host: host,
                        hits: 0,
                        last: log.last,
                        children: children
                    };
                    mem[mem.length] = entry;
                    rowIndex[rowIndex.length] = entry;
                }
                entry.hits += log.hits;
                if (entry.last < log.last) entry.last = log.last;
                var rec = {
                    id: rowIndex.length,
                    user: suspect.user,
                    group_label: suspect.group_label,
                    host: host,
                    last: log.last,
                    referer: log.referer,
                    probe: log.probe,
                    ip: log.ip,
                    hits: log.hits,
                    ipinfo: {
                        ip: log.ip
                    },
                    probeinfo: {
                        id: log.probe
                    }
                };
                if (ips[log.ip]) rec.ipinfo = ips[log.ip];
                if (probes[log.probe]) rec.probeinfo = probes[log.probe];
                if (sharedIps[log.ip])
                    rec.ipinfo.users = sharedIps[log.ip].usernames;
                children[children.length] = rec;
                rowIndex[rowIndex.length] = rec;
            }
        }


        var store = new Memory({
            data: {
                identifier: 'id',
                items: mem
            },
            getChildren: function(object) {
                if (object && object.children) return object.children;
                return [];
            },
            hasChildren: function(id, item) {
                return item && item.children && item.children.length;
            }
        });

        var structure = [{
            id: 'user',
            field: 'user',
            name: 'User',
            width: '160px',
            expandLevel: 1,
            decorator: function(value, id, row) {
                // only show for parent row
                return this[id].children ? value : "";
            }.bind(rowIndex)
        }, {
            id: 'host',
            field: 'host',
            name: 'Server',
            width: '220px',
            decorator: function(value, id, row) {
                // only show for parent row
                return this[id].children ? value : "";
            }.bind(rowIndex)
        }, {
            id: 'last',
            field: 'last',
            name: 'Date',
            width: '150px',
            decorator: function(value, id, row) {
                // only show for data part in parent row
                if (!this[id].children)
                    return value;
                var dparts = value.split(" ");
                return dparts[0];
            }.bind(rowIndex)
        }, {
            id: 'hits',
            field: 'hits',
            name: 'Hits',
            width: '40px'
        }, {
            id: 'ip',
            field: 'ip',
            name: 'IP Address',
            width: '130px',
            decorator: function(value, id, row) {
                // add style for entries with a shared ip
                if (this[String(value)]) {
                    return '<span class="sharedIP">' + value + '</span>';
                }
                return value;
            }.bind(sharedIps)
        }, {
            id: 'referer',
            field: 'referer',
            name: 'Last page to hit probe'
        }];

        var suspectsGrid = Grid({
	    autoHeight: true,
            style: "width:99%;padding:0",
            cacheClass: Cache,
            store: store,
            structure: structure,
            treeNested: true,
            barTop: [
                Summary, {
                    pluginClass: QuickFilter,
                    style: 'text-align: right;'
                }
            ],
            modules: [Tree, SingleSort, Filter, Bar, VirtualVScroller],
            //modules: [Tree, SingleSort, Filter, Bar],
        });
        suspectsGrid.placeAt(panel);

        var SGCOL_USER = 0;
        var SGCOL_IP = 4;
        var SGCOL_PROBE = 5;

        suspectsGrid.on("cellMouseOver", function(evt) {
            var cell = this.grid.cell(evt.rowId, evt.columnId, true);
            var entry = this.suspects[Number(cell.row.id)];
            if (entry.children && evt.columnIndex == SGCOL_USER) {
                flag.innerHTML = userflag(entry);
                showFlag(evt.pageX, evt.pageY);
            } else if (entry.ipinfo && evt.columnIndex == SGCOL_IP) {
                flag.innerHTML = ipflag(entry.ipinfo);
                showFlag(evt.pageX, evt.pageY);
            } else if (entry.probeinfo && evt.columnIndex == SGCOL_PROBE) {
                flag.innerHTML = probeflag(entry.probeinfo);
                showFlag(evt.pageX, evt.pageY);
            }
        }.bind({
            grid: suspectsGrid,
            suspects: rowIndex
        }));

        suspectsGrid.on("cellMouseOut", function(evt) {
            hideFlag();
        });

        suspectsGrid.startup();
    };

    ready(function() {
   	 parser.parse().then(function() {
	wjt.init();
        getData().then(createTabContainer);
	});
    });
});
