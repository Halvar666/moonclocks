/* Copyright (c) 2015 Andy McDonald. All rights reserved. */
/* Please refer to licence.txt for licensing terms. */

// ====================================================================================
/*global Components */

// ====================================================================================
(function(root) {
	"use strict";

	let EXT_URL_MODULE_DIR = 'chrome://moonclocks-modules/content/'; // resource://moonclocks/

	let wlmSyms = {};
	let zmSyms = {};

	Components.utils.import(EXT_URL_MODULE_DIR + "watchlistmanager.js", wlmSyms);
	Components.utils.import(EXT_URL_MODULE_DIR + "zonemanager.js", zmSyms);

	root.foxclocks = {
		utils:				(Components.utils.import(EXT_URL_MODULE_DIR + "utils.js", {})).FoxClocks_Utils,
		TimeFormatter:		(Components.utils.import(EXT_URL_MODULE_DIR + "timeformatter.js", {})).FoxClocks_TimeFormatter,
		prefManager:		(Components.utils.import(EXT_URL_MODULE_DIR + "prefmanager.js", {})).FoxClocks_PrefManager,
		updateManager:		(Components.utils.import(EXT_URL_MODULE_DIR + "updatemanager.js", {})).FoxClocks_UpdateManager,
		watchlistManager:	wlmSyms.FoxClocks_WatchlistManager,
		WatchlistItem:		wlmSyms.FoxClocks_WatchlistItem,
		zoneManager:		zmSyms.FoxClocks_ZoneManager,
		Location:			zmSyms.FoxClocks_Location
	};

})(this);