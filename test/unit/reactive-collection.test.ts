import assert from 'assert';
import config from './config';

import * as schemas from '../helper/schemas';
import * as schemaObjects from '../helper/schema-objects';
import * as humansCollection from '../helper/humans-collection';

import {
    createRxDatabase
} from '../../';
import * as util from '../../dist/lib/util';
import AsyncTestUtil from 'async-test-util';
import {
    first
} from 'rxjs/operators';

config.parallel('reactive-collection.test.js', () => {
    describe('.insert()', () => {
        describe('positive', () => {
            it('should get a valid event on insert', async () => {
                const db = await createRxDatabase({
                    name: util.randomCouchString(10),
                    adapter: 'memory'
                });
                const colName = 'foobar';
                const c = await db.collection({
                    name: colName,
                    schema: schemas.human
                });

                c.insert(schemaObjects.human());
                const changeEvent = await c.$.pipe(first()).toPromise();
                assert.strictEqual(changeEvent.constructor.name, 'RxChangeEvent');
                assert.strictEqual(changeEvent.data.col, colName);
                assert.strictEqual(typeof changeEvent.data.doc, 'string');
                assert.ok(changeEvent.data.v);
                db.destroy();
            });
        });
        describe('negative', () => {
            it('should get no event on non-succes-insert', async () => {
                const db = await createRxDatabase({
                    name: util.randomCouchString(10),
                    adapter: 'memory'
                });
                const c = await db.collection({
                    name: 'foobar',
                    schema: schemas.human
                });
                let calls = 0;
                const sub = db.$.subscribe(() => {
                    calls++;
                });
                await AsyncTestUtil.assertThrows(
                    () => c.insert({
                        foo: 'baar'
                    }),
                    'RxError',
                    'schema'
                );
                assert.strictEqual(calls, 0);
                sub.unsubscribe();
                db.destroy();
            });
        });
    });
    describe('.remove()', () => {
        describe('positive', () => {
            it('should fire on remove', async () => {
                const c = await humansCollection.create(0);
                const q = c.find();
                const ar: any[] = [];
                const sub = q.$
                    .subscribe(docs => {
                        ar.push(docs);
                    });

                // nothing is fired until no results
                assert.strictEqual(ar.length, 0);

                // empty array since no documents
                await AsyncTestUtil.waitUntil(() => ar.length === 1);

                assert.deepStrictEqual(ar[0], []);

                await c.insert(schemaObjects.human());
                await AsyncTestUtil.waitUntil(() => ar.length === 2);

                const doc: any = await c.findOne().exec();
                await doc.remove();
                await AsyncTestUtil.waitUntil(() => ar.length === 3);
                sub.unsubscribe();

                c.database.destroy();
            });
        });
    });
    describe('.insert$', () => {
        it('should only emit inserts', async () => {
            const c = await humansCollection.create(0);

            const emitted: any[] = [];
            c.insert$.subscribe(cE => emitted.push(cE));

            await c.insert(schemaObjects.human());
            const doc = await c.insert(schemaObjects.human());
            await c.insert(schemaObjects.human());
            await doc.remove();

            await c.insert(schemaObjects.human());

            await AsyncTestUtil.waitUntil(() => emitted.length === 4);
            emitted.forEach(cE => assert.strictEqual(cE.data.op, 'INSERT'));
            c.database.destroy();
        });
    });
    describe('.update$', () => {
        it('should only emit updates', async () => {
            const c = await humansCollection.create(0);

            const emitted: any[] = [];
            c.update$.subscribe(cE => emitted.push(cE));

            const doc1 = await c.insert(schemaObjects.human());
            const doc2 = await c.insert(schemaObjects.human());
            const doc3 = await c.insert(schemaObjects.human());
            await c.insert(schemaObjects.human());
            await doc3.remove();

            await doc1.atomicSet('firstName', 'foobar1');
            await doc2.atomicSet('firstName', 'foobar2');

            await AsyncTestUtil.waitUntil(() => emitted.length === 2);
            emitted.forEach(cE => assert.strictEqual(cE.data.op, 'UPDATE'));
            c.database.destroy();
        });
    });
    describe('.remove$', () => {
        it('should only emit removes', async () => {
            const c = await humansCollection.create(0);

            const emitted: any[] = [];
            c.remove$.subscribe(cE => emitted.push(cE));
            await c.insert(schemaObjects.human());
            const doc1 = await c.insert(schemaObjects.human());
            const doc2 = await c.insert(schemaObjects.human());
            await doc1.remove();
            await c.insert(schemaObjects.human());
            await doc2.remove();


            await AsyncTestUtil.waitUntil(() => emitted.length === 2);
            emitted.forEach(cE => assert.strictEqual(cE.data.op, 'REMOVE'));
            c.database.destroy();
        });
    });
});
