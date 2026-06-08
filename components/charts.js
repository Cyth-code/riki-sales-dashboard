import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

const C = {
  accent: '#4DA3FF', won: '#37C98B', lost: '#F2627E', open: '#E0B23C',
  line: '#22304A', dim: '#9DB0CC', faint: '#5E7193',
};

export function fmtMoney(n) {
  if (n == null) return '—';
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + (n / 1000).toFixed(0) + 'K';
  return '$' + Math.round(n);
}
export function fmtNum(n, d = 1) { return n == null ? '—' : Number(n).toFixed(d); }

function TT({ active, payload, label, unit }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="tooltip-box" style={{ padding: '8px 12px' }}>
      <div style={{ color: '#E8EEF7', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.accent }}>
          {p.name}: {p.value}{unit || ''}
        </div>
      ))}
    </div>
  );
}

// Horizontal bar chart, click to filter
export function HBar({ data, dataKey = 'value', unit = '', onBar, colorBy }) {
  if (!data.length) return <div className="empty">No data for current filters</div>;
  const h = Math.max(160, data.length * 34 + 30);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 6, right: 30, top: 4, bottom: 4 }}>
        <CartesianGrid horizontal={false} stroke={C.line} />
        <XAxis type="number" stroke={C.faint} fontSize={10} tickLine={false} />
        <YAxis type="category" dataKey="label" stroke={C.dim} fontSize={11} width={150} tickLine={false} />
        <Tooltip content={<TT unit={unit} />} cursor={{ fill: 'rgba(77,163,255,.06)' }} />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]} onClick={(d) => onBar && onBar(d.payload)} cursor={onBar ? 'pointer' : 'default'}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorBy ? colorBy(d) : C.accent} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Vertical column chart
export function VBar({ data, unit = '', onBar, colorBy }) {
  if (!data.length) return <div className="empty">No data for current filters</div>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke={C.line} />
        <XAxis dataKey="label" stroke={C.faint} fontSize={10} tickLine={false} interval={0} angle={-30} textAnchor="end" height={60} />
        <YAxis stroke={C.faint} fontSize={10} tickLine={false} />
        <Tooltip content={<TT unit={unit} />} cursor={{ fill: 'rgba(77,163,255,.06)' }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} onClick={(d) => onBar && onBar(d.payload)} cursor={onBar ? 'pointer' : 'default'}>
          {data.map((d, i) => (<Cell key={i} fill={colorBy ? colorBy(d) : C.accent} />))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const COLORS = C;
