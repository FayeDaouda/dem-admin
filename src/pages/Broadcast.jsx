import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import { Send, Users, Bike, Briefcase, Bell, FlaskConical, Clock, Pencil, X } from 'lucide-react'
import { glass, pageWrap } from '../lib/glassStyles'

const TARGETS = [
  { value: 'all',      label: 'Tous les utilisateurs', icon: Users,     desc: 'Clients + Livreurs + DEM Pro' },
  { value: 'clients',  label: 'Clients uniquement',    icon: Users,     desc: 'Utilisateurs avec le rôle Client' },
  { value: 'drivers',  label: 'Livreurs uniquement',   icon: Bike,      desc: 'Utilisateurs avec le rôle Livreur' },
  { value: 'dem_pro',  label: 'DEM Pro uniquement',    icon: Briefcase, desc: 'Comptes entreprise DEM Pro' },
]

const TARGET_LABELS = { all: 'Tous', clients: 'Clients', drivers: 'Livreurs', dem_pro: 'DEM Pro' }

const TEMPLATES = [
  {
    label: 'Lancement officiel',
    title: 'DEM est officiellement lancé ! 🚀',
    body: 'Commandez vos livraisons dès maintenant. Rapide, fiable et au meilleur prix. Bienvenue sur DEM !',
  },
  {
    label: 'Appel aux livreurs',
    title: 'Les commandes arrivent ! 🏍️',
    body: 'Connectez-vous maintenant pour recevoir vos premières courses. Bonne route avec DEM !',
  },
  {
    label: 'Promotion',
    title: 'Offre spéciale DEM 🎉',
    body: 'Profitez de tarifs réduits sur vos prochaines livraisons. Commandez maintenant !',
  },
]

