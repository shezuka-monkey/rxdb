export declare type RxChangeEventOperation = 'INSERT' | // document created
'UPDATE' | // document changed
'REMOVE' | // document removed
'RxDatabase.collection';
export declare type RemoveData = {
    _id: string;
    _rev: string;
    _deleted: true;
};
export declare type RxEventValueWithRevAndId = {
    _id: string;
    _rev: string;
};
export declare type RxEventValue<RxDocumentType> = RxDocumentType & RxEventValueWithRevAndId;
export interface RxChangeEventDataBase {
    readonly op: RxChangeEventOperation;
    readonly t: number;
    readonly db: string;
    readonly it: string;
    readonly isLocal: boolean;
}
export declare interface RxChangeEventBase {
    readonly hash: string;
    isIntern(): boolean;
    isSocket(): boolean;
}
export interface RxChangeEventInsertData<RxDocumentType> extends RxChangeEventDataBase {
    readonly op: 'INSERT';
    readonly col: string;
    readonly doc: string;
    readonly v: RxEventValue<RxDocumentType>;
}
export declare interface RxChangeEventInsert<RxDocumentType> extends RxChangeEventBase {
    readonly data: RxChangeEventInsertData<RxDocumentType>;
    toJSON(): RxChangeEventInsertData<RxDocumentType>;
}
export interface RxChangeEventUpdateData<RxDocumentType> extends RxChangeEventDataBase {
    readonly op: 'UPDATE';
    readonly col: string;
    readonly doc: string;
    readonly v: RxEventValue<RxDocumentType>;
}
export declare interface RxChangeEventUpdate<RxDocumentType> extends RxChangeEventBase {
    readonly data: RxChangeEventUpdateData<RxDocumentType>;
    toJSON(): RxChangeEventUpdateData<RxDocumentType>;
}
export interface RxChangeEventRemoveData<RxDocumentType> extends RxChangeEventDataBase {
    readonly op: 'REMOVE';
    readonly col: string;
    readonly doc: string;
    readonly v: RxEventValue<RxDocumentType> | RemoveData;
}
export declare interface RxChangeEventRemove<RxDocumentType> extends RxChangeEventBase {
    readonly data: RxChangeEventRemoveData<RxDocumentType>;
    toJSON(): RxChangeEventRemoveData<RxDocumentType>;
}
export interface RxChangeEventCollectionData extends RxChangeEventDataBase {
    readonly op: 'RxDatabase.collection';
}
export declare interface RxChangeEventCollection extends RxChangeEventBase {
    readonly data: RxChangeEventCollectionData;
    toJSON(): RxChangeEventCollectionData;
}
