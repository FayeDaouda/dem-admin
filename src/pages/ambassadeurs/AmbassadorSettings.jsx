import { useEffect, useState } from 'react'
import { Save, Plus, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { glass, glassInput } from '../../lib/glassStyles'
import { MEDAL, fcfa } from './ambassadorUi'

// Réglages de la campagne (Super) : ouverture, places, dates, montants des
// médailles et des boosters, règles de calcul, vidéo et quiz de formation.
// Valeurs par défaut = brochure (60 000 F de médailles, 20 000 F de boosters).
const toLocal = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : '')

export default function AmbassadorSettings({ canEdit }) {
  const [saved, setSaved] = useState(null)
  const [d, setD] = useState(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/admin/ambassadors/settings').then(r => { setSaved(r.data); setD(JSON.parse(JSON.stringify(r.data))) })
      .catch(e => setError(e.response?.data?.message ?? 'Erreur de chargement.'))
  }, [])
  if (error && !d) return <div style={{ ...glass, padding: 16, color: '#b91c1c', fontSize: 13 }}>{error}</div>
  if (!d) return <div style={{ ...glass, padding: 16, fontSize: 13, color: 'var(--text-muted)' }}>Chargement…</div>

  const set = (patch) => { setD(prev => ({ ...prev, ...patch })); setDone('') }
  const changed = JSON.stringify(d) !== JSON.stringify(saved)
  const total = Object.values(d.medals).reduce((a, b) => a + Number(b || 0), 0) + Number(d.boosterCap || 0)

  const save = async () => {
    setSaving(true); setError(''); setDone('')
    try {
      const { data } = await api.put('/admin/ambassadors/settings', d)
      setSaved(data); setD(JSON.parse(JSON.stringify(data))); setDone('Réglages enregistrés.')
    } catch (e) { setError(e.response?.data?.message ?? 'Enregistrement impossible.') } finally { setSaving(false) }
  }

  const num = (v) => (v === '' ? '' : Number(v))
  const quiz = d.quiz ?? []
  const setQuiz = (next) => set({ quiz: next })

  return (
    <fieldset disabled={!canEdit} style={{ border: 'none', padding: 0, margin: 0, display: 'grid', gap: 14, maxWidth: 820 }}>
      {!canEdit && <div style={{ ...glass, padding: 12, fontSize: 12.5, color: 'var(--text-muted)' }}>Lecture seule : seul le Super Admin modifie les réglages.</div>}

      <Card title="Campagne" text="Fermé : personne ne peut s'inscrire et rien n'est calculé. Les gains déjà acquis sont quand même versés.">
        <label style={row}><input type="checkbox" checked={!!d.active} onChange={e => set({ active: e.target.checked })} /> <b>Programme ouvert</b></label>
        <Grid>
          <Field label="Places (ambassadeurs actifs)"><input type="number" min={1} value={d.places} onChange={e => set({ places: num(e.target.value) })} style={inp} /></Field>
          <Field label="Début de la campagne"><input type="datetime-local" value={toLocal(d.startsAt)} onChange={e => set({ startsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} style={inp} /></Field>
          <Field label="Fin de la campagne"><input type="datetime-local" value={toLocal(d.endsAt)} onChange={e => set({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} style={inp} /></Field>
          <Field label="Jours de vérification avant versement"><input type="number" min={0} value={d.lockDays} onChange={e => set({ lockDays: num(e.target.value) })} style={inp} /></Field>
        </Grid>
      </Card>

      <Card title="Médailles" text={`Gain maximum par ambassadeur : ${fcfa(total)} (médailles + plafond des boosters).`}>
        <Grid>
          {['START', 'BRONZE', 'SILVER', 'GOLD'].map(k => (
            <Field key={k} label={`${MEDAL[k].emoji} ${MEDAL[k].label} (F)`}>
              <input type="number" min={0} value={d.medals[k]} onChange={e => set({ medals: { ...d.medals, [k]: num(e.target.value) } })} style={inp} />
            </Field>
          ))}
        </Grid>
        <Grid>
          <Field label="Pro par ambassadeur"><input type="number" min={1} value={d.maxPro} onChange={e => set({ maxPro: num(e.target.value) })} style={inp} /></Field>
          <Field label="Courses pour débloquer un Pro"><input type="number" min={1} value={d.unlockCourses} onChange={e => set({ unlockCourses: num(e.target.value) })} style={inp} /></Field>
          <Field label="Or : courses cumulées"><input type="number" min={1} value={d.goldTotalCourses} onChange={e => set({ goldTotalCourses: num(e.target.value) })} style={inp} /></Field>
          <Field label="Démarrage : Pro avec une 1re course"><input type="number" min={0} value={d.startMinFirstOrders} onChange={e => set({ startMinFirstOrders: num(e.target.value) })} style={inp} /></Field>
          <Field label="Courses / semaine / destinataire"><input type="number" min={1} value={d.maxPerRecipientWeek} onChange={e => set({ maxPerRecipientWeek: num(e.target.value) })} style={inp} /></Field>
        </Grid>
        <p style={hint}>Le Démarrage est versé quand l'ambassadeur atteint le Bronze.</p>
      </Card>

      <Card title="Boosters" text="Dès le Bronze, quand les Pro ralentissent : un objectif à atteindre en quelques jours. Jamais sous la meilleure semaine, un même Pro compte pour la moitié au plus, un booster par semaine.">
        <Grid>
          {['BRONZE', 'SILVER', 'GOLD'].map(k => (
            <div key={k} style={{ display: 'grid', gap: 6 }}>
              <b style={{ fontSize: 12.5 }}>{MEDAL[k].emoji} Palier {MEDAL[k].label}</b>
              <Field label="Objectif (courses)"><input type="number" min={1} value={d.boosters[k].target} onChange={e => set({ boosters: { ...d.boosters, [k]: { ...d.boosters[k], target: num(e.target.value) } } })} style={inp} /></Field>
              <Field label="Bonus (F)"><input type="number" min={0} value={d.boosters[k].bonus} onChange={e => set({ boosters: { ...d.boosters, [k]: { ...d.boosters[k], bonus: num(e.target.value) } } })} style={inp} /></Field>
            </div>
          ))}
        </Grid>
        <Grid>
          <Field label="Durée d'un booster (jours)"><input type="number" min={1} value={d.boosterDays} onChange={e => set({ boosterDays: num(e.target.value) })} style={inp} /></Field>
          <Field label="Plafond des boosters par ambassadeur (F)"><input type="number" min={0} value={d.boosterCap} onChange={e => set({ boosterCap: num(e.target.value) })} style={inp} /></Field>
        </Grid>
      </Card>

      <Card title="Mini-formation" text="Une vidéo, puis un quiz : toutes les réponses justes débloquent le code et le lien ambassadeur.">
        <Field label="Lien de la vidéo (https://…)"><input value={d.trainingVideoUrl ?? ''} onChange={e => set({ trainingVideoUrl: e.target.value })} placeholder="https://youtu.be/…" style={inp} /></Field>
        {quiz.map((q, i) => (
          <div key={i} style={{ border: '1px solid rgba(0,0,0,.08)', borderRadius: 10, padding: 12, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <b style={{ fontSize: 12.5 }}>Question {i + 1}</b>
              <span style={{ flex: 1 }} />
              <button type="button" onClick={() => setQuiz(quiz.filter((_, j) => j !== i))} style={iconBtn} aria-label="Supprimer la question"><Trash2 size={14} /></button>
            </div>
            <input value={q.question} onChange={e => setQuiz(quiz.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} placeholder="Question" style={inp} />
            {q.options.map((o, k) => (
              <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="radio" name={`q${i}`} checked={q.answer === k} onChange={() => setQuiz(quiz.map((x, j) => j === i ? { ...x, answer: k } : x))} title="Bonne réponse" />
                <input value={o} onChange={e => setQuiz(quiz.map((x, j) => j === i ? { ...x, options: x.options.map((y, l) => l === k ? e.target.value : y) } : x))} placeholder={`Réponse ${k + 1}`} style={{ ...inp, flex: 1 }} />
              </label>
            ))}
            {q.options.length < 4 && <button type="button" onClick={() => setQuiz(quiz.map((x, j) => j === i ? { ...x, options: [...x.options, ''] } : x))} style={linkBtn}>+ Ajouter une réponse</button>}
          </div>
        ))}
        {quiz.length < 10 && <button type="button" onClick={() => setQuiz([...quiz, { question: '', options: ['', ''], answer: 0 }])} style={{ ...btnGhost, justifySelf: 'start' }}><Plus size={14} /> Ajouter une question</button>}
        <p style={hint}>Cochez la bonne réponse de chaque question. Sans quiz, la formation ne peut pas être validée.</p>
      </Card>

      {canEdit && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={save} disabled={!changed || saving} style={{ ...btnPrimary, opacity: !changed || saving ? 0.5 : 1 }}><Save size={14} /> {saving ? 'Enregistrement…' : 'Enregistrer'}</button>
          {error && <span style={{ fontSize: 12.5, color: '#b91c1c' }}>{error}</span>}
          {done && <span style={{ fontSize: 12.5, color: '#15803d', fontWeight: 600 }}>{done}</span>}
        </div>
      )}
    </fieldset>
  )
}

function Card({ title, text, children }) {
  return (
    <section style={{ ...glass, padding: '16px 20px', display: 'grid', gap: 12 }}>
      <div><h3 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>{title}</h3>{text && <p style={{ ...hint, margin: '4px 0 0' }}>{text}</p>}</div>
      {children}
    </section>
  )
}
function Grid({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>{children}</div> }
function Field({ label, children }) { return <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{label}{children}</label> }

const inp = { ...glassInput, padding: '8px 10px', fontSize: 13, color: 'var(--text)', width: '100%', boxSizing: 'border-box' }
const hint = { fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }
const row = { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }
const base = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnPrimary = { ...base, border: 'none', background: 'var(--primary)', color: '#fff' }
const btnGhost = { ...base, border: '1px solid rgba(0,119,182,.25)', background: 'transparent', color: 'var(--primary)' }
const iconBtn = { border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }
const linkBtn = { border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--primary)', fontWeight: 700, fontSize: 12.5, justifySelf: 'start' }
