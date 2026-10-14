import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import type { FormulaNode, SceneCalculator } from './schema';

// Pure arithmetic interpreter — NOT eval / new Function. Walks the small
// operation tree the backend validated (add/subtract/multiply/divide of
// named variables and constants only).
export function evalFormula(node: FormulaNode, scope: Record<string, number>): number {
  if ('const' in node) return node.const;
  if ('var' in node) return scope[node.var] ?? 0;
  const l = evalFormula(node.left, scope);
  const r = evalFormula(node.right, scope);
  switch (node.op) {
    case 'add': return l + r;
    case 'subtract': return l - r;
    case 'multiply': return l * r;
    case 'divide': return r === 0 ? 0 : l / r;
  }
}

export function Calculator({ calc }: { calc: SceneCalculator }) {
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(calc.variables.map((v) => [v.name, v.default])));
  const result = evalFormula(calc.formula, values);
  return (
    <div data-testid="panel-visualizer-calculator">
      <div className="rounded-xl bg-muted p-3 text-center font-mono-app text-xs font-bold text-primary">{calc.displayFormula}</div>
      <div className="mt-4 space-y-4">
        {calc.variables.map((v) => (
          <div key={v.name}>
            <div className="flex items-center justify-between text-[11px] font-bold"><span>{v.label}</span><span className="font-mono-app text-muted-foreground">{values[v.name]}{v.unit ? ` ${v.unit}` : ''}</span></div>
            <Slider className="mt-2" min={v.min} max={v.max} step={v.step ?? 1} value={[values[v.name]]} onValueChange={([val]) => setValues((prev) => ({ ...prev, [v.name]: val }))} data-testid={`slider-equation-${v.name}`} />
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-3 text-center">
        <div className="text-[11px] font-bold text-muted-foreground">{calc.resultLabel}</div>
        <div className="mt-0.5 font-display text-2xl" data-testid="text-equation-result">{Number.isFinite(result) ? Math.round(result * 100) / 100 : '—'}{calc.resultUnit ? ` ${calc.resultUnit}` : ''}</div>
      </div>
    </div>
  );
}