// Format attendu par <input type="datetime-local"> : YYYY-MM-DDTHH:mm (heure locale)
function toDatetimeLocal(date) {
  const d = new Date(date)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Broadcast() {
  const [target, setTarget]   = useState('all')
  const [title, setTitle]     = useState('')
  const [body, setBody]       = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState('')

  // Programmation
  const [scheduledAt, setScheduledAt] = useState('')
  const [scheduling, setScheduling]   = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [editingId, setEditingId]     = useState(null)
  const [scheduledList, setScheduledList] = useState([])
  const [loadingScheduled, setLoadingScheduled] = useState(true)
  const [cancelingId, setCancelingId] = useState(null)

  // Test
  const [testPhone, setTestPhone] = useState('+221000000000')
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult]   = useState(null)
  const [testError, setTestError]     = useState('')

  const loadScheduled = useCallback(async () => {
    setLoadingScheduled(true)
    try {
      const { data } = await api.get('/admin/broadcast/scheduled', { params: { status: 'PENDING' } })
      setScheduledList(data.scheduled ?? [])
    } catch (e) { console.error(e) }
    finally { setLoadingScheduled(false) }
  }, [])

  useEffect(() => { loadScheduled() }, [loadScheduled])

  async function send() {
    if (!title.trim() || !body.trim()) {
      setError('Le titre et le message sont obligatoires.')
      return
    }
    if (!confirm(`Envoyer la notification à ${TARGETS.find(t => t.value === target)?.label} ?`)) return

    setSending(true)
    setError('')
    setResult(null)
    try {
      const { data } = await api.post('/admin/broadcast', { title: title.trim(), body: body.trim(), target })
      setResult(data.stats)
      setTitle('')
      setBody('')
    } catch (e) {
      setError(e.response?.data?.message ?? 'Erreur lors de l\'envoi.')
    } finally {
      setSending(false)
    }
  }

  async function scheduleOrUpdate() {
    if (!title.trim() || !body.trim()) {
      setScheduleError('Le titre et le message sont obligatoires.')
      return
    }
    if (!scheduledAt) {
      setScheduleError('Choisissez une date et une heure d\'envoi.')
      return
    }
    const iso = new Date(scheduledAt).toISOString()

    setScheduling(true)
    setScheduleError('')
    try {
      if (editingId) {
        await api.patch(`/admin/broadcast/scheduled/${editingId}`, { title: title.trim(), body: body.trim(), target, scheduledAt: iso })
      } else {
        await api.post('/admin/broadcast/scheduled', { title: title.trim(), body: body.trim(), target, scheduledAt: iso })
      }
      cancelEdit()
      loadScheduled()
    } catch (e) {
      setScheduleError(e.response?.data?.message ?? 'Erreur lors de la programmation.')
    } finally {
      setScheduling(false)
    }
  }

  function startEdit(item) {
    setEditingId(item.id)
    setTitle(item.title)
    setBody(item.body)
    setTarget(item.target)
    setScheduledAt(toDatetimeLocal(item.scheduledAt))
    setScheduleError('')
    setResult(null)
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setTitle('')
    setBody('')
    setScheduledAt('')
    setScheduleError('')
  }

  async function cancelScheduled(id) {
    if (!confirm('Annuler cette notification programmée ?')) return
    setCancelingId(id)
    try {
      await api.patch(`/admin/broadcast/scheduled/${id}/cancel`)
      if (editingId === id) cancelEdit()
      loadScheduled()
    } catch (e) {
      alert(e.response?.data?.message ?? 'Erreur lors de l\'annulation.')
    } finally {
      setCancelingId(null)
    }
  }

  async function sendTest() {
    if (!title.trim() || !body.trim()) {
      setTestError('Remplissez le titre et le message d\'abord.')
      return
    }
    setTestSending(true)
    setTestError('')
    setTestResult(null)
    try {
      const { data } = await api.post('/admin/broadcast/test', {
        phone: testPhone.trim(),
        title: title.trim(),
        body: body.trim(),
      })
      setTestResult(data)
    } catch (e) {
      setTestError(e.response?.data?.message ?? 'Erreur lors de l\'envoi test.')
    } finally {
      setTestSending(false)
    }
  }

  function applyTemplate(tpl) {
    setTitle(tpl.title)
    setBody(tpl.body)
    setResult(null)
    setError('')
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Bell size={22} color="var(--primary)" />
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Notification broadcast</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 900 }}>

        {/* Colonne gauche : formulaire */}
        <div style={{ ...glass, padding: 24, borderRadius: 16 }}>
          {editingId && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '8px 12px', borderRadius: 8, background: 'rgba(0,180,230,.08)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>Modification d'une notification programmée</span>
              <button onClick={cancelEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
            </div>
          )}

          {/* Cible */}
          <label style={labelStyle}>Cible</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
            {TARGETS.map(t => {
              const sel = target === t.value
              const Icon = t.icon
              return (
                <button key={t.value} onClick={() => setTarget(t.value)} style={{
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${sel ? 'var(--primary)' : 'rgba(0,119,182,.15)'}`,
                  background: sel ? 'rgba(0,180,230,.08)' : 'rgba(255,255,255,.5)',
                  display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                }}>
                  <Icon size={16} color={sel ? 'var(--primary)' : 'var(--text-muted)'} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: sel ? 'var(--primary)' : 'var(--text)' }}>{t.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Titre */}
          <label style={labelStyle}>Titre</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: DEM est officiellement lancé !"
            style={{ ...inputStyle, marginBottom: 14 }}
          />

          {/* Message */}
          <label style={labelStyle}>Message</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Ex: Commandez vos livraisons dès maintenant..."
            rows={4}
            style={{ ...inputStyle, resize: 'vertical', marginBottom: 18 }}
          />

          {/* Bouton envoyer maintenant */}
          {!editingId && (
            <button onClick={send} disabled={sending} style={{
              width: '100%', padding: '12px 0', borderRadius: 10,
              border: 'none', background: 'var(--primary)', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: sending ? 0.7 : 1, marginBottom: 14,
            }}>
              {sending
                ? 'Envoi en cours…'
                : <><Send size={16} /> Envoyer maintenant</>}
            </button>
          )}

          {error && (
            <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,.08)', color: 'var(--danger)', fontSize: 13 }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)' }}>
              <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>Notification envoyée !</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {result.sent} envoyée{result.sent > 1 ? 's' : ''} sur {result.totalUsers} utilisateur{result.totalUsers > 1 ? 's' : ''}
                {result.failed > 0 && ` · ${result.failed} échoué${result.failed > 1 ? 's' : ''}`}
              </div>
            </div>
          )}

          {/* Programmation */}
          <div style={{ borderTop: '1px solid rgba(0,119,182,.12)', paddingTop: 16 }}>
            <label style={labelStyle}>Programmer l'envoi</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              min={toDatetimeLocal(new Date())}
              onChange={e => setScheduledAt(e.target.value)}
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            <button onClick={scheduleOrUpdate} disabled={scheduling} style={{
              width: '100%', padding: '12px 0', borderRadius: 10,
              border: '1.5px solid var(--primary)', background: 'rgba(0,180,230,.06)', color: 'var(--primary)',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: scheduling ? 0.7 : 1,
            }}>
              {scheduling
                ? 'Enregistrement…'
                : <><Clock size={16} /> {editingId ? 'Mettre à jour' : 'Programmer'}</>}
            </button>
            {scheduleError && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,.08)', color: 'var(--danger)', fontSize: 13 }}>
                {scheduleError}
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite : templates */}
        <div>
          <label style={labelStyle}>Modèles prédéfinis</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TEMPLATES.map((tpl, i) => (
              <button key={i} onClick={() => applyTemplate(tpl)} style={{
                ...glass, padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                border: '1px solid rgba(0,119,182,.12)', textAlign: 'left',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', marginBottom: 4 }}>{tpl.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{tpl.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tpl.body}</div>
              </button>
            ))}
          </div>

          {/* Aperçu */}
          {(title || body) && (
            <div style={{ marginTop: 20 }}>
              <label style={labelStyle}>Aperçu notification</label>
              <div style={{
                ...glass, padding: '14px 16px', borderRadius: 14,
                border: '1px solid rgba(0,119,182,.15)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#0CB8DE,#0671BA)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 14 }}>D</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>DEM · maintenant</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{title || 'Titre…'}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{body || 'Message…'}</div>
              </div>
            </div>
          )}
          {/* Test unitaire */}
          <div style={{ marginTop: 20 }}>
            <label style={labelStyle}>Test unitaire</label>
            <div style={{ ...glass, padding: '14px 16px', borderRadius: 14, border: '1px solid rgba(0,119,182,.15)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Envoyer la notification à un seul numéro pour vérifier le rendu.
              </div>
              <input
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="+221000000000"
                style={{ ...inputStyle, marginBottom: 10 }}
              />
              <button onClick={sendTest} disabled={testSending} style={{
                width: '100%', padding: '10px 0', borderRadius: 8,
                border: '1.5px solid var(--primary)', background: 'rgba(0,180,230,.06)',
                color: 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                opacity: testSending ? 0.7 : 1,
              }}>
                {testSending ? 'Envoi…' : <><FlaskConical size={14} /> Envoyer le test</>}
              </button>
              {testError && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)' }}>{testError}</div>
              )}
              {testResult && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--success)' }}>
                  Envoyé à {testResult.user?.name ?? testResult.user?.phone} ({testResult.user?.role})
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications programmées en attente */}
      <div style={{ maxWidth: 900, marginTop: 24 }}>
        <label style={labelStyle}>Notifications programmées</label>
        <div style={{ ...glass, padding: 20, borderRadius: 16 }}>
          {loadingScheduled ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 12 }}>Chargement...</div>
          ) : scheduledList.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 12 }}>Aucune notification programmée pour le moment.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {scheduledList.map(item => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,.5)', border: '1px solid rgba(0,119,182,.12)',
                }}>
                  <Clock size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(item.scheduledAt).toLocaleString('fr-FR')} · {TARGET_LABELS[item.target] ?? item.target}
                    </div>
                  </div>
                  <button onClick={() => startEdit(item)} style={iconBtn} title="Modifier">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => cancelScheduled(item.id)} disabled={cancelingId === item.id} style={{ ...iconBtn, color: 'var(--danger)' }} title="Annuler">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }
const iconBtn = { width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(0,119,182,.2)', background: 'rgba(255,255,255,.6)', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
