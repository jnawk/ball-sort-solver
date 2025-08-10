import React from 'react'
import ReactDOM from 'react-dom/client'
import { PuzzleBuilder } from './components/PuzzleBuilder'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="App">
      <PuzzleBuilder />
    </div>
  </React.StrictMode>,
)
