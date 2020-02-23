import { RxSchema } from '../rx-schema';
export declare const rxdb = true;
export declare const prototypes: {
    /**
     * set validate-function for the RxSchema.prototype
     */
    RxSchema: (proto: any) => void;
};
export declare const hooks: {
    createRxSchema: (rxSchema: RxSchema<any>) => void;
};
declare const _default: {
    rxdb: boolean;
    prototypes: {
        /**
         * set validate-function for the RxSchema.prototype
         */
        RxSchema: (proto: any) => void;
    };
    hooks: {
        createRxSchema: (rxSchema: RxSchema<any>) => void;
    };
};
export default _default;
