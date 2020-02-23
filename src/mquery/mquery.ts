/**
 * this is based on
 * @link https://github.com/aheckmann/mquery/blob/master/lib/mquery.js
 */
import {
    isObject,
    merge,
    mergeClone
} from './mquery_utils';
import {
    newRxTypeError,
    newRxError
} from '../rx-error';
import {
    clone
} from '../util';
import {
    RxQueryObject
} from '../types';

export class MQueryBase {

    public options: any = {};
    public _conditions: RxQueryObject = {} as RxQueryObject;
    public _fields: any;
    public _path: any;
    public _update: any;
    private _distinct: any;

    /**
     * MQuery constructor used for building queries.
     *
     * ####Example:
     *     var query = new MQuery({ name: 'mquery' });
     *     query.where('age').gte(21).exec(callback);
     *
     */
    constructor(criteria?: any) {
        if (criteria)
            this.find(criteria);
    }

    /**
     * returns a cloned version of the query
     */
    clone(): MQuery {
        const same: any = new MQueryBase();
        Object
            .entries(this)
            .forEach(([k, v]) => same[k] = clone(v));
        return same as MQuery;
    }


    /**
     * Specifies a `path` for use with chaining.
     */
    where(_path: string, _val: any): MQueryBase {
        if (!arguments.length) return this;
        const type = typeof arguments[0];
        if ('string' === type) {
            this._path = arguments[0];
            if (2 === arguments.length)
                this._conditions[this._path] = arguments[1];
            return this;
        }

        if ('object' === type && !Array.isArray(arguments[0]))
            return this.merge(arguments[0]);

        throw newRxTypeError('MQ1', {
            path: arguments[0]
        });
    }

    /**
     * Specifies the complementary comparison value for paths specified with `where()`
     * ####Example
     *     User.where('age').equals(49);
     */
    equals(val: any): MQueryBase {
        this._ensurePath('equals');
        const path = this._path;
        this._conditions[path] = val;
        return this;
    }

    /**
     * Specifies the complementary comparison value for paths specified with `where()`
     * This is alias of `equals`
     */
    eq(val: any): MQueryBase {
        this._ensurePath('eq');
        const path = this._path;
        this._conditions[path] = val;
        return this;
    }

    /**
     * Specifies arguments for an `$or` condition.
     * ####Example
     *     query.or([{ color: 'red' }, { status: 'emergency' }])
     */
    or(array: any[]): MQueryBase {
        const or = this._conditions.$or || (this._conditions.$or = []);
        if (!Array.isArray(array)) array = [array];
        or.push.apply(or, array);
        return this;
    }

    /**
     * Specifies arguments for a `$nor` condition.
     * ####Example
     *     query.nor([{ color: 'green' }, { status: 'ok' }])
     */
    nor(array: any[]): MQueryBase {
        const nor = this._conditions.$nor || (this._conditions.$nor = []);
        if (!Array.isArray(array)) array = [array];
        nor.push.apply(nor, array);
        return this;
    }

    /**
     * Specifies arguments for a `$and` condition.
     * ####Example
     *     query.and([{ color: 'green' }, { status: 'ok' }])
     * @see $and http://docs.mongodb.org/manual/reference/operator/and/
     */
    and(array: any[]): MQueryBase {
        const and = this._conditions.$and || (this._conditions.$and = []);
        if (!Array.isArray(array)) array = [array];
        and.push.apply(and, array);
        return this;
    }

    /**
     * Specifies a `$mod` condition
     */
    mod(_path: string, _val: number): MQueryBase {
        let val;
        let path;

        if (1 === arguments.length) {
            this._ensurePath('mod');
            val = arguments[0];
            path = this._path;
        } else if (2 === arguments.length && !Array.isArray(arguments[1])) {
            this._ensurePath('mod');
            val = (arguments as any).slice();
            path = this._path;
        } else if (3 === arguments.length) {
            val = (arguments as any).slice(1);
            path = arguments[0];
        } else {
            val = arguments[1];
            path = arguments[0];
        }

        const conds = this._conditions[path] || (this._conditions[path] = {});
        conds.$mod = val;
        return this;
    }

