//!#include "../header.js"
/*global when, Util, LOG, Cu, Cc, Ci*/
"use strict";

Cu['import']("resource://floatnotes/preferences.js");
Cu['import']("resource://floatnotes/SQLiteDatabase.js");
/*global Preferences, FloatNotesSQLiteDatabase */

var EXPORTED_SYMBOLS = ['Init'];

var Init = {
  init: function() {
    this.loadCSS();
    var deferred = Util.Platform.getCurrentVersion().then(function(version) {
      var URL = 'http://www.floatnotes.org/thankyou';
      this.init = function() {return deferred;};
      var lastVersion = Preferences.version;
      var firstrun = Preferences.firstrun;
      if (firstrun){
        LOG('First run, version ' + version);
        this.runOnFirstRun();
        Util.Mozilla.openAndReuseOneTabPerURL(URL);
      }
      else {
        var upgraded = this.upgrade(lastVersion, version);
        if (upgraded) {
          Util.Mozilla.openAndReuseOneTabPerURL(URL);
        }
      }
      return firstrun;
    }.bind(this));
    return deferred;
  },

  loadCSS: function() {
    var sss = Cc["@mozilla.org/content/style-sheet-service;1"]
      .getService(Ci.nsIStyleSheetService);
    var ios = Cc["@mozilla.org/network/io-service;1"]
      .getService(Ci.nsIIOService);
    var uri = ios.newURI("chrome://floatnotes/skin/notes.css", null, null);

    if (!sss.sheetRegistered(uri, sss.USER_SHEET)) {
      sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    }
    LOG('CSS loaded');
  },

  runOnFirstRun: function() {
    FloatNotesSQLiteDatabase.getInstance().createTable();
    Preferences.firstrun = false;
    Util.Platform.getCurrentVersion().then(function(version) {
        Preferences.version = version;
    });
  },

  upgrade: function(from, to) {
    var upgraded = false;

    if (Util.Platform.versionEquals(from, to)) {
      return false;
    }

    LOG("Update: " + from + " to " + to);

    var db = FloatNotesSQLiteDatabase.getInstance();

    switch(true) {
      case Util.Platform.versionLessThan(from, "0.6"):
        db.backup(from);
        db.executeSimpleSQL('UPDATE floatnotes SET color="#FCFACF"');
      case Util.Platform.versionLessThan(from, "0.7"):
        db.backup("0.6");
        // Change column collapse to status
        db.executeSimpleSQL('ALTER TABLE floatnotes ADD COLUMN status INTEGER');
        db.executeSimpleSQL('UPDATE floatnotes SET status=32 WHERE collapse=1');

        db.executeSimpleSQL('Alter TABLE floatnotes ADD COLUMN guid');
        db.executeSimpleSQL(
          'CREATE INDEX IF NOT EXISTS guid ON floatnotes (guid)'
        );
        db.executeSimpleSQL('UPDATE floatnotes SET guid=hex(randomblob(16))');

        db.executeSimpleSQL(
          'Alter TABLE floatnotes ADD COLUMN creation_date DATETIME'
        );
        db.executeSimpleSQL(
          'Alter TABLE floatnotes ADD COLUMN modification_date DATETIME'
        );
        db.executeSimpleSQL(
          "UPDATE floatnotes SET creation_date=(strftime('%s','now')*1000000),"+
          "modification_date=(strftime('%s','now')*1000000)"
        );

        db.executeSimpleSQL('Alter TABLE floatnotes ADD COLUMN protocol TEXT');
        db.executeSimpleSQL('UPDATE floatnotes SET protocol="http:"');
      case Util.Platform.versionLessThan(from, "0.8"):
        db.backup("0.7");
        db.executeSimpleSQL(
          'UPDATE floatnotes SET creation_date=creation_date/1000,' +
          'modification_date=modification_date/1000'
        );
        upgraded = true;
    }
    Preferences.version = to;
    return upgraded;
  }
};
