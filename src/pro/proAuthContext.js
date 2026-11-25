import { createContext, useContext } from 'react'

// Contexte de connexion de l'espace web DEM Pro (voir ProAuth.jsx)
export const ProAuthContext = createContext(null)
export const useProAuth = () => useContext(ProAuthContext)

// Le numéro n'est pas un compte DEM Pro : message affiché tel quel
export class NotProAccount extends Error {}
