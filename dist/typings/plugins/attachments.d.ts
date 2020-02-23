/// <reference types="node" />
/// <reference types="pouchdb-core" />
import { RxDocument } from '../types';
export declare const blobBufferUtil: {
    /**
     * depending if we are on node or browser,
     * we have to use Buffer(node) or Blob(browser)
     */
    createBlobBuffer(data: string, type: string): Buffer;
    toString(blobBuffer: any): Promise<any>;
};
/**
 * an RxAttachment is basically just the attachment-stub
 * wrapped so that you can access the attachment-data
 */
export declare class RxAttachment {
    doc: any;
    id: string;
    type: string;
    length: number;
    digest: string;
    rev: string;
    constructor({ doc, id, type, length, digest, rev }: any);
    remove(): Promise<any>;
    /**
     * returns the data for the attachment
     */
    getData(): Promise<Buffer | Blob>;
    getStringData(): Promise<any>;
}
export declare function fromPouchDocument(id: string, pouchDocAttachment: any, rxDocument: RxDocument): RxAttachment;
export declare function putAttachment(this: RxDocument, { id, data, type }: any): Promise<any>;
/**
 * get an attachment of the document by its id
 */
export declare function getAttachment(this: RxDocument, id: string): RxAttachment | null;
/**
 * returns all attachments of the document
 */
export declare function allAttachments(this: RxDocument): RxAttachment[];
export declare function preMigrateDocument(action: any): any;
export declare function postMigrateDocument(action: any): Promise<any>;
export declare const rxdb = true;
export declare const prototypes: {
    RxDocument: (proto: any) => void;
};
export declare const overwritable: {};
export declare const hooks: {
    preMigrateDocument: typeof preMigrateDocument;
    postMigrateDocument: typeof postMigrateDocument;
};
declare const _default: {
    rxdb: boolean;
    prototypes: {
        RxDocument: (proto: any) => void;
    };
    overwritable: {};
    hooks: {
        preMigrateDocument: typeof preMigrateDocument;
        postMigrateDocument: typeof postMigrateDocument;
    };
    blobBufferUtil: {
        /**
         * depending if we are on node or browser,
         * we have to use Buffer(node) or Blob(browser)
         */
        createBlobBuffer(data: string, type: string): Buffer;
        toString(blobBuffer: any): Promise<any>;
    };
};
export default _default;
