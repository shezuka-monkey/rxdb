/**
 * @link https://github.com/types/lib-json-schema/blob/master/v4/index.d.ts
 */
export type JsonSchemaTypes = 'array' | 'boolean' | 'integer' | 'number' | 'null' | 'object' | 'string' | string;
export interface JsonSchema {
    allOf?: JsonSchema[];
    anyOf?: JsonSchema[];
    oneOf?: JsonSchema[];
    additionalItems?: boolean | JsonSchema;
    additionalProperties?: boolean;
    type?: JsonSchemaTypes | JsonSchemaTypes[];
    description?: string;
    dependencies?: {
        [key: string]: JsonSchema | string[];
    };
    exclusiveMinimum?: boolean;
    exclusiveMaximum?: boolean;
    items?: JsonSchema | JsonSchema[];
    multipleOf?: number;
    maxProperties?: number;
    maximum?: number;
    minimum?: number;
    maxLength?: number;
    minLength?: number;
    maxItems?: number;
    minItems?: number;
    minProperties?: number;
    pattern?: string;
    patternProperties?: {
        [key: string]: JsonSchema;
    };
    properties?: {
        [key: string]: JsonSchema;
    };
    required?: string[];
    uniqueItems?: boolean;
    enum?: any[];
    not?: JsonSchema;
    definitions?: {
        [key: string]: JsonSchema;
    };
    format?: 'date-time' | 'email' | 'hostname' | 'ipv4' | 'ipv6' | 'uri' | string;

    // RxDB-specific
    ref?: string;
    index?: boolean;
    encrypted?: boolean;
    final?: boolean;
}

export interface TopLevelProperty extends JsonSchema {
    default?: any;
}

export interface PrimaryProperty extends TopLevelProperty {
    type: 'string';
    primary: true;
    index: undefined;
}

export declare class RxJsonSchema<T = any> {
    title?: string;
    description?: string;
    version: number;
    /**
     * TODO this looks like a typescript-bug
     * we have to allows all string because the 'object'-literal is not recognized
     * retry this in later typescript-versions
     */
    type: 'object' | string;
    properties: { [key in keyof T]: TopLevelProperty | PrimaryProperty };
    required?: (keyof T)[];
    compoundIndexes?: string[] | string[][];
    keyCompression?: boolean;
    /**
     * if not set, rxdb will set 'false' as default
     */
    additionalProperties?: boolean;
    attachments?: {
        encrypted?: boolean;
    };
}