    /**
     * Specifies an `$exists` condition
     * ####Example
     *     // { name: { $exists: true }}
     *     Thing.where('name').exists()
     *     Thing.where('name').exists(true)
     *     Thing.find().exists('name')
     */
    exists(_path: string, _val: number): MQueryBase {
        let path;
        let val;
        if (0 === arguments.length) {
            this._ensurePath('exists');
            path = this._path;
            val = true;
        } else if (1 === arguments.length) {
            if ('boolean' === typeof arguments[0]) {
                this._ensurePath('exists');
                path = this._path;
                val = arguments[0];
            } else {
                path = arguments[0];
                val = true;
            }
        } else if (2 === arguments.length) {
            path = arguments[0];
            val = arguments[1];
        }

        const conds = this._conditions[path] || (this._conditions[path] = {});
        conds.$exists = val;
        return this;
    }

    /**
     * Specifies an `$elemMatch` condition
     * ####Example
     *     query.elemMatch('comment', { author: 'autobot', votes: {$gte: 5}})
     *     query.where('comment').elemMatch({ author: 'autobot', votes: {$gte: 5}})
     *     query.elemMatch('comment', function (elem) {
     *       elem.where('author').equals('autobot');
     *       elem.where('votes').gte(5);
     *     })
     *     query.where('comment').elemMatch(function (elem) {
     *       elem.where({ author: 'autobot' });
     *       elem.where('votes').gte(5);
     *     })
     */
    elemMatch(_path: string, _criteria: any): MQueryBase {
        if (null === arguments[0])
            throw newRxTypeError('MQ2');

        let fn;
        let path;
        let criteria;

        if ('function' === typeof arguments[0]) {
            this._ensurePath('elemMatch');
            path = this._path;
            fn = arguments[0];
        } else if (isObject(arguments[0])) {
            this._ensurePath('elemMatch');
            path = this._path;
            criteria = arguments[0];
        } else if ('function' === typeof arguments[1]) {
            path = arguments[0];
            fn = arguments[1];
        } else if (arguments[1] && isObject(arguments[1])) {
            path = arguments[0];
            criteria = arguments[1];
        } else
            throw newRxTypeError('MQ2');

        if (fn) {
            criteria = new MQueryBase;
            fn(criteria);
            criteria = criteria._conditions;
        }

        const conds = this._conditions[path] || (this._conditions[path] = {});
        conds.$elemMatch = criteria;
        return this;
    }

    /**
     * Sets the sort order
     * If an object is passed, values allowed are 'asc', 'desc', 'ascending', 'descending', 1, and -1.
     * If a string is passed, it must be a space delimited list of path names.
     * The sort order of each path is ascending unless the path name is prefixed with `-` which will be treated as descending.
     * ####Example
     *     query.sort({ field: 'asc', test: -1 });
     *     query.sort('field -test');
     *     query.sort([['field', 1], ['test', -1]]);
     */
    sort(arg: any): MQueryBase {
        if (!arg) return this;
        let len;
        const type = typeof arg;
        // .sort([['field', 1], ['test', -1]])
        if (Array.isArray(arg)) {
            len = arg.length;
            for (let i = 0; i < arg.length; ++i)
                _pushArr(this.options, arg[i][0], arg[i][1]);

            return this;
        }

        // .sort('field -test')
        if (1 === arguments.length && 'string' === type) {
            arg = arg.split(/\s+/);
            len = arg.length;
            for (let i = 0; i < len; ++i) {
                let field = arg[i];
                if (!field) continue;
                const ascend = '-' === field[0] ? -1 : 1;
                if (ascend === -1) field = field.substring(1);
                push(this.options, field, ascend);
            }

            return this;
        }

        // .sort({ field: 1, test: -1 })
        if (isObject(arg)) {
            const keys = Object.keys(arg);
            keys.forEach(field => push(this.options, field, arg[field]));
            return this;
        }

        throw newRxTypeError('MQ3', {
            args: arguments
        });
    }

    /**
     * Merges another MQuery or conditions object into this one.
     *
     * When a MQuery is passed, conditions, field selection and options are merged.
     *
     */
    merge(source: any): MQueryBase {
        if (!source)
            return this;

        if (!canMerge(source)) {
            throw newRxTypeError('MQ4', {
                source
            });
        }

        if (source instanceof MQueryBase) {
            // if source has a feature, apply it to ourselves

            if (source._conditions)
                merge(this._conditions, source._conditions);

            if (source._fields) {
                if (!this._fields) this._fields = {};
                merge(this._fields, source._fields);
            }

            if (source.options) {
                if (!this.options) this.options = {};
                merge(this.options, source.options);
            }

            if (source._update) {
                if (!this._update) this._update = {};
                mergeClone(this._update, source._update);
            }

            if (source._distinct)
                this._distinct = source._distinct;

            return this;
        }

        // plain object
        merge(this._conditions, source);

        return this;
    }

