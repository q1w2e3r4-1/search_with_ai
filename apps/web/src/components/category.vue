<script setup lang="ts">
import { useAppStore } from '../store';
import { SearXNGCategories } from '../constants';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { TSearCategory } from '../interface';

const { t } = useI18n();

type Emits = {
  (e: 'change', val: TSearCategory): void;
}

const emits = defineEmits<Emits>();

const categories = SearXNGCategories.map(item => {
  return {
    name: item.displayName,
    value: item.name
  };
});
const appStore = useAppStore();

const value = ref(appStore.category);

const onCategoryChange = (val: any) => {
  appStore.updateCategory(val);
  emits('change', val);
};
</script>

<script lang="ts">
export default {
  name: 'SearchCategory'
};
</script>

<template>
  <div id="sear-category">
    <t-radio-group variant="default-filled" :default-value="value" @change="onCategoryChange">
      <t-radio-button v-for="item in categories" :key="item.value" :value="item.value">
        {{ t(item.name) }}
      </t-radio-button>
    </t-radio-group>
  </div>
</template>

<style scoped>
#sear-category {
 --td-radius-default: 20px;
 --td-radius-small: 20px;
}
</style>
