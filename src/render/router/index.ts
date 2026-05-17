import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      redirect: '/game',
    },
    {
      path: '/game',
      name: 'game',
      component: () => import('../views/GameView.vue'),
    },
    // Forum routes
    {
      path: '/forum',
      name: 'forum-home',
      component: () => import('../views/ForumHomeView.vue'),
    },
    {
      path: '/forum/post/:id',
      name: 'post',
      component: () => import('../views/ForumPostDetailView.vue'),
      props: true,
    },
    {
      path: '/forum/reply/:commentId',
      name: 'reply',
      component: () => import('@tapsss/forum-shared/views/ReplyDetailView.vue'),
      props: true,
    },
    {
      path: '/forum/search',
      name: 'search',
      component: () => import('../views/ForumSearchView.vue'),
    },
    {
      path: '/forum/replay/:recordId/:recordType',
      name: 'replay',
      component: () => import('@tapsss/forum-shared/views/ReplayDetailView.vue'),
      props: true,
    },
    {
      path: '/forum/user/:uid',
      name: 'user',
      component: () => import('@tapsss/forum-shared/views/UserDetailView.vue'),
      props: true,
    },
  ],
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  },
})

export default router
