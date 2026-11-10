import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";


export default [

  layout('./layouts/MainLayout.tsx', [index("routes/home.tsx"),]),
  layout('./layouts/NoNavLayout.tsx', [
    route('/leaderboard', 'routes/leaderboard.tsx'),
    route('/settings', 'routes/settings.tsx'),
    route('/admin', 'routes/admin.tsx'),
    route('/play', 'routes/play.tsx'),
    route('/play/:code', 'routes/lobby.tsx'),
    route('/play/:code/game', 'routes/game.tsx'),
  ]),
  route('/login', 'routes/login.tsx'),
  route('/forgot-password', 'routes/forgot-password.tsx'),
  route('/reset-password', 'routes/reset-password.tsx'),
  route('/store', 'routes/store.tsx'),
  route('/profile', 'routes/profile.tsx'),
  route('/verify-email', 'routes/verify-email.tsx'),
  route('*', 'routes/not-found.tsx')
  ] satisfies RouteConfig;

