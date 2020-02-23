import {
    tap
} from 'rxjs/operators';

// import typings
import {
    RxHeroDocument,
    RxHeroesDatabase,
    RxHeroesCollections,
    RxHeroDocumentType
} from './../RxDB.d';

import heroSchema from '../schemas/Hero.schema';

// batteries-included
// import RxDB from 'rxdb';

/**
 * custom build
 */
import RxDB from 'rxdb/plugins/core';

// import modules
import RxDBSchemaCheckModule from 'rxdb/plugins/schema-check';
import RxDBErrorMessagesModule from 'rxdb/plugins/error-messages';

if (process.env.NODE_ENV === 'development') {
    // in dev-mode we show full error-messages
    RxDB.plugin(RxDBErrorMessagesModule);

    // schema-checks should be used in dev-mode only
    RxDB.plugin(RxDBSchemaCheckModule);
}

import RxDBValidateModule from 'rxdb/plugins/validate';
RxDB.plugin(RxDBValidateModule);

import RxDBLeaderElectionModule from 'rxdb/plugins/leader-election';
RxDB.plugin(RxDBLeaderElectionModule);

import RxDBReplicationModule from 'rxdb/plugins/replication';
RxDB.plugin(RxDBReplicationModule);
// always needed for replication with the node-server
import * as PouchdbAdapterHttp from 'pouchdb-adapter-http';
RxDB.plugin(PouchdbAdapterHttp);


import * as PouchdbAdapterIdb from 'pouchdb-adapter-idb';
RxDB.plugin(PouchdbAdapterIdb);
const useAdapter = 'idb';


const collections = [
    {
        name: 'heroes',
        schema: heroSchema,
        methods: {
            hpPercent(this: RxHeroDocument): number {
                return this.hp / this.maxHP * 100;
            }
        },
        sync: true
    }
];

console.log('hostname: ' + window.location.hostname);
const syncURL = 'http://' + window.location.hostname + ':10101/';

let doSync = true;
if (window.location.hash === '#nosync') { doSync = false; }


/**
 * creates the database
 */
async function _create(): Promise<RxHeroesDatabase> {
    console.log('DatabaseService: creating database..');
    const db = await RxDB.create<RxHeroesCollections>({
        name: 'heroes',
        adapter: useAdapter,
        queryChangeDetection: true
        // password: 'myLongAndStupidPassword' // no password needed
    });
    console.log('DatabaseService: created database');
    (window as any).db = db; // write to window for debugging

    // show leadership in title
    db.waitForLeadership()
        .then(() => {
            console.log('isLeader now');
            document.title = '♛ ' + document.title;
        });

    // create collections
    console.log('DatabaseService: create collections');
    await Promise.all(collections.map((colData) => db.collection(colData)));

    // hooks
    console.log('DatabaseService: add hooks');
    db.collections.heroes.preInsert((docObj: RxHeroDocumentType) => {
        const color = docObj.color;
        return db.collections.heroes.findOne({ color }).exec()
            .then((has: RxHeroDocument | null) => {
                if (has != null) {
                    alert('another hero already has the color ' + color);
                    throw new Error('color already there');
                }
                return db;
            });
    }, true);

    // sync with server
    console.log('DatabaseService: sync');
    await db.heroes.sync({
        remote: syncURL + '/hero'
    });

    return db;
}

const DatabaseService = {
    DB_CREATE_PROMISE: _create(),
    get(): Promise<RxHeroesDatabase> {
        return this.DB_CREATE_PROMISE;
    }
};

export default DatabaseService;
