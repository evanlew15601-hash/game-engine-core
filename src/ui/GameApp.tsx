import { useMemo, useState } from 'react';
import { dispatch, tick, type Engine, type SaveFile } from '../engine';
import type { CoverageTier, IntelTier, Tactic } from '../engine/defs/defs';
import { createExampleDefs } from '../game/exampleDefs';
import { createExampleScenario } from '../game/exampleScenario';
import { createGameEngine } from '../game/createGameEngine';
import type { Defs } from '../game/defs';
import { PhaseReportModalView, type PhaseReport } from './PhaseReportModal';
import { HoloMap } from './HoloMap';
import { computeTravelTicks } from '../game/cityTravel';
import { computeCoverageBonus } from '../game/systems/utils';

type SaveSlot = { savedAt: number; tick: number; day: number; phase: 'DAY' | 'NIGHT'; alignment: string; cash: number; save: SaveFile };
const SAVE_SLOTS = [1, 2, 3] as const;

function readSaveSlot(slot: number): SaveSlot | null {
  const raw = localStorage.getItem(`dispatchsim.save.${slot}`);
  if (!raw) return null;
  return JSON.parse(raw) as SaveSlot;
}
function writeSaveSlot(slot: number, data: SaveSlot) {
  localStorage.setItem(`dispatchsim.save.${slot}`, JSON.stringify(data));
}

function getDayNumber(ticksPerDay: number, t: number) { return Math.floor(t / ticksPerDay) + 1; }
function getPhaseLabel(ticksPerDay: number, t: number): 'DAY' | 'NIGHT' {
  return (t - Math.floor(t / ticksPerDay) * ticksPerDay) < Math.floor(ticksPerDay / 2) ? 'DAY' : 'NIGHT';
}
function getNextBoundaryTick(ticksPerDay: number, t: number) {
  const dayStart = Math.floor(t / ticksPerDay) * ticksPerDay;
  const half = Math.floor(ticksPerDay / 2);
  return (t - dayStart) < half ? dayStart + half : dayStart + ticksPerDay;
}

function formatEvent(e: Engine<Defs>['world']['log'][number]) {
  switch (e.type) {
    case 'INCIDENT_SPAWNED': return `SPAWNED ${e.kind} @${e.district} sev${e.severity}`;
    case 'DISPATCHED': return `DISPATCHED ${e.missionId} → ${e.incidentId}`;
    case 'MISSION_RESOLVED': return `RESOLVED ${e.missionId} ${e.outcome}`;
    case 'INCIDENT_RESPONSE_MISSED': return `SLA MISS ${e.incidentId}`;
    case 'INCIDENT_FAILED': return `FAILED ${e.incidentId}`;
    case 'INTEL_BOUGHT': return `INTEL ${e.tier} sev${e.severityDelta} +${e.deadlineDelta}t`;
    case 'COVERAGE_SET': return `COVERAGE ${e.district} → ${e.tier}`;
    case 'CHARGEBACK': return `CHARGEBACK ${e.district} -$${Math.round(e.amount)}`;
    case 'BILLED_SUBSCRIPTIONS': return `BILLED +$${Math.round(e.amount)}`;
    case 'OPERATING_COST': return `OP COST -$${Math.round(e.amount)}`;
    case 'GAME_ENDED': return `GAME ${e.state}: ${e.reason}`;
    default: return e.type;
  }
}

function snapshotForReport(engine: Engine<Defs>) {
  const districts = engine.defs.subscriptions.districts.reduce<Record<string, { tier: string; satisfaction: number; demand: number }>>((acc, d) => {
    const sub = engine.world.subscriptions.districts[d];
    acc[d] = { tier: sub.tier, satisfaction: sub.satisfaction, demand: sub.demand ?? 1 };
    return acc;
  }, {});
  return {
    cash: engine.world.company.cash, stability: engine.world.city.stability,
    trust: engine.world.city.publicTrust, favor: engine.world.city.underworldFavor,
    heat: engine.world.city.heat, openIncidents: engine.world.incidents.filter((i) => i.state === 'OPEN').length, districts,
  };
}

