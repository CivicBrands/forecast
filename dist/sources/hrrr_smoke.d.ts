import { z } from "zod";
import { Source } from "./types";
declare const HrrrSmokeObservationSchema: z.ZodObject<{
    runTs: z.ZodNumber;
    validTs: z.ZodNumber;
    lat: z.ZodNumber;
    lon: z.ZodNumber;
    near_surface_smoke: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    lat: number;
    lon: number;
    runTs: number;
    validTs: number;
    near_surface_smoke: number;
}, {
    lat: number;
    lon: number;
    runTs: number;
    validTs: number;
    near_surface_smoke: number;
}>;
export type HrrrSmokeObservation = z.infer<typeof HrrrSmokeObservationSchema>;
export declare const hrrrSmokeSource: Source<HrrrSmokeObservation>;
export {};
//# sourceMappingURL=hrrr_smoke.d.ts.map