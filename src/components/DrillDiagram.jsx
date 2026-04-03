/**
 * SVG drill diagrams — unique for every drill.
 * Shows setup, player movement, ball path, cones, goals, walls.
 */

// --- Reusable SVG primitives ---
function Cone({ x, y, color = '#F59E0B' }) {
  return <polygon points={`${x},${y-6} ${x-5},${y+4} ${x+5},${y+4}`} fill={color} opacity="0.8" />;
}
function Player({ x, y, label = 'P' }) {
  return <g><circle cx={x} cy={y} r="8" fill="#1E3A5F" /><text x={x} y={y+3} textAnchor="middle" fontSize="7" fill="white" fontWeight="bold">{label}</text></g>;
}
function Ball({ x, y }) {
  return <circle cx={x} cy={y} r="4" fill="white" stroke="#333" strokeWidth="1" />;
}
function Arrow({ x1, y1, x2, y2, color = '#1E3A5F', dashed }) {
  const a = Math.atan2(y2-y1, x2-x1), h = 6;
  return <g><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" strokeDasharray={dashed?'4,3':'none'} /><polygon points={`${x2},${y2} ${x2-h*Math.cos(a-.4)},${y2-h*Math.sin(a-.4)} ${x2-h*Math.cos(a+.4)},${y2-h*Math.sin(a+.4)}`} fill={color} /></g>;
}
function CurveArrow({ path, color = '#E11D48' }) {
  return <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="4,2" />;
}
function Goal({ x, y, w = 50 }) {
  return <g><rect x={x} y={y} width={w} height="8" fill="none" stroke="#666" strokeWidth="2" rx="1" />{[.1,.3,.5,.7,.9].map((p,i)=><line key={i} x1={x+w*p} y1={y} x2={x+w*p} y2={y+8} stroke="#ccc" strokeWidth=".5"/>)}</g>;
}
function Wall({ x, y, w = 60 }) {
  return <line x1={x} y1={y} x2={x+w} y2={y} stroke="#8B7355" strokeWidth="4" strokeLinecap="round" />;
}
function Bg() { return <rect x="0" y="0" width="200" height="140" rx="8" fill="#2D5016" opacity=".12" />; }
function Lbl({ x, y, text, c = '#666' }) { return <text x={x} y={y} textAnchor="middle" fontSize="7" fill={c}>{text}</text>; }
function Zone({ x, y, w, h, color = '#E11D48' }) { return <rect x={x} y={y} width={w} height={h} fill={color} opacity=".12" rx="2" stroke={color} strokeWidth=".5" strokeDasharray="3,2" />; }