export function GameApp() {
  const [resetKey, setResetKey] = useState(0);
  const [viewTick, setViewTick] = useState(0);
  const [saveSlots, setSaveSlots] = useState(() => SAVE_SLOTS.map((s) => readSaveSlot(s)));
  const [selectedIncidentId, setSelectedIncidentId] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedTactic, setSelectedTactic] = useState<Tactic>('CONTROL');
  const [selectedIntelTier, setSelectedIntelTier] = useState<IntelTier>('BASIC');
  const [useOvertimeDispatch, setUseOvertimeDispatch] = useState(false);
  const [phaseReport, setPhaseReport] = useState<PhaseReport | null>(null);

  const engine = useMemo<Engine<Defs>>(() => {
    const defs = createExampleDefs();
    const world = createExampleScenario({ defs, seed: 1234 });
    return createGameEngine({ defs, world });
  }, [resetKey]);

  const canAct = engine.world.game.state === 'RUNNING' && phaseReport === null;
  if (viewTick !== engine.world.time.tick) setViewTick(engine.world.time.tick);

  const phase = getPhaseLabel(engine.defs.rules.ticksPerDay, engine.world.time.tick);
  const dayNum = getDayNumber(engine.defs.rules.ticksPerDay, engine.world.time.tick);
  const openIncidents = engine.world.incidents.filter((i) => i.state === 'OPEN');
  const selectedIncident = openIncidents.find((i) => i.id === selectedIncidentId) ?? null;
  const activeRoster = engine.world.rosters[engine.world.player.alignment].filter((a) => a.status.type === 'AVAILABLE');
  const rogues = engine.world.rosters.ROGUE;

  const allAgents = useMemo(() => [...engine.world.rosters.HERO, ...engine.world.rosters.VILLAIN, ...engine.world.rosters.ROGUE], [engine.world.rosters.HERO, engine.world.rosters.VILLAIN, engine.world.rosters.ROGUE]);

  const selectedTeam = useMemo(() => {
    const ids = new Set(selectedAgents);
    return allAgents.filter((a) => ids.has(a.id));
  }, [allAgents, selectedAgents]);

  const coverageBonus = useMemo(() => {
    if (!selectedIncident || selectedTeam.length === 0) return 0;
    return computeCoverageBonus(engine.defs, selectedIncident.tags, selectedTeam);
  }, [engine.defs, selectedIncident, selectedTeam]);

  const dispatchEtaTicks = useMemo(() => {
    if (!selectedIncident) return null;
    return computeTravelTicks({ districts: engine.defs.subscriptions.districts, district: selectedIncident.district, severity: selectedIncident.severity, heat: engine.world.city.heat, intelBonusTicks: selectedIncident.intelTravelBonusTicks });
  }, [engine.defs.subscriptions.districts, engine.world.city.heat, selectedIncident]);

  const holoMapIncidents = useMemo(() => openIncidents.map((i) => ({
    id: i.id, district: i.district, kind: i.kind, severity: i.severity,
    deadlineTicksLeft: Math.max(0, (i.responseByTick ?? i.deadlineTick) - engine.world.time.tick),
    selected: i.id === selectedIncidentId,
  })), [openIncidents, engine.world.time.tick, selectedIncidentId]);

  const coverageByDistrict = useMemo(() => {
    const result: Record<string, { tier: string; satisfaction: number }> = {};
    for (const d of engine.defs.subscriptions.districts) {
      const sub = engine.world.subscriptions.districts[d];
      result[d] = { tier: sub.tier, satisfaction: sub.satisfaction };
    }
    return result;
  }, [engine.defs.subscriptions.districts, engine.world.subscriptions.districts]);

  const etaByDistrict = useMemo(() => {
    const result: Record<string, number> = {};
    for (const d of engine.defs.subscriptions.districts) {
      result[d] = computeTravelTicks({ districts: engine.defs.subscriptions.districts, district: d, severity: 5, heat: engine.world.city.heat });
    }
    return result;
  }, [engine.defs.subscriptions.districts, engine.world.city.heat]);

  const advancePhase = () => {
    const ticksPerDay = engine.defs.rules.ticksPerDay;
    const fromTick = engine.world.time.tick;
    const toTick = getNextBoundaryTick(ticksPerDay, fromTick);

    const before = snapshotForReport(engine);
    const beforeLogLen = engine.world.log.length;

    tick(engine, toTick - fromTick);
    setViewTick(engine.world.time.tick);

    const after = snapshotForReport(engine);
    const events = engine.world.log.slice(beforeLogLen);

    const billingHappened = events.some((e) => e.type === 'BILLED_SUBSCRIPTIONS' || e.type === 'OPERATING_COST');
    const billing = billingHappened ? { ...engine.world.subscriptions.lastTotals } : null;

    setPhaseReport({
      title: `Day ${getDayNumber(ticksPerDay, fromTick)} ${getPhaseLabel(ticksPerDay, fromTick)} → ${getPhaseLabel(ticksPerDay, toTick)}`,
      fromTick, toTick,
      deltas: { cash: after.cash - before.cash, stability: after.stability - before.stability, trust: after.trust - before.trust, favor: after.favor - before.favor, heat: after.heat - before.heat, openIncidents: after.openIncidents - before.openIncidents, slaMisses: 0 },
      incidents: { spawned: events.filter((e) => e.type === 'INCIDENT_SPAWNED').length, resolved: events.filter((e) => e.type === 'MISSION_RESOLVED').length, failed: events.filter((e) => e.type === 'INCIDENT_FAILED').length, responseMissed: events.filter((e) => e.type === 'INCIDENT_RESPONSE_MISSED').length },
      billing, forecast: { misses: 0, refunds: 0, chargebackRisk: 0, affects: engine.world.player.alignment === 'HERO' ? 'PUBLIC_TRUST' : 'UNDERWORLD_FAVOR', reputationPenalty: 0, heatGain: 0 },
      demand: { topChanges: engine.defs.subscriptions.districts.map((d) => ({ district: d, demandBefore: before.districts[d]?.demand ?? 1, demandAfter: after.districts[d]?.demand ?? 1, satisfaction: after.districts[d]?.satisfaction ?? 50 })).filter((x) => Math.abs((x.demandAfter) - (x.demandBefore)) > 0.001).slice(0, 5) },
      churn: { events: engine.defs.subscriptions.districts.map((d) => { const b = before.districts[d]; const a = after.districts[d]; if (!b || !a || b.tier === a.tier) return null; return { district: d, fromTier: b.tier, toTier: a.tier, satisfaction: a.satisfaction }; }).filter((x): x is NonNullable<typeof x> => Boolean(x)) },
      intel: { purchases: events.filter((e) => e.type === 'INTEL_BOUGHT').length, totalTravelBonusTicks: 0, totalSeverityDelta: 0, totalDeadlineDelta: 0 },
      events,
    });
  };

  const btn = "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const btnPrimary = `${btn} bg-[hsl(210,80%,50%)] text-white hover:bg-[hsl(210,80%,60%)]`;
  const btnSecondary = `${btn} bg-[hsl(220,30%,15%)] text-[hsl(210,60%,80%)] border border-[hsl(215,30%,22%)] hover:bg-[hsl(220,30%,20%)]`;
  const btnDanger = `${btn} bg-[hsl(0,70%,45%)] text-white hover:bg-[hsl(0,70%,55%)]`;
  const panel = "bg-[hsl(220,40%,8%)] rounded-xl border border-[hsl(215,40%,16%)] p-3";
  const labelText = "text-[hsl(210,30%,55%)] text-[10px] uppercase tracking-wider font-semibold";

  return (
    <div className="min-h-screen bg-[hsl(220,50%,4%)] text-[hsl(210,60%,90%)] font-sans">
      {phaseReport && (
        <PhaseReportModalView report={phaseReport} onClose={() => setPhaseReport(null)} formatEvent={formatEvent} />
      )}

      {/* Header */}
      <div className="border-b border-[hsl(215,40%,14%)] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-bold tracking-wide text-[hsl(40,80%,65%)]">DISPATCH SIM</h1>
          <span className="text-xs font-mono text-[hsl(210,30%,55%)]">Day {dayNum} • {phase}</span>
          <span className="text-xs font-mono text-[hsl(210,30%,55%)]">Tick {engine.world.time.tick}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${engine.world.player.alignment === 'HERO' ? 'bg-[hsl(210,80%,50%)]/20 text-[hsl(210,80%,70%)]' : 'bg-[hsl(280,60%,40%)]/20 text-[hsl(280,60%,70%)]'}`}>
            {engine.world.player.alignment}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { tick(engine, 1); setViewTick(engine.world.time.tick); }} disabled={!canAct} className={btnSecondary}>Tick +1</button>
          <button onClick={advancePhase} disabled={!canAct} className={btnPrimary}>
            Advance → {phase === 'DAY' ? 'NIGHT' : 'DAY'}
          </button>
          <button onClick={() => setResetKey((n) => n + 1)} className={btnDanger}>Reset</button>
        </div>
      </div>

      {/* Game Over Banner */}
      {engine.world.game.state !== 'RUNNING' && (
        <div className={`mx-4 mt-3 p-3 rounded-lg text-center font-bold ${engine.world.game.state === 'WON' ? 'bg-[hsl(140,60%,20%)]/30 text-[hsl(140,60%,70%)] border border-[hsl(140,40%,30%)]' : 'bg-[hsl(0,60%,20%)]/30 text-[hsl(0,60%,70%)] border border-[hsl(0,40%,30%)]'}`}>
          {engine.world.game.state}: {engine.world.game.reason}
        </div>
      )}

      {/* Stats Bar */}
      <div className="px-4 py-2 flex gap-2 flex-wrap border-b border-[hsl(215,40%,10%)]">
        {[
          ['Cash', `$${Math.round(engine.world.company.cash)}`],
          ['Stability', String(Math.round(engine.world.city.stability))],
          ['Trust', String(Math.round(engine.world.city.publicTrust))],
          ['Favor', String(Math.round(engine.world.city.underworldFavor))],
          ['Heat', String(Math.round(engine.world.city.heat))],
          ['Open', String(openIncidents.length)],
          ['Missions', String(engine.world.missions.length)],
        ].map(([label, value]) => (
          <div key={label} className="bg-[hsl(220,30%,8%)] rounded-lg px-2.5 py-1 min-w-[70px]">
            <div className={labelText}>{label}</div>
            <div className="text-sm font-bold font-mono">{value}</div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="p-4 grid grid-cols-[1fr_1fr_1fr] gap-3" style={{ gridTemplateRows: 'auto auto' }}>
        {/* HoloMap */}
        <div className="col-span-2">
          <HoloMap
            title="Magnate City — Tactical Overview"
            districts={engine.defs.subscriptions.districts}
            coverageByDistrict={coverageByDistrict}
            incidents={holoMapIncidents}
            etaByDistrict={etaByDistrict}
            selectedDistrict={selectedDistrict || selectedIncident?.district || null}
            onSelectDistrict={(d) => {
              setSelectedDistrict(d);
              const inc = openIncidents.find((i) => i.district === d);
              if (inc) setSelectedIncidentId(inc.id);
            }}
          />
        </div>

        {/* Incidents Panel */}
        <div className={`${panel} overflow-y-auto max-h-[420px]`}>
          <h2 className="text-sm font-bold text-[hsl(40,80%,65%)] mb-2">Incidents ({openIncidents.length})</h2>
          {openIncidents.length === 0 ? (
            <p className="text-xs text-[hsl(210,30%,50%)]">No open incidents.</p>
          ) : (
            <div className="space-y-1.5">
              {openIncidents.sort((a, b) => (a.responseByTick ?? a.deadlineTick) - (b.responseByTick ?? b.deadlineTick)).map((i) => (
                <button
                  key={i.id}
                  onClick={() => { setSelectedIncidentId(i.id); setSelectedDistrict(i.district); }}
                  className={`w-full text-left p-2 rounded-lg border text-xs transition-colors ${i.id === selectedIncidentId ? 'bg-[hsl(210,80%,50%)]/10 border-[hsl(210,80%,50%)]/40' : 'bg-[hsl(220,30%,10%)] border-[hsl(215,30%,16%)] hover:bg-[hsl(220,30%,14%)]'}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">{i.kind}</span>
                    <span className={`font-mono ${i.severity >= 7 ? 'text-[hsl(0,70%,60%)]' : i.severity >= 4 ? 'text-[hsl(35,80%,60%)]' : 'text-[hsl(210,40%,65%)]'}`}>
                      sev {i.severity}
                    </span>
                  </div>
                  <div className="text-[hsl(210,30%,55%)] mt-0.5">
                    {i.district} • {Math.max(0, (i.responseByTick ?? i.deadlineTick) - engine.world.time.tick)}t left
                    {i.responseMissed ? <span className="text-[hsl(0,70%,60%)] ml-1">• MISSED</span> : null}
                  </div>
                  <div className="text-[hsl(210,25%,45%)] mt-0.5">{i.tags.join(', ')}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dispatch Panel */}
        <div className={`${panel}`}>
          <h2 className="text-sm font-bold text-[hsl(40,80%,65%)] mb-2">
            Dispatch {phase === 'NIGHT' ? '(Night Ops)' : '(Day — Overtime)'}
          </h2>
          {!selectedIncident ? (
            <p className="text-xs text-[hsl(210,30%,50%)]">Select an incident to dispatch.</p>
          ) : (
            <div className="space-y-2">
              <div className="text-xs">
                <span className="font-semibold">{selectedIncident.kind}</span> in {selectedIncident.district}
                <br />
                <span className="text-[hsl(210,30%,55%)]">
                  Sev {selectedIncident.severity} • ETA {dispatchEtaTicks ?? '—'}t
                  {coverageBonus > 0 ? ` • counters +${coverageBonus}` : ''}
                </span>
              </div>

              {/* Intel */}
              <div className="flex gap-1.5 items-center flex-wrap">
                <select value={selectedIntelTier} onChange={(e) => setSelectedIntelTier(e.target.value as IntelTier)} disabled={!canAct || phase === 'NIGHT'} className="bg-[hsl(220,30%,12%)] border border-[hsl(215,30%,20%)] rounded text-xs p-1 text-[hsl(210,60%,80%)]">
                  <option value="BASIC">Basic Intel</option>
                  <option value="STANDARD">Standard</option>
                  <option value="PREMIUM">Premium</option>
                </select>
                <select onChange={(e) => { if (!e.target.value) return; dispatch(engine, { type: 'BUY_INTEL', incidentId: selectedIncident.id, rogueId: e.target.value, tier: selectedIntelTier }); setViewTick(engine.world.time.tick); e.currentTarget.selectedIndex = 0; }} defaultValue="" disabled={!canAct || phase === 'NIGHT'} className="bg-[hsl(220,30%,12%)] border border-[hsl(215,30%,20%)] rounded text-xs p-1 text-[hsl(210,60%,80%)]">
                  <option value="" disabled>Buy intel via…</option>
                  {rogues.filter((r) => r.status.type === 'AVAILABLE').map((r) => (
                    <option key={r.id} value={r.id}>{r.name} (loy {Math.round(r.loyalty)})</option>
                  ))}
                </select>
              </div>

              {/* Tactic */}
              <div className="flex gap-1.5 items-center">
                <select value={selectedTactic} onChange={(e) => setSelectedTactic(e.target.value as Tactic)} disabled={!canAct} className="bg-[hsl(220,30%,12%)] border border-[hsl(215,30%,20%)] rounded text-xs p-1 text-[hsl(210,60%,80%)]">
                  <option value="STEALTH">Stealth</option>
                  <option value="CONTROL">Control</option>
                  <option value="BRUTE">Brute</option>
                </select>
                {phase === 'DAY' && (
                  <label className="flex items-center gap-1 text-[10px] text-[hsl(210,30%,55%)]">
                    <input type="checkbox" checked={useOvertimeDispatch} onChange={(e) => setUseOvertimeDispatch(e.target.checked)} />
                    Overtime (${engine.defs.rules.overtimeDispatch.costCash})
                  </label>
                )}
              </div>

              {/* Agent Selection */}
              <div className="flex gap-1.5">
                <button onClick={() => {
                  const size = (selectedIncident?.severity ?? 0) >= 7 ? 3 : 2;
                  const candidates = [...activeRoster, ...rogues].filter((a) => a.status.type === 'AVAILABLE').sort((a, b) => b.power - a.power || a.fatigue - b.fatigue);
                  setSelectedAgents(candidates.slice(0, size).map((a) => a.id));
                }} disabled={!canAct} className={btnSecondary}>Auto-pick</button>
                <button onClick={() => setSelectedAgents([])} disabled={!canAct || selectedAgents.length === 0} className={btnSecondary}>Clear</button>
              </div>

              <div className="space-y-1 max-h-[120px] overflow-y-auto">
                {[...activeRoster, ...rogues].filter((a) => a.status.type === 'AVAILABLE').sort((a, b) => b.power - a.power).map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-[hsl(220,30%,12%)] rounded px-1 py-0.5">
                    <input type="checkbox" checked={selectedAgents.includes(a.id)} onChange={() => setSelectedAgents((prev) => prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id])} />
                    <span className={a.morality === 'ROGUE' ? 'text-[hsl(280,50%,65%)]' : ''}>{a.name}</span>
                    <span className="text-[hsl(210,30%,50%)] ml-auto font-mono">pw{a.power} ft{Math.round(a.fatigue)}</span>
                  </label>
                ))}
              </div>

              <button
                onClick={() => {
                  dispatch(engine, { type: 'DISPATCH_TEAM', incidentId: selectedIncident.id, agentIds: selectedAgents, tactic: selectedTactic, overtime: phase === 'DAY' ? useOvertimeDispatch : undefined });
                  setSelectedAgents([]); setUseOvertimeDispatch(false); setViewTick(engine.world.time.tick);
                }}
                disabled={!canAct || selectedAgents.length === 0 || (phase === 'DAY' && (!useOvertimeDispatch || engine.world.company.cash < engine.defs.rules.overtimeDispatch.costCash))}
                className={`${btnPrimary} w-full`}
              >
                Dispatch ({selectedAgents.length} agents)
              </button>
            </div>
          )}
        </div>

        {/* Coverage Panel */}
        <div className={`${panel}`}>
          <h2 className="text-sm font-bold text-[hsl(40,80%,65%)] mb-2">Coverage & Subscriptions</h2>
          <div className="space-y-1.5">
            {engine.defs.subscriptions.districts.map((d) => {
              const sub = engine.world.subscriptions.districts[d];
              return (
                <div key={d} className="bg-[hsl(220,30%,10%)] rounded-lg p-2 border border-[hsl(215,30%,16%)]">
                  <div className="flex justify-between items-center text-xs">
                    <button onClick={() => setSelectedDistrict(d)} className="font-semibold hover:text-[hsl(210,80%,70%)] transition-colors text-left">{d}</button>
                    <span className="font-mono text-[hsl(210,30%,55%)]">{sub.tier} • sat {Math.round(sub.satisfaction)}</span>
                  </div>
                  <div className="flex gap-1 mt-1">
                    {(['NONE', 'BASIC', 'PREMIUM'] as CoverageTier[]).map((tier) => (
                      <button key={tier} onClick={() => { dispatch(engine, { type: 'SET_COVERAGE', district: d, tier }); setViewTick(engine.world.time.tick); }} disabled={!canAct || phase === 'NIGHT' || sub.tier === tier} className={`${sub.tier === tier ? 'bg-[hsl(210,80%,50%)]/20 border-[hsl(210,80%,50%)]/40' : 'bg-[hsl(220,30%,12%)] border-[hsl(215,30%,18%)]'} border rounded px-2 py-0.5 text-[10px] font-semibold disabled:opacity-40`}>
                        {tier}
                      </button>
                    ))}
                    <button onClick={() => { dispatch(engine, { type: 'BUY_EMERGENCY_COVERAGE', district: d }); setViewTick(engine.world.time.tick); }} disabled={!canAct || phase === 'NIGHT' || engine.world.company.cash < engine.defs.subscriptions.emergencyCoverage.costCash || sub.tier === 'PREMIUM'} className={`${btnDanger} text-[10px] px-2 py-0.5`}>
                      EMR
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alignment + Saves + Log */}
        <div className={`${panel}`}>
          <h2 className="text-sm font-bold text-[hsl(40,80%,65%)] mb-2">Controls</h2>
          <div className="flex gap-1.5 mb-2">
            <button onClick={() => { dispatch(engine, { type: 'SET_ALIGNMENT', alignment: 'HERO' }); setViewTick(engine.world.time.tick); }} disabled={!canAct} className={`${engine.world.player.alignment === 'HERO' ? btnPrimary : btnSecondary}`}>HERO</button>
            <button onClick={() => { dispatch(engine, { type: 'SET_ALIGNMENT', alignment: 'VILLAIN' }); setViewTick(engine.world.time.tick); }} disabled={!canAct} className={`${engine.world.player.alignment === 'VILLAIN' ? 'px-3 py-1.5 rounded-lg text-xs font-semibold bg-[hsl(280,60%,40%)] text-white' : btnSecondary}`}>VILLAIN</button>
          </div>

          {/* Recruitment */}
          <div className="mb-2">
            <h3 className="text-[10px] uppercase text-[hsl(210,30%,55%)] font-semibold mb-1">Recruitment ({engine.world.recruitment.candidates.length})</h3>
            <div className="space-y-1">
              {engine.world.recruitment.candidates.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs bg-[hsl(220,30%,10%)] rounded px-2 py-1">
                  <span>{c.name} <span className="text-[hsl(210,30%,50%)]">({c.morality} pw{c.power})</span></span>
                  <button onClick={() => { dispatch(engine, { type: 'RECRUIT', candidateId: c.id }); setViewTick(engine.world.time.tick); }} disabled={!canAct || phase === 'NIGHT'} className={btnSecondary}>Recruit</button>
                </div>
              ))}
            </div>
            <button onClick={() => { dispatch(engine, { type: 'REFRESH_RECRUITMENT' }); setViewTick(engine.world.time.tick); }} disabled={!canAct || phase === 'NIGHT'} className={`${btnSecondary} mt-1 w-full`}>
              Refresh (${engine.defs.recruitment.manualRefresh.costCash})
            </button>
          </div>

          {/* Saves */}
          <h3 className="text-[10px] uppercase text-[hsl(210,30%,55%)] font-semibold mb-1">Saves</h3>
          <div className="space-y-1">
            {SAVE_SLOTS.map((slot, idx) => {
              const s = saveSlots[idx];
              return (
                <div key={slot} className="flex items-center gap-1 text-xs">
                  <button onClick={() => {
                    const save = engine.save();
                    const t = engine.world.time.tick;
                    writeSaveSlot(slot, { savedAt: Date.now(), tick: t, day: getDayNumber(engine.defs.rules.ticksPerDay, t), phase: getPhaseLabel(engine.defs.rules.ticksPerDay, t), alignment: engine.world.player.alignment, cash: engine.world.company.cash, save });
                    setSaveSlots(SAVE_SLOTS.map((s) => readSaveSlot(s)));
                  }} className={btnSecondary}>Save {slot}</button>
                  <button onClick={() => { const data = readSaveSlot(slot); if (!data) return; engine.load(data.save); setViewTick(engine.world.time.tick); setPhaseReport(null); setSaveSlots(SAVE_SLOTS.map((s) => readSaveSlot(s))); }} disabled={!s} className={btnSecondary}>Load</button>
                  <span className="text-[hsl(210,30%,50%)] font-mono">{s ? `D${s.day} ${s.phase} $${Math.round(s.cash)}` : 'empty'}</span>
                </div>
              );
            })}
          </div>

          {/* Log */}
          <h3 className="text-[10px] uppercase text-[hsl(210,30%,55%)] font-semibold mt-2 mb-1">Log</h3>
          <div className="space-y-0.5 max-h-[100px] overflow-y-auto">
            {engine.world.log.slice(-8).reverse().map((e, idx) => (
              <div key={idx} className="font-mono text-[10px] text-[hsl(210,30%,50%)]">{formatEvent(e)}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
