Build a simple multiplayer auto-battler game using TypeScript with a centralized authoritative server.

Tech stack:

* Node.js + TypeScript
* WebSocket (Socket.io or ws)
* Static file server (ecstatic)
* Single repository (server + client)

Architecture:

/server
/network   → WebSocket connections and events
/game      → game loop, movement, combat logic
/models    → Unit, Player, Grid
/state     → match and round state
index.ts   → bootstrap

/public
client.js  → UI, rendering, input

Players:

* Max 2 players
* Assigned dynamically (Player A / Player B)
* First two connected players join the match
* If a player disconnects:

  * game pauses
  * slot remains open
  * next connecting player takes that slot

Arena:

* Grid size: 3 rows x 8 columns
* Coordinates:

  * x = column (0–7)
  * y = row (0–2)
* Player A area → columns 0–3
* Player B area → columns 4–7
* Movement and logic are mirrored for Player B
* Max 1 unit per tile
* Max 12 units per player

Units:

* Types: melee, ranged
* Stats:

  * melee: 30 HP, damage 10, range 1 (Manhattan)
  * ranged: 20 HP, damage 6, range 2 (Manhattan)
* Ranged units ignore line-of-sight

Placement Phase:

* Duration: 30 seconds
* Players can:

  * place units
  * move units within their area
  * remove units
* Server validates all actions
* Invalid actions:

  * rejected by server
  * client shows error popup (top-right)
  * client immediately rolls back UI

Placement conflicts:

* If tile already occupied:

  * existing unit stays
  * new placement rejected

Battle Phase:

* No player input allowed
* Server tick rate: 5 ticks/sec

Game Loop (per tick):

1. Movement phase
2. Attack phase
3. Death resolution

Movement Rules:

* Units move max 1 tile per tick
* Resolution order:

  * placement timestamp
  * if equal → Player A first, then Player B
* If multiple units target same tile:

  * highest priority unit moves
  * others stay
* Chain blocking:

  * blocked units do NOT reroute
  * they stay in place

State Machine:

States:

* SEEK
* ENGAGED
* ATTACK
* IDLE (only at end of round)

SEEK:

* Move forward toward enemy side
* Possible directions (priority):

  * forward
  * forward-left
  * forward-right
* Forward interaction line (used for engagement detection):

  * (x+1, y)
  * (x+1, y-1)
  * (x+1, y+1)
  * mirrored for Player B
* If all blocked by allies → stay still

ENGAGED:

* Triggered when enemy detected in forward interaction line
* Unit moves diagonally toward that enemy
* Special side positions allowed ONLY in engaged to avoid separation
* If both diagonal paths blocked → stay still

ATTACK:

* If enemy is in range (Manhattan distance):

  * unit does not move
  * attacks during attack phase

IDLE:

* Only used at end of round

Targeting:

Priority:

1. Previous target (if still in range)
2. Otherwise:

   * forward center
   * forward-left
   * forward-right
   * left
   * right

Combat:

* Attack happens AFTER all movement
* All attacks are simultaneous
* Units that die still perform attack in the same tick
* If both units reach HP ≤ 0 → both die

Round End:

* One side has no units → opponent gets 1 point
* Timeout at 40 seconds → tie (0 points)

Match End:

* First to 3 points wins

Round Reset:

* Units return to original placement positions
* All units respawn
* HP reset
* Players can adjust formation again

Networking:

* Client sends only intentions:

  * place
  * move
  * remove
* Server validates everything
* Server sends FULL GAME STATE every tick
* Client overwrites local state completely

Rate limiting:

* Prevent client spam per socket

Disconnection:

* Game pauses immediately
* Match resumes when 2 players are present again
* New player takes over empty slot

Client:

* Grid rendering
* Unit selection panel (left side)
* Placement via click or drag & drop
* Immediate rollback on invalid action
* Error popup UI

Rendering:

* No complex animations required
* Optional interpolation between ticks

Debug:

* Enable detailed server logs:

  * tick number
  * movement decisions
  * combat resolution
  * unit state transitions
