import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <h1>Lyfoes Solver</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Welcome to the Lyfoes puzzle solver! 🧩
        </p>
      </div>
      <p className="read-the-docs">
        Click the button above to test React functionality
      </p>
    </div>
  )
}

export default App