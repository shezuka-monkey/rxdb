"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.properties = properties;
exports.create = create;
exports.isInstanceOf = isInstanceOf;
exports["default"] = exports.RxCollectionBase = void 0;

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _operators = require("rxjs/operators");

var _util = require("./util");

var _pouchDb = require("./pouch-db");

var _rxCollectionHelper = require("./rx-collection-helper");

var _rxQuery = require("./rx-query");

var _rxSchema = require("./rx-schema");

var _rxChangeEvent = require("./rx-change-event");

var _rxError = require("./rx-error");

var _dataMigrator = require("./data-migrator");

var _crypter = _interopRequireDefault(require("./crypter"));

var _docCache = require("./doc-cache");

var _queryCache = require("./query-cache");

var _changeEventBuffer = require("./change-event-buffer");

var _overwritable = _interopRequireDefault(require("./overwritable"));

var _hooks = require("./hooks");

var _rxDocument = require("./rx-document");

var _rxDocumentPrototypeMerge = require("./rx-document-prototype-merge");

var HOOKS_WHEN = ['pre', 'post'];
var HOOKS_KEYS = ['insert', 'save', 'remove', 'create'];
var hooksApplied = false;

var RxCollectionBase =
/*#__PURE__*/
function () {
  function RxCollectionBase(database, name, schema) {
    var pouchSettings = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
    var migrationStrategies = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
    var methods = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {};
    var attachments = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : {};
    var options = arguments.length > 7 && arguments[7] !== undefined ? arguments[7] : {};
    var statics = arguments.length > 8 && arguments[8] !== undefined ? arguments[8] : {};
    this._isInMemory = false;
    this.destroyed = false;
    this._atomicUpsertQueues = new Map();
    this.synced = false;
    this.hooks = {};
    this._subs = [];
    this._repStates = [];
    this.pouch = {};
    this._docCache = (0, _docCache.createDocCache)();
    this._queryCache = (0, _queryCache.createQueryCache)();
    this._dataMigrator = {};
    this._crypter = {};
    this._changeEventBuffer = {};
    this.database = database;
    this.name = name;
    this.schema = schema;
    this.pouchSettings = pouchSettings;
    this.migrationStrategies = migrationStrategies;
    this.methods = methods;
    this.attachments = attachments;
    this.options = options;
    this.statics = statics;

    _applyHookFunctions(this);
  }
  /**
   * returns observable
   */


  var _proto = RxCollectionBase.prototype;

  _proto.prepare = function prepare() {
    var _this = this;

    this.pouch = this.database._spawnPouchDB(this.name, this.schema.version, this.pouchSettings);

    if (this.schema.doKeyCompression()) {
      this._keyCompressor = _overwritable["default"].createKeyCompressor(this.schema);
    } // we trigger the non-blocking things first and await them later so we can do stuff in the mean time


    var spawnedPouchPromise = this.pouch.info(); // resolved when the pouchdb is useable

    var createIndexesPromise = _prepareCreateIndexes(this, spawnedPouchPromise);

    this._dataMigrator = (0, _dataMigrator.createDataMigrator)(this, this.migrationStrategies);
    this._crypter = _crypter["default"].create(this.database.password, this.schema);
    this._observable$ = this.database.$.pipe((0, _operators.filter)(function (event) {
      return event.data.col === _this.name;
    }));
    this._changeEventBuffer = (0, _changeEventBuffer.createChangeEventBuffer)(this);

    this._subs.push(this._observable$.pipe((0, _operators.filter)(function (cE) {
      return !cE.data.isLocal;
    })).subscribe(function (cE) {
      // when data changes, send it to RxDocument in docCache
      var doc = _this._docCache.get(cE.data.doc);

      if (doc) doc._handleChangeEvent(cE);
    }));

    return Promise.all([spawnedPouchPromise, createIndexesPromise]);
  }
  /**
   * checks if a migration is needed
   */
  ;

  _proto.migrationNeeded = function migrationNeeded() {
    return (0, _dataMigrator.mustMigrate)(this._dataMigrator);
  }
  /**
   * trigger migration manually
   */
  ;

  _proto.migrate = function migrate() {
    var batchSize = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 10;
    return this._dataMigrator.migrate(batchSize);
  }
  /**
   * does the same thing as .migrate() but returns promise
   * @return resolves when finished
   */
  ;

  _proto.migratePromise = function migratePromise() {
    var batchSize = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 10;
    return this._dataMigrator.migratePromise(batchSize);
  }
  /**
   * wrappers for Pouch.put/get to handle keycompression etc
   */
  ;

  _proto._handleToPouch = function _handleToPouch(docData) {
    return (0, _rxCollectionHelper._handleToPouch)(this, docData);
  };

  _proto._handleFromPouch = function _handleFromPouch(docData) {
    var noDecrypt = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    return (0, _rxCollectionHelper._handleFromPouch)(this, docData, noDecrypt);
  }
  /**
   * every write on the pouchdb
   * is tunneld throught this function
   */
  ;

  _proto._pouchPut = function _pouchPut(obj) {
    var _this2 = this;

    var overwrite = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    obj = this._handleToPouch(obj);
    return this.database.lockedRun(function () {
      return _this2.pouch.put(obj);
    })["catch"](function (err) {
      if (overwrite && err.status === 409) {
        return _this2.database.lockedRun(function () {
          return _this2.pouch.get(obj._id);
        }).then(function (exist) {
          obj._rev = exist._rev;
          return _this2.database.lockedRun(function () {
            return _this2.pouch.put(obj);
          });
        });
      } else if (err.status === 409) {
        throw (0, _rxError.newRxError)('COL19', {
          id: obj._id,
          pouchDbError: err,
          data: obj
        });
      } else throw err;
    });
  }
  /**
   * get document from pouchdb by its _id
   */
  ;

  _proto._pouchGet = function _pouchGet(key) {
    var _this3 = this;

    return this.pouch.get(key).then(function (doc) {
      return _this3._handleFromPouch(doc);
    });
  }
  /**
   * wrapps pouch-find
   */
  ;

  _proto._pouchFind = function _pouchFind(rxQuery, limit) {
    var _this4 = this;

    var noDecrypt = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    var compressedQueryJSON = rxQuery.keyCompress();
    if (limit) compressedQueryJSON['limit'] = limit;
    return this.database.lockedRun(function () {
      return _this4.pouch.find(compressedQueryJSON);
    }).then(function (docsCompressed) {
      var docs = docsCompressed.docs.map(function (doc) {
        return _this4._handleFromPouch(doc, noDecrypt);
      });
      return docs;
    });
  };

  _proto.$emit = function $emit(changeEvent) {
    return this.database.$emit(changeEvent);
  };

  _proto.insert = function insert(json) {
    var _this5 = this;

    // inserting a temporary-document
    var tempDoc = null;

    if ((0, _rxDocument.isInstanceOf)(json)) {
      tempDoc = json;

      if (!tempDoc._isTemporary) {
        throw (0, _rxError.newRxError)('COL1', {
          data: json
        });
      }

      json = tempDoc.toJSON();
    }

    var useJson = (0, _rxCollectionHelper.fillObjectDataBeforeInsert)(this, json);
    var newDoc = tempDoc;
    return this._runHooks('pre', 'insert', useJson).then(function () {
      _this5.schema.validate(useJson);

      return _this5._pouchPut(useJson);
    }).then(function (insertResult) {
      useJson[_this5.schema.primaryPath] = insertResult.id;
      useJson._rev = insertResult.rev;

      if (tempDoc) {
        tempDoc._dataSync$.next(useJson);
      } else newDoc = (0, _rxDocumentPrototypeMerge.createRxDocument)(_this5, useJson);

      return _this5._runHooks('post', 'insert', useJson, newDoc);
    }).then(function () {
      // event
      var emitEvent = (0, _rxChangeEvent.createChangeEvent)('INSERT', _this5.database, _this5, newDoc, useJson);

      _this5.$emit(emitEvent);

      return newDoc;
    });
  };

  _proto.bulkInsert = function bulkInsert(docsData) {
    var _this6 = this;

    var useDocs = docsData.map(function (docData) {
      var useDocData = (0, _rxCollectionHelper.fillObjectDataBeforeInsert)(_this6, docData);
      return useDocData;
    });
    return Promise.all(useDocs.map(function (doc) {
      return _this6._runHooks('pre', 'insert', doc).then(function () {
        _this6.schema.validate(doc);

        return doc;
      });
    })).then(function (docs) {
      var insertDocs = docs.map(function (d) {
        return _this6._handleToPouch(d);
      });
      var docsMap = new Map();
      docs.forEach(function (d) {
        docsMap.set(d[_this6.schema.primaryPath], d);
      });
      return _this6.database.lockedRun(function () {
        return _this6.pouch.bulkDocs(insertDocs).then(function (results) {
          var okResults = results.filter(function (r) {
            return r.ok;
          }); // create documents

          var rxDocuments = okResults.map(function (r) {
            var docData = docsMap.get(r.id);
            docData._rev = r.rev;
            var doc = (0, _rxDocumentPrototypeMerge.createRxDocument)(_this6, docData);
            return doc;
          }); // emit events

          rxDocuments.forEach(function (doc) {
            var emitEvent = (0, _rxChangeEvent.createChangeEvent)('INSERT', _this6.database, _this6, doc, docsMap.get(doc.primary));

            _this6.$emit(emitEvent);
          });
          return {
            success: rxDocuments,
            error: results.filter(function (r) {
              return !r.ok;
            })
          };
        });
      });
    });
  }
  /**
   * same as insert but overwrites existing document with same primary
   */
  ;

  _proto.upsert = function upsert(json) {
    var _this7 = this;

    var useJson = (0, _util.flatClone)(json);
    var primary = useJson[this.schema.primaryPath];

    if (!primary) {
      throw (0, _rxError.newRxError)('COL3', {
        primaryPath: this.schema.primaryPath,
        data: useJson
      });
    }

    return this.findOne(primary).exec().then(function (existing) {
      if (existing) {
        useJson._rev = existing['_rev'];
        return existing.atomicUpdate(function () {
          return useJson;
        }).then(function () {
          return existing;
        });
      } else {
        return _this7.insert(json);
      }
    });
  }
  /**
   * upserts to a RxDocument, uses atomicUpdate if document already exists
   */
  ;

  _proto.atomicUpsert = function atomicUpsert(json) {
    var _this8 = this;

    var primary = json[this.schema.primaryPath];

    if (!primary) {
      throw (0, _rxError.newRxError)('COL4', {
        data: json
      });
    } // ensure that it wont try 2 parallel runs


    var queue;

    if (!this._atomicUpsertQueues.has(primary)) {
      queue = Promise.resolve();
    } else {
      queue = this._atomicUpsertQueues.get(primary);
    }

    queue = queue.then(function () {
      return _atomicUpsertEnsureRxDocumentExists(_this8, primary, json);
    }).then(function (wasInserted) {
      if (!wasInserted.inserted) {
        return _atomicUpsertUpdate(wasInserted.doc, json).then(function () {
          return (0, _util.nextTick)();
        }) // tick here so the event can propagate
        .then(function () {
          return wasInserted.doc;
        });
      } else return wasInserted.doc;
    });

    this._atomicUpsertQueues.set(primary, queue);

    return queue;
  }
  /**
   * takes a mongoDB-query-object and returns the documents
   */
  ;

  _proto.find = function find(queryObj) {
    if (typeof queryObj === 'string') {
      throw (0, _rxError.newRxError)('COL5', {
        queryObj: queryObj
      });
    }

    var query = (0, _rxQuery.createRxQuery)('find', queryObj, this);
    return query;
  };

  _proto.findOne = function findOne(queryObj) {
    var query;

    if (typeof queryObj === 'string') {
      query = (0, _rxQuery.createRxQuery)('findOne', {
        _id: queryObj
      }, this);
    } else query = (0, _rxQuery.createRxQuery)('findOne', queryObj, this);

    if (typeof queryObj === 'number' || Array.isArray(queryObj)) {
      throw (0, _rxError.newRxTypeError)('COL6', {
        queryObj: queryObj
      });
    }

    return query;
  }
  /**
   * Export collection to a JSON friendly format.
   * @param _decrypted
   * When true, all encrypted values will be decrypted.
   * When false or omitted and an interface or type is loaded in this collection,
   * all base properties of the type are typed as `any` since data could be encrypted.
   */
  ;

  _proto.dump = function dump() {
    var _decrypted = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

    throw (0, _util.pluginMissing)('json-dump');
  }
  /**
   * Import the parsed JSON export into the collection.
   * @param _exportedJSON The previously exported data from the `<collection>.dump()` method.
   */
  ;

  _proto.importDump = function importDump(_exportedJSON) {
    throw (0, _util.pluginMissing)('json-dump');
  }
  /**
   * waits for external changes to the database
   * and ensures they are emitted to the internal RxChangeEvent-Stream
   * TODO this can be removed by listening to the pull-change-events of the RxReplicationState
   */
  ;

  _proto.watchForChanges = function watchForChanges() {
    throw (0, _util.pluginMissing)('watch-for-changes');
  }
  /**
   * sync with another database
   */
  ;

  _proto.sync = function sync(_syncOptions) {
    throw (0, _util.pluginMissing)('replication');
  }
  /**
   * sync with a GraphQL endpoint
   */
  ;

  _proto.syncGraphQL = function syncGraphQL(options) {
    throw (0, _util.pluginMissing)('replication-graphql');
  }
  /**
   * Create a replicated in-memory-collection
   */
  ;

  _proto.inMemory = function inMemory() {
    throw (0, _util.pluginMissing)('in-memory');
  }
  /**
   * HOOKS
   */
  ;

  _proto.addHook = function addHook(when, key, fun) {
    var parallel = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

    if (typeof fun !== 'function') {
      throw (0, _rxError.newRxTypeError)('COL7', {
        key: key,
        when: when
      });
    }

    if (!HOOKS_WHEN.includes(when)) {
      throw (0, _rxError.newRxTypeError)('COL8', {
        key: key,
        when: when
      });
    }

    if (!HOOKS_KEYS.includes(key)) {
      throw (0, _rxError.newRxError)('COL9', {
        key: key
      });
    }

    if (when === 'post' && key === 'create' && parallel === true) {
      throw (0, _rxError.newRxError)('COL10', {
        when: when,
        key: key,
        parallel: parallel
      });
    } // bind this-scope to hook-function


    var boundFun = fun.bind(this);
    var runName = parallel ? 'parallel' : 'series';
    this.hooks[key] = this.hooks[key] || {};
    this.hooks[key][when] = this.hooks[key][when] || {
      series: [],
      parallel: []
    };
    this.hooks[key][when][runName].push(boundFun);
  };

  _proto.getHooks = function getHooks(when, key) {
    try {
      return this.hooks[key][when];
    } catch (e) {
      return {
        series: [],
        parallel: []
      };
    }
  };

  _proto._runHooks = function _runHooks(when, key, data, instance) {
    var hooks = this.getHooks(when, key);
    if (!hooks) return Promise.resolve(); // run parallel: false

    var tasks = hooks.series.map(function (hook) {
      return function () {
        return hook(data, instance);
      };
    });
    return (0, _util.promiseSeries)(tasks) // run parallel: true
    .then(function () {
      return Promise.all(hooks.parallel.map(function (hook) {
        return hook(data, instance);
      }));
    });
  }
  /**
   * does the same as ._runHooks() but with non-async-functions
   */
  ;

  _proto._runHooksSync = function _runHooksSync(when, key, data, instance) {
    var hooks = this.getHooks(when, key);
    if (!hooks) return;
    hooks.series.forEach(function (hook) {
      return hook(data, instance);
    });
  }
  /**
   * creates a temporaryDocument which can be saved later
   */
  ;

  _proto.newDocument = function newDocument() {
    var docData = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    docData = this.schema.fillObjectWithDefaults(docData);
    var doc = (0, _rxDocument.createWithConstructor)((0, _rxDocumentPrototypeMerge.getRxDocumentConstructor)(this), this, docData);
    doc._isTemporary = true;

    this._runHooksSync('post', 'create', docData, doc);

    return doc;
  };

  _proto.destroy = function destroy() {
    if (this.destroyed) return Promise.resolve(false);

    if (this._onDestroyCall) {
      this._onDestroyCall();
    }

    this._subs.forEach(function (sub) {
      return sub.unsubscribe();
    });

    if (this._changeEventBuffer) {
      this._changeEventBuffer.destroy();
    }

    this._queryCache.destroy();

    this._repStates.forEach(function (sync) {
      return sync.cancel();
    });

    delete this.database.collections[this.name];
    this.destroyed = true;
    return Promise.resolve(true);
  }
  /**
   * remove all data
   */
  ;

  _proto.remove = function remove() {
    return this.database.removeCollection(this.name);
  };

  (0, _createClass2["default"])(RxCollectionBase, [{
    key: "$",
    get: function get() {
      return this._observable$;
    }
  }, {
    key: "insert$",
    get: function get() {
      return this.$.pipe((0, _operators.filter)(function (cE) {
        return cE.data.op === 'INSERT';
      }));
    }
  }, {
    key: "update$",
    get: function get() {
      return this.$.pipe((0, _operators.filter)(function (cE) {
        return cE.data.op === 'UPDATE';
      }));
    }
  }, {
    key: "remove$",
    get: function get() {
      return this.$.pipe((0, _operators.filter)(function (cE) {
        return cE.data.op === 'REMOVE';
      }));
    }
  }, {
    key: "docChanges$",
    get: function get() {
      if (!this.__docChanges$) {
        this.__docChanges$ = this.$.pipe((0, _operators.filter)(function (cEvent) {
          return ['INSERT', 'UPDATE', 'REMOVE'].includes(cEvent.data.op);
        }));
      }

      return this.__docChanges$;
    }
  }, {
    key: "onDestroy",
    get: function get() {
      var _this9 = this;

      if (!this._onDestroy) this._onDestroy = new Promise(function (res) {
        return _this9._onDestroyCall = res;
      });
      return this._onDestroy;
    }
  }]);
  return RxCollectionBase;
}();
/**
 * adds the hook-functions to the collections prototype
 * this runs only once
 */


