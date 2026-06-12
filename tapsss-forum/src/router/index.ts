import CompetitionView from '@tapsss/forum-shared/views/CompetitionView.vue'
import HomeView from '@tapsss/forum-shared/views/HomeView.vue'
import PostDetailView from '@tapsss/forum-shared/views/PostDetailView.vue'
import ReplayDetailView from '@tapsss/forum-shared/views/ReplayDetailView.vue'
import ReplyDetailView from '@tapsss/forum-shared/views/ReplyDetailView.vue'
import SearchView from '@tapsss/forum-shared/views/SearchView.vue'
import UserDetailView from '@tapsss/forum-shared/views/UserDetailView.vue'
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'forum-home',
      component: HomeView,
    },
    {
      path: '/forum/post/:id',
      name: 'post',
      component: PostDetailView,
      props: true,
    },
    {
      path: '/forum/reply/:commentId',
      name: 'reply',
      component: ReplyDetailView,
      props: true,
    },
    {
      path: '/forum/search',
      name: 'search',
      component: SearchView,
    },
    {
      path: '/forum/replay/:recordId/:recordType',
      name: 'replay',
      component: ReplayDetailView,
      props: true,
    },
    {
      path: '/forum/competition',
      name: 'competition',
      component: CompetitionView,
    },
    {
      path: '/forum/user/:uid',
      name: 'user',
      component: UserDetailView,
      props: true,
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    else {
      if (to.name !== 'forum-home') {
        return { top: 0 }
      }
    }
  },
})

export default router
