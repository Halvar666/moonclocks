/* Copyright (c) 2015 Andy McDonald. All rights reserved. */
/* Please refer to licence.txt for licensing terms. */

// ====================================================================================
/*global Components, foxclocks */

// ====================================================================================
(function(root) {
	"use strict";

	// ====================================================================================
	let console = foxclocks.utils.console;

	// ====================================================================================
	function MainManager()
	{
		this.zonePicker = null;
		this.watchlistTree = null;
		this.searchBox = null;
		this.watchlistDropAtIndex = null; // AFM - null => drop at end
		this.timeFormatter = new foxclocks.TimeFormatter();
		this.inOnZonePickerSelect = false;

		this.ZP_DST_INDICATOR_STRING = "*";
	}

	// ====================================================================================
	MainManager.prototype =
	{
		// ====================================================================================
		onLoad : function()
		{
			this.zonePicker = document.getElementById("fc-zonepicker");
			this.watchlistTree = document.getElementById("fc-watchlist");
			this.searchBox = document.getElementById("fc-zonepicker-searchbox");
			this.searchBox.setAttribute("class", "fc-zonepicker-searchbox-inactive");
			this.setTimeFormat();

			foxclocks.utils.getMoonClocksVersion(function(foxClocksVersion) {
				document.getElementById("fc-foxclocks-version-label").setAttribute("value",
						"MoonClocks " + foxClocksVersion + " (" + foxclocks.zoneManager.dataSource.version + ")");
			});

			// AFM - missing locale strings
			//
			if (this.searchBox.getAttribute("fc_init_value") === "")
				this.searchBox.setAttribute("collapsed", "true");

			this.startup();
		},

		// ====================================================================================
		startup : function()
		{
			console.log("+foxclocks.MainManager::startup()");

			this.populateZonePicker();
			this.populateWatchlist();

			foxclocks.prefManager.addPrefObserver("extensions.moonclocks.", this);

			var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
			observerService.addObserver(this, "moonclocks", false);

			console.log("-foxclocks.MainManager::startup()");
		},

		// ====================================================================================
		onUnload : function()
		{
			foxclocks.prefManager.removePrefObserver("extensions.moonclocks.", this);

			var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
			try {observerService.removeObserver(this, "moonclocks");} catch(ex){}
		},

		// AFM - START, EVENTS
		//

		// ====================================================================================
		onWatchListKeyPress : function(event)
		{
			if (event.keyCode === KeyEvent.DOM_VK_ENTER || event.keyCode === KeyEvent.DOM_VK_RETURN)
				this.onOpenLocDetailsCmd();
		},

		// ====================================================================================
		onZonePickerSelect : function()
		{
			// AFM - horrible way to disable selecting non-terminal nodes
			//

			// AFM - prevent recursion. this.zonePicker.view.selection.selectEventsSuppressed
			// doesn't seem to work inside an event handler - in fact causes recursion.
			// We're called back again when we clear a container's selection, so can't use
			// toggleSelection since we'll reselect the container. Yuk.
			//
			if (this.inOnZonePickerSelect)
				return;

			this.inOnZonePickerSelect = true;

			console.log("+foxclocks.MainManager::onZonePickerSelect()");

			var rangeCount = this.zonePicker.view.selection.getRangeCount();

			for (var i=0; i < rangeCount; i++)
			{
				var start = {};
				var end = {};
				this.zonePicker.view.selection.getRangeAt(i, start, end);
				for (var c = start.value; c != -1 && c <= end.value; c++)
				{
					var treeItem = this.zonePicker.view.getItemAtIndex(c);

					if (treeItem.getAttribute("container") === "true")
						this.zonePicker.view.selection.clearRange(c, c);
				}
			}

			this.setZonePickerStates();
			this.inOnZonePickerSelect = false;

			console.log("-foxclocks.MainManager::onZonePickerSelect()");
		},

		// ====================================================================================
		onOpenZoneDetailsCmd : function()
		{
			var location = this.getSelectedZonePickerLocation();
			if (!location)
				return;

			// AFM - ignore return value
			//
			var wathlistItem = new foxclocks.WatchlistItem(location);
			this.openZoneInfo(wathlistItem, "ZONE");
		},

		// ====================================================================================
		onOpenZoneGoogleEarthCmd : function()
		{
			var location = this.getSelectedZonePickerLocation();

			if (location)
				foxclocks.utils.openOpenStreetMap(location);
		},

		// ====================================================================================
		onImportCmd : function()
		{
			var dialogTitle = document.getElementById("fc-dialog-import-title").getAttribute("label");
			var foxClocksFilter = "*." + foxclocks.utils.MC_SETTINGS_EXTENSION;
			var filterText = document.getElementById("fc-dialog-importexport-filter-label").getAttribute("label") +
				" (" + foxClocksFilter + ")";

			var nsIFilePicker = Components.interfaces.nsIFilePicker;
			var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
			fp.init(window, dialogTitle, nsIFilePicker.modeOpen);
			fp.appendFilter(filterText, foxClocksFilter);
			fp.appendFilters(nsIFilePicker.filterAll);

			var res = fp.show();

			if (res != nsIFilePicker.returnOK)
				return;

			var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);

			try
			{
				var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Components.interfaces.nsIXMLHttpRequest);
				req.open('GET', fp.fileURL.spec + '?time=' + new Date().getTime(), true);
				req.addEventListener('loadend', function() {

					try
					{
						if (req.responseXML === null)
							throw 'Bad response';

						if (req.responseXML.documentElement.nodeName === "parsererror")
							throw req.responseXML.documentElement.firstChild.nodeValue;

						var promptText = document.getElementById("fc-import-confirm-label").getAttribute("label");
						if (promptService.confirm(window, "MoonClocks", promptText) === true)
						{
							var root = req.responseXML.documentElement;
							if (root.nodeName === 'prefs')
							{
								var prefNodes = root.getElementsByTagName("Pref");

								for (var i=0; i < prefNodes.length; i++)
								{
									var prefNode = prefNodes.item(i);
									prefNode.QueryInterface(Components.interfaces.nsIDOMElement);

									var id = prefNode.getAttribute("id");
									if (id.search(/^moonclocks/) >= 0 || id.search(/^foxclocks/) >= 0)
									{
										var migratedId = id.replace(/^foxclocks/, "moonclocks");
										prefNode.setAttribute("id", 'extensions.' + migratedId);
										console.log("moonclocks::onImportCmd(): migrated pref from " + id + " to " + prefNode.getAttribute("id"));
									}
								}
							}

							if (foxclocks.prefManager.xmlToPrefs("extensions.moonclocks.", req.responseXML) === false)
								throw 'parsererror';

							promptText = document.getElementById("fc-dialog-import-success").getAttribute("label");
							foxclocks.utils.openChromeSimpleInfo(window, "MoonClocks", promptText);
						}
					}
					catch(ex)
					{
						var promptTextException = document.getElementById("fc-dialog-import-failure").getAttribute("label") + ": " + ex;
						promptService.alert(window, "MoonClocks", promptTextException);
					}

				}, false);

				req.send(null);
			}
			catch(ex)
			{
				console.error("foxclocks.MainManager::onImportCmd(): " + ex);
				var promptText = document.getElementById("fc-dialog-import-failure").getAttribute("label") + ": " + ex;
				promptService.alert(window, "MoonClocks", promptText);
			}
		},

		// ====================================================================================
		onExportCmd : function()
		{
			var dialogTitle = document.getElementById("fc-dialog-export-title").getAttribute("label");
			var foxClocksFilter = "*." + foxclocks.utils.MC_SETTINGS_EXTENSION;
			var filterText = document.getElementById("fc-dialog-importexport-filter-label").getAttribute("label") +
				" (" + foxClocksFilter + ")";

			var nsIFilePicker = Components.interfaces.nsIFilePicker;
			var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
			fp.init(window, dialogTitle, nsIFilePicker.modeSave);
			fp.defaultExtension = foxclocks.utils.MC_SETTINGS_EXTENSION;
			fp.defaultString = 'moonclocks.' + foxclocks.utils.MC_SETTINGS_EXTENSION;
			fp.appendFilter(filterText, foxClocksFilter);
			fp.appendFilters(nsIFilePicker.filterAll);

			var res = fp.show();

			if (res != nsIFilePicker.returnOK && res != nsIFilePicker.returnReplace)
				return;

			foxclocks.utils.getMoonClocksVersion(function(foxClocksVersion) {

				var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);

				try
				{
					var serializer = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(Components.interfaces.nsIDOMSerializer);
					var xmlDoc = foxclocks.prefManager.prefsToXml("extensions.moonclocks.", null, "prefs", foxClocksVersion);
					var xmlString = foxclocks.utils.FC_XML_DEC + serializer.serializeToString(xmlDoc, "UTF-8");

					foxclocks.utils.writeToFile(xmlString, fp.file, function(result, success) {

						if (success)
						{
							var promptText = document.getElementById("fc-dialog-export-success").getAttribute("label");
							foxclocks.utils.openChromeSimpleInfo(window, "MoonClocks", promptText);
						}
						else
						{
							var promptTextFailure = document.getElementById("fc-dialog-export-failure").getAttribute("label") + ": " + result;
							promptService.alert(window, "MoonClocks", promptTextFailure);
						}
					});
				}
				catch(ex)
				{
					var promptTextException = document.getElementById("fc-dialog-export-failure").getAttribute("label") + ": " + ex;
					promptService.alert(window, "MoonClocks", promptTextException);
				}
			});
		},

		// ====================================================================================
		onAddCmd : function(addAtIndex, reSort)
		{
			console.log("+foxclocks.MainManager::onAddCmd()");

			var rangeCount = this.zonePicker.view.selection.getRangeCount();
			var addedItems = [];

			var zonePickerLocMap = foxclocks.zoneManager.getZonePickerLocationMap();

			for (var i=0; i < rangeCount; i++)
			{
				var start = {};
				var end = {};
				this.zonePicker.view.selection.getRangeAt(i, start, end);
				for (var c = start.value; c != -1 && c <= end.value; c++)
				{
					var j = this.zonePicker.view.getItemAtIndex(c).getAttribute("value");
					if (j != null)
					{
						var watchlistItem = new foxclocks.WatchlistItem(zonePickerLocMap[j]);
						addedItems.push(watchlistItem);
					}
				}
			}

			this.addToWatchlist(addedItems, addAtIndex);

			if (reSort === false)
			{
				// AFM - currently removes the sort marker even if the order hasn't changed
				//
				this.setWatchlistUnsorted();
			}
			else
			{
				this.sortWatchlist();
			}

			this.updateFoxClocksState(true);

			console.log("-foxclocks.MainManager::onAddCmd()");
		},

		// ====================================================================================
		onAddAsCmd : function()
		{
			var location = this.getSelectedZonePickerLocation();
			if (!location)
				return;

			var watchlistItem = new foxclocks.WatchlistItem(location);
			var retLocation = this.openZoneInfo(watchlistItem, "ADD_AS");

			if (retLocation)
			{
				watchlistItem.location = retLocation;

				var addedItems = [];
				addedItems.push(watchlistItem);

				this.addToWatchlist(addedItems);
				this.sortWatchlist(); // AFM - if we're sorting, re-sort
				this.updateFoxClocksState(true);
			}
		},

		// ====================================================================================
		onRemoveCmd : function()
		{
			console.log("+foxclocks.MainManager::onRemoveCmd()");

			var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
			var promptText = document.getElementById("fc-remove-confirm-label").getAttribute("label");

			var confirmEnabled = foxclocks.prefManager.getPref("extensions.moonclocks.watchlist.remove.confirm.enabled");

			var result = confirmEnabled ? promptService.confirm(window, null, promptText) : true;

			if (result === false)
				return;

			var indexesToRemove = [];

			var rangeCount = this.watchlistTree.view.selection.getRangeCount();
			for (var i=0; i < rangeCount; i++)
			{
				var start = {};
				var end = {};
				this.watchlistTree.view.selection.getRangeAt(i, start, end);

				for (var c = start.value; c != -1 && c <= end.value; c++)
				{
					indexesToRemove.push(c);
				}
			}

			console.log("foxclocks.MainManager::onRemoveCmd(): indexesToRemove", indexesToRemove);

			var watchlist = foxclocks.watchlistManager.getWatchlist();
			var treeChildrenRoot = document.getElementById("fc-watchlist-treechildren-root");

			// AFM - suppress select events on the watchlistTree until watchlistTree and the watchlist are
			// synchronised - we get called back in updateFoxClocksState() (the onselect handler)
			// immediately after we set the suppressed flag back to false
			//
			this.watchlistTree.view.selection.selectEventsSuppressed = true;
			for (var j=indexesToRemove.length - 1; j >= 0; j--)
			{
				var indexToRemove = indexesToRemove[j];
				var item = this.watchlistTree.view.getItemAtIndex(indexToRemove);
				item.parentNode.removeChild(item);
				watchlist[indexToRemove] = null;
			}
			console.log("foxclocks.MainManager::onRemoveCmd(): watchlist.length", watchlist.length);
			// AFM - sorry about this
			//
			var k = 0;
			while (k < watchlist.length)
			{
				if (watchlist[k] == null)
					watchlist.splice(k, 1);
				else
					k++;
			}
			console.log("foxclocks.MainManager::onRemoveCmd(): watchlist.length", watchlist.length);
			this.watchlistTree.view.selection.selectEventsSuppressed = false;

			// this.updateFoxClocksState(true); - not necessary see above comment, but need to notify, since
			// onselect handler will not do this
			//
			this.setWatchlistPref();

			console.log("-foxclocks.MainManager::onRemoveCmd()");
		},

		// ====================================================================================
		onMoveUpCmd : function()
		{
			// AFM - we know only one item is selected and moving up is possible, saccess to the event is
			// disabled otherwise
			//
			var selectedItem = this.getSelectedWatchlistItem();
			var prevItem = selectedItem.previousSibling;
			this.swapWatchlistItems(prevItem, selectedItem);

			this.setWatchlistUnsorted();

			// AFM - reselect the selected item - the selection is lost moving up. This will trigger
			// this.updateFoxClocksState(false)
			//
			this.watchlistTree.view.selection.select(this.watchlistTree.view.getIndexOfItem(selectedItem));

			// AFM - need to set, since onselect handler will not do this
			//
			this.setWatchlistPref();
		},

		// ====================================================================================
		onMoveDownCmd : function()
		{
			// AFM - we know only one item is selected and moving down is possible, access to the event is
			// disabled otherwise
			//
			var selectedItem = this.getSelectedWatchlistItem();
			var nextItem = selectedItem.nextSibling;
			this.swapWatchlistItems(selectedItem, nextItem);

			this.setWatchlistUnsorted();
			this.updateFoxClocksState(true);
		},

		// ====================================================================================
		moveInWatchlist : function(moveToIndex)
		{
			// AFM - move selected items in the watchlist to moveToIndex
			//
			console.log("+foxclocks.MainManager::moveInWatchlist(): " + moveToIndex);

			var indexesToRemove = [];
			var itemsToAdd = [];
			var watchlist = foxclocks.watchlistManager.getWatchlist();

			if (moveToIndex == null)
				moveToIndex = watchlist.length;

			var numSelectedAboveMoveToIndex = 0;
			var rangeCount = this.watchlistTree.view.selection.getRangeCount();
			for (var i=0; i < rangeCount; i++)
			{
				var start = {};
				var end = {};
				this.watchlistTree.view.selection.getRangeAt(i, start, end);

				for (var c = start.value; c != -1 && c <= end.value; c++)
				{
					indexesToRemove.push(c);
					itemsToAdd.push(watchlist[c]);

					if (c < moveToIndex)
						numSelectedAboveMoveToIndex++;
				}
			}

			for (var j=indexesToRemove.length - 1; j >= 0; j--)
			{
				var indexToRemove = indexesToRemove[j];
				watchlist[indexToRemove] = null;
			}

			var k = 0;
			while (k < watchlist.length)
			{
				if (watchlist[k] == null)
					watchlist.splice(k, 1);
				else
					k++;
			}

			// AFM - adjust moveToIndex by the number of selected items above this index
			//
			var adjMoveToIndex = moveToIndex - numSelectedAboveMoveToIndex;
			for (var l=0; l < itemsToAdd.length; l++)
			{
				watchlist.splice(adjMoveToIndex + l, 0, itemsToAdd[l]);
			}

			this.addToWatchlist(null); // AFM - rebuild
			this.setWatchlistUnsorted();
			this.updateFoxClocksState(true);

			console.log("-foxclocks.MainManager::moveInWatchlist()");
		},

		// ====================================================================================
		onWatchlistSelect : function() { this.updateFoxClocksState(false); },
		onOpenOptionsCmd : function() { foxclocks.utils.openChromeOptions(); },
		onOpenAboutCmd : function() { foxclocks.utils.openChromeAbout(); },
		onSortWatchlist : function(event) { this.sortWatchlist(event); this.updateFoxClocksState(true); },

		// ====================================================================================
		onOpenLocDetailsCmd : function()
		{
			var locationItem = this.getSelectedWatchlistItem();
			if (locationItem == null)
				return;

			var locationIndex = this.watchlistTree.view.getIndexOfItem(locationItem);
			var watchlistItem = foxclocks.watchlistManager.getItem(locationIndex);

			var retLocation = this.openZoneInfo(watchlistItem, "LOCATION");

			if (retLocation)
			{
				watchlistItem.location = retLocation;

				this.addToWatchlist(null);
				this.sortWatchlist();
				this.updateFoxClocksState(true);
			}
		},

		// ====================================================================================
		onOpenLocGoogleEarthCmd : function()
		{
			var locationItem = this.getSelectedWatchlistItem();

			if (locationItem == null)
				return;

			var locationIndex = this.watchlistTree.view.getIndexOfItem(locationItem);
			foxclocks.utils.openOpenStreetMap(foxclocks.watchlistManager.getItem(locationIndex).location);
		},

		// ====================================================================================
		onToggleBarClocksCmd : function()
		{
			console.log("+foxclocks.MainManager::onToggleBarClocksCmd()");

			var rangeCount = this.watchlistTree.view.selection.getRangeCount();
			for (var i=0; i < rangeCount; i++)
			{
				var start = {};
				var end = {};
				this.watchlistTree.view.selection.getRangeAt(i, start, end);

				for (var c = start.value; c != -1 && c <= end.value; c++)
				{
					var watchlistItem = foxclocks.watchlistManager.getItem(c);
					watchlistItem.showClock_statusbar = !watchlistItem.showClock_statusbar;
				}
			}

			this.updateFoxClocksState(true);

			console.log("+foxclocks.MainManager::onToggleBarClocksCmd()");
		},

		// ====================================================================================
		onToggleBarFlagCmd : function()
		{
			console.log("+foxclocks.MainManager::onToggleBarFlagCmd()");

			var rangeCount = this.watchlistTree.view.selection.getRangeCount();
			for (var i=0; i < rangeCount; i++)
			{
				var start = {};
				var end = {};
				this.watchlistTree.view.selection.getRangeAt(i, start, end);

				for (var c = start.value; c != -1 && c <= end.value; c++)
				{
					var watchlistItem = foxclocks.watchlistManager.getItem(c);
					watchlistItem.showClock_statusbarFlag = !watchlistItem.showClock_statusbarFlag;
				}
			}

			this.updateFoxClocksState(true);

			console.log("+foxclocks.MainManager::onToggleBarFlagCmd()");
		},

		// ====================================================================================
		onTimer : function()
		{
			// console.log("+foxclocks.MainManager::onTimer()");

			var nowDate = new Date();
			for (var j=0; j < this.watchlistTree.view.rowCount; j++)
			{
				var treeItem = this.watchlistTree.view.getItemAtIndex(j);

				// AFM - historical - keeping around
				//
				if (treeItem.getAttribute("id") == "fc-watchlist-noitems-item")
					continue;

				var location = foxclocks.watchlistManager.getItem(j).location;
				var timeText = this.timeFormatter.getTimeString(location, nowDate);

				var timeCell = treeItem.firstChild.childNodes[1];
				timeCell.setAttribute("label", timeText);
			}

			// console.log("-foxclocks.MainManager::onTimer()");
		},

		// ====================================================================================
		// AFM - implementing nsIObserver
		//
		observe : function(subject, topic, data)
		{
			if (topic == "moonclocks")
			{
				if (data == "engine:zone-data-update-complete")
				{
					if (foxclocks.updateManager.getLastUpdateResult().result == "OK_NEW")
					{
						foxclocks.utils.getMoonClocksVersion(function(foxClocksVersion) {
							document.getElementById("fc-foxclocks-version-label").setAttribute("value",
									"MoonClocks " + foxClocksVersion + " (" + foxclocks.zoneManager.dataSource.version + ")");
						});

						this.populateZonePicker();
						this.populateWatchlist();
					}
				}
				else if (data == "engine:zone-picker-changed")
				{
					this.populateZonePicker();
				}
				else if (data == "engine:watchlist-changed")
				{
					this.populateWatchlist();
				}
			}
			else if (topic == "nsPref:changed")
			{
				switch (data)
				{
					case "extensions.moonclocks.format.moonclocks.standard": this.setTimeFormat(); break;
					case "extensions.moonclocks.format.moonclocks.custom": this.setTimeFormat(); break;
					case "extensions.moonclocks.clock.style": this.updateFoxClocksState(false); break;
					case "extensions.moonclocks.clock.moonclocks.clock.global.showflag": this.addToWatchlist(null); break; // AFM - rebuild watchlist with/without flags
				}
			}

			this.onTimer();
		},

		//
		// AFM - END, EVENTS

		// ====================================================================================
		populateWatchlist : function()
		{
			// AFM - completely regenerate watchlist, when driven by external notification
			// (eg importing settings), or on load
			// Sort state is not persisted as a preference, so to be safe we remove the sort marker
			//
			this.addToWatchlist(null);
			this.setWatchlistUnsorted();
			this.updateFoxClocksState(false);
		},

		// ====================================================================================
		populateZonePicker : function()
		{
			console.log("+foxclocks.MainManager::populateZonePicker()");

			var zonePickerDoc = foxclocks.zoneManager.getZonePickerXmlDoc();
			if (zonePickerDoc !== null)
			{
				var treeChildrenRoot = document.getElementById("fc-zonepicker-treechildren-root");

				while (treeChildrenRoot.hasChildNodes())
					treeChildrenRoot.removeChild(treeChildrenRoot.firstChild);

				var zpRoot = zonePickerDoc.documentElement;
				for (var i=0; i < zpRoot.childNodes.length; i++)
				{
					this.populateZonePickerFromNode(treeChildrenRoot, zpRoot.childNodes[i]);
				}
			}

			this.setZonePickerStates();

			console.log("-foxclocks.MainManager::populateZonePicker()");
		},

		// ====================================================================================
		populateZonePickerFromNode : function(parentTreeChildren, zpNode)
		{
			var zonePickerLocMap = foxclocks.zoneManager.getZonePickerLocationMap();
			var nowDate = new Date();

			// console.log("foxclocks.MainManager::populateZonePickerFromNode(): " + zpNode.nodeName);

			if (zpNode.nodeType != Node.ELEMENT_NODE)
				return;

			var zpNodeNameAtt = zpNode.getAttribute("name");

			if (zpNode.nodeName == "Leaf")
			{
				var leafId = zpNode.getAttribute("leaf_id");

				// AFM - this is a bad node, with no corresponding entry in zonePickerLocMap
				//
				if (leafId == null)
					return;

				var currLocation = zonePickerLocMap[leafId];

				var treeItem2 = document.createElement("treeitem");
				treeItem2.setAttribute("value", leafId); // AFM - to allow lookup of location from treeitem

				parentTreeChildren.appendChild(treeItem2);

				var cellCurrZoneLabel = '';
				var instantInfo = currLocation.zone.getInstantInfo(nowDate);

				if (instantInfo !== null)
				{
					cellCurrZoneLabel = foxclocks.utils.getZoneOffsetString(instantInfo.offset_mins) + " (" + instantInfo.name + ")";

					if (instantInfo.is_dst)
						cellCurrZoneLabel += this.ZP_DST_INDICATOR_STRING;
				}

				var treeCellRegion = document.createElement("treecell");
				treeCellRegion.setAttribute("label", zpNodeNameAtt);

				// var flagURL = currLocation.zone.getFlagUrl();
				// if (foxclocks.utils.isUriAvailable(flagURL))
				//	treeCellRegion.setAttribute("src", flagURL);

				var treeCellCurrZone = document.createElement("treecell");
				treeCellCurrZone.setAttribute("label", cellCurrZoneLabel);

				var treeRow2 = document.createElement("treerow");
				treeRow2.appendChild(treeCellRegion);
				treeRow2.appendChild(treeCellCurrZone);

				treeItem2.appendChild(treeRow2);

				// AFM - set search text
				//
				var leafNodeSearchText = treeCellRegion.getAttribute("label");
				var currentUpperTreeItem = treeItem2.parentNode.parentNode;

				while (currentUpperTreeItem.nodeName == "treeitem")
				{
					leafNodeSearchText = leafNodeSearchText + ' ' + currentUpperTreeItem.firstChild.firstChild.getAttribute("label");
					currentUpperTreeItem = currentUpperTreeItem.parentNode.parentNode;
				}

				treeCellRegion.setAttribute("fc_searchtext", leafNodeSearchText.toLowerCase());
				// treeCellRegion.setAttribute("label", treeCellRegion.getAttribute("fc_searchtext"));
			}
			else if (zpNode.nodeName == "Branch")
			{
				var childTreeChildren = document.createElement("treechildren");

				var treeItem1 = document.createElement("treeitem");
				treeItem1.setAttribute("container", "true");

				parentTreeChildren.appendChild(treeItem1);

				var treeCell1 = document.createElement("treecell");
				treeCell1.setAttribute("label", zpNodeNameAtt);

				var treeRow1 = document.createElement("treerow");

				treeRow1.appendChild(treeCell1);
				treeItem1.appendChild(treeRow1);
				treeItem1.appendChild(childTreeChildren);

				for (var j=0; j < zpNode.childNodes.length; j++)
				{
					this.populateZonePickerFromNode(childTreeChildren, zpNode.childNodes[j]);
				}
			}
		},

		// ====================================================================================
		onZonePickerSearchFocus : function()
		{
			this.searchBox.setAttribute("class", "fc-zonepicker-searchbox-active " +
				this.searchBox.getAttribute("class"));

			if (this.searchBox.value == this.searchBox.getAttribute("fc_init_value"))
				this.searchBox.value = "";
		},

		// ====================================================================================
		onZonePickerSearchBlur : function()
		{
			if (this.searchBox.value == "")
			{
				this.searchBox.value = this.searchBox.getAttribute("fc_init_value");
				this.searchBox.setAttribute("class", "fc-zonepicker-searchbox-inactive");
			}
		},

		// ====================================================================================
		onZonePickerSearchInput : function()
		{
			// console.log("+foxclocks.MainManager::onZonePickerSearchInput()");

			var inputSearchText = this.searchBox.value.replace(/(^\s+|\s+$)/g, '').toLowerCase();
			var zpTreeItems = document.getElementById("fc-zonepicker-treechildren-root").childNodes;
			var containerStack = [];
			var containerStacksToOpen = [];

			for (var i = 0; i < zpTreeItems.length; i++)
			{
				this.searchZonePickerNode(zpTreeItems[i], inputSearchText, containerStack, containerStacksToOpen);
			}

			if (containerStacksToOpen.length <= foxclocks.utils.FC_FOXCLOCKS_SEARCH_MAX_OPEN_NODES)
			{
				for (var k = 0; k < containerStacksToOpen.length; k++)
				{
					containerStack = containerStacksToOpen[k];
					for (var j = 0; j < containerStack.length; j++)
					{
						var containerItem = containerStack[j];
						var containerItemIndex = this.zonePicker.view.getIndexOfItem(containerItem);

						if (containerItemIndex != -1 && this.zonePicker.view.isContainer(containerItemIndex) &&
								this.zonePicker.view.isContainerOpen(containerItemIndex) == false)
						{
			         		this.zonePicker.view.toggleOpenState(containerItemIndex);
			         		// console.log("foxclocks.MainManager::onZonePickerSearchInput(): opened <" + containerItem.firstChild.firstChild.getAttribute("label") + ">");
			         	}
					}
				}
			}
			else
			{
				console.log("foxclocks.MainManager::onZonePickerSearchInput(): containerStacksToOpen.length is <" + containerStacksToOpen.length + ">");
			}

			var allNodesHidden = true;
			for (var l = 0; allNodesHidden == true && l < zpTreeItems.length; l++)
			{
				if (this.zonePicker.view.getIndexOfItem(zpTreeItems[l]) != -1)
					allNodesHidden = false;
			}

			if (allNodesHidden)
			{
				this.searchBox.setAttribute("class", "fc-zonepicker-searchbox-no-match");
			}
			else
			{
				this.searchBox.setAttribute("class", "fc-zonepicker-searchbox-active");
			}

			// console.log("-foxclocks.MainManager::onZonePickerSearchInput(): inputSearchText <" + inputSearchText + ">");
		},

		// ====================================================================================
		searchZonePickerNode : function(treeItem, inputSearchText, containerStack, containerStacksToOpen)
		{
			// console.log("+foxclocks.MainManager::searchZonePickerNode()");

			var shouldShow = false;

			if (treeItem.getAttribute("container") == "true")
			{
				containerStack.push(treeItem);

				var childTreeItems = treeItem.lastChild.childNodes;
				for (var i = 0; i < childTreeItems.length; i++)
				{
					if (this.searchZonePickerNode(childTreeItems[i], inputSearchText, containerStack, containerStacksToOpen) == true)
						shouldShow = true;
				}
			}
			else
			{
				var cellSearchText = treeItem.firstChild.firstChild.getAttribute("fc_searchtext");

				if (inputSearchText == '' || cellSearchText.indexOf(inputSearchText) != -1)
				{
					shouldShow = true;
					containerStacksToOpen.push(containerStack);

					// if (inputSearchText.length > 3)
					//	console.log("foxclocks.MainManager::searchZonePickerNode(): inputSearchText <" + inputSearchText + "> matches <" + cellSearchText + ">");
				}
			}

			if (shouldShow)
				treeItem.removeAttribute("hidden");
			else
				treeItem.setAttribute("hidden", "true");

			// console.log("-foxclocks.MainManager::searchZonePickerNode()");

			return shouldShow;
		},

		// ====================================================================================
		addToWatchlist : function(addedItems, addAtIndex)
		{
			// AFM - addedItems == null => rebuild from foxclocks.watchlistManager.getWatchlist()
			// addAtIndex == null => add to end of list
			//
			console.log("+foxclocks.MainManager::addToWatchlist()");
			var globaFoxClocksShowflagPref = foxclocks.prefManager.getPref("extensions.moonclocks.clock.moonclocks.clock.global.showflag");

			// AFM - to prevent modifying the tree triggering multiple select events; we get one
			// onselect event just after we unsuppress
			//
			this.watchlistTree.view.selection.selectEventsSuppressed = true;

			var watchlist = foxclocks.watchlistManager.getWatchlist();
			var treeChildrenRoot = document.getElementById("fc-watchlist-treechildren-root");
			var itemsToAdd = addedItems;
			var rebuild = addedItems == null;

			if (rebuild)
			{
				while (treeChildrenRoot.hasChildNodes())
					treeChildrenRoot.removeChild(treeChildrenRoot.firstChild);

				itemsToAdd = watchlist;
			}

			var insertBeforeNode = addAtIndex != null ? treeChildrenRoot.childNodes[addAtIndex] : null;

			for (var i=0; itemsToAdd != "" && i < itemsToAdd.length; i++)
			{
				var currItemToAdd = itemsToAdd[i];

				var locationCell = document.createElement("treecell");
				locationCell.setAttribute("label", currItemToAdd.location.getName());

				// AFM - per-clock not supported right now
				//
				if (globaFoxClocksShowflagPref != "fc-no-clocks")
				{
					var flagURL = currItemToAdd.getFlagUrl();
					if (foxclocks.utils.isUriAvailable(flagURL))
						locationCell.setAttribute("src", flagURL);
				}

				var treeRow = document.createElement("treerow");
				treeRow.appendChild(locationCell);
				treeRow.appendChild(document.createElement("treecell"));

				var treeItem = document.createElement("treeitem");
				treeItem.setAttribute("value", currItemToAdd.location.zone.id);
				treeItem.appendChild(treeRow);

				if (insertBeforeNode != null)
				{
					treeChildrenRoot.insertBefore(treeItem, insertBeforeNode);

					if (!rebuild) // AFM - genuinely inefficient
						watchlist.splice(addAtIndex + i, 0, currItemToAdd);
				}
				else
				{
					treeChildrenRoot.appendChild(treeItem);

					if (!rebuild)
						watchlist.push(currItemToAdd);
				}
			}

			this.watchlistTree.view.selection.selectEventsSuppressed = false;
			console.log("-foxclocks.MainManager::addToWatchlist()");
		},

		// ====================================================================================
		getSupportedFlavours : function()
		{
			// AFM - we could be observing drags from the Watchlist or ZonePicker, so we
			// can't rule out any flavours yet - this is done in onDragOver()
			//
			var flavours = new FlavourSet();
			flavours.appendFlavour("moonclocks/watchlist");
			flavours.appendFlavour("moonclocks/zonepicker");
			return flavours;
		},

		// ====================================================================================
		onDragStart: function(event, transferData, action)
		{
			console.log("+foxclocks.MainManager::onDragStart()");

			var evtTargetId = event.target.getAttribute("id");
			var flavour = "unknown";

			if (evtTargetId == "fc-watchlist-treechildren-root")
				flavour = "moonclocks/watchlist";
			else if (evtTargetId == "fc-zonepicker-treechildren-root")
				flavour = "moonclocks/zonepicker";

			transferData.data = new TransferData();
			transferData.data.addDataForFlavour(flavour, flavour); // AFM drop data is just the flavour again

			console.log("-foxclocks.MainManager::onDragStart(): " + flavour);
		},

		// ====================================================================================
		onDragOver: function(event, flavour, session)
		{
			// console.log("+foxclocks.MainManager::onDragOver(): " + event.target.getAttribute("id"));

			this.removeDropIndicator();
			this.watchlistDropAtIndex = null;

			session.canDrop = false; // AFM - unless we can show otherwise

			// AFM - Watchlist row we're currently over
			//
			var row = {}, col = {}, childElt = {};

			// AFM - handle weird Firefox 3.1 beta bug
			//
			if (this.watchlistTree.boxObject == null || this.watchlistTree.boxObject.getCellAt == null)
			{
				// console.log("foxclocks.MainManager::onDragOver(): getCellAt() not available");
				session.canDrop = true;
				return;
			}

			this.watchlistTree.boxObject.getCellAt(event.clientX, event.clientY, row, col, childElt);

			var fromWatchlist = flavour.contentType == "moonclocks/watchlist";
			var toWatchlist = event.target.getAttribute("id") == "fc-watchlist-treechildren-root";

			// AFM - can't drag from ZonePicker to ZonePicker. Need to look at the selection count
			// if dragging from the ZonePicker, since a drag can start by dragging a ZP branch
			//
			if (!fromWatchlist && toWatchlist && this.zonePicker.view.selection.count > 0)
			{
				session.canDrop = true;
			}
			else if (fromWatchlist && toWatchlist && this.watchlistTree.view.selection.count > 0)
			{
				const disallowDropOnSelectedRow = true; // AFM - configuration
				if (disallowDropOnSelectedRow)
				{
					// AFM - disallow drop on any selected row
					//
					var mouseOverRowIsSelected = false;

					var rangeCount = this.watchlistTree.view.selection.getRangeCount();
					for (var i=0; i < rangeCount && mouseOverRowIsSelected == false; i++)
					{
						var start = {};
						var end = {};
						this.watchlistTree.view.selection.getRangeAt(i, start, end);

						for (var c = start.value; c != -1 && c <= end.value && mouseOverRowIsSelected == false; c++)
						{
						    if (row.value == c)
								mouseOverRowIsSelected = true;
						}
					}

					if (mouseOverRowIsSelected == false)
						session.canDrop = true;
				}
				else
				{
					session.canDrop = true;
				}
			}
			else if (fromWatchlist && !toWatchlist && this.watchlistTree.view.selection.count > 0)
			{
				session.canDrop = true;
			}

			// AFM - we're dragging over Watchlist - figure out which rows to drop between
			//
			if (toWatchlist && session.canDrop)
			{
				var locationItem = null;
				var locationItemDropBelow = null;
				var treeChildrenRoot = document.getElementById("fc-watchlist-treechildren-root");

				if (row.value == -1)
				{
					// AFM - we're not over any row, so we're dropping at the end
					//
					this.watchlistDropAtIndex = null;

					if (treeChildrenRoot.childNodes.length > 0)
					{
						locationItem = treeChildrenRoot.lastChild;
						locationItemDropBelow = true;
					}
				}
				else
				{
					// AFM - get treecell of row we're currently over
					//
					var x_unused = {}, rowY = {}, width_unused = {}, rowHeight = {};
					this.watchlistTree.boxObject.getCoordsForCellItem(row.value, col.value, "text", x_unused, rowY, width_unused, rowHeight);

					locationItem = this.watchlistTree.view.getItemAtIndex(row.value);

					// AFM - y coord of mouse relative to the treechildren root
					//
					var relaClientY = event.clientY - treeChildrenRoot.boxObject.y;

					if (relaClientY >= rowY.value + rowHeight.value/2)
					{
						locationItemDropBelow = true;

						if (row.value < treeChildrenRoot.childNodes.length - 1)
							this.watchlistDropAtIndex = row.value + 1;
						else
							this.watchlistDropAtIndex = null;
					}
					else
					{
						locationItemDropBelow = false;
						this.watchlistDropAtIndex = row.value;
					}
				}

				if (locationItem != null && locationItemDropBelow != null)
				{
					// AFM - style the row to indicate where we would drop - try to use 'above' style if possible,
					// to avoid possible transition effects going from eg bottom half of one item to the top
					// half of the next. Should have read http://www.xulplanet.com/tutorials/xultu/treestyle.html
					// before I did this, but in fact dropBefore and dropAfter don't seem to work automatically...
					//
					if (locationItemDropBelow == true)
					{
						if (locationItem.nextSibling != null)
							locationItem.nextSibling.firstChild.setAttribute("properties", "foxclocks-drop-above");
						else
							locationItem.firstChild.setAttribute("properties", "foxclocks-drop-below");
					}
					else
					{
						locationItem.firstChild.setAttribute("properties", "foxclocks-drop-above");
					}
				}
			}

			// console.log("-foxclocks.MainManager::onDragOver(): " +
			// this.watchlistTree.view.selection.count + " " +
			// flavour.contentType + " " + event.target.getAttribute("id"));
		},

		// ====================================================================================
		onDragExit: function(event, session)
		{
			console.log("+foxclocks.MainManager::onDragExit()");

			this.removeDropIndicator();

			console.log("-foxclocks.MainManager::onDragExit()");
		},

		// ====================================================================================
		onDrop: function(event, dropdata, session)
		{
			console.log("+foxclocks.MainManager::onDrop()");

			this.removeDropIndicator(); // AFM - before we modify the Watchlist

			var fromWatchlist = dropdata.data == "moonclocks/watchlist";
			var toWatchlist = event.target.getAttribute("id") == "fc-watchlist-treechildren-root";

			if (!fromWatchlist && toWatchlist)
				this.onAddCmd(this.watchlistDropAtIndex, false);
			else if (fromWatchlist && !toWatchlist)
				this.onRemoveCmd();
			else if (fromWatchlist && toWatchlist)
				this.moveInWatchlist(this.watchlistDropAtIndex);

			this.watchlistDropAtIndex = null;

			console.log("-foxclocks.MainManager::onDrop()");
		},


		// ====================================================================================
		removeDropIndicator: function()
		{
			// console.log("+foxclocks.MainManager::removeDropIndicator()");

			// AFM - subtle, clever stuff - blow away all possible 'where we would drop' styles
			//
			if (this.watchlistDropAtIndex != null)
			{
				var locationItem = this.watchlistTree.view.getItemAtIndex(this.watchlistDropAtIndex);
				locationItem.firstChild.removeAttribute("properties");

				if (locationItem.nextSibling != null)
					locationItem.nextSibling.firstChild.removeAttribute("properties");
			}
			else
			{
				var treeChildrenRoot = document.getElementById("fc-watchlist-treechildren-root");

				if (treeChildrenRoot.childNodes.length > 0)
					treeChildrenRoot.lastChild.firstChild.removeAttribute("properties");
			}

			// console.log("-foxclocks.MainManager::removeDropIndicator()");
		},

		// ====================================================================================
		sortWatchlist : function(event)
		{
			// AFM - return code currently meaningless
			//
			console.log("+foxclocks.MainManager::sortWatchlist()");

			var reSort = event == null;
			var sortResource = this.watchlistTree.getAttribute("sortResource");

			if (reSort && sortResource == "") // AFM - re-sorting, but nothing to sort by
				return false;

			var column = reSort ? document.getElementById(sortResource) : event.target;
			var colId = column.getAttribute("id");
			var colSortDir = column.getAttribute("sortDirection");
			var newSortDir = null;

			if (reSort)
			{
				newSortDir = colSortDir;
			}
			else
			{
				// AFM - (no sort -> ascending -> descending)
				//

				if (colSortDir == "descending")
				{
					this.setWatchlistUnsorted();
					return false;
				}

				newSortDir = colSortDir == "ascending" ? "descending" : "ascending";
			}

			var currDate = new Date();

			function columnSort(aa, bb)
			{
				function nameSort(a, b) {
					var aLower = a.location.getName().toLowerCase();
					var bLower = b.location.getName().toLowerCase();

					return	aLower > bLower ? 1 : (aLower == bLower ? 0 : -1); }

				function timeSort(a, b) {
					var aInstantInfo = a.location.zone.getInstantInfo(currDate);
					var bInstantInfo = b.location.zone.getInstantInfo(currDate);

					return	(aInstantInfo !== null ? aInstantInfo.offset_mins : 0) -
							(bInstantInfo !== null ? bInstantInfo.offset_mins : 0); }

				var a = newSortDir == "ascending" ? aa : bb;
				var b = newSortDir == "ascending" ? bb : aa;

				var primarySort = colId == "fc_watchlist_col_location" ? nameSort : timeSort;
				var secondarySort = colId == "fc_watchlist_col_location" ? timeSort : nameSort;

				var retVal = primarySort(a, b);
				if (retVal == 0)
					retVal = secondarySort(aa, bb); // always ascending

				return retVal;
			}

			var cols = this.watchlistTree.getElementsByTagName("treecol");
			for (var i = 0; i < cols.length; i++)
			{
				cols[i].removeAttribute("sortDirection");
			}

			column.setAttribute("sortDirection", newSortDir);
			this.watchlistTree.setAttribute("sortResource", colId);

			foxclocks.watchlistManager.getWatchlist().sort(columnSort);
			this.addToWatchlist(null); // AFM - rebuild watchlistTree - no notifications

			console.log("-foxclocks.MainManager::sortWatchlist(): " + newSortDir);

			return false;
		},

		// ====================================================================================
		setWatchlistUnsorted : function()
		{
			var cols = this.watchlistTree.getElementsByTagName("treecol");
			for (var i = 0; i < cols.length; i++)
			{
				cols[i].removeAttribute("sortDirection");
			}

			this.watchlistTree.removeAttribute("sortResource");
		},

		// ====================================================================================
		setTimeFormat : function()
		{
			var standardFormat = foxclocks.prefManager.getPref("extensions.moonclocks.format.moonclocks.standard");
			var customFormat = foxclocks.prefManager.getPref("extensions.moonclocks.format.moonclocks.custom");

			this.timeFormatter.setTimeFormat(standardFormat == "" ? customFormat : standardFormat);
		},

		// ====================================================================================
		setWatchlistPref : function()
		{
			// AFM - we don't want to respond to our own update
			//
			var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);

			try {observerService.removeObserver(this, "moonclocks");} catch(ex){}

			foxclocks.prefManager.removePrefObserver("extensions.moonclocks.", this);
			foxclocks.prefManager.setPref("extensions.moonclocks.watchlist", foxclocks.watchlistManager.watchlistToXmlString());
			foxclocks.prefManager.addPrefObserver("extensions.moonclocks.", this);

			observerService.addObserver(this, "moonclocks", false);

		},

		// ====================================================================================
		getTreeChildrenId : function(index, array) { return "fc-zonepicker-treechildren:" + array.slice(0, index + 1).join(""); },

		// ====================================================================================
		getSelectedZonePickerLocation: function()
		{
			if (this.zonePicker.view.selection.count != 1)
				return null;

			var start = {};
			var end = {};
			this.zonePicker.view.selection.getRangeAt(0, start, end);

			var zoneItem = this.zonePicker.view.getItemAtIndex(start.value);

			if (zoneItem.getAttribute("container") == "true")
				return null;

			return foxclocks.zoneManager.getZonePickerLocationMap()[zoneItem.getAttribute("value")];
		},

		// ====================================================================================
		getSelectedWatchlistItem : function()
		{
			if (this.watchlistTree.view.selection.count == 1)
			{
				var start = {};
				var end = {};
				this.watchlistTree.view.selection.getRangeAt(0, start, end);

				return this.watchlistTree.view.getItemAtIndex(start.value);
			}

			return null;
		},

		// ====================================================================================
		openZoneInfo : function(watchlistItem, mode)
		{
			var retVals = {location: null};

			window.openDialog(	"chrome://moonclocks/content/zoneinfo.xul", "",
								"chrome,modal,centerscreen,resizable=yes",
								this.timeFormatter, mode, watchlistItem, retVals);

			return retVals.location;
		},

		// ====================================================================================
		setZonePickerStates : function()
		{
			// AFM - enable/disable things that depend on what's selected in the zone picker
			//

			console.log("+foxclocks.MainManager::setZonePickerStates()");

			var location = this.getSelectedZonePickerLocation();

			document.getElementById('cmd_fc_add').setAttribute("disabled", (this.zonePicker.view.selection.getRangeCount() == 0 ? "true" : "false"));
			document.getElementById('cmd_fc_addas').setAttribute("disabled", (location == null ? "true" : "false"));
			document.getElementById('cmd_fc_zonedetails').setAttribute("disabled", (location == null ? "true" : "false"));
			document.getElementById('cmd_fc_zonegoogleearth').setAttribute("disabled", (location == null || location.getLatitude() == null || location.getLongitude() == null ? "true" : "false"));

			console.log("-foxclocks.MainManager::setZonePickerStates()");
		},

		// ====================================================================================
		updateFoxClocksState : function(setWatchlistPref)
		{
			// AFM - not an intuitive name. GUI changes dependent on changes to the watchlist
			// (cf setZonePickerStates()
			//
			console.log("+foxclocks.MainManager::updateFoxClocksState()");

			var selectedCount = this.watchlistTree.view.selection.count;
			var selectedItem = this.getSelectedWatchlistItem();
			var selectedIndex = selectedItem ? this.watchlistTree.view.getIndexOfItem(selectedItem) : null;
			var prevItem = selectedItem ? selectedItem.previousSibling : null;
			var nextItem = selectedItem ? selectedItem.nextSibling : null;
			var location = selectedItem ? foxclocks.watchlistManager.getItem(selectedIndex).location : null;

			document.getElementById('cmd_fc_moveup').setAttribute("disabled", (prevItem == null ? "true" : "false"));
			document.getElementById('cmd_fc_movedown').setAttribute("disabled", (nextItem == null ? "true" : "false"));
			document.getElementById('cmd_fc_remove').setAttribute("disabled", (selectedCount == 0 ? "true" : "false"));
			document.getElementById('cmd_fc_locdetails').setAttribute("disabled", (selectedItem == null ? "true" : "false"));
			document.getElementById('cmd_fc_toggle_bar_clocks').setAttribute("disabled", (selectedCount == 0 ? "true" : "false"));
			document.getElementById('cmd_fc_locgoogleearth').setAttribute("disabled", (location == null || location.getLatitude() == null || location.getLongitude() == null ? "true" : "false"));

			if (setWatchlistPref) // AFM - typically want to do this
				this.setWatchlistPref();

			this.onTimer();

			console.log("-foxclocks.MainManager::updateFoxClocksState()");
		},

		// ====================================================================================
		swapWatchlistItems : function(firstItem, secondItem)
		{
			var firstLocationIndex = this.watchlistTree.view.getIndexOfItem(firstItem);
			var secondLocationIndex = this.watchlistTree.view.getIndexOfItem(secondItem);

			console.log("foxclocks.MainManager::swapWatchlistItems(): " + firstLocationIndex + " " + secondLocationIndex);

			var firstWatchlistItem = foxclocks.watchlistManager.getItem(firstLocationIndex);
			var secondWatchlistItem = foxclocks.watchlistManager.getItem(secondLocationIndex);

			foxclocks.watchlistManager.setItem(firstLocationIndex, secondWatchlistItem);
			foxclocks.watchlistManager.setItem(secondLocationIndex, firstWatchlistItem);

			// AFM - swap items in watchlistTree
			//
			document.getElementById("fc-watchlist-treechildren-root").insertBefore(secondItem, firstItem);
		}
	};

	// ====================================================================================
	root.foxclocks.mainManager = new MainManager();

})(this);