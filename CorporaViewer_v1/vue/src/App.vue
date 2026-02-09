<template>
  <div class="header">
    <nav class="col-md-2" v-if="showFullHeader">
      <router-link to="/">{{ $t('search') }}</router-link> |
      <router-link to="/about">{{ $t('about') }}</router-link>
    </nav>
    <div class="app-title col-md-5" @click="toggleSideMenu()">
      <div v-if="!showFullHeader" class="menu-button">
        <i class="fas fa-bars"></i>
      </div>
      <h1>{{ $t('title') }}</h1>
    </div>
    <div class="lang-select col-md-3" v-if="showFullHeader">
      {{ $t('language') }}:
      <select v-model="$i18n.locale">
        <option v-for="lang in $i18n.availableLocales" :key="lang" :value="lang">
          {{ $t(lang) }}
        </option>
      </select>
    </div>
  </div>
  <div class="menu-container blur-background" v-if="showMenu">
    <div class="btn btn-default close-button" @click="toggleSideMenu()">
      <i class="fas fa-times"></i>
    </div>

    <div class="menu">
      <div class="menu-title">
        <h1>{{ $t('menuTitle') }}</h1>
      </div>
      <div class="menu-item">
        <div class="menu-subtitle">
          <h3>{{ $t('menuNavigation') }}</h3>
        </div>
        <div class="navigation">
          <router-link to="/" @click="toggleSideMenu()">{{ $t('search') }}</router-link>
          <router-link to="/about" @click="toggleSideMenu()">{{ $t('about') }}</router-link>
        </div>
      </div>
      <div class="menu-item">
        <div class="menu-subtitle">
          <h3>{{ $t('menuLanguage') }}:</h3>
        </div>
        <select v-model="$i18n.locale" class="input-field">
          <option v-for="lang in $i18n.availableLocales" :key="lang" :value="lang">
            {{ $t(lang) }}
          </option>
        </select>
      </div>
    </div>
  </div>
  <router-view />
</template>

<style scoped>
.menu-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 0.5rem;
  margin-right: 1rem;
  border-radius: 1000px;
  background-color: #F0F7EE;
}

.menu-container {
  display: hidden;
}

@media (max-width: 768px) {
  .app-title {
    cursor: pointer;
  }

  .app-title:hover {
    border: #1E1E24 4px solid;
  }

  .close-button {
    position: absolute;
    top: 2rem;
    right: 2rem;
    background-color: #F0F7EE !important;
    border-radius: 1000px !important;
    border: 0.4rem solid #883636 !important;
  }

  .close-button:hover {
    background-color: #883636 !important;
  }

  .close-button:hover i {
    color: #F0F7EE;
  }

  .close-button i {
    color: #883636;
  }

  .menu-container {
    position: absolute;
    top: 0px;
    left: 0px;
    width: 100%;
    height: 100%;
    background-color: #1e1e2475;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .menu {
    position: relative;
    background-color: #F0F7EE;
    border-radius: 30px;
    padding: 1.5rem;
    color: #1E1E24;
    display: flex;
    flex-direction: column;
    width: fit-content;
    align-items: center;
    justify-content: center;
  }

  .navigation {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .navigation a {
    margin: 0.2rem;
  }

  .menu-title {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-evenly;
    padding-top: 0.5rem;
    background-color: #708d81;
    border-radius: 30px;
    width: 50vw;
    height: 100%;
  }

  .menu-item {
    margin-top: 1rem;
    transition: all 0.2s ease-in-out;
    width: 100%;
    border-radius: 30px;
    padding: 1rem;
  }

  .menu-item:hover {
    background-color: #708d8140;
  }
}
</style>

<script lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';

export default {
  setup() {
    const hover = ref(false);
    const showMenu = ref(false);
    const windowWidth = ref(window.innerWidth);

    const showFullHeader = computed(() => {
      return windowWidth.value > 768;
    });

    const handleResize = () => {
      windowWidth.value = window.innerWidth;
    };

    const toggleSideMenu = () => {
      if (!showFullHeader.value) {
        showMenu.value = !showMenu.value;
      }
    };

    onMounted(() => {
      window.addEventListener('resize', handleResize);
      document.title = 'Zapisniki parlamentarnih zasedanj 1861-1913'
    });

    onBeforeUnmount(() => {
      window.removeEventListener('resize', handleResize);
    });

    return {
      hover,
      showMenu,
      windowWidth,
      showFullHeader,
      handleResize,
      toggleSideMenu,
    };
  },
};
</script>