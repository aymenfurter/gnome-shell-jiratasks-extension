const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;

const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Shell = imports.gi.Shell;
const Atk = imports.gi.Atk;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;

const IndicatorName = 'JiraTasks';

const ITEMS = 10;       
const MORE = 50;        
const USER = "username";
const USERNAME = "username";
const PWD = "pwd";
const JIRABASE = "http://jiraaddress";
const RESTURL = JIRABASE + "/rest/api/2/search?jql=status = 'To Do' AND assignee=" + USERNAME;
const Soup = imports.gi.Soup;


function PopupJIRATasksMenuItem() {
    this._init.apply(this, arguments);
}

PopupJIRATasksMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (text, gIcon, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        this.label = new St.Label({ text: text });
        this._icon = new St.Icon({
                gicon: gIcon,
                style_class: 'popup-menu-icon' });
        this.actor.add_child(this._icon, { align: St.Align.END });
        this.actor.add_child(this.label);
    },
};

function load_json_async(httpSession, url, cb, parent) {  
  let message = Soup.Message.new('GET', url);
  message.requestHeaders.append('Authorization', "Basic " + Base64.encodeB64(USERNAME + ":" + PWD ));
  httpSession.queue_message(message, function(session, message) {
      let data = JSON.parse(message.response_body.data);
      cb(data, parent);
  });
}

const JiraTasks = new Lang.Class({
    Name: IndicatorName,
    Extends: PanelMenu.Button,

    _init: function(metadata, params) {
        this.parent(null, IndicatorName);
        this.actor.accessible_role = Atk.Role.TOGGLE_BUTTON;

        this._icon = new St.Icon({ icon_name: 'view-more-symbolic', style_class: 'system-status-icon' }); 
        this.actor.add_actor(this._icon);
        this.actor.add_style_class_name('popup-combobox-item');        
        this.connect('destroy', Lang.bind(this, this._onDestroy));        
        this._setupAppMenuItems();        
    },

    _onDestroy: function() {
        this._monitor.cancel();        
    },  

    _reloadAppMenu: function() {
        this.menu.removeAll();
        this._setupAppMenuItems();        
    },
   
    _setupAppMenuItems: function(path) {        
        this._createDefaultApps();
    },

    _createDefaultApps: function() {        
        let httpSession = new Soup.SessionAsync();        
 
        let menuItem = new PopupJIRATasksMenuItem("Reload", null, {});
        this.menu.addMenuItem(menuItem);
        menuItem.connect('activate', Lang.bind(this, this._reloadAppMenu));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());


        let cb = function (data, parent) {
          for(var i = 0; i < data.issues.length; i++) {
              var obj = data.issues[i];
              
              let totalItems = data.total;                          
              parent._addItem("[" + obj.key + "] " + obj.fields.summary, JIRABASE + "/browse/" + obj.key);
          }            
        }
        load_json_async(httpSession, RESTURL, cb, this);
    },

    _addItem: function(itemTitle, url) {        
        let menuItem = this._createItem(itemTitle, function(w, ev) {
            Gio.app_info_launch_default_for_uri(
              url,
              global.create_app_launch_context(global.display.get_current_time_roundtrip(), -1)
           );
        });

        let sortKey = itemTitle;
        let pos = Util.lowerBound(this.menu._getMenuItems(), sortKey, function (a,b) {
            if (String(a.label.text).toUpperCase() > String(b).toUpperCase())
                return 0;
            else
                return -1;
        });
        this.menu.addMenuItem(menuItem, pos);
        return menuItem;
    },  
    _createItem: function(appInfo, callback) {
        let menuItem = new PopupJIRATasksMenuItem(appInfo, null, {});
        menuItem.connect('activate', Lang.bind(this, function (menuItem, event) {
                    callback(menuItem, event);
        }));

        return menuItem;
    },   

});

function init() {
}

let _indicator;

function enable() {
    _indicator = new JiraTasks();
    Main.panel.addToStatusArea(IndicatorName, _indicator);
}

function disable() {
    _indicator.destroy();
    _indicator = null;
}

var Base64 = {

// private property
_keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

// public method for encoding
encodeB64 : function (input) {
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;

    input = Base64._utf8_encode(input);

    while (i < input.length) {

        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);

        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;

        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }

        output = output +
        this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
        this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);

    }

    return output;
},

decodeB64 : function (input) {
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;

    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    while (i < input.length) {

        enc1 = this._keyStr.indexOf(input.charAt(i++));
        enc2 = this._keyStr.indexOf(input.charAt(i++));
        enc3 = this._keyStr.indexOf(input.charAt(i++));
        enc4 = this._keyStr.indexOf(input.charAt(i++));

        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;

        output = output + String.fromCharCode(chr1);

        if (enc3 != 64) {
            output = output + String.fromCharCode(chr2);
        }
        if (enc4 != 64) {
            output = output + String.fromCharCode(chr3);
        }

    }

    output = Base64._utf8_decode(output);

    return output;

},

// private method for UTF-8 encoding
_utf8_encode : function (string) {
    string = string.replace(/\r\n/g,"\n");
    var utftext = "";

    for (var n = 0; n < string.length; n++) {

        var c = string.charCodeAt(n);

        if (c < 128) {
            utftext += String.fromCharCode(c);
        }
        else if((c > 127) && (c < 2048)) {
            utftext += String.fromCharCode((c >> 6) | 192);
            utftext += String.fromCharCode((c & 63) | 128);
        }
        else {
            utftext += String.fromCharCode((c >> 12) | 224);
            utftext += String.fromCharCode(((c >> 6) & 63) | 128);
            utftext += String.fromCharCode((c & 63) | 128);
        }

    }

    return utftext;
},

// private method for UTF-8 decoding
_utf8_decode : function (utftext) {
    var string = "";
    var i = 0;
    var c = c1 = c2 = 0;

    while ( i < utftext.length ) {

        c = utftext.charCodeAt(i);

        if (c < 128) {
            string += String.fromCharCode(c);
            i++;
        }
        else if((c > 191) && (c < 224)) {
            c2 = utftext.charCodeAt(i+1);
            string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
            i += 2;
        }
        else {
            c2 = utftext.charCodeAt(i+1);
            c3 = utftext.charCodeAt(i+2);
            string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
            i += 3;
        }

    }

    return string;
}

}
