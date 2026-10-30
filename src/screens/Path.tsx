import { useState } from 'react'
import Progress from './Progress'
import Plan from './Plan'
import Habits from './Habits'
import type { Habit } from '../lib/types'

type Sub = 'progress' | 'plan' | 'habits'

export default function Path({ onAdd, onEdit }: { onAdd: () => void; onEdit: (h: Habit) => void }) {
  const [sub, setSub] = useState<Sub>('progress')
  return (
    <div className="path">
      <div className="seg path-seg" role="tablist">
        <button role="tab" aria-selected={sub === 'progress'} className={sub === 'progress' ? 'on' : ''} onClick={() => setSub('progress')}>Прогресс</button>
        <button role="tab" aria-selected={sub === 'plan'} className={sub === 'plan' ? 'on' : ''} onClick={() => setSub('plan')}>План</button>
        <button role="tab" aria-selected={sub === 'habits'} className={sub === 'habits' ? 'on' : ''} onClick={() => setSub('habits')}>Привычки</button>
      </div>
      <div className="embedded" key={sub}>
        {sub === 'progress' && <Progress />}
        {sub === 'plan' && <Plan />}
        {sub === 'habits' && <Habits onAdd={onAdd} onEdit={onEdit} />}
      </div>
    </div>
  )
}