exports.RxCollectionBase = RxCollectionBase;

function _applyHookFunctions(collection) {
  if (hooksApplied) return; // already run

  hooksApplied = true;
  var colProto = Object.getPrototypeOf(collection);
  HOOKS_KEYS.forEach(function (key) {
    HOOKS_WHEN.map(function (when) {
      var fnName = when + (0, _util.ucfirst)(key);

      colProto[fnName] = function (fun, parallel) {
        return this.addHook(when, key, fun, parallel);
      };
    });
  });
}
/**
 * returns all possible properties of a RxCollection-instance
 */


var _properties = null;

function properties() {
  if (!_properties) {
    var pseudoInstance = new RxCollectionBase();
    var ownProperties = Object.getOwnPropertyNames(pseudoInstance);
    var prototypeProperties = Object.getOwnPropertyNames(Object.getPrototypeOf(pseudoInstance));
    _properties = [].concat(ownProperties, prototypeProperties);
  }

  return _properties;
}

function _atomicUpsertUpdate(doc, json) {
  return doc.atomicUpdate(function (innerDoc) {
    json._rev = innerDoc._rev;
    innerDoc._data = json;
    return innerDoc._data;
  }).then(function () {
    return doc;
  });
}
/**
 * ensures that the given document exists
 * @return promise that resolves with new doc and flag if inserted
 */


