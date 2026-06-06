import { z } from "zod";
import { Source } from "./types";
declare const MetarObservationSchema: z.ZodObject<{
    icaoId: z.ZodString;
    receiptTime: z.ZodString;
    obsTime: z.ZodNumber;
    reportTime: z.ZodString;
    temp: z.ZodNumber;
    dewp: z.ZodNumber;
    wdir: z.ZodNumber;
    wspd: z.ZodNumber;
    wg: z.ZodOptional<z.ZodNumber>;
    visib: z.ZodUnion<[z.ZodNumber, z.ZodString]>;
    altim: z.ZodNumber;
    slp: z.ZodOptional<z.ZodNumber>;
    qcField: z.ZodNumber;
    metarType: z.ZodString;
    rawOb: z.ZodString;
    lat: z.ZodNumber;
    lon: z.ZodNumber;
    elev: z.ZodNumber;
    name: z.ZodString;
    cover: z.ZodString;
    clouds: z.ZodArray<z.ZodObject<{
        cover: z.ZodString;
        base: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        cover: string;
        base?: number | undefined;
    }, {
        cover: string;
        base?: number | undefined;
    }>, "many">;
    wxString: z.ZodOptional<z.ZodString>;
    fltCat: z.ZodString;
}, "strip", z.ZodTypeAny, {
    cover: string;
    icaoId: string;
    receiptTime: string;
    obsTime: number;
    reportTime: string;
    temp: number;
    dewp: number;
    wdir: number;
    wspd: number;
    visib: string | number;
    altim: number;
    qcField: number;
    metarType: string;
    rawOb: string;
    lat: number;
    lon: number;
    elev: number;
    name: string;
    clouds: {
        cover: string;
        base?: number | undefined;
    }[];
    fltCat: string;
    wg?: number | undefined;
    slp?: number | undefined;
    wxString?: string | undefined;
}, {
    cover: string;
    icaoId: string;
    receiptTime: string;
    obsTime: number;
    reportTime: string;
    temp: number;
    dewp: number;
    wdir: number;
    wspd: number;
    visib: string | number;
    altim: number;
    qcField: number;
    metarType: string;
    rawOb: string;
    lat: number;
    lon: number;
    elev: number;
    name: string;
    clouds: {
        cover: string;
        base?: number | undefined;
    }[];
    fltCat: string;
    wg?: number | undefined;
    slp?: number | undefined;
    wxString?: string | undefined;
}>;
export type MetarObservation = z.infer<typeof MetarObservationSchema>;
export declare const metarSource: Source<MetarObservation>;
export {};
//# sourceMappingURL=metar.d.ts.map