// --- Individual drill diagrams keyed by exact name ---
const DRILL_DIAGRAMS = {
  // === SHOOTING ===
  'Finishing Drill': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Player x={100} y={100}/><Ball x={100} y={90}/><Arrow x1={100} y1={88} x2={90} y2={20} color="#E11D48"/><Arrow x1={100} y1={88} x2={110} y2={20} color="#E11D48" dashed/><Zone x={80} y={16} w={40} h={20} color="#16A34A"/><Lbl x={100} y={135} text="Alternate corners, inside the box"/></svg>,

  'Weak Foot Finishing': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Player x={70} y={100}/><Ball x={70} y={90}/><Arrow x1={70} y1={88} x2={85} y2={20} color="#3B82F6"/><Player x={130} y={100} label="W"/><Ball x={130} y={90}/><Arrow x1={130} y1={88} x2={115} y2={20} color="#E11D48" dashed/><Lbl x={70} y={115} text="Strong" c="#3B82F6"/><Lbl x={130} y={115} text="Weak" c="#E11D48"/><Lbl x={100} y={135} text="Alternate feet each shot"/></svg>,

  'One-Touch Finishing': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Wall x={70} y={55}/><Player x={100} y={105}/><Ball x={100} y={95}/><Arrow x1={100} y1={93} x2={100} y2={60} color="#1E3A5F"/><Arrow x1={100} y1={57} x2={100} y2={90} color="#3B82F6" dashed/><Arrow x1={100} y1={88} x2={100} y2={20} color="#E11D48"/><Lbl x={100} y={50} text="Rebound"/><Lbl x={100} y={135} text="First-time finish off wall rebound"/></svg>,

  'Power Shooting': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Player x={100} y={110}/><Ball x={100} y={98}/><line x1={80} y1={70} x2={120} y2={70} stroke="#999" strokeWidth=".5" strokeDasharray="3,2"/><Lbl x={140} y={73} text="20 yards" c="#999"/><Arrow x1={100} y1={96} x2={100} y2={20} color="#E11D48"/><Arrow x1={98} y1={96} x2={85} y2={20} color="#E11D48" dashed/><Lbl x={100} y={135} text="Laces technique, max power from distance"/></svg>,

  'Placement Shooting': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Player x={100} y={100}/><Ball x={100} y={90}/><Zone x={76} y={9} w={12} h={6} color="#16A34A"/><Zone x={112} y={9} w={12} h={6} color="#16A34A"/><Zone x={76} y={9} w={12} h={3}/><Zone x={112} y={9} w={12} h={3}/><Arrow x1={100} y1={88} x2={82} y2={12} color="#E11D48"/><Arrow x1={100} y1={88} x2={118} y2={12} color="#E11D48" dashed/><Lbl x={82} y={25} text="TL" c="#16A34A"/><Lbl x={118} y={25} text="TR" c="#16A34A"/><Lbl x={100} y={135} text="5 shots each corner target"/></svg>,

  'Volleys & Half-Volleys': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Player x={100} y={95}/><CurveArrow path="M 100 50 Q 100 30 100 70"/><Ball x={100} y={50}/><Arrow x1={100} y1={70} x2={95} y2={20} color="#E11D48"/><Lbl x={100} y={42} text="Drop from hands"/><Lbl x={100} y={135} text="Self-serve, strike on bounce or in air"/></svg>,

  'Turning & Shooting': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Player x={100} y={80}/><Arrow x1={100} y1={110} x2={100} y2={85} color="#1E3A5F"/><CurveArrow path="M 100 80 Q 120 70 110 55"/><Arrow x1={110} y1={58} x2={100} y2={20} color="#E11D48"/><Lbl x={100} y={120} text="Receive"/><Lbl x={130} y={65} text="Turn" c="#3B82F6"/><Lbl x={100} y={135} text="Back to goal → turn → finish"/></svg>,

  'Free Kicks': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Player x={100} y={105}/><Ball x={100} y={93}/>{[80,90,100,110,120].map((x,i)=><circle key={i} cx={x} cy={55} r="5" fill="#999"/>)}<CurveArrow path="M 100 91 Q 135 50 115 18"/><CurveArrow path="M 100 91 Q 65 50 85 18"/><Lbl x={100} y={45} text="Wall"/><Lbl x={100} y={135} text="Curve over/around wall into corners"/></svg>,

  'Penalty Kicks': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><circle cx={100} cy={80} r="2" fill="white"/><Player x={100} y={100}/><Ball x={100} y={80}/><Arrow x1={100} y1={78} x2={80} y2={12} color="#E11D48"/><Arrow x1={100} y1={78} x2={120} y2={12} color="#E11D48" dashed/><Lbl x={100} y={72} text="Penalty spot"/><Lbl x={100} y={135} text="Pick your corner, commit to direction"/></svg>,

  'Shooting (Inside Box)': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Zone x={65} y={16} w={70} h={40}/><Player x={85} y={45}/><Ball x={85} y={38}/><Arrow x1={85} y1={36} x2={82} y2={20} color="#E11D48"/><Player x={115} y={50} label="2"/><Arrow x1={115} y1={45} x2={110} y2={20} color="#E11D48" dashed/><Lbl x={100} y={62} text="Box" c="#E11D48"/><Lbl x={100} y={135} text="Quick shots from angles inside the box"/></svg>,

  'Shooting (Outside Box)': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Zone x={60} y={16} w={80} h={35}/><Player x={100} y={80}/><Ball x={100} y={72}/><line x1={60} y1={51} x2={140} y2={51} stroke="#999" strokeWidth=".5" strokeDasharray="3,2"/><Arrow x1={100} y1={70} x2={95} y2={20} color="#E11D48"/><Lbl x={155} y={54} text="Box edge"/><Lbl x={100} y={135} text="Long-range strikes outside the area"/></svg>,

  // === PASSING ===
  'Wall Passes (1-touch)': () => <svg viewBox="0 0 200 140"><Bg/><Wall x={70} y={15}/><Player x={100} y={100}/><Ball x={100} y={90}/><Arrow x1={100} y1={88} x2={100} y2={22} color="#1E3A5F"/><Arrow x1={100} y1={20} x2={100} y2={82} color="#3B82F6" dashed/><Lbl x={100} y={135} text="1-touch: pass and receive immediately"/></svg>,

  'Wall Passes (2-touch)': () => <svg viewBox="0 0 200 140"><Bg/><Wall x={70} y={15}/><Player x={100} y={100}/><Ball x={100} y={90}/><Arrow x1={100} y1={88} x2={100} y2={22} color="#1E3A5F"/><Arrow x1={100} y1={20} x2={100} y2={82} color="#3B82F6" dashed/><circle cx={108} cy={82} r="3" fill="#3B82F6" opacity=".3"/><Lbl x={120} y={80} text="Control" c="#3B82F6"/><Lbl x={100} y={135} text="2-touch: control first, then pass"/></svg>,

  'Short Passing Combos': () => <svg viewBox="0 0 200 140"><Bg/><Wall x={55} y={30} w={40}/><Wall x={105} y={30} w={40}/><Player x={100} y={100}/><Arrow x1={100} y1={95} x2={75} y2={37} color="#1E3A5F"/><Arrow x1={75} y1={33} x2={100} y2={90} color="#3B82F6" dashed/><Arrow x1={105} y1={95} x2={125} y2={37} color="#1E3A5F"/><Arrow x1={125} y1={33} x2={105} y2={85} color="#3B82F6" dashed/><Lbl x={100} y={135} text="Quick combos, alternate walls"/></svg>,

  'Long-Range Passing': () => <svg viewBox="0 0 200 140"><Bg/><Player x={40} y={100}/><Ball x={48} y={98}/><Zone x={140} y={20} w={40} h={30}/><Arrow x1={50} y1={96} x2={155} y2={38} color="#1E3A5F"/><Lbl x={160} y={55} text="Target 30y+"/><Lbl x={100} y={135} text="Lock ankle, follow through to target zone"/></svg>,

  'Long Passing': () => <svg viewBox="0 0 200 140"><Bg/><Player x={40} y={100}/><Ball x={48} y={98}/><Cone x={160} y={35}/><Arrow x1={50} y1={96} x2={155} y2={40} color="#1E3A5F"/><CurveArrow path="M 50 94 Q 100 20 155 38"/><Lbl x={100} y={135} text="Driven long pass to target"/></svg>,

  'Weak Foot Passing': () => <svg viewBox="0 0 200 140"><Bg/><Wall x={70} y={15}/><Player x={100} y={100}/><Ball x={92} y={95}/><Arrow x1={92} y1={93} x2={92} y2={22} color="#E11D48"/><Arrow x1={92} y1={20} x2={92} y2={85} color="#3B82F6" dashed/><Lbl x={80} y={105} text="Weak foot only" c="#E11D48"/><Lbl x={100} y={135} text="All passes with non-dominant foot"/></svg>,

  'Through Ball Practice': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={70} y={50}/><Cone x={90} y={50}/><Cone x={110} y={50}/><Cone x={130} y={50}/><Player x={100} y={100}/><Ball x={100} y={90}/><Arrow x1={100} y1={88} x2={80} y2={52} color="#1E3A5F"/><Arrow x1={100} y1={88} x2={120} y2={52} color="#1E3A5F" dashed/><Lbl x={100} y={42} text="Gates"/><Lbl x={100} y={135} text="Thread passes through cone gates"/></svg>,

  'Lofted Passes': () => <svg viewBox="0 0 200 140"><Bg/><Player x={40} y={100}/><Ball x={48} y={98}/><Zone x={130} y={25} w={40} h={30}/><CurveArrow path="M 50 96 Q 90 10 150 30"/><Lbl x={150} y={60} text="Drop zone"/><Lbl x={100} y={135} text="Chip to land in target zone"/></svg>,

  'First-Time Passing Combos': () => <svg viewBox="0 0 200 140"><Bg/><Wall x={70} y={20}/><Player x={80} y={95}/><Player x={120} y={95} label="2"/><Arrow x1={80} y1={90} x2={85} y2={27} color="#1E3A5F"/><Arrow x1={85} y1={25} x2={85} y2={85} color="#3B82F6" dashed/><Arrow x1={120} y1={90} x2={115} y2={27} color="#1E3A5F"/><Arrow x1={115} y1={25} x2={115} y2={85} color="#3B82F6" dashed/><Lbl x={100} y={135} text="Wall rebounds, alternate feet + position"/></svg>,

  'Passing Under Pressure': () => <svg viewBox="0 0 200 140"><Bg/><Wall x={70} y={15}/><Player x={100} y={100}/><Ball x={100} y={90}/><circle cx={70} cy={70} r="6" fill="#E11D48" opacity=".3"/><circle cx={130} cy={70} r="6" fill="#E11D48" opacity=".3"/><Lbl x={70} y={82} text="Def" c="#E11D48"/><Lbl x={130} y={82} text="Def" c="#E11D48"/><Arrow x1={100} y1={88} x2={100} y2={22} color="#1E3A5F"/><Lbl x={100} y={60} text="⏱ Timed" c="#E11D48"/><Lbl x={100} y={135} text="Complete sequences within time limit"/></svg>,

  'Rondo': () => <svg viewBox="0 0 200 140"><Bg/><circle cx={100} cy={65} r="40" fill="none" stroke="#1E3A5F" strokeWidth="1" strokeDasharray="3,2"/>{[[60,65],[100,25],[140,65],[100,105]].map(([x,y],i)=><Player key={i} x={x} y={y} label={i+1}/>)}<circle cx={100} cy={65} r="6" fill="#E11D48" opacity=".3"/><Lbl x={100} y={68} text="D" c="#E11D48"/><Arrow x1={65} y1={60} x2={95} y2={30} color="#3B82F6" dashed/><Arrow x1={105} y1={30} x2={135} y2={60} color="#3B82F6" dashed/><Lbl x={100} y={135} text="Keep possession, 2-touch max"/></svg>,

  // === DRIBBLING ===
  'Dribbling Circuit': () => <svg viewBox="0 0 200 140"><Bg/>{[50,80,110,140].map((x,i)=><Cone key={i} x={x} y={40}/>)}{[65,95,125].map((x,i)=><Cone key={i} x={x} y={70}/>)}<Player x={30} y={55}/><CurveArrow path="M 38 55 Q 50 35 65 55 Q 80 75 95 55 Q 110 35 125 55 Q 140 75 160 55"/><Lbl x={100} y={135} text="Inside-outside, drag backs, step-overs"/></svg>,

  'Cone Weave Dribbling': () => <svg viewBox="0 0 200 140"><Bg/>{[40,60,80,100,120,140,160].map((x,i)=><Cone key={i} x={x} y={65}/>)}<Player x={20} y={65}/><Ball x={28} y={63}/><CurveArrow path="M 28 63 Q 40 50 50 63 Q 60 78 70 63 Q 80 48 90 63 Q 100 78 110 63 Q 120 48 130 63 Q 140 78 150 63 Q 160 48 175 63"/><Lbl x={100} y={135} text="1m apart, inside-outside technique"/></svg>,

  'Ball Mastery Routine': () => <svg viewBox="0 0 200 140"><Bg/><Player x={100} y={65}/><Ball x={100} y={80}/><circle cx={100} cy={65} r="25" fill="none" stroke="#C4956A" strokeWidth="1" strokeDasharray="3,2"/><Lbl x={100} y={35} text="Sole rolls"/><Lbl x={55} y={65} text="Toe taps"/><Lbl x={145} y={65} text="Foundations"/><Lbl x={100} y={100} text="5 min continuous"/><Lbl x={100} y={135} text="Stationary ball mastery, all surfaces"/></svg>,

  'Close Control Box': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={60} y={30}/><Cone x={140} y={30}/><Cone x={60} y={100}/><Cone x={140} y={100}/><rect x={60} y={30} width="80" height="70" fill="none" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3,2"/><Player x={100} y={65}/><Ball x={108} y={63}/><CurveArrow path="M 108 63 Q 130 45 120 35 Q 100 30 80 45 Q 65 65 80 85 Q 100 95 120 80 Q 135 65 108 63"/><Lbl x={100} y={22} text="5m × 5m"/><Lbl x={100} y={135} text="Dribble in box, change direction on whistle"/></svg>,

  'Speed Dribbling': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={30} y={70}/><Cone x={170} y={70}/><Player x={38} y={70}/><Ball x={46} y={68}/><Arrow x1={48} y1={68} x2={162} y2={68} color="#E11D48"/><Lbl x={30} y={85} text="Start"/><Lbl x={170} y={85} text="30m"/><Lbl x={100} y={55} text="Ball close, max speed" c="#E11D48"/><Lbl x={100} y={135} text="Sprint with ball, maintain close control"/></svg>,

  '1v1 Moves Practice': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={100} y={50}/><Player x={100} y={95}/><Ball x={108} y={93}/><CurveArrow path="M 108 90 Q 130 70 120 55"/><CurveArrow path="M 108 90 Q 70 70 80 55"/><Arrow x1={120} y1={55} x2={140} y2={30} color="#16A34A"/><Arrow x1={80} y1={55} x2={60} y2={30} color="#16A34A"/><Lbl x={140} y={45} text="Step-over"/><Lbl x={60} y={45} text="Scissors"/><Lbl x={100} y={135} text="Practice moves against cone defender"/></svg>,

  'Juggling Progression': () => <svg viewBox="0 0 200 140"><Bg/><Player x={100} y={90}/><Ball x={100} y={50}/><CurveArrow path="M 100 85 Q 100 60 100 50"/><CurveArrow path="M 100 50 Q 110 40 100 30"/><CurveArrow path="M 100 30 Q 90 20 100 15"/><Lbl x={130} y={50} text="Feet"/><Lbl x={130} y={35} text="Thighs"/><Lbl x={130} y={20} text="Head"/><Lbl x={100} y={135} text="Feet → thigh → head, track high score"/></svg>,

  'First Touch Receiving': () => <svg viewBox="0 0 200 140"><Bg/><Wall x={70} y={15}/><Player x={100} y={95}/><Arrow x1={100} y1={90} x2={100} y2={22} color="#1E3A5F"/><Arrow x1={100} y1={20} x2={100} y2={80} color="#3B82F6" dashed/><circle cx={100} cy={80} r="6" fill="#C4956A" opacity=".3"/><Lbl x={115} y={80} text="Cushion" c="#C4956A"/><Lbl x={100} y={135} text="Throw at wall, control with diff surfaces"/></svg>,

  'Drag Back & Turn': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={100} y={45}/><Player x={100} y={80}/><Ball x={100} y={70}/><Arrow x1={100} y1={68} x2={100} y2={50} color="#1E3A5F"/><CurveArrow path="M 100 50 Q 85 45 80 55"/><Arrow x1={80} y1={57} x2={60} y2={90} color="#16A34A"/><Lbl x={120} y={48} text="Drag back" c="#3B82F6"/><Lbl x={65} y={80} text="Accelerate" c="#16A34A"/><Lbl x={100} y={135} text="Receive, drag back, turn, explode away"/></svg>,

  'La Croqueta Drill': () => <svg viewBox="0 0 200 140"><Bg/><Player x={100} y={70}/><Ball x={90} y={72}/><Arrow x1={90} y1={72} x2={110} y2={72} color="#3B82F6"/><Arrow x1={110} y1={72} x2={90} y2={72} color="#E11D48"/><Lbl x={85} y={85} text="L" c="#3B82F6"/><Lbl x={115} y={85} text="R" c="#E11D48"/><Lbl x={100} y={55} text="↔ lateral rolls, increasing speed"/><Lbl x={100} y={135} text="Inside foot to inside foot, quick tempo"/></svg>,

  // === CROSSING ===
  'Crossing & Finishing': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Player x={25} y={85} label="W"/><Arrow x1={30} y1={82} x2={20} y2={35} color="#1E3A5F"/><CurveArrow path="M 22 35 Q 60 10 100 22"/><Zone x={85} y={18} w={30} h={25} color="#16A34A"/><Lbl x={100} y={50} text="Target zone"/><Lbl x={100} y={135} text="Cross from wide, run in and finish"/></svg>,

  'Driven Cross Practice': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Player x={20} y={70} label="W"/><Arrow x1={25} y1={67} x2={20} y2={30} color="#1E3A5F"/><Arrow x1={22} y1={30} x2={100} y2={25} color="#E11D48"/><Zone x={85} y={20} w={30} h={15}/><Lbl x={100} y={42} text="Low, hard"/><Lbl x={100} y={135} text="Low driven crosses to near-post zone"/></svg>,

  'Whipped Cross Technique': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Player x={170} y={110} label="W"/><Arrow x1={168} y1={105} x2={165} y2={30} color="#1E3A5F"/><CurveArrow path="M 165 30 Q 140 5 100 20"/><Zone x={80} y={15} w={40} h={20} color="#16A34A"/><Lbl x={100} y={135} text="Curling delivery from byline area"/></svg>,

  'Set Piece Delivery': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Cone x={170} y={110}/><Player x={170} y={120}/><Ball x={170} y={110}/><CurveArrow path="M 168 108 Q 140 50 100 22"/><CurveArrow path="M 168 108 Q 150 60 85 25"/><Zone x={78} y={16} w={20} h={15} color="#16A34A"/><Zone x={102} y={16} w={20} h={15} color="#3B82F6"/><Lbl x={88} y={38} text="Near"/><Lbl x={112} y={38} text="Far"/><Lbl x={100} y={135} text="Corners to near and far post zones"/></svg>,

  // === SPEED ===
  'Sprint Intervals': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={30} y={70}/><Cone x={170} y={70}/><Player x={38} y={70}/><Arrow x1={48} y1={70} x2={162} y2={70} color="#E11D48"/>{[60,90,120,150].map((x,i)=><line key={i} x1={x} y1={65} x2={x} y2={75} stroke="#999" strokeWidth=".5"/>)}<Lbl x={100} y={55} text="30m sprint → 30s rest × 8"/><Lbl x={100} y={135} text="Max effort, timed rest between"/></svg>,

  'Ladder Footwork': () => <svg viewBox="0 0 200 140"><Bg/>{[0,1,2,3,4,5,6,7].map(i=><g key={i}><line x1={85} y1={20+i*14} x2={115} y2={20+i*14} stroke="#666" strokeWidth="1.5"/></g>)}<line x1={85} y1={20} x2={85} y2={118} stroke="#666" strokeWidth="1"/><line x1={115} y1={20} x2={115} y2={118} stroke="#666" strokeWidth="1"/><Player x={100} y={125}/><Arrow x1={100} y1={120} x2={100} y2={25} color="#1E3A5F"/><Lbl x={140} y={70} text="6 patterns"/><Lbl x={100} y={135} text="Quick feet drills through ladder"/></svg>,

  'T-Drill': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={100} y={110}/><Cone x={100} y={55}/><Cone x={45} y={35}/><Cone x={155} y={35}/><Arrow x1={100} y1={105} x2={100} y2={60} color="#1E3A5F"/><Arrow x1={100} y1={57} x2={50} y2={38} color="#3B82F6"/><Arrow x1={52} y1={37} x2={150} y2={37} color="#E11D48"/><Arrow x1={148} y1={38} x2={100} y2={58} color="#3B82F6" dashed/><Arrow x1={100} y1={60} x2={100} y2={108} color="#16A34A" dashed/><Player x={100} y={120}/><Lbl x={100} y={135} text="Sprint → shuffle → backpedal"/></svg>,

  'Cone Shuttle Runs': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={30} y={70}/><Cone x={60} y={70}/><Cone x={100} y={70}/><Cone x={150} y={70}/><Player x={30} y={85}/><Arrow x1={35} y1={68} x2={55} y2={68} color="#1E3A5F"/><Arrow x1={58} y1={72} x2={35} y2={72} color="#E11D48" dashed/><Arrow x1={35} y1={68} x2={95} y2={68} color="#1E3A5F"/><Lbl x={30} y={62} text="5m"/><Lbl x={60} y={62} text="10m"/><Lbl x={100} y={62} text="15m"/><Lbl x={150} y={62} text="20m"/><Lbl x={100} y={135} text="5-10-15-20m shuttles, 6 reps"/></svg>,

  'Acceleration Sprints': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={40} y={70}/><Cone x={90} y={70}/><Player x={40} y={85}/><Arrow x1={48} y1={70} x2={85} y2={70} color="#E11D48"/><Lbl x={65} y={62} text="10m burst"/>{[1,2,3].map(i=><line key={i} x1={40+i*12} y1={67} x2={40+i*12} y2={73} stroke="#E11D48" strokeWidth=".5"/>)}<Lbl x={65} y={90} text="Standing start × 10"/><Lbl x={100} y={135} text="Explosive 10m from dead stop"/></svg>,

  'Zig-Zag Agility': () => <svg viewBox="0 0 200 140"><Bg/>{[[40,30],[70,80],[100,30],[130,80],[160,30]].map(([x,y],i)=><Cone key={i} x={x} y={y}/>)}<Player x={20} y={55}/><CurveArrow path="M 28 55 L 40 35 L 70 80 L 100 35 L 130 80 L 160 35 L 180 55"/><Lbl x={100} y={135} text="Sprint through angled cone setup"/></svg>,

  'Deceleration Training': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={30} y={70}/><Cone x={130} y={70}/><Zone x={130} y={60} w={20} h={20} color="#E11D48"/><Player x={38} y={70}/><Arrow x1={46} y1={70} x2={125} y2={70} color="#1E3A5F"/><Lbl x={80} y={60} text="Sprint 20m"/><Lbl x={145} y={75} text="Stop in 2 steps" c="#E11D48"/><Lbl x={100} y={135} text="Full speed → controlled stop"/></svg>,

  'Reaction Sprints': () => <svg viewBox="0 0 200 140"><Bg/><Player x={100} y={95}/><circle cx={100} cy={40} r="15" fill="#C4956A" opacity=".2"/><Lbl x={100} y={43} text="Signal" c="#C4956A"/><Arrow x1={100} y1={90} x2={50} y2={45} color="#1E3A5F" dashed/><Arrow x1={100} y1={90} x2={150} y2={45} color="#1E3A5F" dashed/><Arrow x1={100} y1={90} x2={100} y2={45} color="#E11D48"/><Lbl x={40} y={60} text="Left"/><Lbl x={160} y={60} text="Right"/><Lbl x={100} y={135} text="React to signal → sprint direction"/></svg>,

  // === STRENGTH ===
  'Bodyweight Circuit': () => <svg viewBox="0 0 200 140"><Bg/>{[['Squats',35,25],['Push-ups',100,25],['Planks',165,25],['Lunges',35,80],['Burpees',100,80],['Core',165,80]].map(([t,x,y],i)=><g key={i}><rect x={x-25} y={y-10} width="50" height="20" rx="3" fill="#1E3A5F" opacity=".15"/><Lbl x={x} y={y+3} text={t}/></g>)}<Arrow x1={62} y1={28} x2={73} y2={28} color="#C4956A"/><Arrow x1={127} y1={28} x2={138} y2={28} color="#C4956A"/><Arrow x1={165} y1={37} x2={165} y2={68} color="#C4956A"/><Arrow x1={138} y1={83} x2={127} y2={83} color="#C4956A"/><Arrow x1={73} y1={83} x2={62} y2={83} color="#C4956A"/><Lbl x={100} y={135} text="6-station circuit, 30s each"/></svg>,

  'Core Stability Routine': () => <svg viewBox="0 0 200 140"><Bg/><Player x={100} y={60}/>{[['Plank',40,30],['Side',160,30],['Bridge',40,90],['V-sit',160,90]].map(([t,x,y],i)=><g key={i}><circle cx={x} cy={y} r="15" fill="#C4956A" opacity=".15"/><Lbl x={x} y={y+3} text={t} c="#C4956A"/></g>)}<Lbl x={100} y={135} text="8 exercises × 30 seconds each"/></svg>,

  'Single-Leg Stability': () => <svg viewBox="0 0 200 140"><Bg/><Player x={100} y={65}/><Ball x={100} y={85}/><circle cx={100} cy={65} r="20" fill="none" stroke="#3B82F6" strokeWidth="1" strokeDasharray="3,2"/><Lbl x={100} y={40} text="Balance pad" c="#3B82F6"/><Lbl x={100} y={105} text="Eyes closed variation"/><Lbl x={100} y={135} text="Single-leg balance with ball"/></svg>,

  'Plyometric Box Jumps': () => <svg viewBox="0 0 200 140"><Bg/><rect x={85} y={55} width="30" height="25" rx="2" fill="#8B7355" opacity=".5"/><Player x={100} y={105}/><CurveArrow path="M 100 100 Q 100 50 100 55"/><Arrow x1={100} y1={52} x2={100} y2={30} color="#16A34A"/><Lbl x={100} y={68} text="Box"/><Lbl x={100} y={25} text="Explode up" c="#16A34A"/><Lbl x={100} y={135} text="4 sets × 8 jumps"/></svg>,

  'Resistance Band Warm-Up': () => <svg viewBox="0 0 200 140"><Bg/><Player x={100} y={65}/><CurveArrow path="M 90 75 Q 80 85 90 95"/><CurveArrow path="M 110 75 Q 120 85 110 95"/><line x1={85} y1={75} x2={115} y2={75} stroke="#E11D48" strokeWidth="2"/><Lbl x={100} y={55} text="Band at knees"/><Lbl x={70} y={90} text="Hip abduction" c="#E11D48"/><Lbl x={100} y={135} text="Hip activation and knee stability"/></svg>,

  'Yoga for Footballers': () => <svg viewBox="0 0 200 140"><Bg/><Player x={100} y={65}/><circle cx={100} cy={65} r="30" fill="none" stroke="#C4956A" strokeWidth=".5"/><circle cx={100} cy={65} r="40" fill="none" stroke="#C4956A" strokeWidth=".5" opacity=".5"/><Lbl x={100} y={30} text="Warrior"/><Lbl x={55} y={65} text="Tree"/><Lbl x={145} y={65} text="Pigeon"/><Lbl x={100} y={105} text="15 min flow"/><Lbl x={100} y={135} text="Flexibility and recovery flow"/></svg>,

  // === TACTICAL ===
  'Positional Shadow Play': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={50} y={30}/><Cone x={100} y={20}/><Cone x={150} y={30}/><Cone x={75} y={70}/><Cone x={125} y={70}/><Player x={100} y={110}/><Arrow x1={100} y1={105} x2={75} y2={75} color="#1E3A5F" dashed/><Arrow x1={75} y1={72} x2={100} y2={25} color="#3B82F6" dashed/><Arrow x1={100} y1={23} x2={125} y2={72} color="#1E3A5F" dashed/><Lbl x={100} y={135} text="Move through positions without ball"/></svg>,

  'Scanning Practice': () => <svg viewBox="0 0 200 140"><Bg/><Wall x={70} y={15}/><Player x={100} y={90}/><Ball x={100} y={80}/><Arrow x1={100} y1={78} x2={100} y2={22} color="#1E3A5F"/><Arrow x1={100} y1={20} x2={100} y2={72} color="#3B82F6" dashed/><CurveArrow path="M 90 85 Q 60 75 70 85"/><CurveArrow path="M 110 85 Q 140 75 130 85"/><Lbl x={65} y={95} text="Look" c="#C4956A"/><Lbl x={135} y={95} text="Look" c="#C4956A"/><Lbl x={100} y={135} text="Head movement before receiving"/></svg>,

  'Decision-Making Cones': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={80} y={40} color="#E11D48"/><Cone x={120} y={40} color="#3B82F6"/><Cone x={100} y={60} color="#16A34A"/><Player x={100} y={100}/><Ball x={100} y={90}/><Arrow x1={100} y1={88} x2={80} y2={45} color="#E11D48" dashed/><Arrow x1={100} y1={88} x2={120} y2={45} color="#3B82F6" dashed/><Arrow x1={100} y1={88} x2={100} y2={65} color="#16A34A" dashed/><Lbl x={80} y={32} text="Red=shoot" c="#E11D48"/><Lbl x={120} y={32} text="Blue=pass" c="#3B82F6"/><Lbl x={100} y={52} text="Green=dribble" c="#16A34A"/><Lbl x={100} y={135} text="Different action per color cone"/></svg>,

  'Pressing Triggers': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={100} y={30}/><circle cx={100} cy={30} r="5" fill="#E11D48" opacity=".3"/><Player x={100} y={100}/><Arrow x1={100} y1={95} x2={100} y2={38} color="#E11D48"/><Cone x={60} y={60}/><Cone x={140} y={60}/><Arrow x1={100} y1={95} x2={65} y2={65} color="#1E3A5F" dashed/><Arrow x1={100} y1={95} x2={135} y2={65} color="#1E3A5F" dashed/><Lbl x={100} y={22} text="Target"/><Lbl x={100} y={135} text="Close down with sprints on trigger"/></svg>,

  'Transition Sprints': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={30} y={70}/><Cone x={170} y={70}/><Player x={100} y={70}/><Arrow x1={105} y1={68} x2={162} y2={68} color="#E11D48"/><Arrow x1={165} y1={72} x2={38} y2={72} color="#3B82F6" dashed/><Lbl x={140} y={58} text="Attack →" c="#E11D48"/><Lbl x={60} y={82} text="← Defend" c="#3B82F6"/><Lbl x={100} y={135} text="Sprint 30m attack → recovery jog back"/></svg>,

  'Off-The-Ball Movement': () => <svg viewBox="0 0 200 140"><Bg/><Cone x={60} y={40}/><Cone x={140} y={40}/><Cone x={100} y={80}/><Player x={100} y={110}/><Arrow x1={100} y1={105} x2={60} y2={45} color="#1E3A5F"/><Arrow x1={62} y1={43} x2={140} y2={43} color="#3B82F6" dashed/><Arrow x1={138} y1={45} x2={100} y2={85} color="#1E3A5F" dashed/><Lbl x={50} y={55} text="Check"/><Lbl x={150} y={55} text="Overlap"/><Lbl x={100} y={95} text="Diagonal"/><Lbl x={100} y={135} text="Diagonal, check, overlap runs"/></svg>,

  // === PSYCHOLOGICAL ===
  'Pre-Match Visualization': () => <svg viewBox="0 0 200 140"><Bg/><Player x={100} y={75}/><circle cx={100} cy={75} r="20" fill="#C4956A" opacity=".1"/><circle cx={100} cy={75} r="30" fill="#C4956A" opacity=".07"/><circle cx={100} cy={75} r="40" fill="#C4956A" opacity=".04"/><Lbl x={100} y={30} text="👁 Visualize your best plays" c="#C4956A"/><Lbl x={100} y={105} text="10 min guided mental rehearsal"/><Lbl x={100} y={135} text="Eyes closed, imagine success"/></svg>,

  'Pressure Finishing': () => <svg viewBox="0 0 200 140"><Bg/><Goal x={75} y={8}/><Player x={100} y={100}/><Ball x={100} y={90}/><Arrow x1={100} y1={88} x2={100} y2={20} color="#E11D48"/><rect x={145} y={50} width="35" height="20" rx="3" fill="#E11D48" opacity=".2"/><Lbl x={162} y={63} text="⏱ 0:05" c="#E11D48"/><Lbl x={100} y={135} text="Countdown timer adds pressure"/></svg>,

  'Breathing & Focus Reset': () => <svg viewBox="0 0 200 140"><Bg/><Player x={100} y={70}/>{[20,30,40,50].map((r,i)=><circle key={i} cx={100} cy={70} r={r} fill="none" stroke="#C4956A" strokeWidth=".5" opacity={1-i*.2}/>)}<Lbl x={100} y={25} text="In... 4s" c="#C4956A"/><Lbl x={155} y={70} text="Hold... 4s" c="#C4956A"/><Lbl x={100} y={125} text="Out... 4s" c="#C4956A"/><Lbl x={100} y={135} text="Box breathing between sets"/></svg>,

  'Post-Session Reflection': () => <svg viewBox="0 0 200 140"><Bg/><Player x={100} y={60}/><rect x={40} y={85} width="120" height="35" rx="4" fill="white" opacity=".3"/><Lbl x={100} y={98} text="What went well?"/><Lbl x={100} y={110} text="What to improve?"/><Lbl x={100} y={40} text="📝" c="#1E3A5F"/><Lbl x={100} y={135} text="Structured journaling prompts"/></svg>,

  // === WARM-UP & COOL-DOWN ===
  'Dynamic Warm-Up': () => <svg viewBox="0 0 200 140"><Bg/><Player x={30} y={70}/><CurveArrow path="M 38 70 Q 70 40 100 70 Q 130 100 160 70"/><Arrow x1={155} y1={72} x2={170} y2={68} color="#1E3A5F"/>{[60,100,140].map((x,i)=><g key={i}><circle cx={x} cy={110} r="8" fill="#C4956A" opacity=".15"/></g>)}<Lbl x={60} y={113} text="High knees"/><Lbl x={100} y={113} text="Butt kicks"/><Lbl x={140} y={113} text="Lunges"/><Lbl x={100} y={135} text="Jog + dynamic stretches"/></svg>,

  'Ball Warm-Up': () => <svg viewBox="0 0 200 140"><Bg/><Player x={100} y={70}/><Ball x={108} y={68}/><CurveArrow path="M 108 65 Q 120 55 115 50"/><CurveArrow path="M 90 75 Q 80 85 85 90"/><circle cx={100} cy={70} r="25" fill="none" stroke="#C4956A" strokeWidth="1" strokeDasharray="3,2"/><Lbl x={130} y={50} text="Light touches"/><Lbl x={70} y={95} text="Easy passes"/><Lbl x={100} y={135} text="50% intensity, build rhythm"/></svg>,

  'Static Cool-Down Stretches': () => <svg viewBox="0 0 200 140"><Bg/><Player x={100} y={55}/>{[['Quads',40,35],['Hamstrings',160,35],['Hip flexors',40,85],['Calves',160,85]].map(([t,x,y],i)=><g key={i}><circle cx={x} cy={y} r="18" fill="#3B82F6" opacity=".1"/><Lbl x={x} y={y+3} text={t} c="#3B82F6"/></g>)}<Lbl x={100} y={110} text="Hold 20-30s each"/><Lbl x={100} y={135} text="Static stretches, all muscle groups"/></svg>,

  'Foam Rolling Recovery': () => <svg viewBox="0 0 200 140"><Bg/><rect x={75} y={60} width="50" height="12" rx="6" fill="#8B7355" opacity=".5"/><Player x={100} y={50}/><Arrow x1={85} y1={66} x2={115} y2={66} color="#C4956A"/><Arrow x1={115} y1={66} x2={85} y2={66} color="#C4956A"/>{[['Quads',45,95],['IT band',100,95],['Glutes',155,95]].map(([t,x,y],i)=><g key={i}><Lbl x={x} y={y} text={t} c="#C4956A"/></g>)}<Lbl x={100} y={40} text="60s per muscle group"/><Lbl x={100} y={135} text="Roll slowly, pause on tender spots"/></svg>,
};

