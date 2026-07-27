/**
 * The live KC Park Crowd-Cast page, served by the Worker at /crowdcast.
 * It fetches /crowdcast.json (latest place_signals, enriched) and renders the
 * ranked board. Auto-refreshes on the 5-minute cron cadence. Single real state —
 * no scenario toggle; this reflects the live field.
 *
 * The client script deliberately uses string concatenation (no template
 * literals) so it survives being embedded in this module's own template string.
 */
export function renderCrowdcastHtml(): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KC Park Crowd-Cast</title>
<style>
  :root{--bg:#0b1020;--panel:#141b31;--ink:#eaf0ff;--dim:#93a0c4;--line:#26304e;
    --packed:#ff5d5d;--busy:#ffa23a;--moderate:#5bd6a0;--quiet:#5a86ff;--a:#7fe0b0;--d:#ff8f6b;}
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(1200px 600px at 70% -10%,#1a2b4d 0,transparent 60%),var(--bg);
    color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .wrap{max-width:1080px;margin:0 auto;padding:28px 20px 60px}
  header{display:flex;flex-wrap:wrap;align-items:baseline;gap:12px;border-bottom:1px solid var(--line);padding-bottom:16px}
  h1{font-size:30px;margin:0;letter-spacing:.3px}
  h1 .live{color:var(--packed);font-weight:800}
  .tag{color:var(--dim);font-size:13px}
  .lede{margin:14px 0 8px;color:var(--ink);font-size:16px;max-width:78ch}
  .chain{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--dim);white-space:pre-wrap;
    background:#0c1226;border:1px solid var(--line);border-radius:10px;padding:12px;margin:14px 0}
  .meta{color:var(--dim);font-size:13px;margin:8px 2px 18px}
  .grid{display:grid;gap:12px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;
    display:grid;grid-template-columns:54px 1fr auto;gap:14px;align-items:center}
  .rank{font-size:26px;font-weight:800;color:var(--dim);text-align:center}
  .name{font-weight:700;font-size:17px}
  .badges{display:flex;gap:6px;margin-top:3px;flex-wrap:wrap}
  .b{font-size:11px;padding:2px 7px;border-radius:6px;border:1px solid var(--line);color:var(--dim)}
  .b.holcA{color:var(--a);border-color:#2f5a45}
  .b.holcD{color:var(--d);border-color:#5a3327}
  .narr{margin-top:8px;color:var(--ink);font-size:14px;max-width:70ch}
  .score{text-align:right;min-width:120px}
  .num2{font-size:30px;font-weight:800;line-height:1}
  .tier{font-size:12px;text-transform:uppercase;letter-spacing:.6px;font-weight:700}
  .bar{height:8px;border-radius:6px;background:#0c1226;margin-top:8px;overflow:hidden}
  .bar > i{display:block;height:100%;border-radius:6px}
  .t-packed{color:var(--packed)} .t-busy{color:var(--busy)} .t-moderate{color:var(--moderate)} .t-quiet{color:var(--quiet)}
  .f-packed{background:var(--packed)} .f-busy{background:var(--busy)} .f-moderate{background:var(--moderate)} .f-quiet{background:var(--quiet)}
  .foot{margin-top:34px;border-top:1px solid var(--line);padding-top:16px;color:var(--dim);font-size:13px;max-width:84ch}
  .foot b{color:var(--ink)}
  .empty{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:22px;color:var(--dim)}
</style></head><body><div class="wrap">
<header>
  <h1>KC Park <span class="live">Crowd-Cast</span></h1>
  <span class="tag">where the city actually goes — live forecast, not headcount</span>
</header>
<p class="lede">On a hot day KC doesn't spread out across its parks — it funnels into the cool, wet, shaded few and abandons the rest. This board is live: it re-reads the field every few minutes, and every park attribute under it is measured, not guessed.</p>
<div class="chain">Noise · Redlining · Canopy/Heat · Access barriers  ⟶  where the crowd lands
demand(day, temp) × ( pull[shade+water+quiet+amenities] − friction[closures] )</div>
<div class="meta" id="meta">loading the field…</div>
<div class="grid" id="grid"></div>
<div class="foot">
  <p><b>How to read it.</b> The bar is predicted <i>relative</i> crowd concentration, not a turnstile count. When it's hot, shade and water get weighted up hard — that's when the city stops spreading out.</p>
  <p><b>The pattern worth naming.</b> We measured tree canopy inside all 120 of Kansas City's 1939 HOLC polygons (NLCD 2021). The neighborhoods graded <b>A</b> carry <b>37.6%</b> canopy over <b>28%</b> pavement. The ones graded <b>C</b> and <b>D</b> — the redlined ones — carry <b>21.7%</b> canopy over <b>47%</b> pavement. Ninety years on, the lending map still predicts the shade.</p>
  <p><b>The part that surprised us.</b> That gap does <i>not</i> show up inside the parks themselves — park canopy is roughly flat across grades, because a park is the greenest patch of any neighborhood. Which inverts the easy story: a park in a redlined neighborhood isn't shade-poor, it's shade-<i>rare</i>. It's doing more work, for more people, with less around it to share the load. When one of those runs quiet in a heat wave, there's no shaded backup down the street.</p>
  <p><b>Provenance.</b> Temperature and day-type are live. Park geometry and area come from OpenStreetMap; canopy and impervious surface from NLCD 2021 via MRLC; redlining grades from Mapping Inequality (University of Richmond). Surface heat is a labeled <b>proxy</b> derived from impervious + canopy, not a thermal measurement — there is no free keyless Landsat endpoint. Noise enrichment is still pending, so it sits at a neutral default rather than claiming a park is quiet.</p>
  <p><b>Your location is not stored.</b> This board needs no location at all. The companion <code>/nearby.json</code> endpoint accepts coordinates to sort parks by distance, and uses them only to compute that one response — they are never written to the database, never logged, never tied to an identifier, and never shared. No request on this site records where you are.</p>
</div>
</div>
<script>
(function(){
  var TIER_ORDER = {packed:0,busy:1,moderate:2,quiet:3};
  function holcBadge(g){ if(!g) return '<span class="b">unmapped</span>';
    return '<span class="b holc'+g+'">HOLC '+g+'</span>'; }
  function card(p){
    var anomaly = (p.anomaly!==undefined && p.anomaly!==null)
      ? '<span class="b">Δ '+(p.anomaly>0?'+':'')+p.anomaly+'</span>' : '';
    var blocked = (p.friction>0) ? '<span class="b">access blocked</span>' : '';
    var w = Math.max(3, Math.round(p.crowding));
    return '<div class="card">'
      + '<div class="rank">'+p.rank+'</div>'
      + '<div><div class="name">'+p.name+'</div>'
      + '<div class="badges">'+holcBadge(p.holc_grade)+'<span class="b">canopy→shade</span>'+blocked+anomaly+'</div>'
      + '<div class="narr">'+(p.narrative||'')+'</div></div>'
      + '<div class="score"><div class="num2 t-'+p.tier+'">'+Math.round(p.crowding)+'</div>'
      + '<div class="tier t-'+p.tier+'">'+p.tier+'</div>'
      + '<div class="bar"><i class="f-'+p.tier+'" style="width:'+w+'%"></i></div></div>'
      + '</div>';
  }
  function render(data){
    var meta = document.getElementById('meta');
    var grid = document.getElementById('grid');
    if(!data || !data.parks || data.parks.length===0){
      meta.textContent = 'No forecast written yet — the cron populates this every 5 minutes.';
      grid.innerHTML = '<div class="empty">Waiting on the first tick. Check back shortly.</div>';
      return;
    }
    var when = new Date(data.generated_at).toLocaleString('en-US',{timeZone:'America/Chicago'});
    meta.textContent = 'as of '+when+' CT'+(data.calibrated?' · calibrated to observed traffic':'')+' · '+data.parks.length+' parks';
    var parks = data.parks.slice().sort(function(a,b){
      if(a.rank&&b.rank) return a.rank-b.rank;
      return (TIER_ORDER[a.tier]-TIER_ORDER[b.tier]) || (b.crowding-a.crowding);
    });
    grid.innerHTML = parks.map(card).join('');
  }
  function load(){
    fetch('/crowdcast.json',{headers:{accept:'application/json'}})
      .then(function(r){return r.json();})
      .then(render)
      .catch(function(){ document.getElementById('meta').textContent='could not load the field'; });
  }
  load();
  setInterval(load, 300000);
})();
</script></body></html>`;
}
