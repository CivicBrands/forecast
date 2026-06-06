import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAixmMessage } from "../src/parse";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<message:AIXMBasicMessage
  xmlns:message="http://www.aixm.aero/schema/5.1/message"
  xmlns:gml="http://www.opengis.net/gml/3.2"
  xmlns:aixm="http://www.aixm.aero/schema/5.1"
  xmlns:event="http://www.aixm.aero/schema/5.1/event"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:fns="urn:us.gov.dot.faa.aim.fns"
  xmlns:html="http://www.w3.org/1999/xhtml"
  xmlns:fnse="http://www.aixm.aero/schema/5.1/extensions/FAA/FNSE" gml:id="NMS_ID_8356352547785174">
  <message:hasMember>
    <event:Event gml:id="Event_1_8356352547785174">
      <gml:identifier codeSpace="urn:uuid:">9fcd3b9e-04bc-41af-b3f8-e8f23adf12fd</gml:identifier>
      <event:timeSlice>
        <event:EventTimeSlice gml:id="Event_TS_1_8356352547785174">
          <gml:validTime>
            <gml:TimePeriod gml:id="Event_TS_TP_1_8356352547785174">
              <gml:beginPosition>2026-06-06T13:29:00.000Z</gml:beginPosition>
              <gml:endPosition>2026-06-07T13:29:00.000Z</gml:endPosition>
            </gml:TimePeriod>
          </gml:validTime>
          <aixm:interpretation>BASELINE</aixm:interpretation>
          <aixm:sequenceNumber>1</aixm:sequenceNumber>
          <aixm:correctionNumber>0</aixm:correctionNumber>
          <event:scenario>FF001</event:scenario>
          <event:textNOTAM>
            <event:NOTAM gml:id="NOTAM_1_8356352547785174">
              <event:number>035</event:number>
              <event:year>2026</event:year>
              <event:type>N</event:type>
              <event:issued>2026-06-06T13:30:00.000Z</event:issued>
              <event:affectedFIR>ZAU</event:affectedFIR>
              <event:selectionCode>QMRXX</event:selectionCode>
              <event:minimumFL>000</event:minimumFL>
              <event:maximumFL>999</event:maximumFL>
              <event:coordinates>4214N08533W</event:coordinates>
              <event:radius>5</event:radius>
              <event:location>AZO</event:location>
              <event:effectiveStart>202606061329</event:effectiveStart>
              <event:effectiveEnd>202606071329</event:effectiveEnd>
              <event:text>RWY 17 FICON 10 PCT WET OBS AT 2606061329.</event:text>
              <event:translation>
                <event:NOTAMTranslation gml:id="NT_1_8356352547785174">
                  <event:type>LOCAL_FORMAT</event:type>
                  <event:simpleText>!AZO 06/035 AZO RWY 17 FICON 10 PCT WET OBS AT 2606061329. 2606061329-2606071329</event:simpleText>
                </event:NOTAMTranslation>
              </event:translation>
              <event:translation>
                <event:NOTAMTranslation gml:id="NT_2_8356352547785174">
                  <event:type>OTHER:ICAO</event:type>
                  <event:formattedText>
                    <html:div>A6417/26 NOTAMN Q) KZAU/QMRXX////000/999/4214N08533W005 A) KAZO B) 2606061329 C) 2606071329 E) RWY 17 FICON 10 PCT WET OBS AT 2606061329.</html:div>
                  </event:formattedText>
                </event:NOTAMTranslation>
              </event:translation>
            </event:NOTAM>
          </event:textNOTAM>
          <event:extension>
            <fnse:EventExtension gml:id="FNSE_1_8356352547785174">
              <fnse:classification>DOM</fnse:classification>
              <fnse:accountId>AZO</fnse:accountId>
              <fnse:xoveraccountID>KAZO</fnse:xoveraccountID>
              <fnse:xovernotamID>A6417/26</fnse:xovernotamID>
              <fnse:airportname>KALAMAZOO/BATTLE CREEK INTL</fnse:airportname>
              <fnse:qline>KZAU/QMRXX////000/999/4214N08533W005</fnse:qline>
              <fnse:lastUpdated>2026-06-06T13:30:00.000Z</fnse:lastUpdated>
              <fnse:icaoLocation>KAZO</fnse:icaoLocation>
            </fnse:EventExtension>
          </event:extension>
        </event:EventTimeSlice>
      </event:timeSlice>
    </event:Event>
  </message:hasMember>
  <message:hasMember>
    <aixm:AirportHeliport gml:id="AH_1_8356352547785174">
      <gml:identifier codeSpace="urn:uuid:">0544221f-5f11-47e3-88ff-c4823ae3e7c5</gml:identifier>
      <aixm:timeSlice>
        <aixm:AirportHeliportTimeSlice gml:id="AH_TS_1_8356352547785174">
          <gml:validTime>
            <gml:TimeInstant gml:id="AH_TS_TI_1_8356352547785174">
              <gml:timePosition>2026-06-06T13:30:00.000Z</gml:timePosition>
            </gml:TimeInstant>
          </gml:validTime>
          <aixm:interpretation>SNAPSHOT</aixm:interpretation>
          <aixm:designator>AZO</aixm:designator>
          <aixm:name>KALAMAZOO/BATTLE CREEK INTL</aixm:name>
          <aixm:locationIndicatorICAO>KAZO</aixm:locationIndicatorICAO>
          <aixm:ARP>
            <aixm:ElevatedPoint gml:id="EP_1_8356352547785174" srsName="urn:ogc:def:crs:EPSG::4326" srsDimension="2">
              <gml:pos>42.234389 -85.551556</gml:pos>
            </aixm:ElevatedPoint>
          </aixm:ARP>
        </aixm:AirportHeliportTimeSlice>
      </aixm:timeSlice>
    </aixm:AirportHeliport>
  </message:hasMember>
