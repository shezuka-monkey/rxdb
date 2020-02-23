/**
 * This plugin adds the local-documents-support
 * Local documents behave equal then with pouchdb
 * @link https://pouchdb.com/guides/local-documents.html
 */

import objectPath from 'object-path';

import {
    createRxDocumentConstructor,
    basePrototype
} from '../rx-document';
import {
    createChangeEvent,
    RxChangeEvent
} from '../rx-change-event';
import {
    createDocCache
} from '../doc-cache';
import {
    newRxError,
    newRxTypeError
} from '../rx-error';
import {
    clone
} from '../util';

import {
    RxCollection,
    RxDatabase,
    RxDocument
} from '../types';

import {
    isInstanceOf as isRxDatabase
} from '../rx-database';
import {
    isInstanceOf as isRxCollection
} from '../rx-collection';

import {
    filter,
    map,
    distinctUntilChanged
} from 'rxjs/operators';

const DOC_CACHE_BY_PARENT = new WeakMap();
const _getDocCache = (parent: any) => {
    if (!DOC_CACHE_BY_PARENT.has(parent)) {
        DOC_CACHE_BY_PARENT.set(
            parent,
            createDocCache()
        );
    }
    return DOC_CACHE_BY_PARENT.get(parent);
};
const CHANGE_SUB_BY_PARENT = new WeakMap();
const _getChangeSub = (parent: any) => {
    if (!CHANGE_SUB_BY_PARENT.has(parent)) {
        const sub = parent.$
            .pipe(
                filter(cE => (cE as RxChangeEvent).data.isLocal)
            )
            .subscribe((cE: RxChangeEvent) => {
                const docCache = _getDocCache(parent);
                const doc = docCache.get(cE.data.doc);
                if (doc) doc._handleChangeEvent(cE);
            });
        parent._subs.push(sub);
        CHANGE_SUB_BY_PARENT.set(
            parent,
            sub
        );
    }
    return CHANGE_SUB_BY_PARENT.get(parent);
};

const LOCAL_PREFIX = '_local/';

const RxDocumentParent = createRxDocumentConstructor() as any;
export class RxLocalDocument extends RxDocumentParent {
    public id: string;
    public parent: RxCollection | RxDatabase;
    constructor(id: string, jsonData: any, parent: RxCollection | RxDatabase) {
        super(null, jsonData);
        this.id = id;
        this.parent = parent;
    }
}

const _getPouchByParent = (parent: any) => {
    if (isRxDatabase(parent))
        return parent._adminPouch; // database
    else return parent.pouch; // collection
};

const RxLocalDocumentPrototype: any = {
    toPouchJson(
        this: any
    ) {
        const data = clone(this._data);
        data._id = LOCAL_PREFIX + this.id;
    },
    get isLocal() {
        return true;
    },
    get parentPouch(
        this: any
    ) {
        return _getPouchByParent(this.parent);
    },

    //
    // overwrites
    //

    _handleChangeEvent(
        this: any,
        changeEvent: RxChangeEvent
    ) {
        if (changeEvent.data.doc !== this.primary) return;
        switch (changeEvent.data.op) {
            case 'UPDATE':
                const newData = clone(changeEvent.data.v);
                this._dataSync$.next(clone(newData));
                break;
            case 'REMOVE':
                // remove from docCache to assure new upserted RxDocuments will be a new instance
                const docCache = _getDocCache(this.parent);
                docCache.delete(this.primary);
                this._deleted$.next(true);
                break;
        }
    },

    get allAttachments$() {
        // this is overwritten here because we cannot re-set getters on the prototype
        throw newRxError('LD1', {
            document: this
        });
    },
    get primaryPath() {
        return 'id';
    },
    get primary(this: any) {
        return this.id;
    },
    get $(this: RxDocument) {
        return this._dataSync$.asObservable();
    },
    $emit(this: any, changeEvent: RxChangeEvent) {
        return this.parent.$emit(changeEvent);
    },
    get(this: RxDocument, objPath: string) {
        if (!this._data) return undefined;
        if (typeof objPath !== 'string') {
            throw newRxTypeError('LD2', {
                objPath
            });
        }

        let valueObj = objectPath.get(this._data, objPath);
        valueObj = clone(valueObj);
        return valueObj;
    },
    get$(this: RxDocument, path: string) {
        if (path.includes('.item.')) {
            throw newRxError('LD3', {
                path
            });
        }
        if (path === this.primaryPath)
            throw newRxError('LD4');

        return this._dataSync$
            .pipe(
                map(data => objectPath.get(data, path)),
                distinctUntilChanged()
            );
    },
    set(this: RxDocument, objPath: string, value: any) {
        if (!value) {
            // object path not set, overwrite whole data
            const data: any = clone(objPath);
            data._rev = this._data._rev;
            this._data = data;
            return this;
        }
        if (objPath === '_id') {
            throw newRxError('LD5', {
                objPath,
                value
            });
        }
        if (Object.is(this.get(objPath), value)) return;
        objectPath.set(this._data, objPath, value);
        return this;
    },
    _saveData(this: any, newData: any) {
        newData = clone(newData);
        newData._id = LOCAL_PREFIX + this.id;

        return this.parentPouch.put(newData)
            .then((res: any) => {
                newData._rev = res.rev;
                this._dataSync$.next(newData);

                const changeEvent = createChangeEvent(
                    'UPDATE',
                    isRxDatabase(this.parent) ? this.parent : this.parent.database,
                    isRxCollection(this.parent) ? this.parent : null,
                    this,
                    clone(this._data),
                    true
                );
                this.$emit(changeEvent);
            });
    },

    remove(this: any): Promise<void> {
        const removeId = LOCAL_PREFIX + this.id;
        return this.parentPouch.remove(removeId, this._data._rev)
            .then(() => {
                _getDocCache(this.parent).delete(this.id);
                const changeEvent = createChangeEvent(
                    'REMOVE',
                    isRxDatabase(this.parent) ? this.parent : this.parent.database,
                    isRxCollection(this.parent) ? this.parent : null,
                    this,
                    clone(this._data),
                    true
                );
                this.$emit(changeEvent);
            });
    }
};


