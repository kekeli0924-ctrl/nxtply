import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db;

function resolveDbPath() {
  return process.env.DB_PATH === ':memory:'
    ? ':memory:'
    : process.env.DB_PATH
      ? path.resolve(process.env.DB_PATH)
      : path.join(__dirname, 'data', 'nxtply.db');
}

export function getDb() {
  if (!db) {
    const dbPath = resolveDbPath();
    if (dbPath !== ':memory:') {
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
    runMigrations(db);
  }
  return db;
}

export function resetDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 0,
      drills TEXT NOT NULL DEFAULT '[]',
      notes TEXT DEFAULT '',
      intention TEXT DEFAULT '',
      session_type TEXT DEFAULT '',
      position TEXT DEFAULT 'general',
      quick_rating INTEGER DEFAULT 3,
      body_check TEXT,
      shooting TEXT,
      passing TEXT,
      fitness TEXT,
      delivery TEXT,
      attacking TEXT,
      reflection TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      opponent TEXT NOT NULL,
      result TEXT NOT NULL CHECK(result IN ('W', 'D', 'L')),
      minutes_played INTEGER DEFAULT 0,
      goals INTEGER DEFAULT 0,
      assists INTEGER DEFAULT 0,
      shots INTEGER DEFAULT 0,
      passes_completed INTEGER DEFAULT 0,
      rating INTEGER DEFAULT 6,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(date);

    CREATE TABLE IF NOT EXISTS custom_drills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
      distance_unit TEXT DEFAULT 'km',
      weekly_goal INTEGER DEFAULT 3,
      age_group TEXT,
      skill_level TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS personal_records (
      id INTEGER PRIMARY KEY CHECK(id = 1) DEFAULT 1,
      data TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO personal_records (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS training_plans (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      drills TEXT NOT NULL DEFAULT '[]',
      target_duration INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_training_plans_date ON training_plans(date);

    CREATE TABLE IF NOT EXISTS idp_goals (
      id TEXT PRIMARY KEY,
      corner TEXT NOT NULL CHECK(corner IN ('technical', 'tactical', 'physical', 'psychological')),
      text TEXT NOT NULL,
      target_date TEXT,
      progress INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS decision_journal (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      match_id TEXT,
      match_label TEXT,
      decisions TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_decision_journal_date ON decision_journal(date);

    CREATE TABLE IF NOT EXISTS benchmarks (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('lspt', 'lsst')),
      score REAL NOT NULL DEFAULT 0,
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_benchmarks_date ON benchmarks(date);

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// Migration system — add new migrations to the array
const migrations = [
  { version: 1, up: (db) => db.exec("ALTER TABLE sessions ADD COLUMN idp_goals TEXT DEFAULT '[]'") },
  { version: 2, up: (db) => {
    db.exec("ALTER TABLE settings ADD COLUMN player_name TEXT");
    db.exec("ALTER TABLE settings ADD COLUMN onboarding_complete INTEGER DEFAULT 0");
  }},
  { version: 3, up: (db) => db.exec("ALTER TABLE sessions ADD COLUMN media_links TEXT DEFAULT '[]'") },
  { version: 4, up: (db) => {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'player'");
    db.exec(`
      CREATE TABLE IF NOT EXISTS invite_codes (
        code TEXT PRIMARY KEY,
        coach_id INTEGER NOT NULL REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        used_by INTEGER REFERENCES users(id),
        used_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_invite_codes_coach ON invite_codes(coach_id);

      CREATE TABLE IF NOT EXISTS coach_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coach_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        joined_at TEXT DEFAULT (datetime('now')),
        UNIQUE(coach_id, player_id)
      );
      CREATE INDEX IF NOT EXISTS idx_cp_coach ON coach_players(coach_id);
      CREATE INDEX IF NOT EXISTS idx_cp_player ON coach_players(player_id);

      CREATE TABLE IF NOT EXISTS assigned_plans (
        id TEXT PRIMARY KEY,
        coach_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        drills TEXT NOT NULL DEFAULT '[]',
        target_duration INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_ap_player_date ON assigned_plans(player_id, date);
      CREATE INDEX IF NOT EXISTS idx_ap_coach ON assigned_plans(coach_id);
    `);
  }},
  { version: 5, up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS video_analyses (
        id TEXT PRIMARY KEY,
        video_path TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        duration_seconds REAL,
        status TEXT DEFAULT 'uploaded' CHECK(status IN ('uploaded', 'extracting', 'analyzing', 'complete', 'error')),
        frames_extracted INTEGER DEFAULT 0,
        analysis_result TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT
      );
    `);
  }},
  { version: 6, up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS friend_connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_a INTEGER NOT NULL,
        user_b INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_a, user_b)
      );
      CREATE INDEX IF NOT EXISTS idx_friends_a ON friend_connections(user_a);
      CREATE INDEX IF NOT EXISTS idx_friends_b ON friend_connections(user_b);
    `);
    db.exec("ALTER TABLE invite_codes ADD COLUMN type TEXT DEFAULT 'coach'");
    db.exec("ALTER TABLE video_analyses ADD COLUMN clip_path TEXT");
    db.exec("ALTER TABLE video_analyses ADD COLUMN clip_timestamp REAL");
  }},
  { version: 7, up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_user INTEGER NOT NULL,
        to_user INTEGER NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(from_user, to_user);
      CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user);

      CREATE TABLE IF NOT EXISTS session_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_comments_session ON session_comments(session_id);
    `);
  }},
  { version: 8, up: (db) => {
    db.exec("ALTER TABLE settings ADD COLUMN getting_started_complete INTEGER DEFAULT 0");
  }},
  { version: 9, up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS drills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        subcategory TEXT,
        difficulty TEXT NOT NULL DEFAULT 'beginner',
        duration_minutes INTEGER NOT NULL,
        reps_description TEXT,
        equipment_needed TEXT,
        space_needed TEXT,
        description TEXT NOT NULL,
        coaching_points TEXT,
        variations TEXT,
        position_relevance TEXT,
        is_preset INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.exec(`BEGIN TRANSACTION;
      -- Technical - Shooting (8)
      INSERT INTO drills (name, slug, category, subcategory, difficulty, duration_minutes, reps_description, equipment_needed, space_needed, description, coaching_points, variations, position_relevance) VALUES
      ('Finishing Drill', 'finishing-drill', 'Technical', 'Shooting', 'intermediate', 20, '3 sets of 10 shots', 'Ball, cones (4), goal', 'large (half pitch)', 'Receive the ball from various angles around the box and finish on goal. Focus on composure, placement, and hitting the target under simulated pressure.', '["Lock your ankle when striking","Keep your head over the ball for low shots","Place your standing foot beside the ball pointing at target","Follow through towards the goal","Pick your spot before you receive"]', '["Add a passive defender trailing the attacker","Limit to two touches before shooting"]', '["Striker","Attacking Midfielder"]'),
      ('Weak Foot Finishing', 'weak-foot-finishing', 'Technical', 'Shooting', 'intermediate', 15, '4 sets of 8 shots (weak foot only)', 'Ball, cones (2), goal', 'large (half pitch)', 'Dedicated finishing practice using only the weaker foot. Shots taken from inside and around the edge of the box to build confidence and accuracy on the non-dominant side.', '["Focus on technique over power","Open your body to create a clean angle","Strike through the centre of the ball","Start with placement, add power gradually","Visualise the ball hitting the net before shooting"]', '["Volleys with weak foot from crosses","One-touch finishes only"]', '["Striker","Winger","Attacking Midfielder"]'),
      ('One-Touch Finishing', 'one-touch-finishing', 'Technical', 'Shooting', 'advanced', 15, '3 sets of 8 first-time shots', 'Ball, cones (4), goal', 'large (half pitch)', 'Practice finishing with a single touch from passes delivered at different speeds and heights. Develops reaction time, body shape adjustment, and instinctive finishing.', '["Set your body early before the ball arrives","Redirect the pace of the pass into the goal","Stay on your toes and be ready to adjust","Angle your run to open up the goal","Keep the shot low for higher conversion"]', '["Add a server playing random balls","Alternate between left and right foot"]', '["Striker","Winger"]'),
      ('Power Shooting', 'power-shooting', 'Technical', 'Shooting', 'intermediate', 15, '3 sets of 8 shots', 'Ball, cones (2), goal', 'large (half pitch)', 'Drive shots from 20-25 yards out using the laces. Focus on generating maximum power while keeping shots on target through proper technique and body mechanics.', '["Strike through the ball with your laces","Plant foot firm and pointing at target","Lean slightly over the ball","Hit the centre or top half of the ball","Snap your leg through on the follow-through"]', '["Add a wall of mannequins to shoot over or around","Hit from different angles"]', '["Midfielder","Striker"]'),
      ('Placement Shooting', 'placement-shooting', 'Technical', 'Shooting', 'beginner', 15, '4 sets of 6 shots', 'Ball, cones (4), goal', 'large (half pitch)', 'Aim for specific target zones in the goal using the inside of the foot or instep. Uses corner targets to improve accuracy and teaches picking the right shot for each situation.', '["Side-foot for accuracy into corners","Look up and pick your corner","Steady your breathing before the shot","Curl the ball away from the keeper","Prioritise corners low and far post"]', '["Reduce target size with smaller goals","Shoot after a quick turn"]', '["Striker","Attacking Midfielder","Midfielder"]'),
      ('Volleys & Half-Volleys', 'volleys-and-half-volleys', 'Technical', 'Shooting', 'advanced', 15, '3 sets of 8 attempts', 'Ball, cones (2), goal', 'large (half pitch)', 'Practice striking the ball cleanly out of the air and on the half-bounce. Feeds come from the side and front to simulate game crosses and clearances.', '["Watch the ball onto your foot","Keep your body over the ball to stay low","Time your approach to meet the ball at the right height","Lock your ankle firmly","Adjust your body shape early"]', '["Practice with a partner throwing feeds at varying heights","Scissor-kick or bicycle-kick attempts for advanced players"]', '["Striker","Attacking Midfielder"]'),
      ('Turning & Shooting', 'turning-and-shooting', 'Technical', 'Shooting', 'intermediate', 15, '3 sets of 8 reps', 'Ball, cones (4), goal', 'large (half pitch)', 'Receive with back to goal, execute a turn to create space, then shoot. Practices various turns including Cruyff, drag-back, and spin turns before finishing.', '["Check your shoulder before receiving","Use your body to shield the ball while turning","Explode out of the turn into your shot","Take your first touch away from the defender","Choose the right turn based on defender position"]', '["Add a passive defender behind the attacker","Limit time between turn and shot to 2 seconds"]', '["Striker","Attacking Midfielder"]'),
      ('Free Kicks', 'free-kicks', 'Technical', 'Shooting', 'advanced', 20, '15-20 attempts from various distances', 'Ball, cones (4), wall mannequins, goal', 'large (half pitch)', 'Practise dead-ball delivery and shooting from free kick situations 18-30 yards out. Work on curl, dip, power, and placement over and around a wall.', '["Use a consistent run-up routine","Strike across the ball for curl","Hit the valve area for dip and knuckle","Visualise the trajectory before stepping up","Practise both inswing and outswing deliveries"]', '["Alternate between power and finesse techniques","Practise with a two-person wall vs four-person wall"]', '["Midfielder","Attacking Midfielder","Striker"]'),

      -- Technical - Passing (8)
      ('Wall Passes (1-touch)', 'wall-passes-1-touch', 'Technical', 'Passing', 'beginner', 10, '5 sets of 20 passes', 'Ball, wall', 'small (3x3m)', 'Rapid one-touch passing against a wall, focusing on clean first-time contact and accuracy. Alternate between inside foot, outside foot, and instep.', '["Cushion the ball with a soft ankle on reception","Stay on the balls of your feet","Face the wall square with shoulders open","Aim for a consistent target spot on the wall","Keep passes firm and along the ground"]', '["Increase distance from the wall for power","Alternate left and right foot each pass"]', '["All"]'),
      ('Short Passing Combos', 'short-passing-combos', 'Technical', 'Passing', 'beginner', 15, '4 sets of 3 minutes', 'Ball, cones (6)', 'medium (10x10m)', 'Passing patterns with movement between cones simulating quick interplay. Includes give-and-go, third-man runs, and overlapping combinations.', '["Weight of pass should be firm enough to reach partner but soft enough to control","Communicate before receiving","Move after you pass — never stand still","Check your shoulder before receiving","Open your body to see the next pass"]', '["Increase tempo every set","Add a passive defender to the grid"]', '["Midfielder","Attacking Midfielder"]'),
      ('Long-Range Passing', 'long-range-passing', 'Technical', 'Passing', 'intermediate', 15, '3 sets of 10 passes each side', 'Ball, cones (4)', 'large (half pitch)', 'Hit accurate long passes over 30-40 yards to a target zone or partner. Work on driven passes, lofted balls, and diagonal switches of play.', '["Plant foot beside the ball and lean back slightly for loft","Strike the lower half of the ball for height","Follow through fully in the direction of the target","Use your arms for balance","Choose instep for loft, laces for driven"]', '["Add a moving target to hit on the run","Practise under pressure from a closing defender"]', '["Defender","Midfielder"]'),
      ('Weak Foot Passing', 'weak-foot-passing', 'Technical', 'Passing', 'beginner', 10, '4 sets of 15 passes', 'Ball, wall or partner', 'small (3x3m)', 'Build comfort and accuracy with the weaker foot through repetitive short and medium passes. Start with simple inside-foot passes and progress to driven balls.', '["Focus on clean contact through the centre of the ball","Start slow and build speed gradually","Keep your ankle locked","Use the inside of the foot for reliability","Repeat the same pass until it feels natural"]', '["Increase distance progressively","Add one-touch constraint"]', '["All"]'),
      ('Through Ball Practice', 'through-ball-practice', 'Technical', 'Passing', 'advanced', 15, '3 sets of 10 attempts', 'Ball, cones (8), bibs', 'large (half pitch)', 'Play weighted through balls into the path of a runner making timed runs behind a defensive line of cones. Focus on timing, weight, and disguise.', '["Play the ball into space ahead of the runner","Use the side foot for accuracy into the channel","Disguise your intent with body shape","Time the pass with the runner s movement","Vary between ground and lofted through balls"]', '["Add a recovering defender to race the attacker","Play from deeper positions"]', '["Midfielder","Attacking Midfielder"]'),
      ('Lofted Passes', 'lofted-passes', 'Technical', 'Passing', 'intermediate', 15, '3 sets of 10 passes', 'Ball, cones (4)', 'large (half pitch)', 'Practise chipping and lofting the ball over medium distances with accuracy and controlled flight. Includes dink passes, chipped balls, and floated deliveries.', '["Get your foot under the ball and lean back","Use a short sharp jab for chips","Follow through upward for height","Read the wind and adjust","Land the ball softly into the target zone"]', '["Chip over a raised obstacle like a hurdle","Alternate feet each set"]', '["Midfielder","Defender","Goalkeeper"]'),
      ('First-Time Passing Combos', 'first-time-passing-combos', 'Technical', 'Passing', 'intermediate', 15, '4 sets of 3 minutes', 'Ball, cones (6)', 'medium (10x10m)', 'Two or three players exchange one-touch passes in set patterns, building speed and rhythm. Encourages quick thinking and precise weight of pass.', '["Set your body before the ball arrives","Angle your foot to redirect accurately","Keep your weight forward and balanced","Look for the next pass before receiving","Communicate with your partner"]', '["Add a fourth player and rotate positions","Increase the grid size and pass distance"]', '["Midfielder","Attacking Midfielder"]'),
      ('Passing Under Pressure', 'passing-under-pressure', 'Technical', 'Passing', 'advanced', 15, '4 sets of 3 minutes', 'Ball, cones (6), bibs', 'medium (10x10m)', 'Maintain possession in tight spaces with active defenders closing you down. Develops composure on the ball, quick decision-making, and passing accuracy under pressure.', '["Take your first touch away from pressure","Play simple when pressed, creative when free","Use your body to shield before passing","Scan before you receive to know your options","Stay calm — rushed passes lead to turnovers"]', '["Reduce grid size to increase difficulty","Limit to two touches then one touch"]', '["Midfielder","Defender"]'),

      -- Technical - Dribbling (10)
      ('Dribbling Circuit', 'dribbling-circuit', 'Technical', 'Dribbling', 'beginner', 15, '4 laps of the circuit', 'Ball, cones (10)', 'medium (10x10m)', 'Navigate a course of cones using various dribbling techniques: inside-outside, sole rolls, and changes of direction. Builds close control and comfort on the ball.', '["Keep the ball close to your feet","Use both feet equally","Look up between cones, not at the ball","Accelerate out of each turn","Bend your knees and stay low for balance"]', '["Time each lap and try to beat your record","Add a passive chaser for pressure"]', '["All"]'),
      ('Cone Weave Dribbling', 'cone-weave-dribbling', 'Technical', 'Dribbling', 'beginner', 10, '5 sets of 6 weaves', 'Ball, cones (6)', 'medium (10x10m)', 'Weave in and out of a line of cones spaced 1-2 metres apart using inside and outside of both feet. Builds rhythm and close control at speed.', '["Use the inside foot to push past one cone, outside to go around the next","Stay on the balls of your feet","Alternate leading foot each run","Keep touches small and frequent","Gradually increase speed as technique improves"]', '["Reduce cone spacing to 0.5m for tighter control","Use only the outside of the foot"]', '["Winger","Attacking Midfielder","Striker"]'),
      ('Ball Mastery Routine', 'ball-mastery-routine', 'Technical', 'Dribbling', 'beginner', 15, '3 sets of 5 minutes', 'Ball', 'small (3x3m)', 'A series of stationary ball manipulation moves including toe taps, sole rolls, foundations, and Vs. Develops foot-eye coordination and a soft touch.', '["Stay light on your feet and keep rhythm","Use the sole of the foot for control","Start slow and master the pattern before adding speed","Keep the ball within your body frame","Practise to music to build rhythm"]', '["Perform the routine with eyes closed for advanced challenge","Add movement between cones while doing moves"]', '["All"]'),
      ('Close Control Box', 'close-control-box', 'Technical', 'Dribbling', 'intermediate', 10, '4 sets of 2 minutes', 'Ball, cones (4)', 'small (3x3m)', 'Dribble within a small 3x3m box, keeping the ball under tight control while performing turns, feints, and changes of direction. Simulates tight spaces in a game.', '["Use all surfaces of both feet","Practise sharp changes of direction","Keep the ball within the box at all times","React to imaginary defenders","Stay low and balanced"]', '["Reduce box size to 2x2m","Add a second ball for multi-ball control"]', '["Midfielder","Attacking Midfielder","Winger"]'),
      ('Speed Dribbling', 'speed-dribbling', 'Technical', 'Dribbling', 'intermediate', 10, '5 sets of 30m sprints', 'Ball, cones (4)', 'large (half pitch)', 'Dribble at maximum speed over 30 metres while maintaining control. Push the ball ahead with longer touches and sprint to it, simulating a breakaway.', '["Push the ball 2-3 feet ahead and sprint to it","Use the outside of your foot or laces","Keep your head up to see the pitch","Decelerate and regain close control at the end","Drive your arms for speed"]', '["Add a chasing defender to race against","Dribble through a slalom at speed"]', '["Winger","Striker","Full-back"]'),
      ('1v1 Moves Practice', '1v1-moves-practice', 'Technical', 'Dribbling', 'intermediate', 15, '4 sets of 5 attempts per move', 'Ball, cones (4)', 'medium (10x10m)', 'Practise specific 1v1 skills like stepovers, scissors, body feints, and nutmegs against a cone or passive defender. Build a repertoire of moves to beat opponents.', '["Sell the fake by committing your body","Explode past the defender after the move","Practise each move on both sides","Use a change of pace to wrong-foot the defender","Pick the right move for the angle of approach"]', '["Progress to an active defender at half pace","Chain two moves together before accelerating"]', '["Winger","Striker","Attacking Midfielder"]'),
      ('Juggling Progression', 'juggling-progression', 'Technical', 'Dribbling', 'beginner', 10, 'Beat your personal record', 'Ball', 'small (3x3m)', 'Keep the ball airborne using feet, thighs, and head. Progress from catching between touches to continuous juggling, building touch, timing, and coordination.', '["Start with one touch and catch, then build up","Strike the ball gently underneath centre","Use your thigh to cushion when the ball drops","Keep your eyes on the ball","Relax your body — tension kills control"]', '["Juggle while walking forward","Alternate: foot-thigh-head pattern"]', '["All"]'),
      ('First Touch Receiving', 'first-touch-receiving', 'Technical', 'Dribbling', 'intermediate', 15, '4 sets of 10 receives', 'Ball, cones (4), wall or partner', 'medium (10x10m)', 'Receive passes from different angles and heights, controlling the ball with a single touch into space. Practise cushion control, side-foot traps, and chest-to-foot.', '["Move towards the ball to receive","Cushion the ball by withdrawing the contact surface","Direct your first touch into open space","Get your body side-on to see the pitch","Stay on your toes and be ready to adjust"]', '["Receive and turn in one motion","Have passes delivered at random angles"]', '["All"]'),
      ('Drag Back & Turn', 'drag-back-and-turn', 'Technical', 'Dribbling', 'beginner', 10, '4 sets of 10 reps', 'Ball, cones (2)', 'small (3x3m)', 'Use the sole of the foot to drag the ball backwards then quickly turn and accelerate in the opposite direction. Essential for evading press and changing play.', '["Place the sole on top of the ball and roll it back","Spin on your standing foot quickly","Accelerate away from the imaginary defender","Practise on both feet","Keep the drag-back tight and close to your body"]', '["Chain with a stepover before the drag-back","Perform in a small grid with a passive defender"]', '["Midfielder","Attacking Midfielder","Winger"]'),
      ('La Croqueta Drill', 'la-croqueta-drill', 'Technical', 'Dribbling', 'advanced', 10, '4 sets of 10 reps', 'Ball, cones (4)', 'small (3x3m)', 'Practise the La Croqueta move: push the ball laterally from one foot to the other using the inside of both feet in quick succession to evade a tackle.', '["Use the inside of one foot to push across to the other","Keep the ball on the ground and close","Shift your body weight with the ball","Timing is key — do it as the defender commits","Accelerate away after the second touch"]', '["Perform at speed against a closing cone defender","Chain with a pass or shot after the move"]', '["Midfielder","Attacking Midfielder","Winger"]'),

      -- Technical - Crossing (4)
      ('Crossing & Finishing', 'crossing-and-finishing', 'Technical', 'Crossing', 'intermediate', 20, '3 sets of 8 crosses per side', 'Ball, cones (6), goal', 'large (half pitch)', 'Deliver crosses from wide areas for a striker to finish. Alternate between early crosses, byline pull-backs, and whipped deliveries into the box.', '["Hit the area between the keeper and the back line","Aim for specific zones: near post, far post, cut-back","Use your instep for pace and curl","Look up and pick your target before crossing","Vary the type of cross to keep defenders guessing"]', '["Add a defender marking the striker","Cross first-time from a pass"]', '["Winger","Full-back","Striker"]'),
      ('Driven Cross Practice', 'driven-cross-practice', 'Technical', 'Crossing', 'intermediate', 15, '3 sets of 8 crosses', 'Ball, cones (4), goal', 'large (half pitch)', 'Low, hard crosses driven across the face of goal from wide positions. Practise hitting the ball at pace along the ground or at knee height into danger zones.', '["Strike through the centre of the ball with your laces","Keep the ball low — below knee height","Aim for the area between the six-yard box and penalty spot","Drive across the face of goal, away from the keeper","Time your delivery with the runners movement"]', '["Add a near-post runner to flick on","Cross after beating a cone defender"]', '["Winger","Full-back"]'),
      ('Whipped Cross Technique', 'whipped-cross-technique', 'Technical', 'Crossing', 'advanced', 15, '3 sets of 8 crosses', 'Ball, cones (4), goal', 'large (half pitch)', 'Deliver curling, whipped crosses with pace and accuracy into the box from wide areas. Focus on getting the ball to dip and swing away from the goalkeeper.', '["Approach the ball from a slight angle","Use the inside of your foot and wrap around the ball","Follow through across your body for curl","Aim to land the ball between the 6-yard box and penalty spot","Generate whip by snapping your ankle through the ball"]', '["Practise from both flanks","Hit a moving target runner"]', '["Winger","Full-back"]'),
      ('Set Piece Delivery', 'set-piece-delivery', 'Technical', 'Crossing', 'advanced', 15, '15-20 deliveries', 'Ball, cones (6), goal', 'large (half pitch)', 'Practise corner kicks and wide free kick deliveries. Work on inswingers, outswingers, near-post flicks, and back-post deliveries with consistent accuracy.', '["Use a consistent run-up for repeatability","Vary between inswing and outswing","Aim for specific zones: near post, penalty spot, far post","Communicate the delivery type with teammates","Adjust your angle of approach based on swing direction"]', '["Deliver with pressure from a defender on the edge","Short corner variations"]', '["Midfielder","Winger"]'),

      -- Physical - Speed (8)
      ('Sprint Intervals', 'sprint-intervals', 'Physical', 'Speed', 'intermediate', 15, '6-8 sets of 30m sprints with 45s rest', 'Cones (4)', 'large (half pitch)', 'Repeated short sprints with timed recovery periods. Develops top-end speed and the ability to recover and sprint again, mimicking match demands.', '["Drive your arms powerfully","Stay on the balls of your feet","Lean forward and push off explosively","Focus on the first 5 metres of acceleration","Use rest periods fully — walk back slowly"]', '["Increase sprint distance to 40m","Reduce rest to 30 seconds for conditioning"]', '["All"]'),
      ('Ladder Footwork', 'ladder-footwork', 'Physical', 'Speed', 'beginner', 10, '4 sets of 6 patterns', 'Agility ladder', 'small (3x3m)', 'Quick feet drills through an agility ladder including two-foot runs, lateral shuffles, in-out patterns, and single-leg hops. Improves foot speed and coordination.', '["Stay light on your feet — barely touch the ground","Drive your knees up","Pump your arms for rhythm","Look ahead, not down at your feet","Quality over speed — master pattern first"]', '["Increase speed each set","Add a sprint at the end of the ladder"]', '["All"]'),
      ('T-Drill', 't-drill', 'Physical', 'Speed', 'intermediate', 10, '4-6 reps with 60s rest', 'Cones (4)', 'medium (10x10m)', 'Sprint forward, shuffle laterally, backpedal in a T-shaped pattern. Develops multi-directional speed and the ability to transition between movement patterns.', '["Sprint to the first cone then decelerate","Side-shuffle without crossing your feet","Stay low in your lateral movements","Backpedal with short quick steps","Touch each cone for accuracy"]', '["Time each rep and aim to improve","Add a ball to dribble through the pattern"]', '["Defender","Midfielder","Full-back"]'),
      ('Cone Shuttle Runs', 'cone-shuttle-runs', 'Physical', 'Speed', 'beginner', 10, '4-6 sets of 4 shuttles', 'Cones (5)', 'medium (10x10m)', 'Sprint between cones placed at 5m, 10m, 15m, and 20m, touching each cone and returning to the start. Builds acceleration, deceleration, and change of direction.', '["Decelerate in 2-3 steps before the turn","Lower your centre of gravity to change direction","Push off your outside foot to turn","Stay on your toes throughout","Drive your arms for acceleration"]', '["Place cones at random distances","Turn and sprint on a whistle or visual cue"]', '["All"]'),
      ('Acceleration Sprints', 'acceleration-sprints', 'Physical', 'Speed', 'intermediate', 10, '6 sets of 10m sprints with walk-back rest', 'Cones (2)', 'medium (10x10m)', 'Explosive 10-metre sprints from a standing start, focusing purely on the first few steps of acceleration that matter most in football.', '["Drive forward at a 45-degree body lean","Pump your arms aggressively","Take short powerful steps initially","Push off the balls of your feet","Stay low for the first 3-4 steps"]', '["Start from different positions: seated, lying, backward","React to a partner s call or visual signal"]', '["All"]'),
      ('Zig-Zag Agility', 'zig-zag-agility', 'Physical', 'Speed', 'intermediate', 10, '5 sets with 45s rest', 'Cones (8)', 'medium (10x10m)', 'Sprint in a zig-zag pattern through offset cones, cutting sharply at each one. Develops change-of-direction speed and the ability to shift weight quickly.', '["Plant your outside foot hard to change direction","Keep a low centre of gravity","Lean into each turn","Accelerate out of each cut","Stay on the balls of your feet throughout"]', '["Add a ball and dribble through the pattern","Race a partner through parallel setups"]', '["Winger","Full-back","Striker"]'),
      ('Deceleration Training', 'deceleration-training', 'Physical', 'Speed', 'intermediate', 10, '5 sets of 6 reps', 'Cones (4)', 'medium (10x10m)', 'Sprint at full speed and decelerate to a complete stop within a marked zone. Builds eccentric strength and reduces injury risk from sudden stops in matches.', '["Lower your hips as you brake","Take short choppy steps to decelerate","Absorb force through bent knees","Keep your chest up during deceleration","Practise stopping within 2-3 steps"]', '["Decelerate then immediately change direction","Sprint, stop, then react to a direction call"]', '["All"]'),
      ('Reaction Sprints', 'reaction-sprints', 'Physical', 'Speed', 'advanced', 10, '8 sets of short sprints', 'Cones (4), partner', 'medium (10x10m)', 'React to a visual or auditory signal and sprint in the indicated direction. Develops reaction time and the explosive first step that creates separation.', '["Stay in an athletic ready position","React to the signal, not anticipation","Explode off the mark with your first step","Keep your eyes on the cue giver","Stay mentally engaged between reps"]', '["Use different coloured cones for direction cues","React to a dropped ball before it bounces twice"]', '["All"]'),

      -- Physical - Strength (6)
      ('Bodyweight Circuit', 'bodyweight-circuit', 'Physical', 'Strength', 'beginner', 20, '3 rounds of 8 exercises, 40s work / 20s rest', 'Exercise mat', 'small (3x3m)', 'Full-body strength circuit using bodyweight exercises: squats, lunges, push-ups, planks, mountain climbers, burpees, glute bridges, and lateral bounds.', '["Maintain proper form throughout each exercise","Breathe steadily — exhale on effort","Engage your core during every movement","Control the lowering phase of each rep","Rest fully between rounds if needed"]', '["Add resistance bands for extra load","Increase to 50s work / 10s rest"]', '["All"]'),
      ('Core Stability Routine', 'core-stability-routine', 'Physical', 'Strength', 'beginner', 15, '3 sets of 6 exercises, 30s each', 'Exercise mat', 'small (3x3m)', 'Targeted core circuit including front plank, side planks, dead bugs, bird dogs, bicycle crunches, and hollow holds. Builds the core strength essential for balance and power.', '["Keep your spine neutral during planks","Brace your core as if bracing for impact","Breathe steadily — do not hold your breath","Control every movement slowly","Engage glutes alongside your core"]', '["Add a stability ball for advanced variations","Increase hold times to 45 seconds"]', '["All"]'),
      ('Single-Leg Stability', 'single-leg-stability', 'Physical', 'Strength', 'intermediate', 15, '3 sets of 8 reps per leg', 'Exercise mat, balance pad (optional)', 'small (3x3m)', 'Single-leg exercises to build balance and ankle stability: single-leg squats, single-leg deadlifts, and single-leg hops. Critical for injury prevention.', '["Keep your hips level throughout each rep","Focus on a fixed point for balance","Engage your core to stabilise","Control the lowering phase","Land softly on each hop with a bent knee"]', '["Perform on an unstable surface like a balance pad","Add a medicine ball for load"]', '["All"]'),
      ('Plyometric Box Jumps', 'plyometric-box-jumps', 'Physical', 'Strength', 'advanced', 15, '4 sets of 6 jumps', 'Plyometric box or sturdy step', 'small (3x3m)', 'Explosive jumping onto and off a box to develop power in the legs. Includes box jumps, depth jumps, and single-leg step-ups for football-specific power.', '["Land softly with bent knees to absorb impact","Drive your arms upward for height","Fully extend your hips at the top","Step down rather than jumping down to protect knees","Start with a lower box and progress gradually"]', '["Add a single-leg jump variation","Perform a sprint immediately after each jump"]', '["All"]'),
      ('Resistance Band Warm-Up', 'resistance-band-warm-up', 'Physical', 'Strength', 'beginner', 10, '2 sets of 10 reps per exercise', 'Resistance band', 'small (3x3m)', 'Activation exercises using a resistance band targeting glutes, hip flexors, and shoulders: lateral walks, clamshells, monster walks, and shoulder pull-aparts.', '["Keep tension on the band throughout the movement","Move slowly and with control","Focus on feeling the targeted muscle activate","Keep your core braced during standing exercises","Use a band that challenges but allows good form"]', '["Progress to a heavier band","Add ankle band walks"]', '["All"]'),
      ('Yoga for Footballers', 'yoga-for-footballers', 'Physical', 'Strength', 'beginner', 20, 'Flow through 10-12 poses', 'Exercise mat', 'small (3x3m)', 'Football-specific yoga flow targeting hamstrings, hip flexors, quads, and shoulders. Improves flexibility, balance, breathing, and mental focus for recovery.', '["Hold each pose for 5 deep breaths","Never push into pain — feel a stretch not strain","Focus on your breathing throughout","Use blocks or a wall for balance if needed","Maintain a steady slow pace"]', '["Add advanced poses like Warrior III and Half Moon","Integrate balance challenges by closing your eyes"]', '["All"]'),

      -- Tactical (6)
      ('Positional Shadow Play', 'positional-shadow-play', 'Tactical', NULL, 'intermediate', 15, '3 sets of 5 minutes', 'Cones (10)', 'large (half pitch)', 'Move through your positional responsibilities without opposition, rehearsing runs, positioning, and shape. Walk through different phases of play: build-up, transition, and attack.', '["Visualise opponents and react to imaginary cues","Maintain correct distances between positions","Practise the movements at match tempo","Check your shoulder as you would in a game","Focus on off-the-ball movement patterns"]', '["Add a ball and combine shadow play with passing","Have a coach call out phases to transition between"]', '["All"]'),
      ('Scanning Practice', 'scanning-practice', 'Tactical', NULL, 'intermediate', 10, '4 sets of 3 minutes', 'Ball, cones (4), partner', 'medium (10x10m)', 'Practise checking your shoulders before receiving the ball. A partner holds up fingers or colours behind you, and you must identify them while controlling the ball.', '["Scan before the ball is played to you","Check both shoulders — left and right","Process the information quickly and decide","Make scanning a habit, not a conscious effort","Scan at least twice before receiving"]', '["Add more signal givers in multiple positions","Increase pass speed to reduce scanning time"]', '["Midfielder","Defender","Attacking Midfielder"]'),
      ('Decision-Making Cones', 'decision-making-cones', 'Tactical', NULL, 'intermediate', 15, '4 sets of 8 reps', 'Ball, cones (8, multi-coloured)', 'medium (10x10m)', 'Dribble towards cones and react to a called colour or signal to decide which direction to pass, dribble, or shoot. Develops in-game decision-making under pressure.', '["Make your decision early and commit to it","Keep your head up to see the signal","Execute quickly after deciding","Vary your decisions — do not become predictable","Simulate real game options: pass, dribble, or shoot"]', '["Add a time limit per decision","Use a partner to provide random signals"]', '["Midfielder","Attacking Midfielder","Winger"]'),
      ('Pressing Triggers', 'pressing-triggers', 'Tactical', NULL, 'advanced', 15, '4 sets of 3 minutes', 'Ball, cones (10), bibs', 'large (half pitch)', 'Practise recognising when to press and when to hold. React to pressing triggers like a heavy touch, backwards pass, or the ball going to a weaker player.', '["Sprint to close down when the trigger occurs","Angle your run to cut off passing lanes","Recover position quickly if the press is beaten","Communicate with nearby players","Press as a unit — not alone"]', '["Add a small-sided game with pressing rules","Reward successful press and turnovers"]', '["All"]'),
      ('Transition Sprints', 'transition-sprints', 'Tactical', NULL, 'advanced', 15, '6 sets with 45s rest', 'Ball, cones (6), bibs', 'large (half pitch)', 'Simulate transitions from defence to attack and vice versa. Sprint into position, receive or defend, then transition immediately when possession changes.', '["React instantly to the change of possession","Sprint at maximum effort in transition","Recover your shape within 3-4 seconds","Communicate during transitions","Stay mentally switched on between reps"]', '["Add a small-sided game with forced turnovers","Increase the number of transitions per set"]', '["Midfielder","Defender","Full-back"]'),
      ('Off-The-Ball Movement', 'off-the-ball-movement', 'Tactical', NULL, 'intermediate', 15, '4 sets of 4 minutes', 'Ball, cones (8)', 'large (half pitch)', 'Practise making runs without the ball: checking away and towards, diagonal runs, overlaps, and blindside runs. A partner plays passes into your timed runs.', '["Time your run to stay onside","Check away before coming to receive","Use your body to deceive the imaginary defender","Communicate when you want the ball","Vary your runs to be unpredictable"]', '["Add a passive offside line with cones","Combine with a finishing element"]', '["Striker","Winger","Attacking Midfielder"]'),

      -- Psychological (4)
      ('Pre-Match Visualization', 'pre-match-visualization', 'Psychological', NULL, 'beginner', 10, '1 session of 10 minutes', 'None', 'small (3x3m)', 'Close your eyes and mentally rehearse key match actions: first touch, winning headers, making runs, and scoring goals. Build confidence by seeing yourself succeed before the game.', '["Find a quiet space with no distractions","Visualise in vivid detail — sights, sounds, feelings","Focus on successful outcomes and positive moments","Include all senses: feel the grass, hear the crowd","Run through specific scenarios relevant to your next match"]', '["Visualise overcoming specific challenges like a strong defender","Add calming music or white noise in the background"]', '["All"]'),
      ('Pressure Finishing', 'pressure-finishing', 'Psychological', NULL, 'advanced', 15, '3 rounds of 5 shots with consequences', 'Ball, cones (4), goal', 'large (half pitch)', 'Finish under simulated pressure: time limits, score targets, and consequences for misses (e.g., extra sprints). Builds mental resilience and composure in front of goal.', '["Treat every shot as if it is a match-winner","Control your breathing before each attempt","Block out the consequence and focus on technique","Develop a consistent pre-shot routine","Stay positive after a miss and reset quickly"]', '["Reduce time allowed per shot","Add crowd noise through a speaker"]', '["Striker","Attacking Midfielder","Winger"]'),
      ('Breathing & Focus Reset', 'breathing-and-focus-reset', 'Psychological', NULL, 'beginner', 5, '3 rounds of 4-7-8 breathing', 'None', 'small (3x3m)', 'Use controlled breathing techniques (4 seconds inhale, 7 hold, 8 exhale) to reset focus and calm nerves. Ideal between drills, at half-time, or before a big moment.', '["Inhale through your nose for 4 seconds","Hold your breath for 7 seconds","Exhale slowly through your mouth for 8 seconds","Focus solely on the counting and your breath","Use this anytime you feel anxious or unfocused"]', '["Try box breathing: 4-4-4-4 for variety","Pair with a body scan to release physical tension"]', '["All"]'),
      ('Post-Session Reflection', 'post-session-reflection', 'Psychological', NULL, 'beginner', 10, '1 reflection per session', 'Notebook or phone', 'small (3x3m)', 'After every session, write down three things you did well, one area to improve, and your focus for next time. Builds self-awareness and a growth mindset.', '["Be honest but not harsh with yourself","Celebrate small improvements","Write specific observations, not generalities","Link your improvement area to a specific drill for next time","Review previous reflections to track progress over time"]', '["Record a voice note instead of writing","Share your reflection with a coach or training partner"]', '["All"]'),

      -- Warm-Up & Cool-Down (4)
      ('Dynamic Warm-Up', 'dynamic-warm-up', 'Warm-Up & Cool-Down', NULL, 'beginner', 10, '2 sets of each movement over 20m', 'Cones (2)', 'medium (10x10m)', 'Full-body dynamic stretching routine: high knees, butt kicks, leg swings, lateral shuffles, walking lunges, and hip circles. Prepares muscles and joints for training.', '["Start slow and gradually increase range of motion","Perform each movement through full range","Keep your core engaged throughout","Breathe naturally and stay relaxed","Cover all major muscle groups"]', '["Add a ball to the routine for specificity","Increase pace to raise heart rate further"]', '["All"]'),
      ('Ball Warm-Up', 'ball-warm-up', 'Warm-Up & Cool-Down', NULL, 'beginner', 10, '5-8 minutes of progressive passing and movement', 'Ball', 'medium (10x10m)', 'Warm up with the ball at your feet: gentle dribbling, passing against a wall, light juggling, and low-intensity ball manipulation. Gets your touch sharp before the main session.', '["Start with gentle touches and build intensity","Alternate feet frequently","Include all surfaces: sole, inside, outside, laces","Move around the space, do not stay stationary","Combine with light jogging and changes of direction"]', '["Add a partner for passing warm-up","Finish with 10 first-time passes at medium pace"]', '["All"]'),
      ('Static Cool-Down Stretches', 'static-cool-down-stretches', 'Warm-Up & Cool-Down', NULL, 'beginner', 10, 'Hold each stretch for 30 seconds', 'Exercise mat', 'small (3x3m)', 'Post-training static stretching routine targeting quads, hamstrings, calves, hip flexors, glutes, and groin. Reduces muscle tension and aids recovery.', '["Hold each stretch for at least 30 seconds","Breathe deeply and relax into the stretch","Never bounce — hold the position steady","Stretch all major muscle groups used in the session","Cool down while your muscles are still warm"]', '["Add a partner for assisted stretches","Include upper body stretches for goalkeepers"]', '["All"]'),
      ('Foam Rolling Recovery', 'foam-rolling-recovery', 'Warm-Up & Cool-Down', NULL, 'beginner', 10, '60 seconds per muscle group', 'Foam roller', 'small (3x3m)', 'Self-myofascial release using a foam roller on quads, hamstrings, IT band, calves, glutes, and upper back. Reduces soreness and improves tissue quality for faster recovery.', '["Roll slowly — about 1 inch per second","Pause on tender spots for 20-30 seconds","Breathe through discomfort, do not hold your breath","Avoid rolling directly on joints or bones","Roll before and after training for best results"]', '["Use a lacrosse ball for deeper trigger-point release","Add a vibrating foam roller for enhanced recovery"]', '["All"]'),

      -- Extra drill to reach 64 total
      ('Penalty Kicks', 'penalty-kicks', 'Technical', 'Shooting', 'intermediate', 10, '10-15 penalties', 'Ball, goal', 'large (half pitch)', 'Practise penalty kick technique and routine. Work on placement, power, and composure from the spot with a consistent run-up and mental approach to high-pressure situations.', '["Pick your spot before you place the ball","Use a consistent run-up every time","Strike through the ball with conviction","Keep your head down through contact","Practise both side-foot placement and driven penalties"]', '["Add pressure by simulating sudden-death situations","Alternate between left and right corners"]', '["Striker","Midfielder","Attacking Midfielder"]'),

      -- Additional presets to match existing 12 (ones not already above)
      ('Wall Passes (2-touch)', 'wall-passes-2-touch', 'Technical', 'Passing', 'beginner', 10, '5 sets of 20 passes', 'Ball, wall', 'small (3x3m)', 'Two-touch passing against a wall: control with the first touch, pass with the second. Develops a clean receiving touch and accurate distribution under rhythm.', '["Cushion the ball softly with your first touch","Set the ball to the side for a clean pass","Alternate between left and right foot","Keep your body square to the wall","Gradually increase distance as comfort grows"]', '["Add lateral movement between passes","Alternate one-touch and two-touch sets"]', '["All"]'),
      ('Shooting (Inside Box)', 'shooting-inside-box', 'Technical', 'Shooting', 'beginner', 15, '3 sets of 10 shots', 'Ball, cones (4), goal', 'large (half pitch)', 'Finishing practice from inside the 18-yard box. Receive the ball in various positions and finish quickly with an emphasis on composure and placement over power.', '["Stay calm and pick your spot","Use side foot for close-range finishes","Shoot across the goalkeeper when possible","Get your shot off quickly — no extra touches","Expect the ball and be ready to adjust"]', '["Add a closing defender","Limit to one touch inside the box"]', '["Striker","Attacking Midfielder","Winger"]'),
      ('Shooting (Outside Box)', 'shooting-outside-box', 'Technical', 'Shooting', 'intermediate', 15, '3 sets of 8 shots', 'Ball, cones (4), goal', 'large (half pitch)', 'Long-range shooting from outside the 18-yard box. Focus on technique, power, and accuracy from distance using both laces and instep drives.', '["Set the ball out of your feet to create space for the strike","Strike through the ball with your laces","Keep the ball down by leaning over it","Aim for the corners — low and hard is best","Look for the shot early and take it with confidence"]', '["Shoot after a lay-off from a partner","Add a wall of cones to shoot around"]', '["Midfielder","Attacking Midfielder","Striker"]'),
      ('Long Passing', 'long-passing', 'Technical', 'Passing', 'intermediate', 15, '3 sets of 10 passes', 'Ball, cones (4)', 'large (half pitch)', 'Hit accurate long passes over 30-40 yards using driven and lofted techniques. Targets are placed at various distances to build range and consistency.', '["Plant your standing foot firmly beside the ball","Lean back for lofted passes, stay over for driven","Follow through fully towards the target","Use your instep for height and laces for speed","Adjust for wind and surface conditions"]', '["Hit moving targets on the run","Alternate between lofted and driven deliveries"]', '["Defender","Midfielder","Goalkeeper"]'),
      ('Rondo', 'rondo', 'Technical', 'Passing', 'intermediate', 15, '4 sets of 3 minutes', 'Ball, cones (4), bibs', 'medium (10x10m)', 'Keep-ball game in a circle or grid with one or two defenders in the middle. Develops quick passing, movement, and spatial awareness under pressure.', '["Play one or two touch to keep the tempo high","Move after you pass to create a new angle","Keep the ball on the ground","Use body feints to unbalance the defender","Support the ball carrier with two passing options"]', '["Reduce the grid size for added difficulty","Play 4v2 then progress to 3v1"]', '["Midfielder","Attacking Midfielder","Defender"]');
    COMMIT;`);
  }},
  { version: 10, up: (db) => {
    db.exec("ALTER TABLE settings ADD COLUMN equipment TEXT DEFAULT '[\"ball\",\"wall\"]'");
  }},
  { version: 11, up: (db) => {
    db.exec("ALTER TABLE sessions ADD COLUMN session_insights TEXT DEFAULT '[]'");
  }},
  { version: 12, up: (db) => {
    db.exec(`
      CREATE TABLE programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        duration_weeks INTEGER NOT NULL,
        sessions_per_week INTEGER NOT NULL,
        is_preset INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE program_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        program_id INTEGER NOT NULL,
        week_number INTEGER NOT NULL,
        day_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        focus TEXT NOT NULL,
        drills TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        coaching_notes TEXT,
        FOREIGN KEY (program_id) REFERENCES programs(id)
      );

      CREATE TABLE user_programs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        program_id INTEGER NOT NULL,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        current_week INTEGER DEFAULT 1,
        current_day INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active',
        completed_sessions TEXT DEFAULT '[]',
        completed_at DATETIME,
        FOREIGN KEY (program_id) REFERENCES programs(id)
      );
    `);

    // Seed 4 progressive training programs with detailed session data
    db.exec(`BEGIN TRANSACTION;

      -- Program 1: 4-Week Finishing Mastery (Shooting, Intermediate, 3x/week, 4 weeks = 12 sessions)
      INSERT INTO programs (name, description, category, difficulty, duration_weeks, sessions_per_week)
      VALUES ('4-Week Finishing Mastery', 'A progressive shooting program that builds from foundational placement technique through power striking, movement-based finishing, and pressure scenarios. Designed for players who can strike a ball cleanly but want to become clinical in front of goal.', 'Shooting', 'intermediate', 4, 3);

      -- Week 1: Foundation
      INSERT INTO program_sessions (program_id, week_number, day_number, title, focus, drills, duration_minutes, coaching_notes)
      VALUES
        (1, 1, 1, 'Foundation — Both Feet', 'Placement and technique with both feet', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Placement Shooting","reps":"10 shots each foot","duration":12},{"name":"Weak Foot Finishing","reps":"15 shots","duration":10},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 35, 'Focus on clean contact and hitting the corners — power comes later.'),
        (1, 1, 2, 'Foundation — Inside the Box', 'Close-range composure and finishing', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Shooting (Inside Box)","reps":"3 sets of 10 shots","duration":15},{"name":"One-Touch Finishing","reps":"12 shots","duration":8},{"name":"Post-Session Reflection","reps":"1 set","duration":5}]', 38, 'Keep your body over the ball and side-foot into the corners from close range.'),
        (1, 1, 3, 'Foundation — Repetition & Rhythm', 'Building muscle memory through volume', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Finishing Drill","reps":"20 shots","duration":12},{"name":"Placement Shooting","reps":"15 shots","duration":10},{"name":"Foam Rolling Recovery","reps":"1 set","duration":8}]', 40, 'Volume day — do not rush between shots, reset your body shape every time.'),

      -- Week 2: Power & Precision
        (1, 2, 1, 'Power & Precision — Laces Strikes', 'Generating power with clean technique', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Power Shooting","reps":"3 sets of 8 shots","duration":15},{"name":"Shooting (Outside Box)","reps":"10 shots","duration":10},{"name":"Core Stability Routine","reps":"1 set","duration":8}]', 42, 'Plant foot beside the ball, lock your ankle, and strike through the centre.'),
        (1, 2, 2, 'Power & Precision — Volleys', 'Striking the ball cleanly out of the air', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Volleys & Half-Volleys","reps":"20 strikes","duration":15},{"name":"One-Touch Finishing","reps":"12 shots","duration":8},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 38, 'Watch the ball all the way onto your foot — timing beats power for volleys.'),
        (1, 2, 3, 'Power & Precision — Distance Shooting', 'Accuracy from range under fatigue', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Shooting (Outside Box)","reps":"3 sets of 8 shots","duration":15},{"name":"Power Shooting","reps":"10 shots","duration":10},{"name":"Bodyweight Circuit","reps":"2 rounds","duration":8},{"name":"Foam Rolling Recovery","reps":"1 set","duration":5}]', 45, 'Shoot after short sprints to simulate match fatigue — keep technique clean.'),

      -- Week 3: Movement
        (1, 3, 1, 'Movement — Turn & Shoot', 'Receiving with back to goal and finishing', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Turning & Shooting","reps":"15 turns + shots","duration":15},{"name":"Drag Back & Turn","reps":"10 reps each side","duration":8},{"name":"Finishing Drill","reps":"10 shots","duration":8},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 43, 'Sell the turn with a body feint, then accelerate into the shot.'),
        (1, 3, 2, 'Movement — Receive & Finish', 'First touch into shooting positions', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"One-Touch Finishing","reps":"15 shots","duration":10},{"name":"Short Passing Combos","reps":"3 sets of 5 minutes","duration":15},{"name":"Shooting (Inside Box)","reps":"10 shots","duration":8},{"name":"Post-Session Reflection","reps":"1 set","duration":5}]', 45, 'Set the ball with your first touch into the space where you want to shoot.'),
        (1, 3, 3, 'Movement — Crossing & Finishing', 'Finishing from wide deliveries', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Crossing & Finishing","reps":"15 crosses + finishes","duration":15},{"name":"Volleys & Half-Volleys","reps":"12 strikes","duration":10},{"name":"Foam Rolling Recovery","reps":"1 set","duration":5}]', 40, 'Attack the ball at the near post — do not wait for it to come to you.'),

      -- Week 4: Pressure
        (1, 4, 1, 'Pressure — Timed Finishing', 'Finishing quickly under time constraints', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Pressure Finishing","reps":"3 sets of 5 shots","duration":15},{"name":"One-Touch Finishing","reps":"10 shots","duration":8},{"name":"Shooting (Inside Box)","reps":"10 shots","duration":8},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 43, 'Decide where you are shooting before the ball arrives — no extra touches.'),
        (1, 4, 2, 'Pressure — Combination Finishing', 'Wall passes and quick combos into shots', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Short Passing Combos","reps":"3 patterns","duration":10},{"name":"Finishing Drill","reps":"15 shots","duration":12},{"name":"Turning & Shooting","reps":"10 turns","duration":8},{"name":"Core Stability Routine","reps":"1 set","duration":8}]', 45, 'Link play with a team-mate or wall before finishing — replicate match scenarios.'),
        (1, 4, 3, 'Pressure — Dead Balls & Final Test', 'Free kicks and high-pressure finishing', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Free Kicks","reps":"15 attempts","duration":12},{"name":"Penalty Kicks","reps":"10 penalties","duration":8},{"name":"Pressure Finishing","reps":"3 sets of 5 shots","duration":12},{"name":"Post-Session Reflection","reps":"1 set","duration":5}]', 44, 'Treat every dead ball like a match situation — full routine, full focus.');

      -- Program 2: Ball Mastery Fundamentals (Dribbling, Beginner, 4x/week, 4 weeks = 16 sessions)
      INSERT INTO programs (name, description, category, difficulty, duration_weeks, sessions_per_week)
      VALUES ('Ball Mastery Fundamentals', 'Build an unshakeable foundation of close control and comfort on the ball. Starts with stationary ball manipulation and juggling, then progresses to dribbling through traffic, 1v1 moves, and speed dribbling. Perfect for beginners or anyone resetting their technical base.', 'Dribbling', 'beginner', 4, 4);

      -- Week 1: Touch & Feel
      INSERT INTO program_sessions (program_id, week_number, day_number, title, focus, drills, duration_minutes, coaching_notes)
      VALUES
        (2, 1, 1, 'Touch & Feel — Sole Rolls', 'Getting comfortable with the ball under your feet', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Ball Mastery Routine","reps":"3 sets of 2 minutes","duration":10},{"name":"Close Control Box","reps":"3 sets of 2 minutes","duration":8},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 30, 'Use the sole of your foot to roll the ball in every direction — slow is smooth, smooth is fast.'),
        (2, 1, 2, 'Touch & Feel — Toe Taps & Foundations', 'Rhythm and coordination with both feet', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Ball Mastery Routine","reps":"4 sets of 2 minutes","duration":12},{"name":"Juggling Progression","reps":"3 sets of 1 minute","duration":8},{"name":"Post-Session Reflection","reps":"1 set","duration":5}]', 32, 'Keep your head up between touches — even at this stage, build the habit.'),
        (2, 1, 3, 'Touch & Feel — Juggling Basics', 'Developing a soft touch and ball control in the air', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Juggling Progression","reps":"5 sets of 1 minute","duration":10},{"name":"Ball Mastery Routine","reps":"2 sets of 3 minutes","duration":8},{"name":"Foam Rolling Recovery","reps":"1 set","duration":5}]', 30, 'Let the ball drop onto your foot — do not stab at it. Cushion every touch.'),
        (2, 1, 4, 'Touch & Feel — Combination Day', 'Mixing mastery moves with light dribbling', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Ball Mastery Routine","reps":"2 sets of 3 minutes","duration":8},{"name":"Close Control Box","reps":"3 sets of 2 minutes","duration":8},{"name":"Juggling Progression","reps":"3 sets of 1 minute","duration":5},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 33, 'Connect the moves — sole roll into a drag back, toe tap into a change of direction.'),

      -- Week 2: Control Under Movement
        (2, 2, 1, 'Control Under Movement — Cone Weaves', 'Dribbling through cones with rhythm', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Cone Weave Dribbling","reps":"8 runs","duration":12},{"name":"Ball Mastery Routine","reps":"2 sets of 2 minutes","duration":6},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 30, 'Use inside-outside touches to weave — keep the ball within one step of your body.'),
        (2, 2, 2, 'Control Under Movement — Direction Changes', 'Sharp changes of direction at pace', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Cone Weave Dribbling","reps":"6 runs","duration":10},{"name":"Drag Back & Turn","reps":"10 reps each foot","duration":8},{"name":"Close Control Box","reps":"3 sets of 2 minutes","duration":8},{"name":"Post-Session Reflection","reps":"1 set","duration":5}]', 35, 'Drop your shoulder and explode out of each turn — sell the fake.'),
        (2, 2, 3, 'Control Under Movement — Juggling Progression', 'Increasing aerial control and confidence', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Juggling Progression","reps":"5 sets of 90 seconds","duration":12},{"name":"Ball Mastery Routine","reps":"3 sets of 2 minutes","duration":8},{"name":"Foam Rolling Recovery","reps":"1 set","duration":5}]', 32, 'Try thigh-foot-thigh patterns — add body parts as confidence grows.'),
        (2, 2, 4, 'Control Under Movement — Tight Spaces', 'Keeping the ball in congested areas', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Close Control Box","reps":"4 sets of 2 minutes","duration":10},{"name":"Cone Weave Dribbling","reps":"6 runs","duration":8},{"name":"Ball Mastery Routine","reps":"2 sets of 2 minutes","duration":6},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 35, 'Smaller space means quicker feet — keep the ball glued to your sole.'),

      -- Week 3: 1v1 Moves
        (2, 3, 1, '1v1 Moves — La Croqueta & Drag Backs', 'Learning evasive moves to beat a defender', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"La Croqueta Drill","reps":"10 reps each side","duration":10},{"name":"Drag Back & Turn","reps":"10 reps each foot","duration":8},{"name":"Close Control Box","reps":"3 sets of 2 minutes","duration":8},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 35, 'Practice the move slowly first, then add pace — the move must be automatic.'),
        (2, 3, 2, '1v1 Moves — Decision Making', 'Choosing the right move at the right time', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Decision-Making Cones","reps":"10 scenarios","duration":12},{"name":"Cone Weave Dribbling","reps":"6 runs","duration":8},{"name":"La Croqueta Drill","reps":"8 reps each side","duration":6},{"name":"Post-Session Reflection","reps":"1 set","duration":5}]', 35, 'Read the defender body shape — go the opposite way they are leaning.'),
        (2, 3, 3, '1v1 Moves — Speed of Execution', 'Performing moves at match speed', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"La Croqueta Drill","reps":"8 reps at pace","duration":8},{"name":"Drag Back & Turn","reps":"8 reps at pace","duration":8},{"name":"Speed Dribbling","reps":"6 sprints","duration":8},{"name":"Foam Rolling Recovery","reps":"1 set","duration":5}]', 35, 'Slow feet get tackled — accelerate out of every move.'),
        (2, 3, 4, '1v1 Moves — Combination Moves', 'Chaining moves together fluidly', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Ball Mastery Routine","reps":"2 sets of 3 minutes","duration":8},{"name":"La Croqueta Drill","reps":"6 reps","duration":5},{"name":"Drag Back & Turn","reps":"6 reps","duration":5},{"name":"Decision-Making Cones","reps":"8 scenarios","duration":8},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 35, 'Chain a drag back into a La Croqueta — make the defender guess twice.'),

      -- Week 4: Speed & Integration
        (2, 4, 1, 'Speed & Integration — Speed Dribbling', 'Dribbling at pace over distance', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Speed Dribbling","reps":"8 sprints","duration":12},{"name":"Cone Weave Dribbling","reps":"6 runs at pace","duration":8},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 32, 'Push the ball 2-3 yards ahead and sprint to it — bigger touches at speed.'),
        (2, 4, 2, 'Speed & Integration — Under Pressure', 'Maintaining control with a closing defender', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Close Control Box","reps":"4 sets of 2 minutes","duration":10},{"name":"Decision-Making Cones","reps":"10 scenarios","duration":10},{"name":"Ball Mastery Routine","reps":"2 sets of 2 minutes","duration":6},{"name":"Post-Session Reflection","reps":"1 set","duration":5}]', 35, 'Keep your body between the ball and the imaginary defender.'),
        (2, 4, 3, 'Speed & Integration — Full Repertoire', 'Combining all learned skills at pace', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Speed Dribbling","reps":"6 sprints","duration":8},{"name":"La Croqueta Drill","reps":"8 reps","duration":6},{"name":"Drag Back & Turn","reps":"8 reps","duration":6},{"name":"Cone Weave Dribbling","reps":"6 runs","duration":8},{"name":"Foam Rolling Recovery","reps":"1 set","duration":5}]', 35, 'This is your showcase — every skill you have learned in four weeks, at full speed.'),
        (2, 4, 4, 'Speed & Integration — Mastery Test', 'Assessing progress across all ball mastery skills', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Ball Mastery Routine","reps":"3 sets of 3 minutes","duration":10},{"name":"Juggling Progression","reps":"3 sets of 2 minutes","duration":8},{"name":"Close Control Box","reps":"3 sets of 2 minutes","duration":8},{"name":"Speed Dribbling","reps":"4 timed sprints","duration":6},{"name":"Post-Session Reflection","reps":"1 set","duration":5}]', 35, 'Record your juggling record and dribble times — compare to week 1.');

      -- Program 3: Complete Player (All-round, Intermediate, 3x/week, 4 weeks = 12 sessions)
      INSERT INTO programs (name, description, category, difficulty, duration_weeks, sessions_per_week)
      VALUES ('Complete Player', 'A balanced program that develops shooting, passing, dribbling, and physical fitness in every session. Intensity and complexity ramp each week, building a well-rounded player who can contribute in all phases of play.', 'All-round', 'intermediate', 4, 3);

      INSERT INTO program_sessions (program_id, week_number, day_number, title, focus, drills, duration_minutes, coaching_notes)
      VALUES
      -- Week 1: Base Building
        (3, 1, 1, 'Base Building — Technical Foundation', 'Passing accuracy and first touch', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Wall Passes (1-touch)","reps":"3 sets of 20 passes","duration":8},{"name":"Short Passing Combos","reps":"3 patterns","duration":10},{"name":"Finishing Drill","reps":"12 shots","duration":10},{"name":"Core Stability Routine","reps":"1 set","duration":8},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 48, 'Quality over quantity — every pass should be firm and accurate.'),
        (3, 1, 2, 'Base Building — Shooting & Strength', 'Finishing and physical conditioning', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Placement Shooting","reps":"15 shots","duration":10},{"name":"Power Shooting","reps":"10 shots","duration":8},{"name":"Bodyweight Circuit","reps":"3 rounds","duration":12},{"name":"Foam Rolling Recovery","reps":"1 set","duration":8}]', 45, 'Build strength that translates to the pitch — every exercise with intent.'),
        (3, 1, 3, 'Base Building — Dribbling & Agility', 'Close control and change of direction', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Cone Weave Dribbling","reps":"8 runs","duration":10},{"name":"Close Control Box","reps":"3 sets of 2 minutes","duration":8},{"name":"T-Drill","reps":"6 reps","duration":8},{"name":"Zig-Zag Agility","reps":"6 reps","duration":8},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 46, 'Low centre of gravity through the cones — stay on your toes.'),

      -- Week 2: Building Intensity
        (3, 2, 1, 'Building Intensity — Passing Under Pressure', 'Maintaining technique with higher tempo', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Rondo","reps":"4 sets of 3 minutes","duration":14},{"name":"First-Time Passing Combos","reps":"3 patterns","duration":10},{"name":"Shooting (Inside Box)","reps":"10 shots","duration":8},{"name":"Core Stability Routine","reps":"1 set","duration":8}]', 47, 'One and two touch only in the rondo — if you need three touches, move better.'),
        (3, 2, 2, 'Building Intensity — Power & Finishing', 'Explosive movements into finishing', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Acceleration Sprints","reps":"6 sprints","duration":8},{"name":"Turning & Shooting","reps":"12 turns + shots","duration":12},{"name":"Volleys & Half-Volleys","reps":"15 strikes","duration":10},{"name":"Bodyweight Circuit","reps":"2 rounds","duration":8},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 50, 'Sprint, then shoot — replicate the physical demands before a real chance.'),
        (3, 2, 3, 'Building Intensity — Dribbling & Speed', 'Carrying the ball at higher pace', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Speed Dribbling","reps":"8 sprints","duration":10},{"name":"La Croqueta Drill","reps":"8 reps each side","duration":8},{"name":"Cone Shuttle Runs","reps":"6 sets","duration":8},{"name":"Ladder Footwork","reps":"6 patterns","duration":8},{"name":"Foam Rolling Recovery","reps":"1 set","duration":5}]', 46, 'Carry the ball like you are running away from someone — urgency in every touch.'),

      -- Week 3: Game Application
        (3, 3, 1, 'Game Application — Combination Play', 'Linking passes with movement and finishing', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Short Passing Combos","reps":"4 patterns","duration":12},{"name":"Through Ball Practice","reps":"10 through balls","duration":10},{"name":"One-Touch Finishing","reps":"12 shots","duration":8},{"name":"Core Stability Routine","reps":"1 set","duration":8},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 50, 'Think two passes ahead — where is the ball going after your pass?'),
        (3, 3, 2, 'Game Application — Transitions', 'Switching between attack and defence quickly', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Transition Sprints","reps":"8 transitions","duration":12},{"name":"Pressing Triggers","reps":"6 scenarios","duration":10},{"name":"Finishing Drill","reps":"10 shots","duration":8},{"name":"Bodyweight Circuit","reps":"3 rounds","duration":10},{"name":"Foam Rolling Recovery","reps":"1 set","duration":5}]', 50, 'Win the ball back and attack within 5 seconds — transition speed wins games.'),
        (3, 3, 3, 'Game Application — Crossing & Movement', 'Wide play and off-the-ball runs', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Crossing & Finishing","reps":"12 crosses","duration":12},{"name":"Off-The-Ball Movement","reps":"8 runs","duration":10},{"name":"Lofted Passes","reps":"10 passes","duration":8},{"name":"Single-Leg Stability","reps":"3 sets each leg","duration":8},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 50, 'Time your runs to arrive with the ball — too early and you are static.'),

      -- Week 4: Peak Performance
        (3, 4, 1, 'Peak Performance — Technical Excellence', 'High-tempo technical work across all skills', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Rondo","reps":"4 sets of 3 minutes","duration":14},{"name":"One-Touch Finishing","reps":"15 shots","duration":10},{"name":"Speed Dribbling","reps":"6 sprints","duration":8},{"name":"Core Stability Routine","reps":"1 set","duration":8},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 50, 'Everything at match intensity — no coasting through any drill.'),
        (3, 4, 2, 'Peak Performance — Physical Peak', 'Maximum output in strength and speed', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Acceleration Sprints","reps":"8 sprints","duration":10},{"name":"Plyometric Box Jumps","reps":"4 sets of 6","duration":8},{"name":"Cone Shuttle Runs","reps":"6 sets","duration":8},{"name":"Shooting (Outside Box)","reps":"10 shots","duration":8},{"name":"Bodyweight Circuit","reps":"3 rounds","duration":10},{"name":"Foam Rolling Recovery","reps":"1 set","duration":5}]', 50, 'Push your limits today — controlled aggression in every rep.'),
        (3, 4, 3, 'Peak Performance — Complete Test', 'Full assessment of all skills developed', '[{"name":"Ball Warm-Up","reps":"5 minutes","duration":5},{"name":"Short Passing Combos","reps":"3 patterns","duration":8},{"name":"Finishing Drill","reps":"15 shots","duration":10},{"name":"Cone Weave Dribbling","reps":"6 timed runs","duration":8},{"name":"Free Kicks","reps":"10 attempts","duration":8},{"name":"Transition Sprints","reps":"6 transitions","duration":8},{"name":"Post-Session Reflection","reps":"1 set","duration":5}]', 50, 'Reflect on where you started four weeks ago — measure the progress.');

      -- Program 4: Speed & Agility Camp (Physical, Beginner-Intermediate, 3x/week, 3 weeks = 9 sessions)
      INSERT INTO programs (name, description, category, difficulty, duration_weeks, sessions_per_week)
      VALUES ('Speed & Agility Camp', 'A focused three-week program to improve acceleration, top speed, change of direction, and deceleration. Combines sprint technique, ladder drills, and agility work with proper warm-up and recovery protocols. Suitable for players at beginner to intermediate fitness levels.', 'Physical', 'beginner-intermediate', 3, 3);

      INSERT INTO program_sessions (program_id, week_number, day_number, title, focus, drills, duration_minutes, coaching_notes)
      VALUES
      -- Week 1: Sprint Mechanics
        (4, 1, 1, 'Sprint Mechanics — Acceleration', 'First-step explosiveness and drive phase', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Resistance Band Warm-Up","reps":"1 set","duration":5},{"name":"Acceleration Sprints","reps":"8 sprints x 10m","duration":12},{"name":"Ladder Footwork","reps":"4 patterns","duration":6},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 35, 'Drive your knees up and forward — lean into the sprint for the first 5 steps.'),
        (4, 1, 2, 'Sprint Mechanics — Ladder Foundations', 'Foot speed and coordination patterns', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Ladder Footwork","reps":"8 patterns","duration":15},{"name":"Reaction Sprints","reps":"6 sprints","duration":8},{"name":"Foam Rolling Recovery","reps":"1 set","duration":5}]', 35, 'Light feet, quick contacts — pretend the ground is hot under your feet.'),
        (4, 1, 3, 'Sprint Mechanics — Deceleration Basics', 'Learning to stop and change direction safely', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Deceleration Training","reps":"8 reps","duration":12},{"name":"T-Drill","reps":"6 reps","duration":8},{"name":"Single-Leg Stability","reps":"3 sets each leg","duration":6},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 38, 'Bend your knees and lower your hips to brake — never stop with straight legs.'),

      -- Week 2: Agility & Reaction
        (4, 2, 1, 'Agility & Reaction — Change of Direction', 'Multi-directional speed and cutting', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Zig-Zag Agility","reps":"8 runs","duration":10},{"name":"T-Drill","reps":"6 reps","duration":8},{"name":"Cone Shuttle Runs","reps":"6 sets","duration":8},{"name":"Core Stability Routine","reps":"1 set","duration":5},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 40, 'Plant on the outside foot and push off hard — angle your body into the turn.'),
        (4, 2, 2, 'Agility & Reaction — Reactive Speed', 'Reacting to cues and sprinting', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Reaction Sprints","reps":"10 sprints","duration":12},{"name":"Ladder Footwork","reps":"6 patterns","duration":10},{"name":"Acceleration Sprints","reps":"6 sprints","duration":8},{"name":"Foam Rolling Recovery","reps":"1 set","duration":5}]', 40, 'Stay on your toes in the ready position — react to the signal, not to your guess.'),
        (4, 2, 3, 'Agility & Reaction — Power & Plyometrics', 'Building explosive leg power', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Plyometric Box Jumps","reps":"4 sets of 6","duration":10},{"name":"Cone Shuttle Runs","reps":"6 sets","duration":8},{"name":"Deceleration Training","reps":"6 reps","duration":8},{"name":"Single-Leg Stability","reps":"3 sets each leg","duration":5},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 38, 'Land softly on every jump — absorb through your ankles, knees, and hips.'),

      -- Week 3: Integration & Testing
        (4, 3, 1, 'Integration — Football-Specific Speed', 'Speed with the ball and in transitions', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Speed Dribbling","reps":"6 sprints","duration":8},{"name":"Transition Sprints","reps":"6 transitions","duration":10},{"name":"Acceleration Sprints","reps":"6 sprints","duration":8},{"name":"Core Stability Routine","reps":"1 set","duration":5},{"name":"Static Cool-Down Stretches","reps":"1 set","duration":5}]', 38, 'Carry the ball at 90% speed — keep it close enough to change direction instantly.'),
        (4, 3, 2, 'Integration — Endurance Speed', 'Repeated sprint ability under fatigue', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Cone Shuttle Runs","reps":"8 sets","duration":12},{"name":"Zig-Zag Agility","reps":"6 runs","duration":8},{"name":"Ladder Footwork","reps":"6 patterns","duration":8},{"name":"Bodyweight Circuit","reps":"2 rounds","duration":8},{"name":"Foam Rolling Recovery","reps":"1 set","duration":5}]', 40, 'Maintain your form even when tired — technique breaks down before speed does.'),
        (4, 3, 3, 'Integration — Speed & Agility Test', 'Measuring progress across all speed metrics', '[{"name":"Dynamic Warm-Up","reps":"1 set","duration":5},{"name":"Acceleration Sprints","reps":"3 timed sprints","duration":6},{"name":"T-Drill","reps":"3 timed reps","duration":6},{"name":"Zig-Zag Agility","reps":"3 timed runs","duration":6},{"name":"Reaction Sprints","reps":"6 sprints","duration":8},{"name":"Deceleration Training","reps":"4 reps","duration":5},{"name":"Post-Session Reflection","reps":"1 set","duration":5}]', 38, 'Record all your times and compare to week 1 — the numbers tell the story.');

    COMMIT;`);
  }},
  { version: 13, up: (db) => {
    db.exec("ALTER TABLE idp_goals ADD COLUMN target_metric TEXT");
    db.exec("ALTER TABLE idp_goals ADD COLUMN target_value REAL");
  }},
  { version: 14, up: (db) => {
    // Add position column if not exists (safe for existing DBs)
    try { db.exec("ALTER TABLE settings ADD COLUMN position TEXT DEFAULT 'General'"); } catch { /* already exists */ }
  }},
  { version: 15, up: (db) => {
    db.exec(`
      -- Update position_relevance to match app positions: Striker, Winger, CAM, CDM, CB, GK, All
      -- Shooting drills → Striker, Winger, CAM
      UPDATE drills SET position_relevance = '["Striker","Winger","CAM"]' WHERE subcategory = 'Shooting';
      -- Passing drills → CAM, CDM, CB
      UPDATE drills SET position_relevance = '["CAM","CDM","CB","Striker"]' WHERE subcategory = 'Passing';
      -- Dribbling drills → Winger, CAM, Striker
      UPDATE drills SET position_relevance = '["Winger","CAM","Striker"]' WHERE subcategory = 'Dribbling';
      -- Crossing drills → Winger
      UPDATE drills SET position_relevance = '["Winger"]' WHERE subcategory = 'Crossing';
      -- Speed drills → All
      UPDATE drills SET position_relevance = '["All"]' WHERE subcategory = 'Speed';
      -- Strength drills → All
      UPDATE drills SET position_relevance = '["All"]' WHERE subcategory = 'Strength';
      -- Tactical → CDM, CB, CAM
      UPDATE drills SET position_relevance = '["CDM","CB","CAM"]' WHERE category = 'Tactical';
      -- Psychological → All
      UPDATE drills SET position_relevance = '["All"]' WHERE category = 'Psychological';
      -- Warm-up → All
      UPDATE drills SET position_relevance = '["All"]' WHERE category = 'Warm-Up & Cool-Down';
      -- Specific overrides
      UPDATE drills SET position_relevance = '["Winger","CAM","Striker"]' WHERE name = 'Rondo';
      UPDATE drills SET position_relevance = '["CDM","CB","CAM"]' WHERE name = 'Long Passing';
      UPDATE drills SET position_relevance = '["CDM","CB"]' WHERE name = 'Pressing Triggers';
      UPDATE drills SET position_relevance = '["Striker","Winger","CAM"]' WHERE name = 'Off-The-Ball Movement';
      UPDATE drills SET position_relevance = '["CDM","CB"]' WHERE name = 'Transition Sprints';
      UPDATE drills SET position_relevance = '["Striker","CB"]' WHERE name = 'Free Kicks';

      -- Add 12 new position-specific drills
      INSERT OR IGNORE INTO drills (name, slug, category, subcategory, difficulty, duration_minutes, reps_description, equipment_needed, space_needed, description, coaching_points, variations, position_relevance) VALUES
      ('Penalty Box Movement', 'penalty-box-movement', 'Tactical', 'Movement', 'intermediate', 10, '10 runs, vary starting position', 'Cones (6)', 'medium (10x10m)', 'Practice making runs inside the penalty area. Work on losing your marker, timing runs to meet crosses, and finding space in crowded areas.', '["Start your run late — arrive with the ball, not before","Check away then dart back toward goal","Use the defender body as a shield","Vary between near post, far post, and penalty spot runs"]', '["Add a crosser for live delivery","Defender shadows to add pressure"]', '["Striker"]'),
      ('Header Practice', 'header-practice', 'Technical', 'Shooting', 'intermediate', 10, '20 headers total', 'Ball, goal', 'medium (10x10m)', 'Develop heading technique for both attacking and defensive situations. Self-toss or use a wall to practice directing headers toward goal corners.', '["Eyes open, mouth closed at contact","Attack the ball — move forward into the header","Use your forehead, not the top of your head","Generate power from your core and neck, not just your head"]', '["Defensive clearance headers for height and distance","Glancing headers to redirect the ball"]', '["Striker","CB"]'),
      ('Byline Cutback Drill', 'byline-cutback-drill', 'Technical', 'Crossing', 'intermediate', 10, '10 runs each side', 'Ball, cones (4), goal', 'large (half pitch)', 'Sprint to the byline with the ball, cut back sharply, then deliver a low pass across the box or finish at the near post. Practice both sides.', '["Get your head up before the cutback","Use the outside of your foot to cut","Keep the ball moving — don not stop","Aim your cutback to the penalty spot area"]', '["Finish yourself instead of crossing","Add a defender chasing you"]', '["Winger"]'),
      ('Take-On Speed Drill', 'take-on-speed-drill', 'Technical', 'Dribbling', 'intermediate', 10, '8 runs', 'Ball, cones (6)', 'medium (10x10m)', 'Dribble at pace toward a cone defender, execute a skill move (step-over, feint, or chop), accelerate past, then cross or shoot. Focus on doing moves at match speed.', '["Approach at 80% speed, explode past at 100%","Drop your shoulder to sell the feint","Take a big touch past the cone to create space","Practice your go-to move until it is automatic"]', '["Chain two moves together","Add a real defender for live practice"]', '["Winger"]'),
      ('Final Third Creativity', 'final-third-creativity', 'Tactical', 'Movement', 'advanced', 12, '10 min continuous', 'Ball, cones (8), wall', 'medium (10x10m)', 'Simulate receiving the ball between defensive lines, turning quickly, and creating chances. Combine wall passes with sharp turns, through balls into cone gates, and quick decision-making.', '["Always know where the goal is before receiving","First touch should take you toward goal","Play forward whenever possible","Disguise your intentions — look one way, play another"]', '["Add a time limit per possession","Work in a restricted 15x15m zone"]', '["CAM"]'),
      ('One-Two Combinations', 'one-two-combinations', 'Technical', 'Passing', 'intermediate', 10, '3 sets x 10 combos', 'Ball, wall', 'small (3x3m)', 'Practice give-and-go passing with a wall. Pass, move into space, receive the return, then repeat. Work on the timing of the movement and the weight of the pass.', '["Pass and move immediately — never stand still","Angle your run to receive on the move","Use one touch to pass, one touch to control","Accelerate after the return pass"]', '["Add a finish after the combination","Do three-pass combos before finishing"]', '["CAM","Striker"]'),
      ('Defensive Positioning', 'defensive-positioning', 'Tactical', 'Defending', 'intermediate', 10, '10 scenarios', 'Cones (8)', 'medium (10x10m)', 'Shadow defending without a ball. Set up cone attackers in different formations and practice your positioning — when to step up, when to drop, how to cut passing lanes.', '["Stay goal-side at all times","Watch the ball, not the attacker","Position yourself to see both ball and runner","Close down at an angle to force play wide"]', '["Add a ball being passed between cones","Partner acts as attacker making runs"]', '["CDM","CB"]'),
      ('Ball Recovery Drill', 'ball-recovery-drill', 'Tactical', 'Defending', 'intermediate', 12, '8 reps', 'Ball, cones (6)', 'medium (10x10m)', 'Practice pressing triggers, winning the ball, and transitioning to attack. Sprint to close down a cone, win an imaginary tackle, then immediately dribble or pass forward.', '["Press with intensity but stay on your feet","Win the ball and look forward immediately","First touch after recovery should be progressive","Recover your position if you do not win it"]', '["Add a real passer to intercept","Chain recovery into a shot on goal"]', '["CDM"]'),
      ('Long Ball Distribution', 'long-ball-distribution', 'Technical', 'Passing', 'intermediate', 10, '20 passes', 'Ball, cones (4)', 'large (half pitch)', 'Practice accurate long passes from deep positions to targets 30-50 yards away. Work on both driven passes along the ground and lofted balls into space.', '["Lock your ankle and strike through the ball","Follow through toward your target","Vary between driven and lofted passes","Hit targets on both sides of the pitch"]', '["Add a time pressure — 3 seconds to play","Alternate between left and right targets"]', '["CB","GK"]'),
      ('Aerial Duel Practice', 'aerial-duel-practice', 'Physical', 'Strength', 'intermediate', 10, '15 jumps', 'Ball', 'small (3x3m)', 'Practice jumping and winning aerial battles. Self-toss the ball high, time your jump, and head it with power and direction. Build neck strength and timing.', '["Time your run-up and jump","Use your arms for balance and height","Head the ball at the highest point","Land balanced and ready to react"]', '["Compete against a partner","Head toward specific targets"]', '["CB","Striker"]'),
      ('Shot Stopping Drill', 'shot-stopping-drill', 'Technical', 'Goalkeeping', 'intermediate', 15, '30 saves', 'Ball, goal', 'medium (10x10m)', 'Face shots from various angles and distances. Start with slow shots to warm up, progress to full-power strikes. Work on positioning, set position, and diving technique.', '["Get into set position before every shot","Stay on your toes, slightly forward","Make yourself big — spread your body","Push wide, not back into the goal"]', '["Add a second shooter for quick reactions","Face shots after dealing with crosses"]', '["GK"]'),
      ('Distribution Practice', 'distribution-practice', 'Technical', 'Goalkeeping', 'beginner', 10, '20 distributions', 'Ball, cones (4)', 'large (half pitch)', 'Practice goal kicks, overarm throws, and short passing under pressure. Aim for accuracy to specific zones and teammates. Work on building attacks from the back.', '["Goal kicks: strike through the ball with your laces","Throws: step forward and release at the highest point","Short passes: be brave, play out under pressure","Vary your distribution — do not be predictable"]', '["Add cones as pressing attackers","Practice with a teammate making runs"]', '["GK"]');
    `);
  }},
  { version: 16, up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS parent_player_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_id INTEGER NOT NULL,
        player_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','active','revoked')),
        invite_code TEXT,
        invited_at TEXT DEFAULT (datetime('now')),
        accepted_at TEXT,
        UNIQUE(parent_id, player_id)
      );
      CREATE INDEX IF NOT EXISTS idx_ppl_parent ON parent_player_links(parent_id);
      CREATE INDEX IF NOT EXISTS idx_ppl_player ON parent_player_links(player_id);

      CREATE TABLE IF NOT EXISTS parent_visibility_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL UNIQUE,
        show_ratings INTEGER DEFAULT 1,
        show_coach_feedback INTEGER DEFAULT 1,
        show_idp_goals INTEGER DEFAULT 1
      );
    `);
  }},
  { version: 17, up: (db) => {
    try { db.exec("ALTER TABLE video_analyses ADD COLUMN session_id TEXT"); } catch { /* exists */ }
    try { db.exec("ALTER TABLE video_analyses ADD COLUMN drill_bookmarks TEXT DEFAULT '[]'"); } catch { /* exists */ }
    try { db.exec("ALTER TABLE video_analyses ADD COLUMN recording_source TEXT DEFAULT 'upload'"); } catch { /* exists */ }
  }},
  { version: 18, up: (db) => {
    // Add user_id to all core tables for multi-user data isolation
    // DEFAULT 1 preserves existing data (assigned to dev player user id=1)
    const tables = [
      'sessions', 'matches', 'training_plans', 'idp_goals',
      'decision_journal', 'benchmarks', 'templates', 'video_analyses',
    ];
    for (const table of tables) {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER DEFAULT 1`); } catch { /* exists */ }
    }

    // personal_records: add user_id, remove single-row constraint
    try { db.exec("ALTER TABLE personal_records ADD COLUMN user_id INTEGER DEFAULT 1"); } catch { /* exists */ }

    // custom_drills: add user_id
    try { db.exec("ALTER TABLE custom_drills ADD COLUMN user_id INTEGER DEFAULT 1"); } catch { /* exists */ }

    // settings: SQLite can't drop CHECK constraints, so create a new table
    // Check if user_id column already exists on settings
    const cols = db.prepare("PRAGMA table_info(settings)").all();
    if (!cols.find(c => c.name === 'user_id')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS settings_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
          distance_unit TEXT DEFAULT 'km',
          weekly_goal INTEGER DEFAULT 3,
          age_group TEXT,
          skill_level TEXT,
          player_name TEXT,
          onboarding_complete INTEGER DEFAULT 0,
          getting_started_complete INTEGER DEFAULT 0,
          position TEXT DEFAULT 'General',
          equipment TEXT,
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
      // Copy existing settings row to new table
      try {
        db.exec(`INSERT INTO settings_new (user_id, distance_unit, weekly_goal, age_group, skill_level, player_name, onboarding_complete, getting_started_complete, position, equipment, updated_at)
          SELECT 1, distance_unit, weekly_goal, age_group, skill_level, player_name, onboarding_complete, getting_started_complete, position, equipment, updated_at FROM settings WHERE id = 1`);
      } catch { /* empty or already migrated */ }
      db.exec("DROP TABLE IF EXISTS settings");
      db.exec("ALTER TABLE settings_new RENAME TO settings");
    }

    // Add indexes on user_id for fast lookups
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)"); } catch { /* exists */ }
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_plans_user ON training_plans(user_id)"); } catch { /* exists */ }
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_goals_user ON idp_goals(user_id)"); } catch { /* exists */ }
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id)"); } catch { /* exists */ }
  }},
  { version: 19, up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS scouting_reports (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        club_name TEXT NOT NULL,
        level TEXT NOT NULL,
        age_group TEXT NOT NULL,
        gender TEXT NOT NULL,
        location TEXT,
        match_date TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','ready','failed')),
        manus_task_id TEXT,
        report_content TEXT,
        confidence_summary TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_scouting_user ON scouting_reports(user_id);
      CREATE INDEX IF NOT EXISTS idx_scouting_status ON scouting_reports(status);
    `);
  }},
  { version: 20, up: (db) => {
    try { db.exec("ALTER TABLE scouting_reports ADD COLUMN game_plan TEXT"); } catch { /* exists */ }
  }},
  { version: 21, up: (db) => {
    try { db.exec("ALTER TABLE scouting_reports ADD COLUMN shared_by_coach_id INTEGER"); } catch { /* exists */ }
  }},
  { version: 22, up: (db) => {
    try { db.exec("ALTER TABLE settings ADD COLUMN player_identity TEXT DEFAULT ''"); } catch { /* exists */ }
  }},
  { version: 23, up: (db) => {
    // Token version column enables revocation: bumping it invalidates all existing JWTs.
    try { db.exec("ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0"); } catch { /* exists */ }
  }},
  { version: 24, up: (db) => {
    // Prevent duplicate scouting reports for the same opponent/date.
    // Partial index: only enforces uniqueness for pending/ready reports — failed reports
    // are allowed to coexist so the user can retry without having to delete old ones.
    try {
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_scouting_unique_active
        ON scouting_reports (user_id, club_name, COALESCE(match_date, ''))
        WHERE status IN ('pending', 'ready')`);
    } catch { /* ignore — may already exist or older SQLite may not support partial indexes */ }
  }},
];

function runMigrations(db) {
  const current = db.prepare('SELECT MAX(version) as v FROM schema_version').get()?.v || 0;
  for (const m of migrations) {
    if (m.version > current) {
      m.up(db);
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(m.version);
    }
  }
}
