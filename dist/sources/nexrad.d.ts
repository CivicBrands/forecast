import { z } from "zod";
import { Source } from "./types";
declare const NexradObservationSchema: z.ZodObject<{
    station: z.ZodString;
    ts: z.ZodNumber;
    vcp: z.ZodOptional<z.ZodNumber>;
    s3_key: z.ZodString;
}, "strip", z.ZodTypeAny, {
    station: string;
    ts: number;
    s3_key: string;
    vcp?: number | undefined;
}, {
    station: string;
    ts: number;
    s3_key: string;
    vcp?: number | undefined;
}>;
export type NexradObservation = z.infer<typeof NexradObservationSchema>;
export declare const nexradSource: Source<NexradObservation>;
export {};
//# sourceMappingURL=nexrad.d.ts.map