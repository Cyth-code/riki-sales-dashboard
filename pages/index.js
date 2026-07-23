import { useState, useMemo } from 'react';
import opps from '../data/opportunities.json';
import history from '../data/stage_history.json';
import leads from '../data/leads.json';
import meta from '../data/meta.json';
import { HBar, VBar, fmtMoney, fmtNum, COLORS } from '../components/charts';

const BUCKETS = ['0-1 wks', '1-4 wks', '4-8 wks', '8-12 wks', '12-26 wks', '26-52 wks', '52+ wks'];
const uniq = (arr, key) => [...new Set(arr.map((d) => d[key]).filter(Boolean))].sort();
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

export default function Dashboard() {
  const [tab, setTab] = useState('lifecycle');

  return (
    <div className="wrap">
      <header className="masthead">
        <p className="eyebrow">Cyth Systems · Zoho CRM</p>
        <h1 className="title">Riki McClure — <span className="accent">Academic Sales Cycle</span></h1>
        <p className="sub">
          Source: Zoho CRM (Opportunities + Stage History + Lead conversion). Pulled {meta.pulled}.
          Click any KPI tile, chart bar, or lifecycle step to drill through.
        </p>
      </header>

      <nav className="tabs">
        <button className={`tab ${tab === 'lifecycle' ? 'active' : ''}`} onClick={() => setTab('lifecycle')}>Sales Lifecycle</button>
        <button className={`tab ${tab === 'stages' ? 'active' : ''}`} onClick={() => setTab('stages')}>Stage History</button>
        <button className={`tab ${tab === 'funnel' ? 'active' : ''}`} onClick={() => setTab('funnel')}>Lead → Opp Funnel</button>
      </nav>

      {tab === 'lifecycle' && <Lifecycle />}
      {tab === 'stages' && <Stages />}
      {tab === 'funnel' && <Funnel />}

      <footer className="footer">
        <span>Riki McClure only · {meta.oppCount} opps · {meta.transitionCount} stage transitions · {meta.leadCount} leads</span>
        <span>Data from Zoho {meta.pulled}</span>
      </footer>
    </div>
  );
}

