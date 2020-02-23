/**
 * here we use custom errors with the additional field 'parameters'
 */
import { RxErrorParameters } from './types';
export declare class RxError extends Error {
    code: string;
    message: string;
    parameters: RxErrorParameters;
    rxdb: true;
    constructor(code: string, message: string, parameters?: RxErrorParameters);
    readonly name: string;
    toString(): string;
    readonly typeError: boolean;
}
export declare class RxTypeError extends TypeError {
    code: string;
    message: string;
    parameters: RxErrorParameters;
    rxdb: true;
    constructor(code: string, message: string, parameters?: RxErrorParameters);
    readonly name: string;
    toString(): string;
    readonly typeError: boolean;
}
export declare function newRxError(code: string, parameters?: RxErrorParameters): RxError;
export declare function newRxTypeError(code: string, parameters?: RxErrorParameters): RxTypeError;
