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
    route('/results', 'routes/results.tsx'),
  ]),
  route('/login', 'routes/login.tsx'),
  route('/forgot-password', 'routes/forgot-password.tsx'),
  route('/reset-password', 'routes/reset-password.tsx'),
  route('/practice', 'routes/practice.tsx'),
  route('/store', 'routes/store.tsx'),
  route('/profile', 'routes/profile.tsx'),
  route('/verify-email', 'routes/verify-email.tsx'),
  route('/join/:code', 'routes/join.tsx'),
  route('/progress', 'routes/progress.tsx'),
  route('/friends', 'routes/friends.tsx'),
  route('/player/:id', 'routes/player.tsx'),
  route('/replay/:code', 'routes/replay.tsx'),
  route('/watch/:code', 'routes/watch.tsx'),
  route('/solutions/:id', 'routes/solutions.tsx'),
  route('/tournament', 'routes/tournament.tsx'),
  route('/lesson', 'routes/lesson-join.tsx', { id: 'lesson-join' }),
  route('/lesson/:code', 'routes/lesson-join.tsx', { id: 'lesson-join-code' }),
  route('/lesson/:code/play', 'routes/lesson-play.tsx'),
  route('/teacher', 'routes/teacher.tsx'),
  route('/teacher/:code', 'routes/teacher-lesson.tsx'),
  route('/offer', 'routes/legal.tsx', { id: 'legal-offer' }),
  route('/privacy', 'routes/legal.tsx', { id: 'legal-privacy' }),
  route('/contacts', 'routes/legal.tsx', { id: 'legal-contacts' }),
  route('*', 'routes/not-found.tsx')
  ] satisfies RouteConfig;