let INIT_DONE = false;
const _init = () => {
    if (INIT_DONE) return;
    else INIT_DONE = true;

    // add functions of RxDocument
    const docBaseProto = basePrototype;
    const props = Object.getOwnPropertyNames(docBaseProto);
    props.forEach(key => {
        const exists = Object.getOwnPropertyDescriptor(RxLocalDocumentPrototype, key);
        if (exists) return;
        const desc: any = Object.getOwnPropertyDescriptor(docBaseProto, key);
        Object.defineProperty(RxLocalDocumentPrototype, key, desc);
    });


    /**
     * overwrite things that not work on local documents
     * with throwing function
     */
    const getThrowingFun = (k: string) => () => {
        throw newRxError('LD6', {
            functionName: k
        });
    };
    [
        'populate',
        'update',
        'putAttachment',
        'getAttachment',
        'allAttachments'
    ].forEach((k: string) => RxLocalDocumentPrototype[k] = getThrowingFun(k));
};

RxLocalDocument.create = (id: string, data: any, parent: any) => {
    _init();
    _getChangeSub(parent);

    const newDoc = new RxLocalDocument(id, data, parent);
    newDoc.__proto__ = RxLocalDocumentPrototype;
    _getDocCache(parent).set(id, newDoc);
    return newDoc;
};

/**
 * save the local-document-data
 * throws if already exists
 */
function insertLocal(this: any, id: string, data: any): Promise<RxLocalDocument> {
    if (isRxCollection(this) && this._isInMemory)
        return this._parentCollection.insertLocal(id, data);

    data = clone(data);

    return this.getLocal(id)
        .then((existing: any) => {
            if (existing) {
                throw newRxError('LD7', {
                    id,
                    data
                });
            }

            // create new one
            const pouch = _getPouchByParent(this);
            const saveData = clone(data);
            saveData._id = LOCAL_PREFIX + id;

            return pouch.put(saveData);
        }).then((res: any) => {
            data._rev = res.rev;
            const newDoc = RxLocalDocument.create(id, data, this);
            return newDoc;
        });
}

/**
 * save the local-document-data
 * overwrites existing if exists
 */
function upsertLocal(this: any, id: string, data: any): Promise<RxLocalDocument> {
    if (isRxCollection(this) && this._isInMemory)
        return this._parentCollection.upsertLocal(id, data);

    return this.getLocal(id)
        .then((existing: any) => {
            if (!existing) {
                // create new one
                const doc = this.insertLocal(id, data);
                return doc;
            } else {
                // update existing
                data._rev = existing._data._rev;
                return existing.atomicUpdate(() => data).then(() => existing);
            }
        });
}

function getLocal(this: any, id: string): Promise<RxLocalDocument> {
    if (isRxCollection(this) && this._isInMemory)
        return this._parentCollection.getLocal(id);

    const pouch = _getPouchByParent(this);
    const docCache = _getDocCache(this);

    // check in doc-cache
    const found = docCache.get(id);
    if (found) return Promise.resolve(found);

    // if not found, check in pouch
    return pouch.get(LOCAL_PREFIX + id)
        .then((docData: any) => {
            if (!docData) return null;
            const doc = RxLocalDocument.create(id, docData, this);
            return doc;
        })
        .catch(() => null);
}

export const rxdb = true;
export const prototypes = {
    RxCollection: (proto: any) => {
        proto.insertLocal = insertLocal;
        proto.upsertLocal = upsertLocal;
        proto.getLocal = getLocal;
    },
    RxDatabase: (proto: any) => {
        proto.insertLocal = insertLocal;
        proto.upsertLocal = upsertLocal;
        proto.getLocal = getLocal;
    }
};
export const overwritable = {};

export default {
    rxdb,
    prototypes,
    overwritable
};