    /**
     * Finds documents.
     * ####Example
     *     query.find()
     *     query.find({ name: 'Burning Lights' })
     */
    find(criteria: any): MQueryBase {
        if (canMerge(criteria))
            this.merge(criteria);

        return this;
    }

    /**
     * Make sure _path is set.
     *
     * @parmam {String} method
     */
    _ensurePath(method: any) {
        if (!this._path) {
            throw newRxError('MQ5', {
                method
            });
        }
    }
}

export function createMQuery(criteria: any): MQuery {
    return new MQueryBase(criteria) as MQuery;
}

export interface MQuery extends MQueryBase {
    limit: ReturnSelfFunction;
    skip: ReturnSelfFunction;
    maxScan: ReturnSelfFunction;
    batchSize: ReturnSelfFunction;
    comment: ReturnSelfFunction;

    gt: ReturnSelfFunction;
    gte: ReturnSelfFunction;
    lt: ReturnSelfFunction;
    lte: ReturnSelfFunction;
    ne: ReturnSelfFunction;
    in: ReturnSelfFunction;
    nin: ReturnSelfFunction;
    all: ReturnSelfFunction;
    regex: ReturnSelfFunction;
    size: ReturnSelfFunction;
}

declare type ReturnSelfFunction = (v: any) => MQueryBase;

/**
 * limit, skip, maxScan, batchSize, comment
 *
 * Sets these associated options.
 *
 *     query.comment('feed query');
 */
['limit', 'skip', 'maxScan', 'batchSize', 'comment'].forEach(function (method) {
    (MQueryBase.prototype as any)[method] = function (v: any) {
        this.options[method] = v;
        return this;
    };
});


/**
 * gt, gte, lt, lte, ne, in, nin, all, regex, size, maxDistance
 *
 *     Thing.where('type').nin(array)
 */
['gt', 'gte', 'lt', 'lte', 'ne', 'in', 'nin', 'all', 'regex', 'size']
    .forEach(function ($conditional) {
        (MQueryBase.prototype as any)[$conditional] = function () {
            let path;
            let val;
            if (1 === arguments.length) {
                this._ensurePath($conditional);
                val = arguments[0];
                path = this._path;
            } else {
                val = arguments[1];
                path = arguments[0];
            }

            const conds = this._conditions[path] === null || typeof this._conditions[path] === 'object' ?
                this._conditions[path] :
                (this._conditions[path] = {});
            conds['$' + $conditional] = val;
            return this;
        };
    });

/*!
 * @ignore
 */
function push(opts: any, field: string, value: any) {
    if (Array.isArray(opts.sort)) {
        throw newRxTypeError('MQ6', {
            opts,
            field,
            value
        });
    }

    if (value && value.$meta) {
        const sort = opts.sort || (opts.sort = {});
        sort[field] = {
            $meta: value.$meta
        };
        return;
    }

    const val = String(value || 1).toLowerCase();
    if (!/^(?:ascending|asc|descending|desc|1|-1)$/.test(val)) {
        if (Array.isArray(value)) value = '[' + value + ']';
        throw newRxTypeError('MQ7', {
            field,
            value
        });
    }
    // store `sort` in a sane format
    const s = opts.sort || (opts.sort = {});
    const valueStr = value.toString()
        .replace('asc', '1')
        .replace('ascending', '1')
        .replace('desc', '-1')
        .replace('descending', '-1');
    s[field] = parseInt(valueStr, 10);
}

function _pushArr(opts: any, field: string, value: any) {
    opts.sort = opts.sort || [];
    if (!Array.isArray(opts.sort)) {
        throw newRxTypeError('MQ8', {
            opts,
            field,
            value
        });
    }

    /*    const valueStr = value.toString()
            .replace('asc', '1')
            .replace('ascending', '1')
            .replace('desc', '-1')
            .replace('descending', '-1');*/
    opts.sort.push([field, value]);
}


/**
 * Determines if `conds` can be merged using `mquery().merge()`
 */
export function canMerge(conds: any): boolean {
    return conds instanceof MQueryBase || isObject(conds);
}


