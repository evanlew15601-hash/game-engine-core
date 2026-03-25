import type { Engine } from '../engine';
import type { Defs } from '../game/defs';

export type PhaseReport = {
  title: string;
  fromTick: number;
  toTick: number;
  deltas: {
    cash: number;
    stability: number;
    trust: number;
    favor: number;
    heat: number;
    openIncidents: number;
    slaMisses: number;
  };
  incidents: {
    spawned: number;
    resolved: number;
    failed: number;
    responseMissed: number;
  };
  billing: null | {
    billed: number;
    refunds: number;
    operatingCost: number;
    net: number;
    chargebacks: number;
  };
  forecast: {
    misses: number;
    refunds: number;
    chargebackRisk: number;
    affects: 'PUBLIC_TRUST' | 'UNDERWORLD_FAVOR';
    reputationPenalty: number;
    heatGain: number;
  };
  demand: {
    topChanges: Array<{ district: string; demandBefore: number; demandAfter: number; satisfaction: number }>;
  };
  churn: {
    events: Array<{ district: string; fromTier: string; toTier: string; satisfaction: number }>;
  };
  intel: {
    purchases: number;
    totalTravelBonusTicks: number;
    totalSeverityDelta: number;
    totalDeadlineDelta: number;
  };
  events: Array<Engine<Defs>['world']['log'][number]>;
};

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[hsl(220,30%,10%)] rounded-lg px-3 py-2 min-w-[80px]">
      <div className="text-[hsl(210,30%,55%)] text-[10px] uppercase tracking-wider font-semibold">{label}</div>
      <div className="text-[hsl(210,60%,90%)] text-sm font-bold font-mono">{value}</div>
    </div>
  );
}

