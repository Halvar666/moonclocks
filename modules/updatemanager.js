/* Copyright (c) 2015 Andy McDonald. All rights reserved. */
/* Please refer to licence.txt for licensing terms. */

// ====================================================================================
/*global Components */

// ====================================================================================
(function(root, factory) {
	"use strict";

	let EXT_URL_MODULE_DIR = 'chrome://moonclocks-modules/content/'; // resource://moonclocks/

	let utils =			(Components.utils.import(EXT_URL_MODULE_DIR + "utils.js", {})).FoxClocks_Utils;
	let prefManager =	(Components.utils.import(EXT_URL_MODULE_DIR + "prefmanager.js", {})).FoxClocks_PrefManager;
	let zoneManager =	(Components.utils.import(EXT_URL_MODULE_DIR + "zonemanager.js", {})).FoxClocks_ZoneManager;

	utils.exportSymbols(root, factory(Components, utils.console, utils, prefManager, zoneManager));

}(this,

// ====================================================================================
function(Components, console, utils, prefManager, zoneManager) {
	"use strict";

	// ====================================================================================
	let CI = Components.interfaces, CC = Components.classes;
	var UPDATE_INTERVAL_SECS = 604800; // week
	var MANIFEST_SCHEMA = "moonclocks-tzdb-update-1";

	// ====================================================================================
	function UpdateManager()
	{
		this._nextUpdateDate = null; // null if automatic updates disabled
		this._lastUpdateResult = { result: "NONE", server_time: null }; // result: "ERROR", "OK_NEW", "OK_NO"
		this._lastUpdateDate = null;

		this._timer = CC["@mozilla.org/timer;1"].createInstance(CI.nsITimer);
		this._remoteUrl = null;
		this._remoteUrlMode = null; // "manifest", "raw", or legacy FoxClocks-style response
	}

	// ====================================================================================
	UpdateManager.prototype =
	{
		// ====================================================================================
		init: function(enabled, remoteUrl, remoteUrlMode)
		{
			this._remoteUrl = remoteUrl;

			// Backwards compatibility with the old boolean argument:
			// true = raw zones.json, false = legacy server response.
			if (remoteUrlMode === true)
				this._remoteUrlMode = "raw";
			else if (remoteUrlMode === false)
				this._remoteUrlMode = "legacy";
			else
				this._remoteUrlMode = remoteUrlMode;

			this._setUpdateDates(enabled);
		},

		// ====================================================================================
		updateNow: function(type)
		{
			var url = this._remoteUrl;

			if (url === null || url === "")
			{
				console.log("foxclocks.UpdateManager::updateNow(): no update URL configured");
				this._onResponseProcessed("OK_NO", null);
				return;
			}

			if (type === 'manual')
				url = this._addQueryParam(url, 'time', new Date().getTime());

			if (this._remoteUrlMode === "manifest")
			{
				this._requestJson(url, function(manifestText, manifest, error) {
					this._onManifestResponse(manifestText, manifest, error, type);
				}.bind(this));
				return;
			}

			this._requestJson(url, function(responseText, response, error) {
				this._onResponse(response, error);
			}.bind(this));
		},

		// ====================================================================================
		getNextUpdateDate: function() { return this._nextUpdateDate; },
		getLastUpdateResult: function() { return this._lastUpdateResult; },
		getLastUpdateDate: function() { return this._lastUpdateDate; },

		// ====================================================================================
		_addQueryParam: function(url, name, value)
		{
			return url + (url.indexOf('?') === -1 ? '?' : '&') + name + '=' + encodeURIComponent(value);
		},

		// ====================================================================================
		_requestJson: function(url, callback)
		{
			try
			{
				var req = CC["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(CI.nsIXMLHttpRequest);
				req.open('GET', url, true);
				req.responseType = 'text';
				try { req.overrideMimeType('application/json'); } catch (ex) {}

				req.addEventListener('loadend', function(e) {
					try
					{
						// status 0 is acceptable for local file URLs in test profiles.
						if (req.status !== 0 && (req.status < 200 || req.status >= 300))
							throw "HTTP status " + req.status;

						var responseText = req.responseText;
						var response = JSON.parse(responseText);
						callback(responseText, response, null);
					}
					catch (ex)
					{
						callback(null, null, ex);
					}
				}, false);

				req.send(null);
				console.log("foxclocks.UpdateManager::_requestJson(): request sent to url " + url);
			}
			catch (ex)
			{
				console.error("foxclocks.UpdateManager::_requestJson(): failed", ex);
				callback(null, null, ex);
			}
		},

		// ====================================================================================
		_onManifestResponse: function(manifestText, manifest, error, type)
		{
			try
			{
				if (error !== null)
					throw error;

				this._validateManifest(manifest);

				if (manifest.enabled !== true)
				{
					console.log("foxclocks.UpdateManager::_onManifestResponse(): update channel disabled");
					this._onResponseProcessed("OK_NO", null);
					return;
				}

				var manifestVersion = manifest.version;
				if (typeof(manifestVersion) !== 'string' && manifest.source && typeof(manifest.source.version) === 'string')
					manifestVersion = manifest.source.version;

				if (utils.compareTzdbVersions(manifestVersion, zoneManager.dataSource.version) <= 0)
				{
					console.log("foxclocks.UpdateManager::_onManifestResponse(): no newer database", manifestVersion, zoneManager.dataSource.version);
					this._onResponseProcessed("OK_NO", null);
					return;
				}

				var zonesUrl = manifest.zones.url;
				var requestUrl = (type === 'manual') ? this._addQueryParam(zonesUrl, 'time', new Date().getTime()) : zonesUrl;

				this._requestJson(requestUrl, function(zonesText, zonesJson, zonesError) {
					this._onManifestZonesResponse(manifest, zonesText, zonesJson, zonesError);
				}.bind(this));
			}
			catch (ex)
			{
				console.error("foxclocks.UpdateManager::_onManifestResponse()", ex);
				this._onResponseProcessed("ERROR", null);
			}
		},

		// ====================================================================================
		_onManifestZonesResponse: function(manifest, zonesText, tz_db, error)
		{
			try
			{
				if (error !== null)
					throw error;

				this._validateZoneData(tz_db);

				if (zonesText.length !== manifest.zones.size)
					throw "Downloaded zones.json size mismatch";

				var actualSha256 = utils.sha256String(zonesText);
				if (actualSha256.toLowerCase() !== manifest.zones.sha256.toLowerCase())
					throw "Downloaded zones.json SHA-256 mismatch";

				if (utils.compareTzdbVersions(tz_db.source.version, zoneManager.dataSource.version) <= 0)
				{
					console.log("foxclocks.UpdateManager::_onManifestZonesResponse(): downloaded database is not newer", tz_db.source.version, zoneManager.dataSource.version);
					this._onResponseProcessed("OK_NO", null);
					return;
				}

				this._writeZoneData(tz_db);
			}
			catch (ex)
			{
				console.error("foxclocks.UpdateManager::_onManifestZonesResponse()", ex);
				this._onResponseProcessed("ERROR", null);
			}
		},

		// ====================================================================================
		_validateManifest: function(manifest)
		{
			if (manifest === null || typeof(manifest) !== 'object')
				throw "Bad manifest";

			if (manifest.schema !== MANIFEST_SCHEMA)
				throw "Unsupported manifest schema";

			if (typeof(manifest.version) !== 'string')
				throw "Manifest version missing";

			if (typeof(manifest.zones) !== 'object' || manifest.zones === null)
				throw "Manifest zones block missing";

			if (manifest.zones.schema_version !== 1.2)
				throw "Unsupported zones schema version";

			if (!utils.isHttpsUrl(manifest.zones.url))
				throw "Manifest zones URL must be HTTPS";

			if (typeof(manifest.zones.sha256) !== 'string' || !/^[0-9a-f]{64}$/i.test(manifest.zones.sha256))
				throw "Manifest zones SHA-256 missing or invalid";

			if (typeof(manifest.zones.size) !== 'number' || manifest.zones.size <= 0 || manifest.zones.size > 10 * 1024 * 1024)
				throw "Manifest zones size missing or invalid";
		},

		// ====================================================================================
		_validateZoneData: function(tz_db)
		{
			if (tz_db === null || typeof(tz_db) !== 'object')
				throw "Bad timezone database";

			if (tz_db.schema_version !== 1.2)
				throw "Unsupported timezone database schema";

			if (typeof(tz_db.source) !== 'object' || tz_db.source === null || typeof(tz_db.source.version) !== 'string')
				throw "Timezone database source metadata missing";

			if (typeof(tz_db.zones) !== 'object' || tz_db.zones === null)
				throw "Timezone database zones block missing";
		},

		// ====================================================================================
		_onResponse: function(response, error)
		{
			var serverTime = null;

			try
			{
				if (error !== null)
					throw error;

				if (response === null)
					throw 'Bad response';

				var tz_db = null;

				if (this._remoteUrlMode !== "raw")
				{
					console.log("foxclocks.UpdateManager::_onResponse(): status: " + JSON.stringify(response.response_status));

					if (typeof(response.response_status.current_time) === 'string')
						serverTime = new Date(response.response_status.current_time);

					if (response.response_status.error)
						throw response.response_status.error;

					if (typeof(response.tz_db) !== 'undefined')
						tz_db = response.tz_db;
				}
				else
				{
					tz_db = response;
				}

				this._validateZoneData(tz_db);

				if (utils.compareTzdbVersions(tz_db.source.version, zoneManager.dataSource.version) > 0)
					this._writeZoneData(tz_db, serverTime);
				else
					this._onResponseProcessed("OK_NO", serverTime);
			}
			catch (ex)
			{
				console.error("foxclocks.UpdateManager::_onResponse()", ex);
				this._onResponseProcessed("ERROR", serverTime);
			}
		},

		// ====================================================================================
		_writeZoneData: function(tz_db, serverTime)
		{
			var self = this;
			utils.writeToFile(JSON.stringify(tz_db), zoneManager.dataFile, function(result, success) {

				if (success)
				{
					self._onResponseProcessed("OK_NEW", serverTime || null);
				}
				else
				{
					console.error("foxclocks.UpdateManager::_writeZoneData()", result);
					self._onResponseProcessed("ERROR", serverTime || null);
				}
			});
		},

		// ====================================================================================
		_onResponseProcessed: function(result, serverTime)
		{
			this._lastUpdateResult = { result: result, server_time: serverTime };
			this._setUpdateDates();

			CC["@mozilla.org/observer-service;1"].getService(CI.nsIObserverService)
				.notifyObservers(this, "moonclocks", "updatemanager:update-complete");
		},

		// ====================================================================================
		_setUpdateDates: function(enabled)
		{
			enabled = (typeof(enabled) === 'boolean' ? enabled : this._nextUpdateDate !== null);
			var prevUpdatePref = "extensions." + utils.FC_GUID_FOXCLOCKS + ".data.update.prevupdate";
			var now = new Date();
			var millisToNextUpdate = null;

			if (this._lastUpdateDate === null)
			{
				var prevUpdateSecs = prefManager.getPref(prevUpdatePref);

				if (prevUpdateSecs === 0)
				{
					this._lastUpdateDate = now;
					millisToNextUpdate = 0;
				}
				else
				{
					this._lastUpdateDate = new Date(prevUpdateSecs * 1000);
					millisToNextUpdate = Math.max(this._lastUpdateDate.getTime() - now.getTime() + (UPDATE_INTERVAL_SECS * 1000), 0);
				}
			}
			else
			{
				this._lastUpdateDate = now;
				millisToNextUpdate = UPDATE_INTERVAL_SECS * 1000;
			}

			prefManager.setPref(prevUpdatePref, Math.round(this._lastUpdateDate.getTime()/1000));

			if (enabled !== false)
			{
				this._nextUpdateDate = new Date(now.getTime() + millisToNextUpdate);

				// AFM - implicitly cancels an outstanding timer
				//
				var self = this;
				this._timer.initWithCallback(function() { self.updateNow('automatic'); }, millisToNextUpdate, CI.nsITimer.TYPE_ONE_SHOT);

				console.log("foxclocks.UpdateManager::_setUpdateDates(): auto-update enabled: next update", this._nextUpdateDate.toLocaleString());
			}
			else if (this._nextUpdateDate !== null)
			{
				this._nextUpdateDate = null;
				this._timer.cancel();
				console.log("foxclocks.UpdateManager::_setUpdateDates(): auto-update disabled");
			}
		}
	};

	// ====================================================================================
	return [{name: 'FoxClocks_UpdateManager', constructor: UpdateManager, is_service: true}];

}));
