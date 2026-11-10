import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        welcome_mini: "Welcome to",
        play: "play",
        leaderboard: "leaderboard",
        store: "store",
        settings: "settings",
        footer_text: 'Production version',
        place: "place",
        combatant: 'combatant',
        score: 'score',
        menu: "MENU",
        server: "SERVER: KAZAKHSTAN",
        your_rank: "YOUR RANK",
        current_mmr: "Current MMR",
        music_audio: "Music & Audio",
        music_volume: "Music Volume",
        language: "Language",
        page_not_found: "The page you are looking for does not exist...",
        return_home: "Return to Home Page",
        oops: "Oops!",
        error: "Error",
        unexpected_error: "An unexpected error occurred.",
        requested_page_not_found: "The requested page could not be found.",
        rank_first: "1ST",
        rank_second: "2ND",
        rank_third: "3RD",
        nickname: "Nickname",
        need_nickname: "Set your nickname first",
        create_room: "Create room",
        join_room: "Join room",
        room_code: "Room code",
        loading: "Loading...",
        lobby: "LOBBY",
        status: "Status",
        ready: "Ready",
        im_ready: "I'm ready",
        start: "Start",
        you: "you",
        waiting_player: "Waiting for player...",
        match_started: "MATCH STARTED",


      }
    },
    kz: {
      translation: {
        welcome_mini: "Qow keldin",
        play: "Oynau",
        leaderboard: "Uzdikter",
        store: "Duken",
        settings: "Baptaular",
        footer_text: 'Zhalpy basylym nusqasy',
        place: "oryn",
        combatant: 'zhauynger',
        score: 'upai sany',
        menu: "MAZIR",
        server: "SERVER: QAZAQSTAN",
        your_rank: "SENIN ORNYN",
        current_mmr: "Agymdagy MMR",
        music_audio: "Muzyka zhane dybys",
        music_volume: "Muzyka dengeyi",
        language: "Til",
        page_not_found: "Siz izdegen bet tabylmady...",
        return_home: "Basty betke oralu",
        oops: "Qate!",
        error: "Qate",
        unexpected_error: "Kutpegen qate oryn aldy.",
        requested_page_not_found: "Suralgan bet tabylmady.",
        rank_first: "1-ORYN",
        rank_second: "2-ORYN",
        rank_third: "3-ORYN",
        nickname: "Laqap at",
        need_nickname: "Aldymen laqap atyndy engiz",
        create_room: "Bolme quru",
        join_room: "Bolmege kiru",
        room_code: "Bolme kody",
        loading: "Zhuktelude...",
        lobby: "LOBBY",
        status: "Kuy",
        ready: "Dayyn",
        im_ready: "Men dayynmyn",
        start: "Bastau",
        you: "sen",
        waiting_player: "Oiynshy kutude...",
        match_started: "OIYN BASTALDY",


      }
    }
  },
  lng: "en", 
  fallbackLng: "en",
  interpolation: {
    escapeValue: false // React уже защищает от XSS
  }
});

export default i18n;
