/* Copyright (c) 2015 Andy McDonald. All rights reserved. */
/* Please refer to licence.txt for licensing terms. */

// ====================================================================================
/*global Components, foxclocks */

// ====================================================================================
(function(root, factory) {
	"use strict";

	let AddonManager =	(Components.utils.import("resource://gre/modules/AddonManager.jsm", {})).AddonManager;

	let Overlay = factory(Components, foxclocks.utils.console, AddonManager, foxclocks.utils, foxclocks.updateManager,
							foxclocks.prefManager, foxclocks.watchlistManager, foxclocks.TimeFormatter);

	let overlay = null;
	let onOverlayReady = function() {

		if (overlay === null)
		{
			overlay = new Overlay();
			overlay.startup();
		}
	};

	let onShutdown = function() {

		root.removeEventListener("overlayready.moonclocks", onOverlayReady);
		root.removeEventListener("shutdown.moonclocks", onShutdown);

		if (overlay !== null)
		{
			overlay.shutdown();
			overlay = null;
		}
	};

	root.addEventListener("overlayready.moonclocks", onOverlayReady);
	root.addEventListener("shutdown.moonclocks", onShutdown);

}(this,

// ====================================================================================
function(Components, console, AddonManager, utils, updateManager, prefManager, watchlistManager, TimeFormatter) {
	"use strict";

	// ====================================================================================
	function Overlay()
	{
		this.clockTimeFormatter = new TimeFormatter();
		this.tooltipTimeFormatter = new TimeFormatter();

		this.toolbox = null;
		this.clockTooltip = null;
		this.clockTooltipUpdate = false;
		this.clockContainerType = null;
		this.customizing = null;
		this.restoreAddonBarTo = { parentNode: null, heightStyle: null };
		this.activeExtensions = [];

		var self = this;

		this.addonListener = {

			onInstalling: function(addon, needsRestart) {
				if (needsRestart === false)
					this.handle(true, addon);
			},

			onEnabling: function(addon, needsRestart) {
				if (needsRestart === false)
					this.handle(true, addon);
			},

			onUninstalled: function(addon) {
				this.handle(false, addon);
			},

			onDisabled: function(addon) {
				this.handle(false, addon);
			},

			handle: function(isActive, addon) {

				if (utils.FC_GUID_STATUSBAR_EXTENSIONS.indexOf(addon.id) === -1)
					return;

				let index = self.activeExtensions.indexOf(addon.id);

				if (isActive === true && index === -1)
					self.activeExtensions.push(addon.id);

				if (isActive === false && index !== -1)
					self.activeExtensions.splice(index, 1);

				self.setClocksContainerType('extension_state_change');
			}
		};

		this.customizationListener = {

			beforeCustomization: function()
			{
				console.log("+foxclocks.Overlay::beforeCustomization()");

				if (self.customizing !== null)
					return;

				self.customizing = {
					notInToolbarBefore: document.querySelector("toolbar #foxclocksoverlay-toolbaritem-clocks") === null
				};

				self.createClocks();
				self.updateView();

				console.log("-foxclocks.Overlay::beforeCustomization()");
			},

			afterCustomization: function()
			{
				console.log("+foxclocks.Overlay::afterCustomization()");

				if (self.customizing === null)
					return;

				let notInToolbarBefore = self.customizing.notInToolbarBefore;
				self.customizing = null;

				let item = document.querySelector("toolbar #foxclocksoverlay-toolbaritem-clocks");
				let positionsPref = prefManager.getPref("extensions.moonclocks.toolbar.positions");
				let positions = {};

				try
				{
					positions = JSON.parse(positionsPref);
				}
				catch (ex)
				{
					console.error("foxclocks.Overlay::afterCustomization(): failed to parse extensions.moonclocks.toolbar.positions", positionsPref);
				}

				let beforeId = item !== null && item.nextSibling !== null ? item.nextSibling.getAttribute("id") : null;
				if (beforeId !== null)
					beforeId = beforeId.replace(/^wrapper-/i, '');

				positions[window.location.href] = { toolbarId: (item !== null ? item.parentNode.getAttribute("id") : null), beforeId: beforeId };

				prefManager.removePrefObserver("extensions.moonclocks.", self);
				prefManager.setPref("extensions.moonclocks.toolbar.positions", JSON.stringify(positions));
				prefManager.addPrefObserver("extensions.moonclocks.", self);

				if (self.clockContainerType === "fc-clock-containertype-statusbar" && item !== null && notInToolbarBefore === true)
				{
					console.log("foxclocks.Overlay::afterCustomization(): moving from statusbar to toolbar via pref change");
					prefManager.setPref("extensions.moonclocks.clock.containertype", "fc-clock-containertype-toolbar");
				}
				else
				{
					self.createClocks();
				}

				console.log("-foxclocks.Overlay::afterCustomization()");
			}
		};
	}

	// ====================================================================================
	Overlay.prototype =
	{
		// ====================================================================================
		startup : function()
		{
			console.log("+foxclocks.Overlay::startup()");

			this.toolbox = document.getElementById("navigator-toolbox") || document.getElementById("mail-toolbox") || document.getElementById("compose-toolbox");
			this.clockTooltipUpdate = false;
			this.customizing = null;
			this.activeExtensions = [];

			let statusbar = document.getElementById('status-bar');
			let appName = utils.getAppInfo().appName.toLowerCase().replace(/ /g, '-');

			if (statusbar !== null && appName !== '')
				statusbar.classList.add('foxclocks-' + appName);

			this._setToolbarItem();

			var self = this;

			AddonManager.getAddonsByIDs(utils.FC_GUID_STATUSBAR_EXTENSIONS, function(addons) {

				for (let i=0; i < addons.length; i++)
				{
					let currAddon = addons[i];

					if (currAddon === null || typeof(currAddon) !== 'object') // Nightly bug
						console.warn("foxclocks.Overlay::startup(): bad addon info at index", i);
					else if (currAddon.isActive)
						self.activeExtensions.push(currAddon.id);
				}

				self.clockTooltip = document.getElementById("foxclocksoverlay-clock-tooltip");

				self.clockTooltip.addEventListener("popupshowing", function(event) { self.clockTooltipUpdate = true; self.updateView(); });
				self.clockTooltip.addEventListener("popuphidden", function(event) { self.clockTooltipUpdate = false; });

				self.setClocksFormat();
				self.setTooltipFormat();
				self.setMenuItemState();

				self.setClocksContainerType('startup');

				self.createClocks();
				self.updateView();

				prefManager.addPrefObserver("extensions.moonclocks.", self);

				Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService).addObserver(self, "moonclocks", false);
				AddonManager.addAddonListener(self.addonListener);


				if (self.toolbox !== null)
				{
					self.toolbox.addEventListener("beforecustomization", self.customizationListener.beforeCustomization);
					self.toolbox.addEventListener("aftercustomization", self.customizationListener.afterCustomization);
				}

				console.log("-foxclocks.Overlay::startup()");
			});
		},

		// ====================================================================================
		shutdown : function()
		{
			console.log("+foxclocks.Overlay::shutdown()");

			// AFM - don't strictly need to do this if normal shutdown
			//
			this._restoreAddonBar();

			var newTooltip = this.clockTooltip.cloneNode(true);
			this.clockTooltip.parentNode.replaceChild(newTooltip, this.clockTooltip); // clears event listeners

			prefManager.removePrefObserver("extensions.moonclocks.", this);

			Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService).removeObserver(this, "moonclocks");
			AddonManager.removeAddonListener(this.addonListener);

			if (this.toolbox !== null)
			{
				this.toolbox.removeEventListener("beforecustomization", this.customizationListener.beforeCustomization);
				this.toolbox.removeEventListener("aftercustomization", this.customizationListener.afterCustomization);

				if (typeof(this.toolbox.palette) === 'object')
				{
					let item = this.toolbox.palette.querySelector('#foxclocksoverlay-toolbaritem-clocks');

					if (item !== null)
						item.parentNode.removeChild(item);
				}
			}

			console.log("-foxclocks.Overlay::shutdown()");
		},

		// ====================================================================================
		_setToolbarItem : function()
		{
			console.log("+foxclocks.Overlay::_setToolbarItem()");

			if (this.toolbox === null)
				return;

			let itemId = 'foxclocksoverlay-toolbaritem-clocks';
			let item = document.getElementById(itemId);

			if (item === null && typeof(this.toolbox.palette) === 'object')
			{
				item = this.toolbox.palette.querySelector('#' + itemId);

				if (item === null)
				{
					// No idea why foxclocksoverlay.xul doesn't create this for Firefox and Thunderbird
					//
					console.log("foxclocks.Overlay::_setToolbarItem(): creating toolbaritem in palette");

					let label = document.getElementById('foxclocksoverlay-toolbarbutton-clocks-label').getAttribute('label');

					item = document.createElement('toolbaritem');
					item.setAttribute('id', itemId);
					item.setAttribute('class', 'chromeclass-toolbar-additional overlay-unloadable');
					item.setAttribute('removable', 'true');
					item.setAttribute('tooltip', 'foxclocksoverlay-clock-tooltip');
					item.setAttribute('label', label); // For Firefox, Thunderbird palette

					let button = document.createElement('toolbarbutton');
					button.setAttribute('id', 'foxclocksoverlay-toolbarbutton-clocks');
					button.setAttribute('class', 'toolbarbutton-1');
					button.setAttribute('align', 'center');
					button.setAttribute('command', 'cmd_fcov_openfc');
					button.setAttribute('label', label); // For Firefox menu panel and Thunderbird toolbar (text, icon/text mode)
					button.setAttribute('title', label); // Magically stops double label in Thunderbird and SM palette

					if (utils.getAppInfo().appName === 'Firefox')
						button.setAttribute('wrap', 'true'); // For Firefox menu panel - messes up Thunderbird and SM toolbar button text height slightly

					let box = document.createElement('hbox');
					box.setAttribute('id', 'foxclocksoverlay-toolbaritem-box');
					box.setAttribute('align', 'center');

					item.appendChild(button);
					item.appendChild(box);
					this.toolbox.palette.appendChild(item);

					console.log("foxclocks.Overlay::_setToolbarItem(): toolbaritem added to palette");
				}
				else
				{
					console.log("foxclocks.Overlay::_setToolbarItem(): toolbaritem already in palette");
				}
			}
			else
			{
				console.log("foxclocks.Overlay::_setToolbarItem(): toolbaritem already exists in document or palette");
			}

			let positionsPref = prefManager.getPref("extensions.moonclocks.toolbar.positions");
			let positions = {};

			try
			{
				positions = JSON.parse(positionsPref);
			}
			catch (ex)
			{
				console.error("foxclocks.Overlay::_setToolbarItem(): failed to parse extensions.moonclocks.toolbar.positions", positionsPref);
			}

			let toolboxPositions = positions[window.location.href];
			if (typeof(toolboxPositions) === 'object' && toolboxPositions.toolbarId !== null)
			{
				let toolbar = document.getElementById(toolboxPositions.toolbarId);
				if (toolbar !== null)
				{
					let before = toolboxPositions.beforeId !== null ? document.getElementById(toolboxPositions.beforeId) : null;
					if (before === null)
					{
						let currentSetArray = toolbar.getAttribute("currentset").split(",");
						let itemIndex = currentSetArray.indexOf(itemId);

						if (itemIndex >= 0)
						{
							for (let i=itemIndex + 1; i < currentSetArray.length; i++)
							{
								before = document.getElementById(currentSetArray[i]);

								if (before !== null)
									break;
							}
						}
					}

					if (typeof(toolbar.insertItem) === 'function') // SeaMonkey bug? This function should exist
						toolbar.insertItem(itemId, before);

					console.log("foxclocks.Overlay::_setToolbarItem(): added to toolbar based on prefs", toolboxPositions, typeof(toolbar.insertItem) === 'function');
				}
				else
				{
					console.warn("foxclocks.Overlay::_setToolbarItem(): cannot find toolbar from toolbarId", toolboxPositions.toolbarId);
				}
			}

			console.log("-foxclocks.Overlay::_setToolbarItem()");
		},

		// ====================================================================================
		_moveAddonBar : function()
		{
			var bottomBox = document.getElementById('browser-bottombox');
			var addonBar = document.getElementById('addon-bar');

			if (bottomBox !== null && addonBar !== null && bottomBox.querySelector("#status-bar") === null && addonBar.parentNode !== bottomBox)
			{
				this.restoreAddonBarTo.parentNode = addonBar.parentNode;
				this.restoreAddonBarTo.heightStyle = window.getComputedStyle(addonBar).getPropertyValue("height");

				bottomBox.appendChild(addonBar);
				addonBar.style.setProperty("height", "auto", "important");

				console.log("foxclocks.Overlay::_moveAddonBar(): moved");
			}
		},

		// ====================================================================================
		_restoreAddonBar : function()
		{
			let addonBar = document.getElementById('addon-bar');

			if (addonBar === null)
				return;

			if (this.restoreAddonBarTo.parentNode !== null)
			{
				if (this.restoreAddonBarTo.parentNode !== addonBar.parentNode)
				{
					this.restoreAddonBarTo.parentNode.appendChild(addonBar);
					console.log("foxclocks.Overlay::_restoreAddonBar(): restored");
				}

				this.restoreAddonBarTo.parentNode = null;
			}

			if (this.restoreAddonBarTo.heightStyle !== null)
			{
				addonBar.style.setProperty("height", this.restoreAddonBarTo.heightStyle, "important");
				this.restoreAddonBarTo.heightStyle = null;
			}
		},

		// ====================================================================================
		// AFM - implementing nsIObserver
		//
		observe : function(subject, topic, data)
		{
			if (topic == "moonclocks")
			{
				if (data == "engine:watchlist-changed")
				{
					this.createClocks();
				}
				else if (data == "engine:zone-data-update-complete")
				{
					if (updateManager.getLastUpdateResult().result == "OK_NEW")
						this.createClocks();
				}
			}
			else if (topic == "nsPref:changed")
			{
				switch (data)
				{
					case "extensions.moonclocks.clock.containertype": this.setClocksContainerType('clock_container_type_changed'); this.createClocks(); break;
					case "extensions.moonclocks.clock.style": this.setClocksVisibility(); break;
					case "extensions.moonclocks.clock.position.relative": this.createClocks(); break;
					case "extensions.moonclocks.format.clock.standard": this.setClocksFormat(); break;
					case "extensions.moonclocks.format.clock.custom": this.setClocksFormat(); break;
					case "extensions.moonclocks.format.tooltip.standard": this.setTooltipFormat(); break;
					case "extensions.moonclocks.format.tooltip.custom": this.setTooltipFormat(); break;
					case "extensions.moonclocks.clock.bar.clock.global.showflag": this.createClocks(); break;
					case "extensions.moonclocks.clock.tooltip.clock.global.showflag": this.createClocks(); break;
					case "extensions.moonclocks.toolbar.menuitem.hidden": this.setMenuItemState(); break;
					case "extensions.moonclocks.toolbar.positions": this._setToolbarItem(); this.createClocks(); break;
				}
			}

			this.updateView();
		},

		// ====================================================================================
		updateView : function()
		{
			var nowDate = new Date();

			for (var i=0; i < watchlistManager.getWatchlist().length; i++)
			{
				var watchlistItem = watchlistManager.getItem(i);
				var clock = document.getElementById('foxclocksoverlay-clock-id-' + i);

				if (clock == null || clock.hidden)
					continue;

				var sbarFormatter = watchlistItem.getStatusbarTimeFormatter() != null ?
					watchlistItem.getStatusbarTimeFormatter() : this.clockTimeFormatter;

				clock.setAttribute("label", sbarFormatter.getTimeString(watchlistItem.location, nowDate));

				var colour = watchlistItem.colour;

				if (watchlistItem.altColour_enabled)
				{
					var instantInfo = watchlistItem.location.zone.getInstantInfo(nowDate);
					if (instantInfo !== null)
					{
						var localDate = new Date(nowDate.getTime() + instantInfo.offset_mins * 1000 * 60);
						var minsPastMidnight = localDate.getUTCHours() * 60 + localDate.getUTCMinutes();

						var startTime = watchlistItem.altColour_startTime;
						var endTime = watchlistItem.altColour_endTime;

						if (startTime < endTime)
						{
							if (minsPastMidnight >= startTime && minsPastMidnight < endTime)
								colour = watchlistItem.altColour;
						}
						else
						{
							if (!(minsPastMidnight >= endTime && minsPastMidnight < startTime))
								colour = watchlistItem.altColour;
						}
					}
				}

				var clockPanelLabel = this.getClockPanelLabel(clock);
				if (clockPanelLabel != null)
				{
					if (colour != "")
						clockPanelLabel.setAttribute("style", "color:" + colour + " !important;");
					else
						clockPanelLabel.removeAttribute("style");
				}
			}

			// AFM - update tooltip if visible
			//
			var clockTooltipGrid = this.clockTooltip.firstChild;
			if (clockTooltipGrid && this.clockTooltipUpdate)
			{
				var gridRows = clockTooltipGrid.lastChild;
				for (var j=0; j < gridRows.childNodes.length; j++)
				{
					var gridRow = gridRows.childNodes[j];
					var locationIndex = gridRow.getAttribute("value");

					if (locationIndex && locationIndex != "fc-nolocs-row")
					{
						var currWatchlistItem = watchlistManager.getItem(locationIndex);

						var tooltipFormatter = currWatchlistItem.getTooltipTimeFormatter() != null ?
							currWatchlistItem.getTooltipTimeFormatter() : this.tooltipTimeFormatter;

						var timeText = tooltipFormatter.getTimeString(currWatchlistItem.location, nowDate);

						var pos = timeText.indexOf("\t");
						var label1Value = null;
						var label2Value = null;

						if (pos != -1)
						{
							label1Value = timeText.substring(0, pos);
							label2Value = timeText.substring(pos + 1).replace("\t", "", "g");
						}
						else
						{
							label1Value = "";
							label2Value = timeText;
						}

						gridRow.childNodes[2].lastChild.setAttribute("value", label1Value);
						gridRow.childNodes[3].lastChild.setAttribute("value", label2Value);
					}
				}
			}
		},

		// ====================================================================================
		setClocksContainerType : function(context)
		{
			this.clockContainerType = prefManager.getPref("extensions.moonclocks.clock.containertype");

			if (this.clockContainerType == "fc-clock-containertype-statusbar" && utils.getAppInfo().appName === 'Firefox' && this.activeExtensions.length === 0)
				this._moveAddonBar();
			else
				this._restoreAddonBar();
		},

		// ====================================================================================
		setClocksFormat : function()
		{
			var standardFormat = prefManager.getPref("extensions.moonclocks.format.clock.standard");
			var customFormat = prefManager.getPref("extensions.moonclocks.format.clock.custom");

			this.clockTimeFormatter.setTimeFormat(standardFormat == "" ? customFormat : standardFormat);
		},

		// ====================================================================================
		setTooltipFormat : function()
		{
			var standardFormat = prefManager.getPref("extensions.moonclocks.format.tooltip.standard");
			var customFormat = prefManager.getPref("extensions.moonclocks.format.tooltip.custom");

			this.tooltipTimeFormatter.setTimeFormat(standardFormat == "" ? customFormat : standardFormat);
		},

		// ====================================================================================
		setMenuItemState : function()
		{
			var hideMenuItem = prefManager.getPref("extensions.moonclocks.toolbar.menuitem.hidden");

			var menuItem = document.getElementById("foxclocksoverlay-menuitem");
			if (menuItem != null)
				menuItem.collapsed = hideMenuItem;

			var appMenuMenuItem = document.getElementById("foxclocksoverlay-menuitem-appmenu");
			if (appMenuMenuItem != null)
				appMenuMenuItem.collapsed = hideMenuItem;
		},

		// ====================================================================================
		setClocksVisibility : function()
		{
			var clockStyle = prefManager.getPref("extensions.moonclocks.clock.style");

			var showToolbarButton = (this.clockContainerType == "fc-clock-containertype-toolbar" && (clockStyle == "fc-clock-style-icon" || this.customizing !== null));

			// In SeaMonkey, the button exists in the current document, even when it's in the palette, so we explicitly look for the button in the toolbar or new
			// menu panel thing
			//
			var toolbarButton = document.querySelector("toolbar #foxclocksoverlay-toolbarbutton-clocks") ||
				document.querySelector('#foxclocksoverlay-toolbaritem-clocks[cui-areatype="menu-panel"] #foxclocksoverlay-toolbarbutton-clocks');

			if (toolbarButton !== null)
				toolbarButton.setAttribute("hidden", showToolbarButton ? "false" : "true");

			// No context menu when in menu panel - https://bugzilla.mozilla.org/show_bug.cgi?id=892463
			//
			var showContext = true;

			var item = document.querySelector('#foxclocksoverlay-toolbaritem-clocks');
			if (item !== null)
			{
				if (item.getAttribute('cui-areatype') === 'menu-panel')
					showContext = false;

				if (showContext)
					item.setAttribute('context', 'foxclocksoverlay-clock-context');
				else
					item.removeAttribute('context');

				if (clockStyle === "fc-clock-style-clocks")
					item.classList.add('panel-wide-item');
				else
					item.classList.remove('panel-wide-item');
			}

			var showStatusbarIcon = (this.clockContainerType == "fc-clock-containertype-statusbar" && clockStyle == "fc-clock-style-icon");
			var statusbarPanelIcon = document.getElementById("foxclocksoverlay-statusbarpanel-icon");

			if (statusbarPanelIcon)
				statusbarPanelIcon.setAttribute("hidden", showStatusbarIcon ? "false" : "true");

			for (var i=0; i < watchlistManager.getWatchlist().length; i++)
			{
				var clock = document.getElementById('foxclocksoverlay-clock-id-' + i);
				if (clock != null)
				{
					var item = watchlistManager.getItem(i);
					clock.hidden = (showToolbarButton || showStatusbarIcon || item == null || item.showClock_statusbar == false);

					if (showContext)
						clock.setAttribute('context', 'foxclocksoverlay-clock-context');
					else
						clock.removeAttribute('context');
				}
			}

			// AFM - due to the 'persistent tooltip' Firefox bug, for now, don't show the tooltip if
			// there are no locations in it, rather than showing '(no locations selected)'. Exception is
			// when we're in icon mode (only point of icon mode is to see the tooltip)
			// Note that this bug only applies to the statusbar, but for consistency this workaround
			// isn't statusbar-specific
			//
			var clockTooltipGrid = this.clockTooltip.firstChild;
			if (clockTooltipGrid)
			{
				var gridRows = clockTooltipGrid.lastChild;

				if (	gridRows.childNodes.length == 1 &&
						gridRows.childNodes[0].getAttribute("value") == "fc-nolocs-row" &&
						clockStyle != "fc-clock-style-icon")
				{
					this.clockTooltip.setAttribute("collapsed", "true");
				}
				else
				{
					this.clockTooltip.removeAttribute("collapsed");
				}
			}
		},

		// ====================================================================================
		createClocks : function()
		{
			console.log("+foxclocks.Overlay::createClocks()");

			var globalClockShowflagPref = prefManager.getPref("extensions.moonclocks.clock.bar.clock.global.showflag");
			var globalTooltipShowflagPref = prefManager.getPref("extensions.moonclocks.clock.tooltip.clock.global.showflag");

			// AFM - subtle: blow away the clocks and clockTooltipGrid from all possible places
			//
			var allClockContainerIds = ["status-bar", "foxclocksoverlay-toolbaritem-box"];

			for (var x=0; x < allClockContainerIds.length; x++)
			{
				var currClockContainer = document.getElementById(allClockContainerIds[x]);
				if (currClockContainer == null)
					continue;

				var foxclocksChildren = currClockContainer.getElementsByClassName('foxclocks');
				for (var k = foxclocksChildren.length - 1; k >= 0; k--)
				{
					currClockContainer.removeChild(foxclocksChildren[k]);
				}
			}

			var clockTooltipGrid = this.clockTooltip.firstChild;

			if (clockTooltipGrid != null)
				this.clockTooltip.removeChild(clockTooltipGrid);

			var clockContainer = document.getElementById(this.clockContainerType === "fc-clock-containertype-statusbar" ? "status-bar" : "foxclocksoverlay-toolbaritem-box");
			if (clockContainer === null)
			{
				// AFM - container dragged off toolbar, for example
				//
				this.setClocksVisibility();

				console.log("-foxclocks.Overlay::createClocks(): no container");
				return;
			}

			var clockType = this.clockContainerType === "fc-clock-containertype-statusbar" ? "statusbarpanel" : "foxclocks-clockpanel";
			var clocksPosnRelative = prefManager.getPref("extensions.moonclocks.clock.position.relative");

			// AFM - create tool tip grid/columns/column/rows elements
			//
			clockTooltipGrid = document.createElement("grid");
			clockTooltipGrid.setAttribute("flex", "1");
			this.clockTooltip.appendChild(clockTooltipGrid);

			var gridColumns = document.createElement("columns");
			gridColumns.appendChild(document.createElement("column"));
			gridColumns.appendChild(document.createElement("column"));
			gridColumns.appendChild(document.createElement("column"));
			clockTooltipGrid.appendChild(gridColumns);

			var gridRows = document.createElement("rows");
			clockTooltipGrid.appendChild(gridRows);

			var previousClock = null;
			var clockId = 0;

			var clickHandler = function(event) { if (event.button == 0) utils.openChromeMoonClocks(); };

			var startIndex = this.clockContainerType == "fc-clock-containertype-statusbar" ? -1 : 0;
			for (var i = startIndex; i < watchlistManager.getWatchlist().length; i++)
			{
				var clock = null;

				if (i == -1)
				{
					// AFM - -1 => must be in statusbar
					//
					clock = document.createElement(clockType);
					clock.setAttribute("id", "foxclocksoverlay-statusbarpanel-icon");
					clock.setAttribute("class", "statusbarpanel-iconic foxclocks overlay-unloadable");
					clock.addEventListener("click", clickHandler, false);
				}
				else
				{
					var watchlistItem = watchlistManager.getItem(i);

					// AFM - don't use i, in case we've 'continued' above
					//
					var clockIdString = "foxclocksoverlay-clock-id-" + clockId++;

					clock = document.createElement(clockType);
					clock.setAttribute("id", clockIdString);
					clock.addEventListener("click", clickHandler, false);

					if (this.clockContainerType == "fc-clock-containertype-toolbar")
						clock.setAttribute("labelclass", "toolbarbutton-text foxclocks-toolbar-clock-text");

					var classString = "overlay-unloadable foxclocks foxclocks-clock ";

					if (watchlistItem.bold == true) classString += "foxclocks-bold ";
					if (watchlistItem.italic == true) classString += "foxclocks-italic ";
					if (watchlistItem.underline == true) classString += "foxclocks-underline ";

					if (	globalClockShowflagPref != "fc-no-clocks" &&
							(	watchlistItem.showClock_statusbarFlag == true ||
								globalClockShowflagPref == "fc-all-clocks")
						)
					{
						var flagUrl = watchlistItem.getFlagUrl();
						if (flagUrl != "")
						{
							clock.setAttribute("src", flagUrl);

							if (this.clockContainerType == "fc-clock-containertype-statusbar")
								classString += "statusbarpanel-iconic-text";
						}
					}

					clock.setAttribute("class", classString);

					// AFM - generate the tool tip grid row
					//
					if (watchlistItem.showClock_statusbarTooltip == true)
					{
						var gridRow = document.createElement("row");

						// AFM - store index of location corresponding to tooltip row
						// so we can get the location's time when updating the tooltip
						//
						gridRow.setAttribute("value", i);
						gridRow.setAttribute("align", "center");

						var imageHBox = document.createElement("hbox");
						imageHBox.setAttribute("align", "start");

						var imageElement = document.createElement("image");
						imageHBox.appendChild(imageElement);

						if (	globalTooltipShowflagPref != "fc-no-clocks" &&
								(	watchlistItem.showClock_statusbarTooltipFlag == true ||
									globalTooltipShowflagPref == "fc-all-clocks")
							)
						{
							var flagUrl = watchlistItem.getFlagUrl();
							if (flagUrl != "")
							{
								imageElement.setAttribute("src", flagUrl);
							}
						}

						gridRow.appendChild(imageElement);

						var label = document.createElement("label");
						label.setAttribute("value", watchlistItem.location.getName());

						gridRow.appendChild(label);

						var hbox = document.createElement("hbox");
						hbox.setAttribute("align", "right");
						hbox.setAttribute("class", "location");
						hbox.appendChild(document.createElement("label"));
						gridRow.appendChild(hbox);

						hbox = document.createElement("hbox");
						hbox.setAttribute("align", "left");
						hbox.setAttribute("class", "time");
						hbox.appendChild(document.createElement("label"));
						gridRow.appendChild(hbox);

						gridRows.appendChild(gridRow);
					}
				}

				// AFM - attributes common to the 'icon' clock and normal clocks
				//
				clock.setAttribute("tooltip", "foxclocksoverlay-clock-tooltip");

				if (previousClock)
				{
					if (previousClock.nextSibling != null)
						clockContainer.insertBefore(clock, previousClock.nextSibling);
					else
						clockContainer.appendChild(clock);
				}
				else
				{
					// AFM - first clock going in to the clockContainer
					//
					if (this.clockContainerType == "fc-clock-containertype-statusbar")
					{
						var statusbarIndex = null;

						if (clocksPosnRelative == "fc-clock-position-left")
							statusbarIndex = 0;
						else if (clocksPosnRelative == "fc-clock-position-right")
							statusbarIndex = clockContainer.childNodes.length;
						else
							statusbarIndex = Number(clocksPosnRelative);

						if (clockContainer.childNodes.length == 0 || statusbarIndex > clockContainer.childNodes.length - 1)
							clockContainer.appendChild(clock);
						else
							clockContainer.insertBefore(clock, clockContainer.childNodes[statusbarIndex]);
					}
					else //  "fc-clock-containertype-toolbar" or anything else
					{
						clockContainer.appendChild(clock);
					}
				}

				previousClock = clock;
			}

			if (gridRows.childNodes.length == 0)
			{
				// AFM - generate the tool tip grid row when there are no locations to be displayed
				// in the tooltip
				//
				var gridRow = document.createElement("row");
				gridRow.setAttribute("value", "fc-nolocs-row");

				var label = document.createElement("label");
				label.setAttribute("value", document.getElementById("foxclocksoverlay-nolocs-label").getAttribute("label"));
				label.setAttribute("disabled", "true");

				gridRow.appendChild(label);
				// AFM - don't add second column. Naughty but seems to make it look nicer...
				// gridRow.appendChild(document.createElement("label"));

				gridRows.appendChild(gridRow);
			}

			this.setClocksVisibility();

			console.log("-foxclocks.Overlay::createClocks()");
		},

		// ====================================================================================
		getClockPanelLabel : function(clock) { return this.clockContainerType == "fc-clock-containertype-statusbar" ?
				document.getAnonymousElementByAttribute(clock, "class", "statusbarpanel-text") :
				document.getAnonymousElementByAttribute(clock, "anonid", "label"); },

		// ====================================================================================
		// AFM - legacy code to support CuteMenus: http://www.extensionsmirror.nl/index.php?showtopic=4360
		//
		onMenuItemCmd : function(event) { utils.openChromeMoonClocks(); }
	};

	// ====================================================================================
	return Overlay;
}));