import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// Champ mot de passe avec bouton afficher / masquer
export default function PasswordInput({ value, onChange, placeholder, autoComplete, inputStyle }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        style={{ ...inputStyle, paddingRight: 42 }}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        title={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
          color: '#5a7a96', display: 'flex', alignItems: 'center',
        }}
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  )
}
