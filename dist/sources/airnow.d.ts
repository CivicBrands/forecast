import { z } from "zod";
import { Source } from "./types";
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
export declare const airnowSource: Source<AirNowObservation>;
export {};
//# sourceMappingURL=airnow.d.ts.map