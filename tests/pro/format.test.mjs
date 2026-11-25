import './setup.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pctOf, dakarDay, dakarInputToISO, isoToDakarInput, dakarMidnight, fcfa } from '../../src/pro/lib/format.js'

test('taux d’annulation : le pourcentage du serveur n’est jamais multiplié', () => {
  assert.equal(pctOf(0.5), 0.5)   // 0,5 % et non 50 %
  assert.equal(pctOf(1), 1)       // 1 % et non 100 %
  assert.equal(pctOf(12.4), 12)
  assert.equal(pctOf(null), 0)
})

test('heure de Dakar (UTC), quel que soit le fuseau de l’ordinateur', () => {
  // 23 h 30 à Dakar le 24/11 = toujours le 24/11 (un PC à Paris disait le 25)
  assert.equal(dakarDay('2026-11-24T23:30:00.000Z'), '2026-11-24')
  // Heure programmée saisie « 14:30 » = 14 h 30 à Dakar = 14:30 UTC
  assert.equal(dakarInputToISO('2026-11-25T14:30'), '2026-11-25T14:30:00.000Z')
  assert.equal(isoToDakarInput('2026-11-25T14:30:00.000Z'), '2026-11-25T14:30')
  assert.equal(dakarMidnight(0).toISOString().slice(11), '00:00:00.000Z')
})

test('montants FCFA lisibles', () => {
  assert.match(fcfa(12500), /^12 500/)
})
