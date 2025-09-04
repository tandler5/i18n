import { deepCopy, create, isFunction, toTypeString } from "@intlify/shared";
import { useNuxtApp } from "#app";
import { createDefu } from "defu";
const cacheMessages = /* @__PURE__ */ new Map();
const merger = createDefu((obj, key, value) => {
  if (key === "messages" || key === "datetimeFormats" || key === "numberFormats") {
    obj[key] ??= create(null);
    deepCopy(value, obj[key]);
    return true;
  }
});
export async function loadVueI18nOptions(vueI18nConfigs) {
  const nuxtApp = useNuxtApp();
  let vueI18nOptions = { messages: create(null) };
  for (const configFile of vueI18nConfigs) {
    const resolver = await configFile().then((x) => x.default);
    const resolved = isFunction(resolver) ? await nuxtApp.runWithContext(() => resolver()) : resolver;
    vueI18nOptions = merger(create(null), resolved, vueI18nOptions);
  }
  vueI18nOptions.fallbackLocale ??= false;
  return vueI18nOptions;
}
const isModule = (val) => toTypeString(val) === "[object Module]";
const isResolvedModule = (val) => isModule(val) || import.meta.server;
async function getLocaleMessages(locale, loader) {
  const nuxtApp = useNuxtApp();
  try {
    const getter = await nuxtApp.runWithContext(loader.load).then((x) => isResolvedModule(x) ? x.default : x);
    return isFunction(getter) ? await nuxtApp.runWithContext(() => getter(locale)) : getter;
  } catch (e) {
    throw new Error(`Failed loading locale (${locale}): ` + e.message);
  }
}
export async function getLocaleMessagesMerged(locale, loaders = []) {
  const nuxtApp = useNuxtApp();
  const merged = {};
  for (const loader of loaders) {
    deepCopy(await nuxtApp.runWithContext(async () => await getLocaleMessages(locale, loader)), merged);
  }
  return merged;
}
export async function getLocaleMessagesMergedCached(locale, loaders = []) {
  const nuxtApp = useNuxtApp();
  const merged = {};
  for (const loader of loaders) {
    const cached = getCachedMessages(loader);
    const messages = cached || await nuxtApp.runWithContext(async () => await getLocaleMessages(locale, loader));
    if (!cached && loader.cache !== false) {
      cacheMessages.set(loader.key, { ttl: Date.now() + __I18N_CACHE_LIFETIME__ * 1e3, value: messages });
    }
    deepCopy(messages, merged);
  }
  return merged;
}
function getCachedMessages(loader) {
  if (!__I18N_CACHE__) return;
  if (loader.cache === false) return;
  const cache = cacheMessages.get(loader.key);
  if (cache == null) return;
  return __I18N_CACHE_LIFETIME__ === 0 || cache.ttl > Date.now() ? cache.value : void 0;
}
