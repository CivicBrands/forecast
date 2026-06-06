import { z } from "zod";
import { Source } from "./types";
declare const NldnObservationSchema: z.ZodObject<{
    ts: z.ZodNumber;
    lat: z.ZodNumber;
    lon: z.ZodNumber;
    peak_kA: z.ZodNumber;
    type: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: string;
    lat: number;
    lon: number;
    ts: number;
    peak_kA: number;
}, {
    type: string;
    lat: number;
    lon: number;
    ts: number;
    peak_kA: number;
}>;
export type NldnObservation = z.infer<typeof NldnObservationSchema>;
export declare const nldnSource: Source<NldnObservation>;
export {};
//# sourceMappingURL=nldn.d.ts.map