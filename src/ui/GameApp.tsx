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
  try { return JSON.parse(raw) as SaveSlot; } catch { return null; }
}
function writeSaveSlot(slot: number, data: SaveSlot) {
  localStorage.setItem(`dispatchsim.save.${slot}`, JSON.stringify(data));
}

function getDayNumber(ticksPerDay: number, t: number) { return Math.floor(t / ticksPerDay) + 1; }
function getPhaseLabel(ticksPerDay: number, t: number): 'DAY' | 'NIGHT' {
  return (t - Math.floor(t / ticksPerDay) * ticksPerDay) < Math.floor(ticksPerDay / 2) ? 'DAY' : 'NIGHT';
}
function getNextPhaseLabel(ticksPerDay: number, t: number) {
  return getPhaseLabel(ticksPerDay, t) === 'DAY' ? 'NIGHT' : 'DAY';
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

// Shared style constants
const btn = "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
const btnPrimary = `${btn} bg-primary text-primary-foreground hover:bg-primary/80`;
const btnSecondary = `${btn} bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80`;
const btnDanger = `${btn} bg-destructive text-destructive-foreground hover:bg-destructive/80`;
const panel = "bg-card rounded-xl border border-border p-3";
const labelText = "text-muted-foreground text-[10px] uppercase tracking-wider font-semibold";
const selectClass = "bg-muted border border-input rounded text-xs p-1 text-secondary-foreground";

export function GameApp(props: { onReturnToTitle?: () => void }) {
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

  // Billing forecast
  const billingForecast = useMemo(() => {
    const entries = engine.defs.subscriptions.districts
      .map((district) => {
        const sub = engine.world.subscriptions.districts[district];
        const tier = engine.defs.subscriptions.tiers[sub.tier];
        const misses = sub.slaMissesThisPeriod;
        const refund = misses * tier.refundPerMiss;
        return { district, misses, refund };
      })
      .filter((x) => x.misses > 0)
      .sort((a, b) => b.refund - a.refund);
    const misses = entries.reduce((sum, x) => sum + x.misses, 0);
    const refunds = entries.reduce((sum, x) => sum + x.refund, 0);
    const chargebackRisk = entries.filter((x) => x.refund >= engine.defs.subscriptions.chargebackRefundThreshold).length;
    return { entries, misses, refunds, chargebackRisk };
  }, [engine.defs.subscriptions, engine.world.subscriptions.districts]);

  // Demand forecast
  const demandForecast = useMemo(() => {
    return engine.defs.subscriptions.districts
      .map((district) => {
        const sub = engine.world.subscriptions.districts[district];
        return { district, demand: sub.demand ?? 1, satisfaction: sub.satisfaction };
      })
      .sort((a, b) => b.demand - a.demand);
  }, [engine.defs.subscriptions.districts, engine.world.subscriptions.districts]);

  // District detail
  const districtForPanel = selectedDistrict || selectedIncident?.district || '';
  const selectedDistrictState = districtForPanel ? engine.world.subscriptions.districts[districtForPanel] : undefined;
  const selectedDistrictTier = selectedDistrictState ? engine.defs.subscriptions.tiers[selectedDistrictState.tier] : undefined;

  const advancePhase = () => {
    const ticksPerDay = engine.defs.rules.ticksPerDay;
    const fromTick = engine.world.time.tick;
    const toTick = getNextBoundaryTick(ticksPerDay, fromTick);

    const before = snapshotForReport(engine);
    const beforeLogLen = engine.world.log.length;
    const beforeSlaMisses = engine.defs.subscriptions.districts.reduce(
      (sum, d) => sum + (engine.world.subscriptions.districts[d]?.slaMissesThisPeriod ?? 0), 0,
    );

    tick(engine, toTick - fromTick);
    setViewTick(engine.world.time.tick);

    const after = snapshotForReport(engine);
    const events = engine.world.log.slice(beforeLogLen);

    const billingHappened = events.some((e) => e.type === 'BILLED_SUBSCRIPTIONS' || e.type === 'OPERATING_COST');
    const billing = billingHappened ? { ...engine.world.subscriptions.lastTotals } : null;

    const afterSlaMisses = engine.defs.subscriptions.districts.reduce(
      (sum, d) => sum + (engine.world.subscriptions.districts[d]?.slaMissesThisPeriod ?? 0), 0,
    );

    const forecastEntries = engine.defs.subscriptions.districts
      .map((district) => {
        const sub = engine.world.subscriptions.districts[district];
        const tier = engine.defs.subscriptions.tiers[sub.tier];
        return { district, misses: sub.slaMissesThisPeriod, refund: sub.slaMissesThisPeriod * tier.refundPerMiss };
      })
      .filter((x) => x.misses > 0).sort((a, b) => b.refund - a.refund);
    const fMisses = forecastEntries.reduce((sum, x) => sum + x.misses, 0);
    const fRefunds = forecastEntries.reduce((sum, x) => sum + x.refund, 0);
    const fCBRisk = forecastEntries.filter((x) => x.refund >= engine.defs.subscriptions.chargebackRefundThreshold).length;

    const intelEvents = events.filter((e) => e.type === 'INTEL_BOUGHT');
    const intelTotals = intelEvents.reduce(
      (acc, e) => {
        if (e.type !== 'INTEL_BOUGHT') return acc;
        acc.purchases += 1; acc.totalTravelBonusTicks += e.travelBonusTicks;
        acc.totalSeverityDelta += e.severityDelta; acc.totalDeadlineDelta += e.deadlineDelta;
        return acc;
      },
      { purchases: 0, totalTravelBonusTicks: 0, totalSeverityDelta: 0, totalDeadlineDelta: 0 },
    );

    setPhaseReport({
      title: `Day ${getDayNumber(ticksPerDay, fromTick)} ${getPhaseLabel(ticksPerDay, fromTick)} → ${getPhaseLabel(ticksPerDay, toTick)}`,
      fromTick, toTick,
      deltas: {
        cash: after.cash - before.cash, stability: after.stability - before.stability,
        trust: after.trust - before.trust, favor: after.favor - before.favor,
        heat: after.heat - before.heat, openIncidents: after.openIncidents - before.openIncidents,
        slaMisses: afterSlaMisses - beforeSlaMisses,
      },
      incidents: {
        spawned: events.filter((e) => e.type === 'INCIDENT_SPAWNED').length,
        resolved: events.filter((e) => e.type === 'MISSION_RESOLVED').length,
        failed: events.filter((e) => e.type === 'INCIDENT_FAILED').length,
        responseMissed: events.filter((e) => e.type === 'INCIDENT_RESPONSE_MISSED').length,
      },
      billing,
      forecast: {
        misses: fMisses, refunds: fRefunds, chargebackRisk: fCBRisk,
        affects: engine.world.player.alignment === 'HERO' ? 'PUBLIC_TRUST' : 'UNDERWORLD_FAVOR',
        reputationPenalty: fCBRisk * engine.defs.subscriptions.reputationPenaltyPerChargeback,
        heatGain: fCBRisk * engine.defs.subscriptions.heatGainOnChargeback,
      },
      demand: {
        topChanges: engine.defs.subscriptions.districts.map((d) => ({
          district: d, demandBefore: before.districts[d]?.demand ?? 1,
          demandAfter: after.districts[d]?.demand ?? 1, satisfaction: after.districts[d]?.satisfaction ?? 50,
        })).filter((x) => Math.abs(x.demandAfter - x.demandBefore) > 0.001).slice(0, 5),
      },
      churn: {
        events: engine.defs.subscriptions.districts.map((d) => {
          const b = before.districts[d]; const a = after.districts[d];
          if (!b || !a || b.tier === a.tier) return null;
          return { district: d, fromTier: b.tier, toTier: a.tier, satisfaction: a.satisfaction };
        }).filter((x): x is NonNullable<typeof x> => Boolean(x)),
      },
      intel: intelTotals,
      events,
    });
  };

  const focusDistrictIncident = (d: string) => {
    const inc = openIncidents
      .slice().sort((a, b) => (a.responseByTick ?? a.deadlineTick) - (b.responseByTick ?? b.deadlineTick))
      .find((i) => i.district === d);
    if (inc) { setSelectedIncidentId(inc.id); setSelectedDistrict(d); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-mono">
      {phaseReport && (
        <PhaseReportModalView report={phaseReport} onClose={() => setPhaseReport(null)} formatEvent={formatEvent} />
      )}

      {/* ─── Header ─── */}
      <div className="border-b border-border px-4 py-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-base font-bold tracking-wide text-accent">DISPATCH SIM</h1>
          <span className="text-xs font-mono text-muted-foreground">Day {dayNum} • {phase}</span>
          <span className="text-xs font-mono text-muted-foreground">Tick {engine.world.time.tick}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${engine.world.player.alignment === 'HERO' ? 'bg-primary/20 text-primary' : 'bg-[hsl(280,60%,40%)]/20 text-[hsl(280,60%,70%)]'}`}>
            {engine.world.player.alignment}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={advancePhase} disabled={!canAct} className={btnPrimary}>
            Advance → {getNextPhaseLabel(engine.defs.rules.ticksPerDay, engine.world.time.tick)}
          </button>
          <button onClick={() => setResetKey((n) => n + 1)} className={btnDanger}>Reset</button>
          {props.onReturnToTitle && (
            <button onClick={props.onReturnToTitle} className={btnSecondary}>Menu</button>
          )}
        </div>
      </div>

      {/* ─── Game Over Banner ─── */}
      {engine.world.game.state !== 'RUNNING' && (
        <div className={`mx-4 mt-3 p-3 rounded-lg text-center font-bold ${engine.world.game.state === 'WON' ? 'bg-[hsl(140,60%,20%)]/30 text-[hsl(140,60%,70%)] border border-[hsl(140,40%,30%)]' : 'bg-destructive/30 text-[hsl(0,60%,70%)] border border-[hsl(0,40%,30%)]'}`}>
          {engine.world.game.state}: {engine.world.game.reason}
        </div>
      )}

      {/* ─── Stats Bar ─── */}
      <div className="px-4 py-2 flex gap-2 flex-wrap border-b border-border/60">
        {[
          ['Cash', `$${Math.round(engine.world.company.cash)}`],
          ['Stability', String(Math.round(engine.world.city.stability))],
          ['Trust', String(Math.round(engine.world.city.publicTrust))],
          ['Favor', String(Math.round(engine.world.city.underworldFavor))],
          ['Heat', String(Math.round(engine.world.city.heat))],
          ['Open', String(openIncidents.length)],
          ['Missions', String(engine.world.missions.length)],
        ].map(([label, value]) => (
          <div key={label} className="bg-muted rounded-lg px-2.5 py-1 min-w-[70px]">
            <div className={labelText}>{label}</div>
            <div className="text-sm font-bold font-mono">{value}</div>
          </div>
        ))}
        {/* Billing forecast mini */}
        <div className="bg-muted rounded-lg px-2.5 py-1 min-w-[120px] ml-auto">
          <div className={labelText}>Next billing</div>
          <div className="text-sm font-mono">
            <span className="text-foreground font-bold">{Math.max(0, engine.world.subscriptions.nextBillingTick - engine.world.time.tick)}t</span>
            {billingForecast.refunds > 0 && (
              <span className="text-destructive ml-1.5 text-[11px]">-${Math.round(billingForecast.refunds)}</span>
            )}
            {billingForecast.chargebackRisk > 0 && (
              <span className="text-[hsl(35,80%,60%)] ml-1 text-[10px]">⚠ CB</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Main Grid ─── */}
      <div className="p-3 grid grid-cols-1 lg:grid-cols-3 gap-3">

        {/* ─── LEFT COL: Map + Incidents ─── */}
        <div className="lg:col-span-2 space-y-3">
          {/* HoloMap */}
          <HoloMap
            title="Magnate City — Tactical Overview"
            districts={engine.defs.subscriptions.districts}
            coverageByDistrict={coverageByDistrict}
            incidents={holoMapIncidents}
            etaByDistrict={etaByDistrict}
            selectedDistrict={selectedDistrict || selectedIncident?.district || null}
            onSelectDistrict={(d) => { setSelectedDistrict(d); focusDistrictIncident(d); }}
          />

          {/* Demand hot zones */}
          <div className={`${panel} flex items-center gap-2 flex-wrap`}>
            <span className={labelText}>Hot zones:</span>
            {demandForecast.slice(0, 4).map((x) => (
              <button key={x.district} onClick={() => focusDistrictIncident(x.district)}
                disabled={!canAct || openIncidents.every((i) => i.district !== x.district)}
                className={`${btnSecondary} text-[10px]`}>
                {x.district} ({x.demand.toFixed(2)}×)
              </button>
            ))}
            {billingForecast.chargebackRisk > 0 && (
              <span className="text-[hsl(35,80%,60%)] text-[10px] font-semibold ml-auto">
                ⚠ {billingForecast.chargebackRisk} chargeback-risk district{billingForecast.chargebackRisk > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Incidents Panel */}
          <div className={`${panel} overflow-y-auto max-h-[420px]`}>
            <h2 className="text-sm font-bold text-accent mb-2">Incidents ({openIncidents.length})</h2>
            {openIncidents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No open incidents.</p>
            ) : (
              <div className="space-y-1.5">
                {openIncidents.sort((a, b) => (a.responseByTick ?? a.deadlineTick) - (b.responseByTick ?? b.deadlineTick)).map((i) => (
                  <button
                    key={i.id}
                    onClick={() => { setSelectedIncidentId(i.id); setSelectedDistrict(i.district); }}
                    className={`w-full text-left p-2 rounded-lg border text-xs transition-colors cursor-pointer ${i.id === selectedIncidentId ? 'bg-primary/10 border-primary/40' : 'bg-muted border-border hover:bg-muted/80'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{i.kind}</span>
                      <span className={`font-mono ${i.severity >= 7 ? 'text-destructive' : i.severity >= 4 ? 'text-[hsl(35,80%,60%)]' : 'text-muted-foreground'}`}>
                        sev {i.severity}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      {i.district} • {Math.max(0, (i.responseByTick ?? i.deadlineTick) - engine.world.time.tick)}t left
                      {i.responseMissed ? <span className="text-destructive ml-1">• MISSED</span> : null}
                    </div>
                    <div className="text-muted-foreground/70 mt-0.5">
                      tags: {i.tags.join(', ')}
                      {i.intelTravelBonusTicks > 0 ? ` • intel travel -${i.intelTravelBonusTicks}` : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT COL: Dispatch + Coverage + Controls ─── */}
        <div className="space-y-3">

          {/* ─── Dispatch Panel ─── */}
          <div className={panel}>
            <h2 className="text-sm font-bold text-accent mb-2">
              Dispatch {phase === 'NIGHT' ? '(Night Ops)' : '(Day — Overtime required)'}
            </h2>
            {!selectedIncident ? (
              <p className="text-xs text-muted-foreground">Select an incident to dispatch.</p>
            ) : (
              <div className="space-y-2">
                <div className="text-xs">
                  <span className="font-semibold">{selectedIncident.kind}</span> in {selectedIncident.district}
                  <br />
                  <span className="text-muted-foreground">
                    Sev {selectedIncident.severity} • ETA {dispatchEtaTicks ?? '—'}t
                    {coverageBonus > 0 ? ` • counters +${coverageBonus}` : ''}
                  </span>
                </div>

                {/* Intel */}
                <div className="flex gap-1.5 items-center flex-wrap">
                  <select value={selectedIntelTier} onChange={(e) => setSelectedIntelTier(e.target.value as IntelTier)} disabled={!canAct || phase === 'NIGHT'} className={selectClass}>
                    <option value="BASIC">Basic Intel</option>
                    <option value="STANDARD">Standard</option>
                    <option value="PREMIUM">Premium</option>
                  </select>
                  <select onChange={(e) => { if (!e.target.value) return; dispatch(engine, { type: 'BUY_INTEL', incidentId: selectedIncident.id, rogueId: e.target.value, tier: selectedIntelTier }); setViewTick(engine.world.time.tick); e.currentTarget.selectedIndex = 0; }} defaultValue="" disabled={!canAct || phase === 'NIGHT'} className={selectClass}>
                    <option value="" disabled>Buy intel via…</option>
                    {rogues.filter((r) => r.status.type === 'AVAILABLE').map((r) => (
                      <option key={r.id} value={r.id}>{r.name} (loy {Math.round(r.loyalty)})</option>
                    ))}
                  </select>
                </div>

                {/* Tactic */}
                <div className="flex gap-1.5 items-center flex-wrap">
                  <select value={selectedTactic} onChange={(e) => setSelectedTactic(e.target.value as Tactic)} disabled={!canAct} className={selectClass}>
                    <option value="STEALTH">Stealth</option>
                    <option value="CONTROL">Control</option>
                    <option value="BRUTE">Brute</option>
                  </select>
                  <button onClick={() => {
                    if (!selectedIncident) return;
                    const sev = selectedIncident.severity;
                    if (sev >= 7) setSelectedTactic('BRUTE');
                    else if (sev >= 4) setSelectedTactic('CONTROL');
                    else setSelectedTactic('STEALTH');
                  }} disabled={!canAct} className={`${btnSecondary} text-[10px]`}>Auto-tactic</button>
                  {phase === 'DAY' && (
                    <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={useOvertimeDispatch} onChange={(e) => setUseOvertimeDispatch(e.target.checked)} />
                      Overtime (${engine.defs.rules.overtimeDispatch.costCash}, heat +{engine.defs.rules.overtimeDispatch.heatGain})
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
                  <span className="text-[10px] text-muted-foreground self-center">Picks {(selectedIncident?.severity ?? 0) >= 7 ? 3 : 2}</span>
                </div>

                <div className="space-y-1 max-h-[140px] overflow-y-auto">
                  {[...activeRoster, ...rogues].filter((a) => a.status.type === 'AVAILABLE').sort((a, b) => b.power - a.power).map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted rounded px-1 py-0.5">
                      <input type="checkbox" checked={selectedAgents.includes(a.id)} onChange={() => setSelectedAgents((prev) => prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id])} />
                      <span className={a.morality === 'ROGUE' ? 'text-[hsl(280,50%,65%)]' : ''}>{a.name} <span className="text-muted-foreground">({a.morality})</span></span>
                      <span className="text-muted-foreground ml-auto font-mono">pw{a.power} ft{Math.round(a.fatigue)}</span>
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

          {/* ─── Coverage Panel ─── */}
          <div className={panel}>
            <h2 className="text-sm font-bold text-accent mb-2">
              Coverage {phase === 'DAY' ? '(Day planning)' : '(Locked at night)'}
            </h2>

            {/* District detail */}
            {districtForPanel && selectedDistrictState && selectedDistrictTier && (
              <div className="bg-muted rounded-lg p-2.5 border border-border mb-2">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-bold">{districtForPanel}</span>
                  <button onClick={() => setSelectedDistrict('')} className="text-muted-foreground hover:text-foreground text-[10px] cursor-pointer">✕ clear</button>
                </div>
                <div className="text-[10px] text-muted-foreground space-y-0.5">
                  <div>Tier: {selectedDistrictState.tier} • Sat: {Math.round(selectedDistrictState.satisfaction)} • Demand: {(selectedDistrictState.demand ?? 1).toFixed(2)}×</div>
                  <div>SLA misses: {selectedDistrictState.slaMissesThisPeriod} • Fee: ${selectedDistrictTier.dailyFee}</div>
                  {selectedDistrictState.tier !== 'NONE' && selectedDistrictState.satisfaction <= engine.defs.subscriptions.churn.cancelThreshold + 3 && (
                    <div className="text-destructive font-semibold">⚠ Cancel risk</div>
                  )}
                  {selectedDistrictState.tier !== 'NONE' && selectedDistrictState.satisfaction > engine.defs.subscriptions.churn.cancelThreshold + 3 && selectedDistrictState.satisfaction <= engine.defs.subscriptions.churn.downgradeThreshold + 5 && (
                    <div className="text-[hsl(35,80%,60%)] font-semibold">⚠ Downgrade risk</div>
                  )}
                </div>
                <div className="flex gap-1 mt-1.5">
                  {(['NONE', 'BASIC', 'PREMIUM'] as CoverageTier[]).map((tier) => (
                    <button key={tier} onClick={() => { dispatch(engine, { type: 'SET_COVERAGE', district: districtForPanel, tier }); setViewTick(engine.world.time.tick); }} disabled={!canAct || phase === 'NIGHT' || selectedDistrictState.tier === tier}
                      className={`${selectedDistrictState.tier === tier ? 'bg-primary/20 border-primary/40' : 'bg-muted border-border'} border rounded px-2 py-0.5 text-[10px] font-semibold disabled:opacity-40 cursor-pointer`}>
                      {tier}
                    </button>
                  ))}
                  <button onClick={() => { dispatch(engine, { type: 'BUY_EMERGENCY_COVERAGE', district: districtForPanel }); setViewTick(engine.world.time.tick); }}
                    disabled={!canAct || phase === 'NIGHT' || engine.world.company.cash < engine.defs.subscriptions.emergencyCoverage.costCash || selectedDistrictState.tier === 'PREMIUM'}
                    className={`${btnDanger} text-[10px] px-2 py-0.5`}>
                    {selectedDistrictState.emergency ? 'Extend EMR' : 'EMR'} (${engine.defs.subscriptions.emergencyCoverage.costCash})
                  </button>
                </div>
                {selectedDistrictState.emergency && (
                  <div className="text-[10px] text-[hsl(35,80%,60%)] mt-1">Emergency active until tick {selectedDistrictState.emergency.expiresTick}</div>
                )}
                <button onClick={() => focusDistrictIncident(districtForPanel)}
                  disabled={!canAct || openIncidents.every((i) => i.district !== districtForPanel)}
                  className={`${btnSecondary} text-[10px] mt-1.5 w-full`}>Focus incident</button>
              </div>
            )}

            {/* Quick chargeback actions */}
            {phase === 'DAY' && billingForecast.entries.filter((x) => x.refund >= engine.defs.subscriptions.chargebackRefundThreshold).length > 0 && (
              <div className="flex gap-1 flex-wrap mb-2">
                <span className="text-[10px] text-[hsl(35,80%,60%)] font-semibold self-center">Quick:</span>
                {billingForecast.entries.filter((x) => x.refund >= engine.defs.subscriptions.chargebackRefundThreshold).slice(0, 2).map((x) => (
                  <button key={x.district} onClick={() => { dispatch(engine, { type: 'BUY_EMERGENCY_COVERAGE', district: x.district }); setViewTick(engine.world.time.tick); }}
                    disabled={!canAct || engine.world.company.cash < engine.defs.subscriptions.emergencyCoverage.costCash}
                    className={`${btnDanger} text-[10px] px-2 py-0.5`}>
                    EMR → {x.district}
                  </button>
                ))}
              </div>
            )}

            {/* District list */}
            <div className="space-y-1.5">
              {engine.defs.subscriptions.districts
                .slice().sort((a, b) => (billingForecast.entries.find((x) => x.district === b)?.refund ?? 0) - (billingForecast.entries.find((x) => x.district === a)?.refund ?? 0))
                .map((d) => {
                const sub = engine.world.subscriptions.districts[d];
                const entry = billingForecast.entries.find((x) => x.district === d);
                const isChargeback = (entry?.refund ?? 0) >= engine.defs.subscriptions.chargebackRefundThreshold;
                return (
                  <div key={d} className={`rounded-lg p-2 border text-xs ${isChargeback ? 'bg-[hsl(35,80%,60%)]/5 border-[hsl(35,80%,60%)]/30' : 'bg-muted border-border'}`}>
                    <div className="flex justify-between items-center">
                      <button onClick={() => setSelectedDistrict(d)} className="font-semibold hover:text-primary transition-colors text-left cursor-pointer">
                        {d}
                        {entry && entry.refund > 0 && (
                          <span className={`ml-1.5 text-[10px] ${isChargeback ? 'text-destructive' : 'text-[hsl(35,80%,60%)]'}`}>
                            {isChargeback ? 'CB RISK ' : ''}-${Math.round(entry.refund)}
                          </span>
                        )}
                      </button>
                      <span className="font-mono text-muted-foreground">{sub.tier} • sat {Math.round(sub.satisfaction)}</span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      {(['NONE', 'BASIC', 'PREMIUM'] as CoverageTier[]).map((tier) => (
                        <button key={tier} onClick={() => { dispatch(engine, { type: 'SET_COVERAGE', district: d, tier }); setViewTick(engine.world.time.tick); }} disabled={!canAct || phase === 'NIGHT' || sub.tier === tier} className={`${sub.tier === tier ? 'bg-primary/20 border-primary/40' : 'bg-muted border-border'} border rounded px-2 py-0.5 text-[10px] font-semibold disabled:opacity-40 cursor-pointer`}>
                          {tier}
                        </button>
                      ))}
                      <button onClick={() => { dispatch(engine, { type: 'BUY_EMERGENCY_COVERAGE', district: d }); setViewTick(engine.world.time.tick); }} disabled={!canAct || phase === 'NIGHT' || engine.world.company.cash < engine.defs.subscriptions.emergencyCoverage.costCash || sub.tier === 'PREMIUM' || (sub.tier === engine.defs.subscriptions.emergencyCoverage.tier && !sub.emergency)}
                        className={`${btnDanger} text-[10px] px-2 py-0.5`}>
                        EMR
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ─── Controls Panel ─── */}
          <div className={panel}>
            <h2 className="text-sm font-bold text-accent mb-2">Controls</h2>

            {/* Alignment */}
            <div className="flex gap-1.5 mb-2">
              <button onClick={() => { dispatch(engine, { type: 'SET_ALIGNMENT', alignment: 'HERO' }); setViewTick(engine.world.time.tick); }} disabled={!canAct} className={engine.world.player.alignment === 'HERO' ? btnPrimary : btnSecondary}>HERO</button>
              <button onClick={() => { dispatch(engine, { type: 'SET_ALIGNMENT', alignment: 'VILLAIN' }); setViewTick(engine.world.time.tick); }} disabled={!canAct} className={engine.world.player.alignment === 'VILLAIN' ? `${btn} bg-[hsl(280,60%,40%)] text-white` : btnSecondary}>VILLAIN</button>
            </div>

            {/* Recruitment */}
            <div className="mb-2">
              <h3 className={`${labelText} mb-1`}>Recruitment ({engine.world.recruitment.candidates.length})</h3>
              <div className="space-y-1">
                {engine.world.recruitment.candidates.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1">
                    <span>{c.name} <span className="text-muted-foreground">({c.morality} pw{c.power})</span></span>
                    <button onClick={() => { dispatch(engine, { type: 'RECRUIT', candidateId: c.id }); setViewTick(engine.world.time.tick); }} disabled={!canAct || phase === 'NIGHT'} className={btnSecondary}>Recruit</button>
                  </div>
                ))}
                {engine.world.recruitment.candidates.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">No candidates available.</p>
                )}
              </div>
              <button onClick={() => { dispatch(engine, { type: 'REFRESH_RECRUITMENT' }); setViewTick(engine.world.time.tick); }} disabled={!canAct || phase === 'NIGHT'} className={`${btnSecondary} mt-1 w-full`}>
                Refresh (${engine.defs.recruitment.manualRefresh.costCash})
              </button>
            </div>

            {/* Saves */}
            <h3 className={`${labelText} mb-1`}>Saves</h3>
            <div className="space-y-1">
              {SAVE_SLOTS.map((slot, idx) => {
                const s = saveSlots[idx];
                return (
                  <div key={slot} className="flex items-center gap-1 text-xs">
                    <button onClick={() => {
                      if (s && !window.confirm(`Overwrite save ${slot}? (D${s.day} ${s.phase})`)) return;
                      const save = engine.save();
                      const t = engine.world.time.tick;
                      writeSaveSlot(slot, { savedAt: Date.now(), tick: t, day: getDayNumber(engine.defs.rules.ticksPerDay, t), phase: getPhaseLabel(engine.defs.rules.ticksPerDay, t), alignment: engine.world.player.alignment, cash: engine.world.company.cash, save });
                      setSaveSlots(SAVE_SLOTS.map((s) => readSaveSlot(s)));
                    }} className={btnSecondary}>Save {slot}</button>
                    <button onClick={() => {
                      const data = readSaveSlot(slot); if (!data) return;
                      engine.load(data.save); setViewTick(engine.world.time.tick);
                      setSelectedIncidentId(''); setSelectedAgents([]); setUseOvertimeDispatch(false);
                      setPhaseReport(null); setSaveSlots(SAVE_SLOTS.map((s) => readSaveSlot(s)));
                    }} disabled={!s} className={btnSecondary}>Load</button>
                    <button onClick={() => {
                      if (!s) return;
                      if (!window.confirm(`Delete save ${slot}?`)) return;
                      localStorage.removeItem(`dispatchsim.save.${slot}`);
                      setSaveSlots(SAVE_SLOTS.map((s) => readSaveSlot(s)));
                    }} disabled={!s} className={`${btnSecondary} text-destructive`}>✕</button>
                    <span className="text-muted-foreground font-mono">{s ? `D${s.day} ${s.phase} $${Math.round(s.cash)}` : 'empty'}</span>
                  </div>
                );
              })}
            </div>

            {/* Log */}
            <h3 className={`${labelText} mt-2 mb-1`}>Log</h3>
            <div className="space-y-0.5 max-h-[100px] overflow-y-auto">
              {engine.world.log.slice(-10).reverse().map((e, idx) => (
                <div key={idx} className="font-mono text-[10px] text-muted-foreground">{formatEvent(e)}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Footer ─── */}
      <div className="px-4 py-2 border-t border-border/40 text-[10px] text-muted-foreground/60 text-center">
        Day = plan (subscriptions, intel, coverage). Night = execute (dispatch). Missed SLAs → refunds → chargebacks → reputation loss.
      </div>
    </div>
  );
}
