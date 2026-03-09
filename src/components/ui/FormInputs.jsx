export function NumInput({ label, value, onChange, step, min, max, placeholder }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>
  );
}

export function TextInput({ label, value, onChange, placeholder }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>
  );
}

export function SelectInput({ label, value, onChange, children }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
      >
        {children}
      </select>
    </div>
  );
}

export function TextArea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
      />
    </div>
  );
}

const SHOT_ZONES = [
  { id: 'top-left', row: 0, col: 0 },
  { id: 'top-center', row: 0, col: 1 },
  { id: 'top-right', row: 0, col: 2 },
  { id: 'bottom-left', row: 1, col: 0 },
  { id: 'bottom-center', row: 1, col: 1 },
  { id: 'bottom-right', row: 1, col: 2 },
];

const COL_LABELS = ['L', 'C', 'R'];
const ROW_LABELS = ['High', 'Low'];

export function ShotZoneGrid({ value, onChange }) {
  const selected = value || '';

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Target Zone</label>
      <div className="space-y-1">
        {/* Column labels */}
        <div className="grid grid-cols-3 gap-1 text-center">
          {COL_LABELS.map(l => (
            <span key={l} className="text-[10px] text-gray-400 font-medium">{l}</span>
          ))}
        </div>
        {/* Zone rows */}
        {[0, 1].map(row => (
          <div key={row} className="flex items-center gap-1">
            <div className="grid grid-cols-3 gap-1 flex-1">
              {SHOT_ZONES.filter(z => z.row === row).map(zone => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => onChange(selected === zone.id ? '' : zone.id)}
                  className={`py-1.5 rounded text-xs font-medium transition-colors ${
                    selected === zone.id
                      ? 'bg-accent text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {zone.id.replace('top-', '').replace('bottom-', '').charAt(0).toUpperCase() + zone.id.replace('top-', '').replace('bottom-', '').slice(1)}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-gray-400 font-medium w-7 text-right">{ROW_LABELS[row]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const POSITIONS = ['General', 'Winger', 'Striker', 'CAM'];

export function PositionPicker({ value, onChange }) {
  const selected = value || 'General';

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">Position</label>
      <div className="flex gap-1">
        {POSITIONS.map(pos => (
          <button
            key={pos}
            type="button"
            onClick={() => onChange(pos)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selected === pos
                ? 'bg-accent text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {pos}
          </button>
        ))}
      </div>
    </div>
  );
}
