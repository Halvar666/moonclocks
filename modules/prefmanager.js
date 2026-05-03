/* Copyright (c) 2015 Andy McDonald. All rights reserved. */
/* Please refer to licence.txt for licensing terms. */

// ====================================================================================
/*global Components */

// ====================================================================================
(function(root, factory) {
	"use strict";

	let EXT_URL_MODULE_DIR = 'chrome://moonclocks-modules/content/'; // resource://moonclocks/

	let utils =		(Components.utils.import(EXT_URL_MODULE_DIR + "utils.js", {})).FoxClocks_Utils;

	utils.exportSymbols(root, factory(Components, utils.console, utils));

}(this,

// ====================================================================================
function(Components, console, utils) {
	"use strict";

	// ====================================================================================
	var CI = Components.interfaces, CC = Components.classes;

	var _prefService = CC["@mozilla.org/preferences-service;1"].getService(CI.nsIPrefBranch);
	var _stringBundles = {};

	// ====================================================================================
	function PrefManager()
	{
		this._prefsDeclaredAsXml = [];
	}

	// ====================================================================================
	PrefManager.prototype =
	{
		// ====================================================================================
		getPrefTypeString : function(prefType)
		{
			if (prefType === CI.nsIPrefBranch.PREF_STRING)
				return "PREF_STRING";
			else if (prefType === CI.nsIPrefBranch.PREF_INT)
				return "PREF_INT";
			else if (prefType === CI.nsIPrefBranch.PREF_BOOL)
				return "PREF_BOOL";
			else
				return "PREF_INVALID";
		},

		// ====================================================================================
		getPref : function(prefName)
		{
			try
			{
				var prefType = _prefService.getPrefType(prefName);

				// AFM - don't use getCharPref(): all string prefs are unicode
				//
				if (prefType === _prefService.PREF_STRING)
				{
					var data = _prefService.getComplexValue(prefName, CI.nsISupportsString).data;

					// AFM - there's no way to know whether a pref has a localised default, but this works well
					// unless there's really a pref which is a chrome URL
					//
					if (data.indexOf("chrome://") === 0)
					{
						// AFM - this can fail when re-installing bootstrapped extension - Firefox bug - see
						// https://developer.mozilla.org/en-US/Add-ons/How_to_convert_an_overlay_extension_to_restartless#Step_10.3A_Bypass_cache_when_loading_properties_files
						//
						// data = _prefService.getComplexValue(prefName, CI.nsIPrefLocalizedString).data;

						if (_stringBundles.hasOwnProperty(data) === false)
							_stringBundles[data] = CC["@mozilla.org/intl/stringbundle;1"].getService(CI.nsIStringBundleService).createBundle(data + '?' + Math.random());

						data = _stringBundles[data].GetStringFromName(prefName);
					}

					return data;
				}
				else if (prefType === _prefService.PREF_INT)
				{
					return _prefService.getIntPref(prefName);
				}
				else if (prefType === _prefService.PREF_BOOL)
				{
					return _prefService.getBoolPref(prefName);
				}
				else
				{
					return null;
				}
			}
			catch (ex)
			{
				console.error("foxclocks.PrefManager::getPref()", prefName, ex);
				return null;
			}
		},

		// ====================================================================================
		getPrefNames : function(branchName)
		{
			return _prefService.getChildList(branchName, {});
		},

		// ====================================================================================
		deleteBranch : function(branchName)
		{
			return _prefService.deleteBranch(branchName);
		},

		// ====================================================================================
		setPref : function(prefName, value)
		{
			var prefType = _prefService.getPrefType(prefName);

			if (prefType === _prefService.PREF_STRING)
			{
				// AFM - don't use setCharPref(): all string prefs are unicode
				//
				var supportsString = CC["@mozilla.org/supports-string;1"].createInstance(CI.nsISupportsString);
				supportsString.data = value;

				_prefService.setComplexValue(prefName, CI.nsISupportsString, supportsString);
			}
			else if (prefType === _prefService.PREF_INT)
			{
				_prefService.setIntPref(prefName, value);
			}
			else if (prefType === _prefService.PREF_BOOL)
			{
				_prefService.setBoolPref(prefName, value);
			}
		},

		// ====================================================================================
		addPrefObserver : function(branchName, observer)
		{
			var nsIPrefBranchInternal = _prefService.QueryInterface(CI.nsIPrefBranchInternal);
			nsIPrefBranchInternal.addObserver(branchName, observer, false);
		},

		// ====================================================================================
		removePrefObserver : function(branchName, observer)
		{
			var nsIPrefBranchInternal = _prefService.QueryInterface(CI.nsIPrefBranchInternal);
			nsIPrefBranchInternal.removeObserver(branchName, observer);
		},

		// ====================================================================================
		declarePrefAsXml : function(fqPrefName)
		{
			// AFM - the pref must not be a document fragment
			//
			this._prefsDeclaredAsXml[fqPrefName] = true;
		},

		// ====================================================================================
		prefIsDeclaredAsXml : function(fqPrefName)
		{
			return this._prefsDeclaredAsXml[fqPrefName] === true;
		},

		// ====================================================================================
		prefsToXml : function(branchName, xmlns, rootElt, version)
		{
			var domParser = CC["@mozilla.org/xmlextras/domparser;1"].createInstance(CI.nsIDOMParser);

			var doc = utils.getDOMImpl().createDocument(xmlns, rootElt, null);
			var root = doc.documentElement;

			root.setAttribute("version", version);

			var prefsList = _prefService.getChildList(branchName, {});

			for (var i=0; i < prefsList.length; i++)
			{
				var currPref = prefsList[i];
				var currPrefTypeStr = this.getPrefTypeString(_prefService.getPrefType(currPref));

				var elt = doc.createElementNS(xmlns, "Pref");
				root.appendChild(elt);
				elt.setAttribute("id", currPref);
				elt.setAttribute("type", currPrefTypeStr);

				var currPrefValue = this.getPref(currPref);

				if (this.prefIsDeclaredAsXml(currPref))
				{
					var valueNode = doc.createElementNS(xmlns, "Value");
					elt.appendChild(valueNode);

					// AFM - the pref must not be a document fragment
					//
					var currPrefValueAsDoc = domParser.parseFromString(currPrefValue, "text/xml");
					var nodeToImport = doc.importNode(currPrefValueAsDoc.documentElement, true); // true => deep copy
					valueNode.appendChild(nodeToImport);
				}
				else
				{
					elt.setAttribute("value", currPrefValue);
				}
			}

			return doc;
		},

		// ====================================================================================
		xmlToPrefs : function(branchName, doc)
		{
			var serializer = CC["@mozilla.org/xmlextras/xmlserializer;1"].createInstance(CI.nsIDOMSerializer);

			var root = doc.documentElement;
			if (root.nodeName !== "prefs")
			{
				console.error("foxclocks.PrefManager::xmlToPrefs(): bad root node", root.nodeName);
				return false;
			}

			var importedPrefs = {};
			var prefNodes = root.getElementsByTagName("Pref");

			for (var i=0; i < prefNodes.length; i++)
			{
				var prefNode = prefNodes.item(i);
				prefNode.QueryInterface(CI.nsIDOMElement);

				var id = prefNode.getAttribute("id");
				var value = prefNode.getAttribute("value");
				var type = prefNode.getAttribute("type");

				if (id === null || type === null)
				{
					console.warn("foxclocks.PrefManager::xmlToPrefs(): pref node has missing attributes - skipping");
				}
				else
				{
					if (typeof(importedPrefs[id]) !== 'undefined')
						console.warn("foxclocks.PrefManager::xmlToPrefs(): duplicate pref - overwriting", id);

					// AFM - pref is stored in the 'value' attribute
					//
					if (value !== null)
					{
						importedPrefs[id] = (type === "PREF_BOOL") ? (value === "true") : value;
					}
					else
					{
						var firstValueChildNode = null;

						var valueNode = utils.getFirstEltByTagAsNode(prefNode, "Value");
						if (valueNode !== null)
							firstValueChildNode = utils.getFirstEltByTagAsNode(valueNode, "*");

						if (firstValueChildNode !== null)
							importedPrefs[id] = serializer.serializeToString(firstValueChildNode);
						else
							console.warn("foxclocks.PrefManager::xmlToPrefs(): xml pref has missing value - skipping", id);
					}
				}
			}

			var prefsList = _prefService.getChildList(branchName, {});
			for (var j=0; j < prefsList.length; j++)
			{
				var currPref = prefsList[j];
				var importedValue = importedPrefs[currPref];

				if (typeof(importedValue) === 'undefined')
				{
					console.warn("foxclocks.PrefManager::xmlToPrefs(): document does not contain pref <" + currPref + ">");
				}
				else if (importedValue === this.getPref(currPref))
				{
					console.log("foxclocks.PrefManager::xmlToPrefs(): pref <" + currPref + ">, value <" + importedValue + "> - no change");
				}
				else
				{
					console.log("foxclocks.PrefManager::xmlToPrefs(): pref <" + currPref + ">, value <" + importedValue + "> - changed");
					this.setPref(currPref, importedValue);
				}
			}

			return true;
		}
	};

	// ====================================================================================
	return [{name: 'FoxClocks_PrefManager', constructor: PrefManager, is_service: true}];

}));