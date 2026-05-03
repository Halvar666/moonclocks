/* Copyright (c) 2015 Andy McDonald. All rights reserved. */
/* Please refer to licence.txt for licensing terms. */

pref("extensions.moonclocks.watchlist", '<Watchlist><WatchlistItem><Location><Zone id="Europe/London"/><Coordinates latitude="51.475" longitude="-0.3125"/></Location><Style><Statusbar visible="true" showflag="true"><UsualState colour="" bold="false" italic="false" underline="false"/><AlternateState enabled="false" colour="#660000" starttime="1020" endtime="540"/></Statusbar><StatusbarTooltip visible="true"/></Style></WatchlistItem><WatchlistItem><Location><Zone id="America/Los_Angeles"/></Location><Style><Statusbar visible="true" showflag="true"><UsualState colour="" bold="false" italic="false" underline="false"/><AlternateState enabled="false" colour="#660000" starttime="1020" endtime="540"/></Statusbar><StatusbarTooltip visible="true"/></Style></WatchlistItem><WatchlistItem><Location><Zone id="Asia/Hong_Kong"/><Coordinates latitude="22.28333" longitude="114.15"/></Location><Style><Statusbar visible="true" showflag="true"><UsualState colour="" bold="false" italic="false" underline="false"/><AlternateState enabled="false" colour="#660000" starttime="1020" endtime="540"/></Statusbar><StatusbarTooltip visible="true" showflag="false"/></Style></WatchlistItem></Watchlist>');

pref("extensions.moonclocks.format.clock.standard", "chrome://moonclocks/locale/defaults.properties");
pref("extensions.moonclocks.format.clock.custom", "chrome://moonclocks/locale/defaults.properties");
pref("extensions.moonclocks.format.tooltip.standard", "chrome://moonclocks/locale/defaults.properties");
pref("extensions.moonclocks.format.tooltip.custom", "chrome://moonclocks/locale/defaults.properties");
pref("extensions.moonclocks.format.moonclocks.standard", "chrome://moonclocks/locale/defaults.properties");
pref("extensions.moonclocks.format.moonclocks.custom", "chrome://moonclocks/locale/defaults.properties");

pref("extensions.moonclocks.clock.containertype", "fc-clock-containertype-statusbar");
pref("extensions.moonclocks.clock.style", "fc-clock-style-clocks");

// AFM - these two preferences are actually statusbar-specific
//
pref("extensions.moonclocks.clock.position.relative", "fc-clock-position-left");
pref("extensions.moonclocks.clock.position.specific.hidden", true); // AFM - no UI

// AFM - global clock preferences: fc-per-clock, fc-all-clocks, fc-no-clocks
//
pref("extensions.moonclocks.clock.bar.clock.global.showflag", "fc-per-clock"); // AFM - no UI
pref("extensions.moonclocks.clock.tooltip.clock.global.showflag", "fc-all-clocks");
pref("extensions.moonclocks.clock.moonclocks.clock.global.showflag", "fc-all-clocks"); // AFM - no UI

pref("extensions.moonclocks.clock.bar.clock.new.visible", true);
pref("extensions.moonclocks.clock.bar.clock.new.showflag", true);
pref("extensions.moonclocks.clock.tooltip.clock.new.visible", true);
pref("extensions.moonclocks.clock.tooltip.clock.new.showflag", true); // AFM - no UI

pref("extensions.moonclocks.data.update.auto.enabled", false);
pref("extensions.moonclocks.data.update.auto.alert.enabled", true);
pref("extensions.moonclocks.data.update.rawurl", ""); // AFM - no UI

pref("extensions.moonclocks.zonepicker.dataurl", "fc-zonepicker-dataurl-builtin"); // AFM - no UI
pref("extensions.moonclocks.watchlist.remove.confirm.enabled", true);

pref("extensions.moonclocks.toolbar.menuitem.hidden", false);
pref("extensions.moonclocks.toolbar.positions", '{"chrome://browser/content/browser.xul":{"toolbarId":"nav-bar","beforeId":null}}'); // AFM - no UI

// AFM - internal prefs - no UI
//
pref("extensions.moonclocks@halvar666.description", "chrome://moonclocks/locale/defaults.properties");
pref("extensions.moonclocks@halvar666.prevrun.version", "");
pref("extensions.moonclocks@halvar666.data.update.prevupdate", 0);
pref("extensions.moonclocks@halvar666.statusbar.forceshow", true);
pref("extensions.moonclocks@halvar666.toolbar.firsttime", true);

//AFM - pref syncing - all extensions.moonclocks. prefs
//
pref("services.sync.prefs.sync.extensions.moonclocks.watchlist", true);
pref("services.sync.prefs.sync.extensions.moonclocks.format.clock.standard", true);
pref("services.sync.prefs.sync.extensions.moonclocks.format.clock.custom", true);
pref("services.sync.prefs.sync.extensions.moonclocks.format.tooltip.standard", true);
pref("services.sync.prefs.sync.extensions.moonclocks.format.tooltip.custom", true);
pref("services.sync.prefs.sync.extensions.moonclocks.format.moonclocks.standard", true);
pref("services.sync.prefs.sync.extensions.moonclocks.format.moonclocks.custom", true);
pref("services.sync.prefs.sync.extensions.moonclocks.clock.containertype", true);
pref("services.sync.prefs.sync.extensions.moonclocks.clock.style", true);
pref("services.sync.prefs.sync.extensions.moonclocks.clock.position.relative", true);
pref("services.sync.prefs.sync.extensions.moonclocks.clock.position.specific.hidden", true);
pref("services.sync.prefs.sync.extensions.moonclocks.clock.bar.clock.global.showflag", true);
pref("services.sync.prefs.sync.extensions.moonclocks.clock.tooltip.clock.global.showflag", true);
pref("services.sync.prefs.sync.extensions.moonclocks.clock.moonclocks.clock.global.showflag", true);
pref("services.sync.prefs.sync.extensions.moonclocks.clock.bar.clock.new.visible", true);
pref("services.sync.prefs.sync.extensions.moonclocks.clock.bar.clock.new.showflag", true);
pref("services.sync.prefs.sync.extensions.moonclocks.clock.tooltip.clock.new.visible", true);
pref("services.sync.prefs.sync.extensions.moonclocks.clock.tooltip.clock.new.showflag", true);
pref("services.sync.prefs.sync.extensions.moonclocks.data.update.auto.enabled", true);
pref("services.sync.prefs.sync.extensions.moonclocks.data.update.auto.alert.enabled", true);
pref("services.sync.prefs.sync.extensions.moonclocks.data.update.rawurl", true);
pref("services.sync.prefs.sync.extensions.moonclocks.zonepicker.dataurl", true);
pref("services.sync.prefs.sync.extensions.moonclocks.watchlist.remove.confirm.enabled", true);
pref("services.sync.prefs.sync.extensions.moonclocks.toolbar.positions", true);