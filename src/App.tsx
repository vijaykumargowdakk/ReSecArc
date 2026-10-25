import { ReactFlowProvider } from '@xyflow/react';
import { X } from 'lucide-react';
import { useState } from 'react';
import { Canvas } from './ui/canvas/Canvas';
import { Inspector } from './ui/inspector/Inspector';
import { Palette } from './ui/Palette';
import { Toolbar } from './ui/Toolbar';

export function App() {
  const [errors, setErrors] = useState<string[]>([]);
  return (
    <ReactFlowProvider>
      <div className="app">
        <Toolbar onErrors={setErrors} />
        {errors.length > 0 && (
          <div className="notice" role="alert">
            <ul>
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            <button type="button" className="icon-button" onClick={() => setErrors([])} title="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}
        <main className="workspace">
          <Palette />
          <Canvas />
          <Inspector />
        </main>
      </div>
    </ReactFlowProvider>
  );
}
