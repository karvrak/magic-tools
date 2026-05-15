/**
 * Point d'entree de la couche IA.
 * Re-export les sous-modules pour faciliter les imports applicatifs.
 */

export * from './config'
export * from './types'
export * from './schemas'
export { getOpenAI, getAnthropic } from './clients'
