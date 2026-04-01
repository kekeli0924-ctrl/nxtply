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
      id INTEGER PRIMARY KEY CHECK(id = 1) DEFAULT 1,
      distance_unit TEXT DEFAULT 'km',
      weekly_goal INTEGER DEFAULT 3,
      age_group TEXT,
      skill_level TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO settings (id) VALUES (1);

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