export function PhaseReportModalView(props: {
  report: PhaseReport;
  onClose: () => void;
  formatEvent: (e: PhaseReport['events'][number]) => string;
}) {
  const { report } = props;

  const counts = report.events.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50">
      <div className="w-full max-w-[960px] bg-[hsl(220,40%,8%)] rounded-xl border border-[hsl(215,40%,20%)] p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center gap-3">
          <h2 className="text-[hsl(210,60%,90%)] font-bold text-lg m-0">{report.title}</h2>
          <button
            onClick={props.onClose}
            className="px-4 py-1.5 bg-[hsl(210,80%,50%)] text-white rounded-lg font-semibold text-sm hover:bg-[hsl(210,80%,60%)] transition-colors"
          >
            Continue
          </button>
        </div>

        <div className="mt-3 flex gap-2 flex-wrap">
          <StatBox label="Cash Δ" value={formatSignedMoney(report.deltas.cash)} />
          <StatBox label="Stability Δ" value={formatSigned(report.deltas.stability)} />
          <StatBox label="Trust Δ" value={formatSigned(report.deltas.trust)} />
          <StatBox label="Favor Δ" value={formatSigned(report.deltas.favor)} />
          <StatBox label="Heat Δ" value={formatSigned(report.deltas.heat)} />
          <StatBox label="Incidents Δ" value={formatSigned(report.deltas.openIncidents)} />
          <StatBox label="SLA misses Δ" value={formatSigned(report.deltas.slaMisses)} />
        </div>

        <div className="mt-3 text-xs text-[hsl(210,30%,55%)] font-mono">
          Window: ticks {report.fromTick} → {report.toTick}
        </div>

        {/* Incidents */}
        <div className="mt-3 bg-[hsl(220,30%,10%)] rounded-lg p-3 border border-[hsl(215,30%,16%)]">
          <h3 className="text-[hsl(210,60%,80%)] font-bold text-sm m-0 mb-2">Incidents</h3>
          <div className="flex gap-2 flex-wrap">
            <StatBox label="Spawned" value={String(report.incidents.spawned)} />
            <StatBox label="Resolved" value={String(report.incidents.resolved)} />
            <StatBox label="Failed" value={String(report.incidents.failed)} />
            <StatBox label="Missed" value={String(report.incidents.responseMissed)} />
          </div>
        </div>

        {/* Billing */}
        {report.billing ? (
          <div className="mt-3 bg-[hsl(220,30%,10%)] rounded-lg p-3 border border-[hsl(215,30%,16%)]">
            <h3 className="text-[hsl(210,60%,80%)] font-bold text-sm m-0 mb-2">Billing</h3>
            <div className="flex gap-2 flex-wrap">
              <StatBox label="Billed" value={formatMoney(report.billing.billed)} />
              <StatBox label="Refunds" value={formatMoney(report.billing.refunds)} />
              <StatBox label="Op Cost" value={formatMoney(report.billing.operatingCost)} />
              <StatBox label="Net" value={formatMoney(report.billing.net)} />
              <StatBox label="Chargebacks" value={String(report.billing.chargebacks)} />
            </div>
          </div>
        ) : null}

        {/* Forecast */}
        <div className="mt-3 bg-[hsl(220,30%,10%)] rounded-lg p-3 border border-[hsl(215,30%,16%)]">
          <h3 className="text-[hsl(210,60%,80%)] font-bold text-sm m-0 mb-2">Next Billing Forecast</h3>
          <div className="flex gap-2 flex-wrap">
            <StatBox label="SLA misses" value={String(report.forecast.misses)} />
            <StatBox label="Refunds" value={formatMoney(report.forecast.refunds)} />
            <StatBox label="CB risk" value={String(report.forecast.chargebackRisk)} />
            <StatBox label="Heat" value={'+' + String(report.forecast.heatGain)} />
          </div>
        </div>

        {/* Demand + Churn */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="bg-[hsl(220,30%,10%)] rounded-lg p-3 border border-[hsl(215,30%,16%)]">
            <h3 className="text-[hsl(210,60%,80%)] font-bold text-sm m-0 mb-2">Demand Changes</h3>
            {report.demand.topChanges.length === 0 ? (
              <p className="text-xs text-[hsl(210,30%,55%)]">(no changes)</p>
            ) : (
              <ul className="list-none p-0 m-0 space-y-1">
                {report.demand.topChanges.map((d) => (
                  <li key={d.district} className="font-mono text-xs text-[hsl(210,40%,75%)]">
                    {d.district}: {d.demandBefore.toFixed(2)} → {d.demandAfter.toFixed(2)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-[hsl(220,30%,10%)] rounded-lg p-3 border border-[hsl(215,30%,16%)]">
            <h3 className="text-[hsl(210,60%,80%)] font-bold text-sm m-0 mb-2">Churn</h3>
            {report.churn.events.length === 0 ? (
              <p className="text-xs text-[hsl(210,30%,55%)]">(none)</p>
            ) : (
              <ul className="list-none p-0 m-0 space-y-1">
                {report.churn.events.map((e, idx) => (
                  <li key={idx} className="font-mono text-xs text-[hsl(210,40%,75%)]">
                    {e.district}: {e.fromTier} → {e.toTier}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Event log */}
        <div className="mt-3 bg-[hsl(220,30%,10%)] rounded-lg p-3 border border-[hsl(215,30%,16%)]">
          <h3 className="text-[hsl(210,60%,80%)] font-bold text-sm m-0 mb-2">
            Event Log ({report.events.length})
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <h4 className="text-xs text-[hsl(210,30%,55%)] mb-1 font-semibold">Counts</h4>
              <ul className="list-none p-0 m-0 space-y-0.5">
                {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                  <li key={k} className="font-mono text-[11px] text-[hsl(210,40%,70%)]">{k}: {v}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs text-[hsl(210,30%,55%)] mb-1 font-semibold">Latest</h4>
              <ul className="list-none p-0 m-0 space-y-0.5">
                {report.events.slice(-10).reverse().map((e, idx) => (
                  <li key={idx} className="font-mono text-[11px] text-[hsl(210,40%,70%)]">
                    {props.formatEvent(e)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatSigned(n: number) {
  const r = Math.round(n * 10) / 10;
  return (r >= 0 ? '+' : '') + String(r);
}

function formatSignedMoney(n: number) {
  const r = Math.round(n);
  return (r >= 0 ? '+' : '-') + '$' + String(Math.abs(r));
}

function formatMoney(n: number) {
  return '$' + String(Math.round(n));
}