export function DrillDiagram({ drill }) {
  const name = drill?.name;
  const Diagram = DRILL_DIAGRAMS[name];

  if (!Diagram) {
    // Fallback based on subcategory
    const sub = (drill?.subcategory || '').toLowerCase();
    const cat = (drill?.category || '').toLowerCase();
    if (sub.includes('shooting')) return <div className="bg-gray-50 rounded-lg p-3 mb-3"><div className="aspect-[10/7] max-h-40">{DRILL_DIAGRAMS['Finishing Drill']()}</div></div>;
    if (sub.includes('passing')) return <div className="bg-gray-50 rounded-lg p-3 mb-3"><div className="aspect-[10/7] max-h-40">{DRILL_DIAGRAMS['Wall Passes (1-touch)']()}</div></div>;
    if (sub.includes('dribbling')) return <div className="bg-gray-50 rounded-lg p-3 mb-3"><div className="aspect-[10/7] max-h-40">{DRILL_DIAGRAMS['Dribbling Circuit']()}</div></div>;
    if (sub.includes('speed')) return <div className="bg-gray-50 rounded-lg p-3 mb-3"><div className="aspect-[10/7] max-h-40">{DRILL_DIAGRAMS['Sprint Intervals']()}</div></div>;
    if (cat.includes('tactical')) return <div className="bg-gray-50 rounded-lg p-3 mb-3"><div className="aspect-[10/7] max-h-40">{DRILL_DIAGRAMS['Positional Shadow Play']()}</div></div>;
    return null;
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3 mb-3">
      <div className="aspect-[10/7] max-h-40">
        <Diagram />
      </div>
    </div>
  );
}