function _atomicUpsertEnsureRxDocumentExists(rxCollection, primary, json) {
  return rxCollection.findOne(primary).exec().then(function (doc) {
    if (!doc) {
      return rxCollection.insert(json).then(function (newDoc) {
        return {
          doc: newDoc,
          inserted: true
        };
      });
    } else {
      return {
        doc: doc,
        inserted: false
      };
    }
  });
}
/**
 * creates the indexes in the pouchdb
 */


function _prepareCreateIndexes(rxCollection, spawnedPouchPromise) {
  return Promise.all(rxCollection.schema.indexes.map(function (indexAr) {
    var compressedIdx = indexAr.map(function (key) {
      if (!rxCollection.schema.doKeyCompression()) return key;else return rxCollection._keyCompressor.transformKey('', '', key.split('.'));
    });
    return spawnedPouchPromise.then(function () {
      return rxCollection.pouch.createIndex({
        index: {
          fields: compressedIdx
        }
      });
    });
  }));
}
/**
 * creates and prepares a new collection
 */


function create(_ref) {
  var database = _ref.database,
      name = _ref.name,
      schema = _ref.schema,
      _ref$pouchSettings = _ref.pouchSettings,
      pouchSettings = _ref$pouchSettings === void 0 ? {} : _ref$pouchSettings,
      _ref$migrationStrateg = _ref.migrationStrategies,
      migrationStrategies = _ref$migrationStrateg === void 0 ? {} : _ref$migrationStrateg,
      _ref$autoMigrate = _ref.autoMigrate,
      autoMigrate = _ref$autoMigrate === void 0 ? true : _ref$autoMigrate,
      _ref$statics = _ref.statics,
      statics = _ref$statics === void 0 ? {} : _ref$statics,
      _ref$methods = _ref.methods,
      methods = _ref$methods === void 0 ? {} : _ref$methods,
      _ref$attachments = _ref.attachments,
      attachments = _ref$attachments === void 0 ? {} : _ref$attachments,
      _ref$options = _ref.options,
      options = _ref$options === void 0 ? {} : _ref$options;
  (0, _pouchDb.validateCouchDBString)(name); // ensure it is a schema-object

  if (!(0, _rxSchema.isInstanceOf)(schema)) schema = (0, _rxSchema.createRxSchema)(schema);
  Object.keys(methods).filter(function (funName) {
    return schema.topLevelFields.includes(funName);
  }).forEach(function (funName) {
    throw (0, _rxError.newRxError)('COL18', {
      funName: funName
    });
  });
  var collection = new RxCollectionBase(database, name, schema, pouchSettings, migrationStrategies, methods, attachments, options, statics);
  return collection.prepare().then(function () {
    // ORM add statics
    Object.entries(statics).forEach(function (_ref2) {
      var funName = _ref2[0],
          fun = _ref2[1];
      Object.defineProperty(collection, funName, {
        get: function get() {
          return fun.bind(collection);
        }
      });
    });
    var ret = Promise.resolve();
    if (autoMigrate) ret = collection.migratePromise();
    return ret;
  }).then(function () {
    (0, _hooks.runPluginHooks)('createRxCollection', collection);
    return collection;
  });
}

function isInstanceOf(obj) {
  return obj instanceof RxCollectionBase;
}

var _default = {
  create: create,
  properties: properties,
  isInstanceOf: isInstanceOf,
  RxCollectionBase: RxCollectionBase
};
exports["default"] = _default;

//# sourceMappingURL=rx-collection.js.map