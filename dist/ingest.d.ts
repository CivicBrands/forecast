import { z } from "zod";
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
export declare function ingestMetar(lat: number, lon: number, radiusMiles?: number): Promise<{
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
}[]>;
export declare function validateMetar(input: unknown): MetarObservation[];
declare const AirNowObservationSchema: z.ZodObject<{
    DateObserved: z.ZodString;
    HourObserved: z.ZodNumber;
    LocalTimeZone: z.ZodString;
    ReportingArea: z.ZodString;
    StateCode: z.ZodString;
    Latitude: z.ZodNumber;
    Longitude: z.ZodNumber;
    ParameterName: z.ZodString;
    AQI: z.ZodNumber;
    Category: z.ZodObject<{
        Number: z.ZodNumber;
        Name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        Number: number;
        Name: string;
    }, {
        Number: number;
        Name: string;
    }>;
}, "strip", z.ZodTypeAny, {
    DateObserved: string;
    HourObserved: number;
    LocalTimeZone: string;
    ReportingArea: string;
    StateCode: string;
    Latitude: number;
    Longitude: number;
    ParameterName: string;
    AQI: number;
    Category: {
        Number: number;
        Name: string;
    };
}, {
    DateObserved: string;
    HourObserved: number;
    LocalTimeZone: string;
    ReportingArea: string;
    StateCode: string;
    Latitude: number;
    Longitude: number;
    ParameterName: string;
    AQI: number;
    Category: {
        Number: number;
        Name: string;
    };
}>;
export type AirNowObservation = z.infer<typeof AirNowObservationSchema>;
export declare function ingestAirNow(lat: number, lon: number, distanceMiles: number | undefined, apiKey: string): Promise<{
    DateObserved: string;
    HourObserved: number;
    LocalTimeZone: string;
    ReportingArea: string;
    StateCode: string;
    Latitude: number;
    Longitude: number;
    ParameterName: string;
    AQI: number;
    Category: {
        Number: number;
        Name: string;
    };
}[]>;
export declare function validateAirNow(input: unknown): AirNowObservation[];
export {};
//# sourceMappingURL=ingest.d.ts.map