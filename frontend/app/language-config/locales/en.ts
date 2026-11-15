// English: the reference list of every translatable string. A key missing in another language falls back to this.
const en = {
  // menu & shared
  welcome_mini: "Welcome to",
  tagline: "CODE FASTER. RUN HARDER. WIN",
  play: "play",
  leaderboard: "leaderboard",
  store: "store",
  settings: "settings",
  menu: "MENU",
  menu_practice: "PRACTICE",
  menu_results: "MY RESULTS",
  menu_profile: "PROFILE",
  menu_quit: "QUIT",
  how_to_play: "How to play",
  live_online: "ONLINE",
  live_duels: "DUELS LIVE",
  live_queue: "IN QUEUE",
  footer_text: "Production version",
  server: "SERVER: KAZAKHSTAN",
  loading: "Loading...",
  cancel: "CANCEL",

  // leaderboard / rank
  place: "place",
  combatant: "combatant",
  score: "score",
  your_rank: "YOUR RANK",
  current_mmr: "Current MMR",
  rank_first: "1ST",
  rank_second: "2ND",
  rank_third: "3RD",

  // play
  choose: "CHOOSE",
  mode: "MODE",
  quick_play: "QUICK PLAY",
  create_room: "Create room",
  join_room: "Join room",
  room_code: "Room code",
  return_match: "Return to match",
  return_lobby: "Return to lobby",
  finding_match: "Finding a match",
  warm_up: "Warm up your fingers...",
  in_queue: "in queue",
  match_found: "Match found!",
  entering_lobby: "Entering the lobby",
  login_first: "PLEASE LOG IN FIRST",
  login_register: "LOG IN / REGISTER",
  ready: "Ready",
  waiting_player: "Waiting for player...",

  // settings
  music_audio: "Music & Audio",
  music_volume: "Music Volume",
  sound_effects: "Sound Effects",
  language: "Language",
  account: "ACCOUNT",
  account_hint: "Nickname, avatar, e-mail, password and account deletion.",
  manage_account: "Manage account",
  match_history: "Match history",
  fullscreen: "FULLSCREEN",
  toggle_fullscreen: "Toggle fullscreen",
  fullscreen_blocked: "Fullscreen was blocked by the browser.",
  log_out: "Log out",

  // how to play
  howto_title: "HOW TO PLAY",
  howto_1_title: "1 · RACE",
  howto_1: "You and your rival run the same map side by side. Move with A / D or the arrows, jump with Space.",
  howto_2_title: "2 · CRACK THE DOORS",
  howto_2: "Four locked doors block the way. Walk up to one and press E: a short Java task opens. Solve it and the door unlocks. Stuck? It opens by itself after 4 minutes.",
  howto_3_title: "3 · REACH THE EXIT",
  howto_3: "Whoever gets through all four doors and reaches the exit first wins. Ranked wins give MMR and +150 pixels (a loss still gives +25).",
  howto_4_title: "4 · SPEND YOUR PIXELS",
  howto_4: "Buy and equip skins in the Store. Your rival sees them in the match.",
  try_practice: "TRY PRACTICE",
  got_it: "GOT IT",

  // errors
  oops: "Oops!",
  error: "Error",
  unexpected_error: "An unexpected error occurred.",
  requested_page_not_found: "The requested page could not be found.",
};

export type Translation = Record<keyof typeof en, string>;
export default en;