</message:AIXMBasicMessage>`;

test("parses an FNS AIXM Basic Message into a canonical NOTAM", () => {
  const r = parseAixmMessage(SAMPLE);
  assert.ok(r, "expected a parsed record");
  assert.equal(r.id, "A6417/26");
  assert.equal(r.fns_uuid, "9fcd3b9e-04bc-41af-b3f8-e8f23adf12fd");
  assert.equal(r.number, "035");
  assert.equal(r.year, "2026");
  assert.equal(r.type, "N");
  assert.equal(r.interpretation, "BASELINE");
  assert.equal(r.issued, "2026-06-06T13:30:00.000Z");
  assert.equal(r.effective_start, "2026-06-06T13:29:00.000Z");
  assert.equal(r.effective_end, "2026-06-07T13:29:00.000Z");
  assert.equal(r.location, "AZO");
  assert.equal(r.icao_location, "KAZO");
  assert.equal(r.airport_name, "KALAMAZOO/BATTLE CREEK INTL");
  assert.equal(r.affected_fir, "ZAU");
  assert.equal(r.selection_code, "QMRXX");
  assert.equal(r.qline, "KZAU/QMRXX////000/999/4214N08533W005");
  assert.equal(r.min_fl, 0);
  assert.equal(r.max_fl, 999);
  assert.equal(r.coordinates, "4214N08533W");
  assert.equal(r.radius_nm, 5);
  assert.equal(r.classification, "DOM");
  assert.equal(r.lat, 42.234389);
  assert.equal(r.lon, -85.551556);
  assert.equal(r.text, "RWY 17 FICON 10 PCT WET OBS AT 2606061329.");
  assert.match(r.local_format ?? "", /^!AZO 06\/035 AZO RWY 17 FICON 10 PCT WET/);
  assert.match(r.icao_format ?? "", /A6417\/26 NOTAMN/);
});

test("returns null when no Event member is present", () => {
  const empty = `<?xml version="1.0"?><message:AIXMBasicMessage xmlns:message="x"/>`;
  assert.equal(parseAixmMessage(empty), null);
});
