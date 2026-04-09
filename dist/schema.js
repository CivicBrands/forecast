"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetSchema = exports.DataPointSchema = void 0;
const zod_1 = require("zod");
exports.DataPointSchema = zod_1.z.object({
    id: zod_1.z.string(),
    timestamp: zod_1.z.number(),
    value: zod_1.z.number(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
exports.DatasetSchema = zod_1.z.object({
    name: zod_1.z.string(),
    points: zod_1.z.array(exports.DataPointSchema),
    created: zod_1.z.number(),
});
//# sourceMappingURL=schema.js.map