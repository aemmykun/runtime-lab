import type { Trace } from '@runtime-lab/core';
import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';

/** Builds the agent/tool graph: prompt → model turns → tool calls → … → output. */
export function buildGraph(trace: Trace): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const style = (color: string) => ({ background: '#0f172a', color: '#e2e8f0', border: `1px solid ${color}`, fontSize: 11, width: 170 });
  nodes.push({ id: 'prompt', position: { x: 0, y: 0 }, data: { label: 'Prompt' }, style: style('#64748b') });
  let prev = 'prompt';
  let y = 0;
  let pendingTools: string[] = [];
  for (const s of trace.steps) {
    if (s.type === 'model') {
      y += 90;
      nodes.push({ id: s.id, position: { x: 0, y }, data: { label: `${s.label}\n${Math.round(s.latencyMs)} ms` }, style: style(s.error ? '#ef4444' : '#38bdf8') });
      const sources = pendingTools.length ? pendingTools : [prev];
      for (const src of sources) edges.push({ id: `${src}-${s.id}`, source: src, target: s.id, animated: false });
      pendingTools = [];
      prev = s.id;
    } else if (s.type === 'tool' || s.type === 'validation') {
      const x = 220 * (pendingTools.length + 1);
      nodes.push({ id: s.id, position: { x, y: y + 45 }, data: { label: s.label }, style: style(s.error ? '#ef4444' : s.type === 'tool' ? '#a78bfa' : '#f59e0b') });
      edges.push({ id: `${prev}-${s.id}`, source: prev, target: s.id });
      pendingTools.push(s.id);
    }
  }
  y += 90;
  nodes.push({ id: 'output', position: { x: 0, y }, data: { label: trace.status === 'ok' ? 'Output' : 'Stopped (error)' }, style: style(trace.status === 'ok' ? '#34d399' : '#ef4444') });
  edges.push({ id: `${prev}-output`, source: prev, target: 'output' });
  return { nodes, edges };
}

export function AgentGraph({ trace }: { trace: Trace }) {
  const { nodes, edges } = useMemo(() => buildGraph(trace), [trace]);
  return (
    <div className="h-[420px] rounded-md border border-slate-800">
      <ReactFlow nodes={nodes} edges={edges} fitView nodesConnectable={false} proOptions={{ hideAttribution: false }}>
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
