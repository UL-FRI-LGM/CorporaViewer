/* eslint-disable */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@vuepic/vue-datepicker'

declare module 'vue/types/vue' {
  interface Vue {
    $axios: any
    $filters: any
  }
}