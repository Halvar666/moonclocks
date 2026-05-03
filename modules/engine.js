/* Copyright (c) 2015 Andy McDonald. All rights reserved. */
/* Please refer to licence.txt for licensing terms. */

// ====================================================================================
/*global Components */

// ====================================================================================
(function(root, factory) {
	"use strict";

	let EXT_URL_MODULE_DIR = 'chrome://moonclocks-modules/content/'; // resource://moonclocks/

	let utils =				(Components.utils.import(EXT_URL_MODULE_DIR + "utils.js", {})).FoxClocks_Utils;
	let updateManager =		(Components.utils.import(EXT_URL_MODULE_DIR + "updatemanager.js", {})).FoxClocks_UpdateManager;
	let prefManager =		(Components.utils.import(EXT_URL_MODULE_DIR + "prefmanager.js", {})).FoxClocks_PrefManager;
	let watchlistManager =	(Components.utils.import(EXT_URL_MODULE_DIR + "watchlistmanager.js", {})).FoxClocks_WatchlistManager;
	let zoneManager =		(Components.utils.import(EXT_URL_MODULE_DIR + "zonemanager.js", {})).FoxClocks_ZoneManager;

	utils.exportSymbols(root, factory(Components, utils.console, utils, updateManager, prefManager, watchlistManager, zoneManager));

}(this,

// ====================================================================================
function(Components, console, utils, updateManager, prefManager, watchlistManager, zoneManager) {
	"use strict";

	// ====================================================================================
	var CI = Components.interfaces, CC = Components.classes;

	// ====================================================================================
	function Engine()
	{
		this._started = null; // AFM - tri-state boolean
		this._observerService = CC["@mozilla.org/observer-service;1"].getService(CI.nsIObserverService);
		this._secondTimer = CC["@mozilla.org/timer;1"].createInstance(CI.nsITimer);
	}

	// ====================================================================================
	Engine.prototype =
	{
		startup: function(data, reasonText, callback)
		{
			if (this._started !== null)
			{
				console.warn("foxclocks.Engine::startup(): startup already in progress");
				return;
			}

			this._started = false;
			var self = this;

			prefManager.declarePrefAsXml("extensions.moonclocks.watchlist");

			var legacyPrefs = prefManager.getPrefNames('foxclocks.');
			if (legacyPrefs.length > 0)
			{
				console.warn("foxclocks.Engine::startup(): found legacy preferences - migrating");

				for (var i=0; i < legacyPrefs.length; i++)
				{
					var legacyPref = legacyPrefs[i];
					prefManager.setPref('extensions.' + legacyPref, prefManager.getPref(legacyPref));
				}

				prefManager.deleteBranch('foxclocks.');
				prefManager.deleteBranch('services.sync.prefs.sync.foxclocks.');
			}

			var appName = utils.getAppInfo().appName;
			var startupStartTime = new Date();
			console.log("foxclocks.Engine::startup(): starting up on " + appName + " with reason " + reasonText + "...");

			if (reasonText === 'APP_STARTUP' && (appName === 'Firefox' || appName === 'SeaMonkey' || appName === 'Pale Moon')) // AFM - event only for these apps
			{
				console.log("foxclocks.Engine::startup(): waiting for session restore event");

				var restoreObserver = { observe: function(subject, topic, data) {

					self._observerService.removeObserver(restoreObserver, "sessionstore-windows-restored");

					console.log("foxclocks.Engine::startup(): got session restore event");
					self._checkVersion();
				}};

				// AFM - ASAP or we might miss the event
				//
				this._observerService.addObserver(restoreObserver, "sessionstore-windows-restored", false);
			}
			else
			{
				self._checkVersion();
			}

			let dataFile = CC["@mozilla.org/file/directory_service;1"].getService(CI.nsIProperties).get("ProfD", CI.nsIFile);
			dataFile.append("moonclocks");

			try
			{
				if (!dataFile.exists() || !dataFile.isDirectory())
					dataFile.create(CI.nsIFile.DIRECTORY_TYPE, -1);
			}
			catch (ex)
			{
				console.error("foxclocks.Engine::startup(): FATAL: cannot create moonclocks directory in profile");
				self.shutdown();
				return;
			}

			dataFile.append("zones.json");

			zoneManager.init(dataFile);
			zoneManager.loadZoneData(function(success) {

				if (success === false)
				{
					console.error("foxclocks.Engine::startup(): FATAL: cannot load zone data");
					self.shutdown();
					return;
				}

				self._initUpdateManager();

				zoneManager.loadZonePicker(function(success) {

					if (success === false)
					{
						console.error("foxclocks.Engine::startup(): FATAL: cannot load zone picker");
						self.shutdown();
						return;
					}

					// AFM - empty watchlist names are taken from the zone picker, so we need to wait for the zone picker
					// to be available before we create the watchlist
					//
					watchlistManager.watchlistFromXmlString(zoneManager.getZoneData(), prefManager.getPref("extensions.moonclocks.watchlist"));

					self._started = true;
					console.log("foxclocks.Engine::startup(): startup done in " + (new Date().getTime() - startupStartTime.getTime()) + "ms");

					if (typeof(callback) === 'function')
						callback();

					self._observerService.notifyObservers(self, "moonclocks", "engine:started");

					prefManager.addPrefObserver("extensions.moonclocks.", self);
					self._observerService.addObserver(self, "moonclocks", false);
				});
			});

			var timerCallback = {
				notify: function(){

					self._observerService.notifyObservers(self, "moonclocks", "engine:tick");

					// no need to cancel
					//
					self._secondTimer.initWithCallback(this, 1000 - new Date().getMilliseconds(), CI.nsITimer.TYPE_ONE_SHOT);
				}
			};

			timerCallback.notify();
		},

		// ====================================================================================
		shutdown: function()
		{
			prefManager.removePrefObserver("extensions.moonclocks.", this);

			try {this._observerService.removeObserver(this, "moonclocks");} catch(ex){}
			try {this._observerService.removeObserver(this, "sessionstore-windows-restored");} catch(ex){}

			this._secondTimer.cancel();

			this._started = null;
		},

		// ====================================================================================
		// AFM - nsIObserver
		observe: function(aSubject, aTopic, aData)
		{
			if (aTopic === "moonclocks")
			{
				if (aData === "updatemanager:update-complete")
					this._onZoneDataUpdate();
			}
			else if (aTopic === "nsPref:changed")
			{
				switch (aData)
				{
					case "extensions.moonclocks.data.update.auto.enabled": this._initUpdateManager(); break;
					case "extensions.moonclocks.data.update.rawurl": this._initUpdateManager(); break;
					case "extensions.moonclocks.data.update.manifesturl": this._initUpdateManager(); break;

					case "extensions.moonclocks.watchlist":

						watchlistManager.watchlistFromXmlString(zoneManager.getZoneData(), prefManager.getPref("extensions.moonclocks.watchlist"));
						this._observerService.notifyObservers(watchlistManager, "moonclocks", "engine:watchlist-changed");
						break;

					case "extensions.moonclocks.zonepicker.dataurl":

						var self = this;
						zoneManager.loadZonePicker(function(success) {
							if (success)
								self._observerService.notifyObservers(null, "moonclocks", "engine:zone-picker-changed");
						}, true);

						break;
				}
			}
			else if (aTopic === "alertclickcallback")
			{
				if (aData === "engine-internal:moonclocks-zone-data-update-complete:new")
					utils.openFoxClocksDbUpdate();
			}
		},

		// ====================================================================================
		_checkVersion : function()
		{
			utils.getFoxClocksVersion(function(foxClocksVersion) {

				var prevRunVersion = prefManager.getPref("extensions." + utils.FC_GUID_FOXCLOCKS + ".prevrun.version");
				prefManager.setPref("extensions." + utils.FC_GUID_FOXCLOCKS + ".prevrun.version", foxClocksVersion);

				if (prevRunVersion === "")
				{
					console.log("foxclocks.Engine::_checkVersion(): install - version", foxClocksVersion);
					utils.openFoxClocksInstall(foxClocksVersion);
				}
				else
				{
					var comparison = CC["@mozilla.org/xpcom/version-comparator;1"]
						.getService(CI.nsIVersionComparator).compare(prevRunVersion, foxClocksVersion);

					if (comparison < 0)
					{
						console.log("foxclocks.Engine::_checkVersion(): update - versions", prevRunVersion, foxClocksVersion);
						utils.openFoxClocksUpdate(foxClocksVersion, prevRunVersion);
					}
				}
			});
		},

		// ====================================================================================
		_initUpdateManager: function()
		{
			console.log("+foxclocks.Engine::_initUpdateManager()");

			var autoUpenabled = prefManager.getPref("extensions.moonclocks.data.update.auto.enabled");
			var rawUrl = prefManager.getPref("extensions.moonclocks.data.update.rawurl");
			var manifestUrl = prefManager.getPref("extensions.moonclocks.data.update.manifesturl");

			var remoteUrl = null;
			var remoteUrlMode = null;

			// Hidden tester override: a direct GPL-compatible zones.json URL.
			if (rawUrl !== null && rawUrl !== "")
			{
				remoteUrl = rawUrl;
				remoteUrlMode = "raw";
			}
			else if (manifestUrl !== null && manifestUrl !== "")
			{
				remoteUrl = manifestUrl;
				remoteUrlMode = "manifest";
			}

			// MoonClocks updates only its timezone database here.
			// This is not an XPI/add-on update mechanism.
			updateManager.init(autoUpenabled && remoteUrl !== null && remoteUrl !== "", remoteUrl, remoteUrlMode);

			// AFM - the way the GUI is notified of these changes is poor; if the devel param is modified,
			// eg, the GUI doesn't update (because it's not watching the extensions.{ branch
			//

			console.log("-foxclocks.Engine::_initUpdateManager()");
		},

		// ====================================================================================
		_onZoneDataUpdate: function()
		{
			if (updateManager.getLastUpdateResult().result !== "OK_NEW")
			{
				this._observerService.notifyObservers(updateManager, "moonclocks", "engine:zone-data-update-complete");
				return;
			}

			var self = this;
			zoneManager.loadZoneData(function(success) {

				if (success === true)
				{
					console.log("foxclocks.Engine::_onZoneDataUpdate(): reinitialised on new data");

					if (prefManager.getPref("extensions.moonclocks.data.update.auto.alert.enabled") === true)
					{
						var alertText = CC["@mozilla.org/intl/stringbundle;1"].getService(CI.nsIStringBundleService)
							.createBundle("chrome://moonclocks/locale/foxclocks.properties")
							.GetStringFromName("options.data.update.last.status.ok_new.label");

						try
						{
							// AFM  observe 'alertclickcallback', 'alertfinished'
							//
							CC["@mozilla.org/alerts-service;1"].getService(CI.nsIAlertsService).showAlertNotification("chrome://moonclocks/skin/icon32.png",
									"MoonClocks", alertText, true, "engine-internal:moonclocks-zone-data-update-complete:new", self, "MoonClocks");
						}
						catch (ex)
						{
							console.error("foxclocks.Engine::_onZoneDataUpdate()", ex); // AFM - NS_ERROR_NOT_AVAILABLE is a known exception
						}
					}
				}
				else
				{
					console.error("foxclocks.Engine::_onZoneDataUpdate(): could not reinitialise on new data");
				}

				self._observerService.notifyObservers(updateManager, "moonclocks", "engine:zone-data-update-complete");
			});
		}
	};

	// ====================================================================================
	return [{name: 'FoxClocks_Engine', constructor: Engine, is_service: true}];

}));