/* ============ TAB 1: SALES LIFECYCLE ============ */
function Lifecycle() {
  const [f, setF] = useState({ stage: '', pipeline: '', source: '', type: '', status: '', origin: '', bucket: '', loss: '', from: '', to: '', closedFrom: '', closedTo: '', q: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const clear = () => setF({ stage: '', pipeline: '', source: '', type: '', status: '', origin: '', bucket: '', loss: '', from: '', to: '', closedFrom: '', closedTo: '', q: '' });

  const rows = useMemo(() => opps.filter((o) => {
    if (f.stage && o.stage !== f.stage) return false;
    if (f.pipeline && o.pipeline !== f.pipeline) return false;
    if (f.source && o.leadSource !== f.source) return false;
    if (f.type && o.type !== f.type) return false;
    if (f.origin && o.origin !== f.origin) return false;
    if (f.bucket && o.cycleBucket !== f.bucket) return false;
    if (f.loss && o.lossReason !== f.loss) return false;
    if (f.status === 'closed' && o.outcome === 'Open') return false;
    if (f.status === 'Won' && o.outcome !== 'Won') return false;
    if (f.status === 'Lost' && o.outcome !== 'Lost') return false;
    if (f.status === 'Open' && o.outcome !== 'Open') return false;
    if (f.from && o.created && o.created < f.from) return false;
    if (f.to && o.created && o.created > f.to) return false;
    if (f.closedFrom && (!o.closing || o.closing < f.closedFrom)) return false;
    if (f.closedTo && (!o.closing || o.closing > f.closedTo)) return false;
    if (f.q) { const s = (o.name + ' ' + o.company).toLowerCase(); if (!s.includes(f.q.toLowerCase())) return false; }
    return true;
  }), [f]);

  const won = rows.filter((o) => o.outcome === 'Won');
  const lost = rows.filter((o) => o.outcome === 'Lost');
  const closed = won.length + lost.length;
  const cycles = rows.map((o) => o.oppCycleWks).filter((x) => x != null);
  const wonAmt = won.reduce((s, o) => s + (o.amount || 0), 0);
  const winRate = closed ? won.length / closed : 0;

  // phase breakdown (closed only)
  const closedRows = rows.filter((o) => o.outcome !== 'Open');
  const prospecting = avg(closedRows.map((o) => o.leadConvDays).filter((x) => x != null));
  const oppPhase = avg(closedRows.map((o) => o.oppCycleWks).filter((x) => x != null));
  const overall = avg(closedRows.map((o) => o.overallWks).filter((x) => x != null));

  const byStage = useMemo(() => {
    const m = {};
    rows.forEach((o) => { if (o.oppCycleWks != null) { (m[o.stage] = m[o.stage] || []).push(o.oppCycleWks); } });
    return Object.entries(m).map(([k, v]) => ({ label: k, value: +avg(v).toFixed(1) })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const bySource = useMemo(() => {
    const m = {};
    rows.forEach((o) => { if (o.oppCycleWks != null && o.leadSource) (m[o.leadSource] = m[o.leadSource] || []).push(o.oppCycleWks); });
    return Object.entries(m).map(([k, v]) => ({ label: k, value: +avg(v).toFixed(1) })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [rows]);

  const wonLostDist = useMemo(() => BUCKETS.map((b) => ({
    label: b,
    Won: won.filter((o) => o.cycleBucket === b).length,
    Lost: lost.filter((o) => o.cycleBucket === b).length,
  })), [rows]);

  const lossReasons = useMemo(() => {
    const m = {};
    lost.forEach((o) => { const r = o.lossReason || 'Not specified'; m[r] = (m[r] || 0) + 1; });
    return Object.entries(m).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const byPipeline = useMemo(() => {
    const m = {};
    rows.forEach((o) => { const p = o.pipeline || 'Unknown'; m[p] = (m[p] || 0) + 1; });
    return Object.entries(m).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const winBySource = useMemo(() => {
    const m = {};
    rows.forEach((o) => { if (o.outcome === 'Open' || !o.leadSource) return; m[o.leadSource] = m[o.leadSource] || { w: 0, t: 0 }; m[o.leadSource].t++; if (o.outcome === 'Won') m[o.leadSource].w++; });
    return Object.entries(m).map(([k, v]) => ({ label: k, value: +(100 * v.w / v.t).toFixed(0), t: v.t })).filter((x) => x.t >= 3).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [rows]);

  const lifeSteps = [
    { name: 'Lead → Opp', val: fmtNum(median(rows.map((o) => o.leadConvDays).filter((x) => x != null)), 0), unit: 'days (median)' },
    { name: 'Opp Cycle', val: fmtNum(median(cycles), 1), unit: 'wks (median)' },
    { name: 'Overall', val: fmtNum(median(rows.map((o) => o.overallWks).filter((x) => x != null)), 1), unit: 'wks lead→close' },
  ];

  const filterLabels = { stage: 'stage', pipeline: 'pipeline', source: 'source', type: 'type', status: 'status', origin: 'origin', bucket: 'bucket', loss: 'loss reason', from: 'created from', to: 'created to', closedFrom: 'closed from', closedTo: 'closed to', q: 'search' };
  const active = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${filterLabels[k] || k}: ${v}`);

  return (
    <>
      <div className="filters">
        <Sel label="Stage" v={f.stage} set={(v) => set('stage', v)} opts={uniq(opps, 'stage')} />
        <Sel label="Pipeline" v={f.pipeline} set={(v) => set('pipeline', v)} opts={uniq(opps, 'pipeline')} />
        <Sel label="Lead Source" v={f.source} set={(v) => set('source', v)} opts={uniq(opps, 'leadSource')} />
        <Sel label="Type" v={f.type} set={(v) => set('type', v)} opts={uniq(opps, 'type')} />
        <Sel label="Status" v={f.status} set={(v) => set('status', v)} opts={['closed', 'Won', 'Lost', 'Open']} labels={{ closed: 'Closed only' }} />
        <Sel label="Origin" v={f.origin} set={(v) => set('origin', v)} opts={['From Lead', 'Direct Opp']} />
        <Sel label="Cycle Bucket" v={f.bucket} set={(v) => set('bucket', v)} opts={BUCKETS} />
        <Sel label="Loss Reason" v={f.loss} set={(v) => set('loss', v)} opts={uniq(opps, 'lossReason')} />
        <div className="filter"><label>Created From</label><input type="date" value={f.from} onChange={(e) => set('from', e.target.value)} /></div>
        <div className="filter"><label>Created To</label><input type="date" value={f.to} onChange={(e) => set('to', e.target.value)} /></div>
        <div className="filter"><label>Closed From</label><input type="date" value={f.closedFrom} onChange={(e) => set('closedFrom', e.target.value)} /></div>
        <div className="filter"><label>Closed To</label><input type="date" value={f.closedTo} onChange={(e) => set('closedTo', e.target.value)} /></div>
        <div className="filter"><label>Search</label><input placeholder="opp or company" value={f.q} onChange={(e) => set('q', e.target.value)} /></div>
        <button className="clearbtn" onClick={clear}>Clear</button>
      </div>
      {active.length > 0 && <div className="activefilters">Active: {active.map((a, i) => <b key={i}>{a}{i < active.length - 1 ? ' · ' : ''}</b>)}</div>}

      <div className="kpis">
        <Kpi label="Total Opps" val={rows.length} hint="click to reset" onClick={clear} />
        <Kpi label="Closed" val={closed} hint="won + lost" onClick={() => set('status', 'closed')} active={f.status === 'closed'} />
        <Kpi label="Closed Won" val={won.length} cls="won" onClick={() => set('status', 'Won')} active={f.status === 'Won'} />
        <Kpi label="Closed Lost" val={lost.length} cls="lost" onClick={() => set('status', 'Lost')} active={f.status === 'Lost'} />
        <Kpi label="Avg Opp Cycle" val={fmtNum(avg(cycles))} hint="weeks" />
        <Kpi label="Median Cycle" val={fmtNum(median(cycles))} hint="weeks" />
        <Kpi label="Win Rate" val={(winRate * 100).toFixed(0) + '%'} cls="win" hint="of closed" />
        <Kpi label="Won $" val={fmtMoney(wonAmt)} cls="won" hint="closed won" />
      </div>

      <div className="section-h"><h2>Sales Lifecycle — Duration by Phase</h2><span className="note">medians across filtered opps</span></div>
      <div className="lifecycle">
        {lifeSteps.map((s) => (
          <div className="life-step" key={s.name}>
            <div className="ls-name">{s.name}</div>
            <div className="ls-val">{s.val}</div>
            <div className="ls-unit">{s.unit}</div>
          </div>
        ))}
      </div>

      <div className="section-h"><h2>Sales Cycle Phase Breakdown</h2><span className="note">closed opps only · averages</span></div>
      <div className="phases">
        <Phase name="Prospecting" sub="Lead → Converted" val={fmtNum(prospecting, 0) + ' days'} />
        <Phase name="Opp Phase" sub="Opp Created → Close" val={fmtNum(oppPhase) + ' wks'} />
        <Phase name="Overall" sub="Lead → Close" val={fmtNum(overall) + ' wks'} />
      </div>

      <div className="grid g2">
        <Card title="Avg Opp Cycle by Stage" hint="click a bar to filter by stage">
          <HBar data={byStage} unit=" wks" onBar={(d) => set('stage', d.label)} />
        </Card>
        <Card title="Avg Opp Cycle by Lead Source" hint="click a bar to filter by source">
          <HBar data={bySource} unit=" wks" onBar={(d) => set('source', d.label)} />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Won vs Lost: Cycle Distribution" hint="opps by cycle-length bucket">
          <ResponsiveStacked data={wonLostDist} onBar={(d) => set('bucket', d.label)} />
        </Card>
        <Card title="Reasons for Loss" hint="click a bar to filter by reason">
          <HBar data={lossReasons} onBar={(d) => set('loss', d.label)} colorBy={() => COLORS.lost} />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Opportunities by Pipeline" hint="click to filter by pipeline">
          <HBar data={byPipeline} onBar={(d) => set('pipeline', d.label)} />
        </Card>
        <Card title="Win Rate by Lead Source" hint="sources with 3+ closed opps">
          <HBar data={winBySource} unit="%" onBar={(d) => set('source', d.label)} colorBy={() => COLORS.won} />
        </Card>
      </div>

      <div className="section-h"><h2>Opportunity Drill-Through</h2></div>
      <p className="shown">{rows.length} shown · click a row</p>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Opportunity</th><th>Company</th><th>Stage</th><th>Pipeline</th><th>Source</th><th>Created</th><th>Closing</th><th>Opp (wks)</th><th>Overall (wks)</th><th>Amount</th><th>Prob%</th><th>Loss Reason</th></tr></thead>
          <tbody>
            {rows.slice(0, 200).map((o, i) => (
              <tr key={i} onClick={() => set('q', o.name || '')}>
                <td style={{ color: '#E8EEF7' }}>{o.name || '—'}</td>
                <td>{o.company || '—'}</td>
                <td><span className={`pill ${o.outcome}`}>{o.stage}</span></td>
                <td>{o.pipeline || '—'}</td><td>{o.leadSource || '—'}</td>
                <td>{o.created || '—'}</td><td>{o.closing || '—'}</td>
                <td>{fmtNum(o.oppCycleWks)}</td><td>{fmtNum(o.overallWks)}</td>
                <td>{fmtMoney(o.amount)}</td><td>{o.prob ?? '—'}</td><td>{o.lossReason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 200 && <p className="shown">Showing first 200 of {rows.length}. Narrow filters to see more.</p>}
    </>
  );
}

/* ============ TAB 2: STAGE HISTORY ============ */
const STAGE_ORDER = ['Qualification', 'Proposal/Quote', 'PursueClose', 'OnHold', 'Closed Won', 'Closed-Lost', 'Closed-Cancel/Expire', 'Closed-Disqual', 'Closed-NoOpp'];
function Stages() {
  const [f, setF] = useState({ stage: '', pipeline: '', source: '', path: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const clear = () => setF({ stage: '', pipeline: '', source: '', path: '' });

  // map opp -> outcome for path filtering
  const oppOutcome = useMemo(() => { const m = {}; opps.forEach((o) => { m[o.name] = o.outcome; }); return m; }, []);

  const rows = useMemo(() => history.filter((h) => {
    if (f.stage && h.stage !== f.stage) return false;
    if (f.pipeline && h.pipeline !== f.pipeline) return false;
    if (f.source && h.leadSource !== f.source) return false;
    if (f.path) { const oc = oppOutcome[h.opp]; if (f.path === 'Won' && oc !== 'Won') return false; if (f.path === 'Lost' && oc !== 'Lost') return false; if (f.path === 'Open' && oc !== 'Open') return false; }
    return true;
  }), [f, oppOutcome]);

  const oppsInScope = new Set(rows.map((h) => h.opp)).size;
  const avgStages = oppsInScope ? (rows.length / oppsInScope).toFixed(1) : '—';
  const longest = rows.reduce((mx, h) => (h.durationDays != null && h.durationDays > (mx.durationDays || -1) ? h : mx), {});

  const stageStats = useMemo(() => {
    const m = {};
    rows.forEach((h) => { if (h.durationDays == null) return; (m[h.stage] = m[h.stage] || []).push(h.durationDays); });
    return Object.entries(m).map(([k, v]) => ({ label: k, avg: +avg(v).toFixed(1), med: +median(v).toFixed(1), max: Math.max(...v), entered: v.length }));
  }, [rows]);

  const avgByStage = [...stageStats].map((s) => ({ label: s.label, value: s.avg })).sort((a, b) => b.value - a.value);
  const medByStage = [...stageStats].map((s) => ({ label: s.label, value: s.med })).sort((a, b) => b.value - a.value);

  const funnel = useMemo(() => {
    const m = {};
    rows.forEach((h) => { m[h.stage] = m[h.stage] || new Set(); m[h.stage].add(h.opp); });
    return STAGE_ORDER.filter((s) => m[s]).map((s) => ({ label: s, value: m[s].size }));
  }, [rows]);

  // transition matrix
  const matrix = useMemo(() => {
    const byOpp = {};
    rows.forEach((h) => { (byOpp[h.opp] = byOpp[h.opp] || []).push(h); });
    const stages = STAGE_ORDER;
    const mat = {};
    Object.values(byOpp).forEach((arr) => {
      arr.sort((a, b) => (a.modified || '').localeCompare(b.modified || ''));
      for (let i = 0; i < arr.length - 1; i++) {
        const from = arr[i].stage, to = arr[i + 1].stage;
        mat[from] = mat[from] || {}; mat[from][to] = (mat[from][to] || 0) + 1;
      }
    });
    return { mat, stages };
  }, [rows]);

  return (
    <>
      <div className="filters">
        <Sel label="Current Stage" v={f.stage} set={(v) => set('stage', v)} opts={uniq(history, 'stage')} />
        <Sel label="Pipeline" v={f.pipeline} set={(v) => set('pipeline', v)} opts={uniq(history, 'pipeline')} />
        <Sel label="Lead Source" v={f.source} set={(v) => set('source', v)} opts={uniq(history, 'leadSource')} />
        <Sel label="Path" v={f.path} set={(v) => set('path', v)} opts={['Won', 'Lost', 'Open']} labels={{ Won: 'Won path', Lost: 'Lost path' }} />
        <button className="clearbtn" onClick={clear}>Clear</button>
      </div>

      <div className="kpis">
        <Kpi label="Opps in Scope" val={oppsInScope} hint="with stage history" onClick={clear} />
        <Kpi label="Stage Transitions" val={rows.length} hint="rows" />
        <Kpi label="Avg Stages / Opp" val={avgStages} hint="stages visited" />
        <Kpi label="Longest Stage" val={longest.durationDays != null ? longest.durationDays + 'd' : '—'} hint={longest.stage || ''} />
      </div>

      <div className="grid g2">
        <Card title="Avg Days in Each Stage" hint="click a bar to filter by stage">
          <HBar data={avgByStage} unit=" d" onBar={(d) => set('stage', d.label)} />
        </Card>
        <Card title="Median Days in Each Stage" hint="click a bar to filter">
          <HBar data={medByStage} unit=" d" onBar={(d) => set('stage', d.label)} colorBy={() => COLORS.open} />
        </Card>
      </div>

      <div className="grid g2">
        <Card title="Stage Funnel: Opps Reaching Each Stage" hint="distinct opps per stage">
          <HBar data={funnel} onBar={(d) => set('stage', d.label)} />
        </Card>
        <Card title="Time-in-Stage Summary" hint="click a row to filter">
          <div className="tablewrap" style={{ marginTop: 0, maxHeight: 320, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Stage</th><th>Entered</th><th>Avg d</th><th>Med d</th><th>Max d</th></tr></thead>
              <tbody>
                {stageStats.sort((a, b) => b.entered - a.entered).map((s, i) => (
                  <tr key={i} onClick={() => set('stage', s.label)}>
                    <td style={{ color: '#E8EEF7' }}>{s.label}</td><td>{s.entered}</td><td>{s.avg}</td><td>{s.med}</td><td>{s.max}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="section-h"><h2>Stage Transition Matrix</h2><span className="note">from (row) → to (column)</span></div>
      <div className="matrix tablewrap">
        <table>
          <thead><tr><th>From → To</th>{matrix.stages.map((s) => <th key={s} className="rot">{s}</th>)}</tr></thead>
          <tbody>
            {matrix.stages.filter((from) => matrix.mat[from]).map((from) => (
              <tr key={from}>
                <td style={{ color: '#E8EEF7' }}>{from}</td>
                {matrix.stages.map((to) => {
                  const v = matrix.mat[from]?.[to] || 0;
                  return <td key={to} className={`cellnum ${v === 0 ? 'zero' : ''}`} style={v ? { background: `rgba(77,163,255,${Math.min(.5, v / 30)})` } : {}}>{v || '·'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ============ TAB 3: LEAD → OPP FUNNEL (NEW) ============ */
function Funnel() {
  const [f, setF] = useState({ source: '', status: '', conv: '' });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const clear = () => setF({ source: '', status: '', conv: '' });

  const rows = useMemo(() => leads.filter((l) => {
    if (f.source && l.source !== f.source) return false;
    if (f.status && l.status !== f.status) return false;
    if (f.conv === 'yes' && !l.converted) return false;
    if (f.conv === 'no' && l.converted) return false;
    return true;
  }), [f]);

  const converted = rows.filter((l) => l.converted);
  const convRate = rows.length ? converted.length / rows.length : 0;
  const convDays = converted.map((l) => l.convDays).filter((x) => x != null);

  const bySource = useMemo(() => {
    const m = {};
    rows.forEach((l) => { const s = l.source || 'Unknown'; m[s] = m[s] || { t: 0, c: 0 }; m[s].t++; if (l.converted) m[s].c++; });
    return Object.entries(m).map(([k, v]) => ({ label: k, value: v.t, converted: v.c, rate: +(100 * v.c / v.t).toFixed(0) })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [rows]);

  const convRateBySource = useMemo(() => bySource.filter((s) => s.value >= 5).map((s) => ({ label: s.label, value: s.rate })).sort((a, b) => b.value - a.value), [bySource]);

  const byMonth = useMemo(() => {
    const m = {};
    rows.forEach((l) => { if (!l.created) return; const k = l.created.slice(0, 7); m[k] = m[k] || { t: 0, c: 0 }; m[k].t++; if (l.converted) m[k].c++; });
    return Object.entries(m).sort().map(([k, v]) => ({ label: k, value: v.t, converted: v.c }));
  }, [rows]);

  return (
    <>
      <div className="section-h"><h2>Lead → Opportunity Funnel</h2><span className="note">the front half the opp data can't see</span></div>
      <p className="sub" style={{ marginTop: 6 }}>
        Combines unconverted + converted academic lead exports to produce a true conversion rate —
        the denominator the opportunity-only dashboard lacks.
      </p>

      <div className="filters">
        <Sel label="Lead Source" v={f.source} set={(v) => set('source', v)} opts={uniq(leads, 'source')} />
        <Sel label="Lead Status" v={f.status} set={(v) => set('status', v)} opts={uniq(leads, 'status')} />
        <Sel label="Converted?" v={f.conv} set={(v) => set('conv', v)} opts={['yes', 'no']} labels={{ yes: 'Converted', no: 'Not converted' }} />
        <button className="clearbtn" onClick={clear}>Clear</button>
      </div>

      <div className="kpis">
        <Kpi label="Total Leads" val={rows.length} onClick={clear} />
        <Kpi label="Converted to Opp" val={converted.length} cls="won" onClick={() => set('conv', 'yes')} active={f.conv === 'yes'} />
        <Kpi label="Conversion Rate" val={(convRate * 100).toFixed(1) + '%'} cls="win" hint="lead → opp" />
        <Kpi label="Median Time to Convert" val={fmtNum(median(convDays), 0)} hint="days" />
        <Kpi label="Avg Time to Convert" val={fmtNum(avg(convDays), 0)} hint="days" />
        <Kpi label="Same-Day Conversions" val={convDays.filter((d) => d < 1).length} hint="< 24h" />
      </div>

      <div className="grid g2">
        <Card title="Leads by Source" hint="total inbound · click to filter">
          <HBar data={bySource} onBar={(d) => set('source', d.label)} />
        </Card>
        <Card title="Conversion Rate by Source" hint="sources with 5+ leads">
          <HBar data={convRateBySource} unit="%" onBar={(d) => set('source', d.label)} colorBy={() => COLORS.won} />
        </Card>
      </div>

      <Card title="Monthly Lead Volume" hint="total leads created per month">
        <VBar data={byMonth} onBar={(d) => set('source', '')} />
      </Card>

      <div className="section-h"><h2>Lead Drill-Through</h2></div>
      <p className="shown">{rows.length} shown</p>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Created</th><th>Source</th><th>Status</th><th>Company</th><th>Pipeline</th><th>Converted</th><th>Days to Convert</th></tr></thead>
          <tbody>
            {rows.slice(0, 200).map((l, i) => (
              <tr key={i}>
                <td>{l.created || '—'}</td><td>{l.source || '—'}</td><td>{l.status || '—'}</td>
                <td style={{ color: '#E8EEF7' }}>{l.company || '—'}</td><td>{l.pipeline || '—'}</td>
                <td><span className={`pill ${l.converted ? 'Won' : 'Lost'}`}>{l.converted ? 'Yes' : 'No'}</span></td>
                <td>{l.convDays != null ? l.convDays : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 200 && <p className="shown">Showing first 200 of {rows.length}.</p>}
    </>
  );
}

/* ============ SHARED UI ============ */
function Sel({ label, v, set, opts, labels = {} }) {
  return (
    <div className="filter">
      <label>{label}</label>
      <select value={v} onChange={(e) => set(e.target.value)}>
        <option value="">All</option>
        {opts.map((o) => <option key={o} value={o}>{labels[o] || o}</option>)}
      </select>
    </div>
  );
}
function Kpi({ label, val, hint, cls = '', onClick, active }) {
  return (
    <div className={`kpi ${cls} ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="k-label">{label}</div>
      <div className="k-val">{val}</div>
      {hint && <div className="k-hint">{hint}</div>}
    </div>
  );
}
function Phase({ name, sub, val }) {
  return (<div className="phase"><div className="p-name">{name}</div><div className="p-sub">{sub}</div><div className="p-val">{val}</div></div>);
}
function Card({ title, hint, children }) {
  return (<div className="card"><h3>{title}</h3>{hint && <p className="ch-hint">{hint}</p>}{children}</div>);
}

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
function ResponsiveStacked({ data, onBar }) {
  if (!data.some((d) => d.Won || d.Lost)) return <div className="empty">No data for current filters</div>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="#22304A" />
        <XAxis dataKey="label" stroke="#5E7193" fontSize={9} tickLine={false} interval={0} angle={-25} textAnchor="end" height={50} />
        <YAxis stroke="#5E7193" fontSize={10} tickLine={false} />
        <Tooltip cursor={{ fill: 'rgba(77,163,255,.06)' }} contentStyle={{ background: '#121C2E', border: '1px solid #4DA3FF', borderRadius: 8, fontSize: 11 }} />
        <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} />
        <Bar dataKey="Won" stackId="a" fill="#37C98B" radius={[0, 0, 0, 0]} onClick={(d) => onBar && onBar(d.payload)} cursor="pointer" />
        <Bar dataKey="Lost" stackId="a" fill="#F2627E" radius={[4, 4, 0, 0]} onClick={(d) => onBar && onBar(d.payload)} cursor="pointer" />
      </BarChart>
    </ResponsiveContainer>
  );
}
