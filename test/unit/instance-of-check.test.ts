import assert from 'assert';
import config from './config';

import * as humansCollection from '../helper/humans-collection';
import * as RxDB from '../../';

config.parallel('instance-of-check.test.js', () => {
    it('positive', async () => {
        const c = await humansCollection.create(1);
        const query = c.findOne();
        const doc = await query.exec();
        assert.ok(RxDB.isRxDatabase(c.database));
        assert.ok(RxDB.isRxCollection(c));
        assert.ok(RxDB.isRxQuery(query));
        assert.ok(RxDB.isRxDocument(doc));
        assert.ok(RxDB.isRxSchema(c.schema));

        c.database.destroy();
    });
    it('negative', async () => {
        const anyObj = {};
        assert.strictEqual(false, RxDB.isRxDatabase(anyObj));
        assert.strictEqual(false, RxDB.isRxCollection(anyObj));
        assert.strictEqual(false, RxDB.isRxQuery(anyObj));
        assert.strictEqual(false, RxDB.isRxDocument(anyObj));
        assert.strictEqual(false, RxDB.isRxSchema(anyObj));
    });
});
