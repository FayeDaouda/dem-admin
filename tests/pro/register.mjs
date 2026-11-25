// Le code de l'espace web importe sans extension (résolution de Vite) :
// même résolution pour le testeur de Node.
import { registerHooks } from 'node:module'
registerHooks({
  resolve(specifier, context, next) {
    try { return next(specifier, context) } catch (e) {
      if (e?.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[cm]?jsx?$/.test(specifier)) {
        return next(`${specifier}.js`, context)
      }
      throw e
    }
  },
})
