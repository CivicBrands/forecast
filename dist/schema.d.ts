import { z } from 'zod';
export declare const DataPointSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodNumber;
    value: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    value: number;
    id: string;
    timestamp: number;
    metadata?: Record<string, unknown> | undefined;
}, {
    value: number;
    id: string;
    timestamp: number;
    metadata?: Record<string, unknown> | undefined;
}>;
export type DataPoint = z.infer<typeof DataPointSchema>;
export declare const DatasetSchema: z.ZodObject<{
    name: z.ZodString;
    points: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        timestamp: z.ZodNumber;
        value: z.ZodNumber;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        value: number;
        id: string;
        timestamp: number;
        metadata?: Record<string, unknown> | undefined;
    }, {
        value: number;
        id: string;
        timestamp: number;
        metadata?: Record<string, unknown> | undefined;
    }>, "many">;
    created: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    points: {
        value: number;
        id: string;
        timestamp: number;
        metadata?: Record<string, unknown> | undefined;
    }[];
    created: number;
}, {
    name: string;
    points: {
        value: number;
        id: string;
        timestamp: number;
        metadata?: Record<string, unknown> | undefined;
    }[];
    created: number;
}>;
export type Dataset = z.infer<typeof DatasetSchema>;
//# sourceMappingURL=schema.d.ts.map