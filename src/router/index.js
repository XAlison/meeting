import Vue from 'vue'
import Router from 'vue-router'
import course from '@/components/course/course'
Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      component: course
    },
    {
      path: '/course',
      component: course
    }
  ]
})
