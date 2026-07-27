"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveLatents = deriveLatents;
/**
 * Derive cross-source latent signals from a collation.
 *
 * A latent is computed only when every source it depends on is present in the
 * collation. Absence MUST NOT be interpolated.
 */
function deriveLatents(c, lookup, context = {}) {
    const out = [];
    const has = (name) => Boolean(c.sources[name]);
    const events = [...eventsFromSnapshot(has("EVENTS") ? lookup("EVENTS")?.data ?? [] : []), ...(context.events ?? [])];
    const placeContext = buildPlaceContext(c, { ...context, events });
    out.push({
        name: "civic_temporal_rhythm",
        label: "Civic Temporal Rhythm",
        value: placeContext.presenceWeight,
        unit: "index",
        summary: temporalRhythmSummary(placeContext),
        severity: placeContext.presenceWeight >= 80 ? "watch" : "ok",
        order: 3,
        family: "civic",
        inputs: {
            location: placeContext.locationLabel,
            local_hour: placeContext.localHour,
            local_weekday: placeContext.localWeekday,
            day_type: placeContext.dayType,
            active_events: placeContext.activeEvents.map((e) => e.name),
        },
        confidence: placeContext.activeEvents.length > 0 ? 0.85 : 0.65,
    });
    if (has("AIRNOW")) {
        const snap = lookup("AIRNOW");
        if (snap) {
            const aqis = snap.data
                .map((d) => d.AQI)
                .filter((n) => typeof n === "number");
            if (aqis.length > 0) {
                const max = Math.max(...aqis);
                out.push({
                    name: "aqi_max",
                    label: "Peak AQI",
                    value: max,
                    summary: airQualitySummary(max),
                    severity: severityFromAqi(max),
                    order: 1,
                    family: "air",
                    inputs: { source: "AIRNOW", samples: aqis.length },
                });
            }
        }
    }
    if (has("METAR")) {
        const snap = lookup("METAR");
        if (snap) {
            const visib = snap.data
                .map((d) => {
                const v = d.visib;
                if (typeof v === "number")
                    return v;
                const n = Number(v);
                return Number.isFinite(n) ? n : undefined;
            })
                .filter((n) => typeof n === "number");
            if (visib.length > 0) {
                const min = Math.min(...visib);
                out.push({
                    name: "visibility_min_sm",
                    label: "Lowest Visibility",
                    value: min,
                    unit: "statute miles",
                    summary: min < 3 ? "Low surface visibility is present." : min < 6 ? "Visibility is reduced but usable." : "Visibility is broadly clear.",
                    severity: min < 3 ? "alert" : min < 6 ? "watch" : "ok",
                    order: 1,
                    family: "visibility",
                    inputs: { source: "METAR", samples: visib.length },
                });
            }
        }
    }
    if (has("FIRMS")) {
        const snap = lookup("FIRMS");
        if (snap) {
            const frps = numbers(snap.data, "frp");
            const maxFrp = frps.length ? Math.max(...frps) : 0;
            out.push({
                name: "fire_detection_count",
                label: "Fire Detections",
                value: snap.data.length,
                unit: "detections",
                summary: snap.data.length > 0 ? "Thermal fire detections are present in the radius." : "No thermal fire detections are present.",
                severity: snap.data.length > 5 || maxFrp >= 75 ? "alert" : snap.data.length > 0 ? "watch" : "ok",
                order: 1,
                family: "fire",
                inputs: { source: "FIRMS", max_frp: maxFrp },
            });
        }
    }
    if (has("HRRR_SMOKE")) {
        const snap = lookup("HRRR_SMOKE");
        if (snap) {
            const smoke = numbers(snap.data, "near_surface_smoke");
            if (smoke.length > 0) {
                const max = Math.max(...smoke);
                out.push({
                    name: "hrrr_smoke_max",
                    label: "Modeled Smoke",
                    value: max,
                    summary: max > 0 ? "Near-surface smoke is present in the model field." : "The smoke model is quiet near the surface.",
                    severity: max >= 25 ? "alert" : max > 0 ? "watch" : "ok",
                    order: 1,
                    family: "smoke",
                    inputs: { source: "HRRR_SMOKE", samples: smoke.length },
                });
            }
        }
    }
    if (has("NLDN")) {
        const snap = lookup("NLDN");
        if (snap) {
            const peaks = numbers(snap.data, "peak_kA").map(Math.abs);
            const maxPeak = peaks.length ? Math.max(...peaks) : 0;
            out.push({
                name: "lightning_strike_count",
                label: "Lightning Activity",
                value: snap.data.length,
                unit: "strikes",
                summary: snap.data.length > 0 ? "Lightning has been detected near the field." : "No lightning strikes are present in the selected radius.",
                severity: snap.data.length > 0 ? "alert" : "ok",
                order: 1,
                family: "storm",
                inputs: { source: "NLDN", max_peak_ka: maxPeak },
            });
        }
    }
    if (has("NOTAM")) {
        const snap = lookup("NOTAM");
        if (snap) {
            const active = activeNotams(snap.data, placeContext.now);
            const constraintScore = clamp(active.length * 35 + notamTextWeight(active) * 25, 0, 100);
            out.push({
                name: "declared_operational_constraint",
                label: "Declared Operational Constraint",
                value: Math.round(constraintScore),
                unit: "index",
                summary: active.length > 0 ? "Current NOTAMs declare operational constraints in the selected field." : "No currently effective NOTAM constraints were found in the latest batch.",
                severity: constraintScore >= 70 ? "alert" : constraintScore > 0 ? "watch" : "ok",
                order: 2,
                family: "operations",
                inputs: {
                    source: "NOTAM",
                    active_notam_count: active.length,
                    classifications: summarizeNotamClasses(active),
                    local_hour: placeContext.localHour,
                },
                confidence: active.length > 0 ? 0.8 : 0.4,
            });
        }
    }
    if (has("AIRNOW") && has("FIRMS")) {
        const aq = lookup("AIRNOW");
        const fire = lookup("FIRMS");
        if (aq && fire) {
            const pm = aq.data
                .filter((d) => /PM2\.5|PM10/.test(d.ParameterName ?? ""))
                .map((d) => d.AQI)
                .filter((n) => typeof n === "number");
            const pmMax = pm.length > 0 ? Math.max(...pm) : 0;
            const fires = fire.data.length;
            out.push({
                name: "smoke_impacted_aq",
                label: "Smoke-Impacted Air",
                value: fires > 0 ? pmMax : 0,
                summary: fires > 0 && pmMax > 50 ? "Particle AQI and fire detections point to smoke-impacted air." : fires > 0 ? "Fire detections are present, but particle AQI is not elevated." : "Particle AQI is not fire-reinforced in this field.",
                severity: fires > 0 && pmMax > 100 ? "alert" : fires > 0 && pmMax > 50 ? "watch" : "ok",
                order: 2,
                family: "smoke",
                inputs: { pm_aqi_max: pmMax, fire_count: fires },
                confidence: fires > 0 ? Math.min(1, fires / 10) : 0,
            });
        }
    }
    if (has("AIRNOW") && has("FIRMS") && has("HRRR_SMOKE")) {
        const aq = lookup("AIRNOW");
        const fire = lookup("FIRMS");
        const hrrr = lookup("HRRR_SMOKE");
        if (aq && fire && hrrr) {
            const pmMax = maxAirnow(aq.data, /PM2\.5|PM10/);
            const smokeMax = maxOf(numbers(hrrr.data, "near_surface_smoke"));
            const fireCount = fire.data.length;
            const value = clamp(scoreAqi(pmMax) * 0.45 + scoreCount(fireCount, 10) * 0.3 + scoreSmoke(smokeMax) * 0.25, 0, 100);
            out.push({
                name: "smoke_transport_pressure",
                label: "Smoke Transport Pressure",
                value: Math.round(value),
                unit: "index",
                summary: value >= 70 ? "Observed particles, detections, and modeled smoke align into a strong smoke signal." : value >= 35 ? "Smoke ingredients are partially aligned across observations and model guidance." : "The smoke ingredients are weakly aligned.",
                severity: value >= 70 ? "alert" : value >= 35 ? "watch" : "ok",
                order: 3,
                family: "smoke",
                inputs: { pm_aqi_max: pmMax, fire_count: fireCount, hrrr_smoke_max: smokeMax },
                confidence: confidenceFromPresence([pmMax > 0, fireCount > 0, smokeMax > 0]),
            });
        }
    }
    if (has("AIRNOW") && has("METAR") && has("HRRR_SMOKE")) {
        const aq = lookup("AIRNOW");
        const metar = lookup("METAR");
        const hrrr = lookup("HRRR_SMOKE");
        if (aq && metar && hrrr) {
            const pmOrOzone = maxAirnow(aq.data, /PM2\.5|PM10|O3/);
            const minVisibility = minVisibilitySm(metar.data);
            const smokeMax = maxOf(numbers(hrrr.data, "near_surface_smoke"));
            if (minVisibility !== undefined) {
                const value = clamp(scoreAqi(pmOrOzone) * 0.45 + scoreVisibility(minVisibility) * 0.35 + scoreSmoke(smokeMax) * 0.2, 0, 100);
                out.push({
                    name: "respiratory_visibility_stress",
                    label: "Respiratory Visibility Stress",
                    value: Math.round(value),
                    unit: "index",
                    summary: value >= 70 ? "Air quality and visibility are jointly stressed." : value >= 35 ? "Air quality or visibility is somewhat degraded." : "Breathing and visibility conditions are not jointly stressed.",
                    severity: value >= 70 ? "alert" : value >= 35 ? "watch" : "ok",
                    order: 3,
                    family: "visibility",
                    inputs: { airnow_aqi_max: pmOrOzone, visibility_min_sm: minVisibility, hrrr_smoke_max: smokeMax },
                    confidence: confidenceFromPresence([pmOrOzone > 0, minVisibility < 10, smokeMax > 0]),
                });
            }
        }
    }
    if (has("NEXRAD") && has("NLDN") && has("METAR")) {
        const radar = lookup("NEXRAD");
        const lightning = lookup("NLDN");
        const metar = lookup("METAR");
        if (radar && lightning && metar) {
            const strikes = lightning.data.length;
            const nonVfr = metar.data.filter((d) => d.fltCat && d.fltCat !== "VFR").length;
            const gusts = numbers(metar.data, "wg");
            const maxGust = gusts.length ? Math.max(...gusts) : 0;
            const value = clamp(scoreCount(strikes, 5) * 0.45 + scoreCount(nonVfr, 3) * 0.25 + scoreWind(maxGust) * 0.2 + scoreCount(radar.data.length, 2) * 0.1, 0, 100);
            out.push({
                name: "convective_disruption_signal",
                label: "Convective Disruption",
                value: Math.round(value),
                unit: "index",
                summary: value >= 70 ? "Lightning, radar, and station weather indicate active disruption." : value >= 35 ? "Storm ingredients are present but not fully aligned." : "Storm disruption signals are limited.",
                severity: value >= 70 ? "alert" : value >= 35 ? "watch" : "ok",
                order: 3,
                family: "storm",
                inputs: { lightning_count: strikes, non_vfr_station_count: nonVfr, max_gust_kt: maxGust, radar_station_count: radar.data.length },
                confidence: confidenceFromPresence([strikes > 0, nonVfr > 0, maxGust > 0, radar.data.length > 0]),
            });
        }
    }
    const operational = out.find((l) => l.name === "declared_operational_constraint");
    const convective = out.find((l) => l.name === "convective_disruption_signal");
    const smokeTransport = out.find((l) => l.name === "smoke_transport_pressure");
    const fire = out.find((l) => l.name === "fire_detection_count");
    const physicalStress = Math.max(convective?.value ?? 0, smokeTransport?.value ?? 0, fire?.value ?? 0);
    if (operational && operational.value > 0) {
        const value = clamp(operational.value * 0.45 + physicalStress * 0.3 + placeContext.presenceWeight * 0.25, 0, 100);
        out.push({
            name: "constraint_collision",
            label: "Constraint Collision",
            value: Math.round(value),
            unit: "index",
            summary: value >= 70 ? "Declared constraints, physical signals, and local timing are colliding into an operationally consequential situation." : value >= 35 ? "Declared constraints overlap with enough field context to watch." : "Declared constraints are present, but the wider field is not strongly compressed.",
            severity: value >= 70 ? "alert" : value >= 35 ? "watch" : "ok",
            order: 4,
            family: "operations",
            inputs: {
                declared_constraint: operational.value,
                physical_stress: physicalStress,
                civic_temporal_rhythm: placeContext.presenceWeight,
                active_events: placeContext.activeEvents.map((e) => e.name),
            },
            confidence: confidenceFromPresence([operational.value > 0, physicalStress > 0, placeContext.presenceWeight >= 55]),
        });
    }
    if (!operational && physicalStress >= 35 && placeContext.presenceWeight >= 55) {
        const value = clamp(physicalStress * 0.65 + placeContext.presenceWeight * 0.35, 0, 100);
        out.push({
            name: "unannounced_disruption_potential",
            label: "Unannounced Disruption Potential",
            value: Math.round(value),
            unit: "index",
            summary: "Physical signals and local timing imply possible disruption without a fresh declared operational constraint in the collation.",
            severity: value >= 70 ? "alert" : "watch",
            order: 4,
            family: "operations",
            inputs: {
                physical_stress: physicalStress,
                civic_temporal_rhythm: placeContext.presenceWeight,
                notam_source_present: has("NOTAM"),
            },
            confidence: has("NOTAM") ? 0.65 : 0.45,
        });
    }
    const stressLatents = out.filter((l) => l.unit === "index" || l.severity !== "ok");
    if (stressLatents.length >= 2) {
        const weighted = stressLatents.reduce((sum, l) => sum + l.value * (l.order >= 3 ? 1.2 : 1), 0);
        const weights = stressLatents.reduce((sum, l) => sum + (l.order >= 3 ? 1.2 : 1), 0);
        const value = clamp(weighted / weights, 0, 100);
        const families = [...new Set(stressLatents.map((l) => l.family))];
        out.push({
            name: "compound_field_stress",
            label: "Compound Field Stress",
            value: Math.round(value),
            unit: "index",
            summary: value >= 70 ? "Multiple independent signals are reinforcing a stressed field." : value >= 35 ? "Several field signals are elevated enough to watch together." : "The field has only light compound stress.",
            severity: value >= 70 ? "alert" : value >= 35 ? "watch" : "ok",
            order: 4,
            family: "field",
            inputs: {
                latent_names: stressLatents.map((l) => l.name),
                families,
            },
            confidence: Math.min(1, families.length / 4),
        });
    }
    return out;
}
function numbers(rows, key) {
    return rows
        .map((d) => d[key])
        .map((v) => (typeof v === "number" ? v : Number(v)))
        .filter((n) => Number.isFinite(n));
}
function maxOf(values) {
    return values.length ? Math.max(...values) : 0;
}
function maxAirnow(rows, parameterPattern) {
    return maxOf(rows
        .filter((d) => parameterPattern.test(d.ParameterName ?? ""))
        .map((d) => d.AQI)
        .filter((n) => typeof n === "number"));
}
function minVisibilitySm(rows) {
    const values = numbers(rows, "visib");
    return values.length ? Math.min(...values) : undefined;
}
function airQualitySummary(aqi) {
    if (aqi > 150)
        return "Air quality is unhealthy.";
    if (aqi > 100)
        return "Air quality is unhealthy for sensitive groups.";
    if (aqi > 50)
        return "Air quality is moderate.";
    return "Air quality is good.";
}
function severityFromAqi(aqi) {
    return aqi > 100 ? "alert" : aqi > 50 ? "watch" : "ok";
}
function scoreAqi(aqi) {
    return clamp((aqi / 150) * 100, 0, 100);
}
function scoreVisibility(sm) {
    return clamp(((10 - sm) / 8) * 100, 0, 100);
}
function scoreSmoke(value) {
    return clamp((value / 50) * 100, 0, 100);
}
function scoreCount(count, high) {
    return clamp((count / high) * 100, 0, 100);
}
function scoreWind(kt) {
    return clamp((kt / 35) * 100, 0, 100);
}
function confidenceFromPresence(parts) {
    return Math.round((parts.filter(Boolean).length / parts.length) * 100) / 100;
}
function buildPlaceContext(c, context) {
    const now = context.now ?? c.collated_at;
    const timezone = context.timezone ?? "America/Chicago";
    const locationLabel = context.locationLabel ?? "Kansas City area";
    const local = localDateParts(now, timezone);
    const holidayName = usHolidayName(local.year, local.month, local.day);
    const weekend = local.weekday === "Sat" || local.weekday === "Sun";
    const activeEvents = (context.events ?? []).filter((e) => now >= e.starts_at && now <= e.ends_at);
    const base = weekend ? 38 : 48;
    const commute = !weekend && (inHourRange(local.hour, 7, 9) || inHourRange(local.hour, 16, 18)) ? 22 : 0;
    const midday = inHourRange(local.hour, 11, 14) ? 10 : 0;
    const evening = inHourRange(local.hour, 18, 22) ? 14 : 0;
    const night = local.hour < 5 ? -18 : 0;
    const holiday = holidayName ? -12 : 0;
    const eventWeight = activeEvents.reduce((sum, e) => sum + (e.expected_presence ?? 18), 0);
    return {
        now,
        timezone,
        locationLabel,
        localHour: local.hour,
        localWeekday: local.weekday,
        dayType: holidayName ? "holiday" : weekend ? "weekend" : "weekday",
        holidayName,
        presenceWeight: Math.round(clamp(base + commute + midday + evening + night + holiday + eventWeight, 0, 100)),
        activeEvents,
    };
}
function eventsFromSnapshot(rows) {
    const out = [];
    for (const row of rows) {
        const e = row;
        const starts = e.starts_at ? Date.parse(e.starts_at) : Number.NaN;
        const ends = e.ends_at ? Date.parse(e.ends_at) : Number.NaN;
        if (!e.name || !Number.isFinite(starts))
            continue;
        out.push({
            name: e.name,
            starts_at: starts,
            ends_at: Number.isFinite(ends) ? ends : starts,
            expected_presence: e.expected_presence,
            tags: [e.category, ...(e.labels ?? [])].filter((v) => Boolean(v)),
        });
    }
    return out;
}
function localDateParts(ts, timezone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
        weekday: "short",
    }).formatToParts(new Date(ts));
    const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
    const hour = Number(get("hour"));
    return {
        year: Number(get("year")),
        month: Number(get("month")),
        day: Number(get("day")),
        hour: hour === 24 ? 0 : hour,
        weekday: get("weekday"),
    };
}
function inHourRange(hour, startInclusive, endInclusive) {
    return hour >= startInclusive && hour <= endInclusive;
}
function temporalRhythmSummary(ctx) {
    if (ctx.activeEvents.length > 0) {
        return `${ctx.locationLabel} is in an event-modified local rhythm.`;
    }
    if (ctx.holidayName) {
        return `${ctx.locationLabel} is in a holiday rhythm for ${ctx.holidayName}.`;
    }
    if (ctx.localHour < 5)
        return `${ctx.locationLabel} is in a low-presence overnight rhythm.`;
    if (ctx.dayType === "weekend")
        return `${ctx.locationLabel} is in a weekend public-life rhythm.`;
    if (inHourRange(ctx.localHour, 7, 9) || inHourRange(ctx.localHour, 16, 18)) {
        return `${ctx.locationLabel} is in a weekday movement peak.`;
    }
    return `${ctx.locationLabel} is in an ordinary ${ctx.dayType} rhythm.`;
}
function usHolidayName(year, month, day) {
    if (month === 1 && day === 1)
        return "New Year's Day";
    if (month === 6 && day === 19)
        return "Juneteenth";
    if (month === 7 && day === 4)
        return "Independence Day";
    if (month === 11 && day === 11)
        return "Veterans Day";
    if (month === 12 && day === 25)
        return "Christmas Day";
    if (month === 1 && day === nthWeekdayOfMonth(year, 1, 1, 3))
        return "Martin Luther King Jr. Day";
    if (month === 2 && day === nthWeekdayOfMonth(year, 2, 1, 3))
        return "Presidents Day";
    if (month === 5 && day === lastWeekdayOfMonth(year, 5, 1))
        return "Memorial Day";
    if (month === 9 && day === nthWeekdayOfMonth(year, 9, 1, 1))
        return "Labor Day";
    if (month === 10 && day === nthWeekdayOfMonth(year, 10, 1, 2))
        return "Columbus Day";
    if (month === 11 && day === nthWeekdayOfMonth(year, 11, 4, 4))
        return "Thanksgiving Day";
    return undefined;
}
function nthWeekdayOfMonth(year, month, weekday, nth) {
    let seen = 0;
    for (let day = 1; day <= 31; day++) {
        const d = new Date(Date.UTC(year, month - 1, day));
        if (d.getUTCMonth() !== month - 1)
            break;
        if (d.getUTCDay() === weekday) {
            seen++;
            if (seen === nth)
                return day;
        }
    }
    return -1;
}
function lastWeekdayOfMonth(year, month, weekday) {
    for (let day = 31; day >= 1; day--) {
        const d = new Date(Date.UTC(year, month - 1, day));
        if (d.getUTCMonth() !== month - 1)
            continue;
        if (d.getUTCDay() === weekday)
            return day;
    }
    return -1;
}
function activeNotams(rows, nowMs) {
    return rows.filter((row) => {
        const n = row;
        const start = n.effective_start ? Date.parse(n.effective_start) : Number.NaN;
        const end = n.effective_end ? Date.parse(n.effective_end) : Number.POSITIVE_INFINITY;
        return (!Number.isFinite(start) || nowMs >= start) && nowMs <= end;
    });
}
function notamTextWeight(rows) {
    const terms = /closed|closure|restricted|hazard|tfr|runway|taxiway|airspace|obstruction|crane|fire|rescue/i;
    return rows.filter((row) => terms.test(`${row.classification ?? ""} ${row.text ?? ""}`)).length;
}
function summarizeNotamClasses(rows) {
    const out = {};
    for (const row of rows) {
        const key = row.classification ?? row.type ?? "unknown";
        out[key] = (out[key] ?? 0) + 1;
    }
    return out;
}
function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}
//# sourceMappingURL=latents.js.map