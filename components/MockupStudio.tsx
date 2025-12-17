
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, Wand2, Download, Eraser, CheckCircle2, Shirt, Zap, Move, Lock, Unlock, FlipHorizontal, FlipVertical, Sparkles, Maximize, Ruler, PenTool, RotateCcw, RefreshCcw, ZoomIn, ZoomOut, Hand, MousePointerClick, RefreshCw, Layers, CopyCheck, Settings2, Undo2, Redo2, XCircle } from 'lucide-react';
import { ModuleHeader, ModuleLandingPage } from './Shared';

interface AppliedLayer {
  id: string;
  maskCanvas: HTMLCanvasElement;
  maskX: number; maskY: number; maskW: number; maskH: number; maskCenter: { x: number, y: number };
  pattern: CanvasPattern | null;
  offsetX: number; offsetY: number; scale: number; rotation: number; flipX: boolean; flipY: boolean;
  timestamp?: number;
}

export const MockupStudio: React.FC = () => {
  const [moldImage, setMoldImage] = useState<string | null>(null);
  const [moldImgObj, setMoldImgObj] = useState<HTMLImageElement | null>(null);
  const [patternImage, setPatternImage] = useState<string | null>(null);
  const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);

  // State & History
  const [layers, setLayers] = useState<AppliedLayer[]>([]);
  const [history, setHistory] = useState<AppliedLayer[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [tool, setTool] = useState<'WAND' | 'MOVE' | 'HAND'>('WAND');
  const [tolerance, setTolerance] = useState(40); 
  
  // UI Controls (Global State)
  const [editAll, setEditAll] = useState(true);
  const [activeScale, setActiveScale] = useState(0.5);
  const [activeRotation, setActiveRotation] = useState(0);
  const [activeFlipX, setActiveFlipX] = useState(false);
  const [activeFlipY, setActiveFlipY] = useState(false);

  // Viewport
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const isPanning = useRef(false);
  const lastDistRef = useRef<number>(0);

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const moldInputRef = useRef<HTMLInputElement>(null);
  const patternInputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // --- HISTORY MANAGEMENT ---
  const saveToHistory = (newLayers: AppliedLayer[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newLayers);
      // Limit history to 20 steps to save memory
      if (newHistory.length > 20) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setLayers(newLayers);
  };

  const undo = () => {
      if (historyIndex > 0) {
          const prevIndex = historyIndex - 1;
          setHistoryIndex(prevIndex);
          setLayers(history[prevIndex]);
          // Restore active layer ID if it exists in previous state, else null
          const prevLayers = history[prevIndex];
          if (activeLayerId && !prevLayers.find(l => l.id === activeLayerId)) {
              setActiveLayerId(null);
          }
      } else if (historyIndex === 0) {
          // Clear all if hitting start
          setHistoryIndex(-1);
          setLayers([]);
          setActiveLayerId(null);
      }
  };

  const redo = () => {
      if (historyIndex < history.length - 1) {
          const nextIndex = historyIndex + 1;
          setHistoryIndex(nextIndex);
          setLayers(history[nextIndex]);
      }
  };

  // Keyboard Shortcuts (Undo/Redo)
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
              e.preventDefault();
              if (e.shiftKey) redo();
              else undo();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // --- INIT & SETUP ---
  useEffect(() => {
    const checkStorage = () => {
        const stored = localStorage.getItem('vingi_mockup_pattern');
        if (stored) { setPatternImage(stored); localStorage.removeItem('vingi_mockup_pattern'); }
    };
    checkStorage();
    window.addEventListener('vingi_transfer', (e: any) => { if (e.detail?.module === 'MOCKUP') checkStorage(); });
  }, []);

  useEffect(() => {
    if (moldImage) {
      const img = new Image(); 
      img.src = moldImage; 
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setMoldImgObj(img);
        setLayers([]); 
        setHistory([]);
        setHistoryIndex(-1);
        setActiveLayerId(null);
        
        // Auto Fit
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            // Wait a tick for layout
            setTimeout(() => {
                const k = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight) * 0.9;
                setView({ x: 0, y: 0, k: k || 0.5 });
            }, 50);
        }
        
        // Init Canvas Buffers
        if (mainCanvasRef.current) {
            mainCanvasRef.current.width = img.naturalWidth;
            mainCanvasRef.current.height = img.naturalHeight;
        }
        if (!tempCanvasRef.current) tempCanvasRef.current = document.createElement('canvas');
        tempCanvasRef.current.width = img.naturalWidth;
        tempCanvasRef.current.height = img.naturalHeight;
      };
    }
  }, [moldImage]);

  useEffect(() => { if (patternImage) { const img = new Image(); img.src = patternImage; img.crossOrigin = "anonymous"; img.onload = () => setPatternImgObj(img); } }, [patternImage]);

  // Sync Controls when selecting specific layer (if not editing all)
  useEffect(() => {
      if (activeLayerId && !editAll) {
          const layer = layers.find(l => l.id === activeLayerId);
          if (layer) { 
              setActiveScale(layer.scale); 
              setActiveRotation(layer.rotation); 
              setActiveFlipX(layer.flipX); 
              setActiveFlipY(layer.flipY); 
          }
      }
  }, [activeLayerId]); 

  // --- LAYER UPDATES ---
  const updateTargetLayers = (updater: (l: AppliedLayer) => Partial<AppliedLayer>, saveToHistoryFlag = false) => {
      if (layers.length === 0) return;
      
      const newLayers = layers.map(l => { 
          if (editAll || l.id === activeLayerId) { 
              return { ...l, ...updater(l) }; 
          }
          return l; 
      });
      
      setLayers(newLayers);
      if (saveToHistoryFlag) saveToHistory(newLayers);
  };

  const handleFlipX = () => {
      const newVal = !activeFlipX;
      setActiveFlipX(newVal);
      updateTargetLayers(l => ({ flipX: newVal, offsetX: -l.offsetX }), true); 
  };

  const handleFlipY = () => {
      const newVal = !activeFlipY;
      setActiveFlipY(newVal);
      updateTargetLayers(l => ({ flipY: newVal, offsetY: -l.offsetY }), true);
  };

  const handleRotate = (val: number, commit = false) => {
      setActiveRotation(val);
      updateTargetLayers(l => ({ rotation: val }), commit);
  };

  const handleScale = (val: number, commit = false) => {
      setActiveScale(val);
      updateTargetLayers(l => ({ scale: val }), commit);
  };

  // --- RENDER ---
  const render = useCallback(() => {
    const canvas = mainCanvasRef.current; const tempCanvas = tempCanvasRef.current;
    if (!canvas || !moldImgObj || !tempCanvas) return;
    const ctx = canvas.getContext('2d', { alpha: false })!; const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;

    // 1. Draw Base
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); 
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);

    // 2. Draw Layers
    layers.forEach(layer => {
        // Clear temp for this layer
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw Mask
        tempCtx.drawImage(layer.maskCanvas, layer.maskX, layer.maskY);
        
        // Clip & Draw Pattern
        tempCtx.globalCompositeOperation = 'source-in';
        
        tempCtx.save();
        tempCtx.translate(layer.maskCenter.x, layer.maskCenter.y);
        tempCtx.rotate((layer.rotation * Math.PI) / 180);
        tempCtx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
        tempCtx.scale(layer.scale, layer.scale);
        tempCtx.translate(layer.offsetX, layer.offsetY);
        
        if (layer.pattern) { 
            tempCtx.fillStyle = layer.pattern; 
            const diag = Math.sqrt(layer.maskW**2 + layer.maskH**2); 
            const safeSize = (diag * 1.5) / layer.scale; 
            tempCtx.fillRect(-safeSize, -safeSize, safeSize*2, safeSize*2); 
        }
        tempCtx.restore();
        
        // Composite to Main
        ctx.save(); 
        ctx.globalAlpha = 0.92; 
        ctx.drawImage(tempCanvas, 0, 0); 
        ctx.restore();

        // Highlight
        if (layer.id === activeLayerId || (editAll && activeLayerId)) {
            ctx.save(); 
            ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath(); 
            ctx.arc(layer.maskCenter.x, layer.maskCenter.y, 8 / view.k, 0, Math.PI * 2); 
            ctx.fillStyle = editAll ? '#8b5cf6' : '#3b82f6'; 
            ctx.strokeStyle = 'white'; 
            ctx.lineWidth = 2 / view.k; 
            ctx.fill(); ctx.stroke();
            ctx.restore();
        }
    });

    // 3. Texture Overlay (Multiply)
    ctx.save(); 
    ctx.globalCompositeOperation = 'multiply'; 
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height); 
    ctx.restore();

  }, [moldImgObj, layers, activeLayerId, editAll, view.k]);

  useEffect(() => { requestAnimationFrame(render); }, [render]);

  // --- FLOOD FILL ---
  const createMaskFromClick = (startX: number, startY: number) => {
      if (!mainCanvasRef.current || !moldImgObj) return null;
      const width = mainCanvasRef.current.width; const height = mainCanvasRef.current.height;
      
      // Always read from ORIGINAL mold image to avoid interference from existing layers
      const tempCanvas = document.createElement('canvas'); tempCanvas.width = width; tempCanvas.height = height;
      const tCtx = tempCanvas.getContext('2d')!; tCtx.drawImage(moldImgObj, 0, 0, width, height);
      const data = tCtx.getImageData(0, 0, width, height).data;
      
      const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
      const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];
      
      const visited = new Uint8Array(width * height);
      const stack = [[Math.floor(startX), Math.floor(startY)]];
      const tol = tolerance;
      let minX = width, maxX = 0, minY = height, maxY = 0;
      let pixelCount = 0;
      const validPixels: number[] = [];

      while (stack.length) {
          const [x, y] = stack.pop()!;
          const idx = y * width + x;
          if (visited[idx]) continue;
          visited[idx] = 1;
          const pPos = idx * 4;
          
          const diff = Math.abs(data[pPos] - r0) + Math.abs(data[pPos+1] - g0) + Math.abs(data[pPos+2] - b0);
          
          if (diff <= tol * 3) {
              validPixels.push(idx); pixelCount++;
              if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
              
              if (x > 0) stack.push([x-1, y]); 
              if (x < width - 1) stack.push([x+1, y]); 
              if (y > 0) stack.push([x, y-1]); 
              if (y < height - 1) stack.push([x, y+1]);
          }
      }
      
      if (pixelCount < 50) return null;

      const maskW = maxX - minX + 1; const maskH = maxY - minY + 1;
      const maskCanvas = document.createElement('canvas'); maskCanvas.width = maskW; maskCanvas.height = maskH;
      const mCtx = maskCanvas.getContext('2d')!; const mImgData = mCtx.createImageData(maskW, maskH); const mData = mImgData.data;
      
      for (const globalIdx of validPixels) {
          const gx = globalIdx % width; const gy = Math.floor(globalIdx / width);
          const lx = gx - minX; const ly = gy - minY;
          const localIdx = (ly * maskW + lx) * 4;
          mData[localIdx] = 255; mData[localIdx+1] = 255; mData[localIdx+2] = 255; mData[localIdx+3] = 255;
      }
      mCtx.putImageData(mImgData, 0, 0);
      return { maskCanvas, minX, minY, maskW, maskH, centerX: minX + maskW / 2, centerY: minY + maskH / 2 };
  };

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      const x = (clientX - rect.left) * (canvas.width / rect.width);
      const y = (clientY - rect.top) * (canvas.height / rect.height);
      return { x, y, clientX, clientY };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (!moldImgObj || !patternImgObj) return;
      // Prevent browser zoom/pan defaults
      // e.preventDefault(); // Optional: careful with this on mobile scrolling

      const { x, y, clientX, clientY } = getCanvasCoords(e);
      lastPos.current = { x: clientX, y: clientY };

      if (tool === 'HAND' || ('buttons' in e && e.buttons === 4)) {
          isPanning.current = true;
          return;
      }

      if (tool === 'WAND') {
          const res = createMaskFromClick(x, y);
          if (res) {
              const tempP = document.createElement('canvas');
              const ctxP = tempP.getContext('2d')!;
              const pat = ctxP.createPattern(patternImgObj, 'repeat');
              const newLayer: AppliedLayer = {
                  id: Date.now().toString(), 
                  maskCanvas: res.maskCanvas, 
                  maskX: res.minX, 
                  maskY: res.minY, 
                  maskW: res.maskW, 
                  maskH: res.maskH, 
                  maskCenter: { x: res.centerX, y: res.centerY },
                  pattern: pat, 
                  offsetX: 0, offsetY: 0, 
                  // Inherit UI settings to keep consistency
                  scale: activeScale, 
                  rotation: activeRotation,
                  flipX: activeFlipX, 
                  flipY: activeFlipY, 
                  timestamp: Date.now()
              };
              
              const nextLayers = [...layers, newLayer];
              saveToHistory(nextLayers);
              setActiveLayerId(newLayer.id); 
          }
      } else if (tool === 'MOVE') {
          let clickedId = null;
          for (let i = layers.length - 1; i >= 0; i--) {
              const l = layers[i];
              const dist = Math.sqrt((x - l.maskCenter.x)**2 + (y - l.maskCenter.y)**2);
              if (dist < 50 / view.k) { clickedId = l.id; break; }
          }
          if (clickedId) { setActiveLayerId(clickedId); isDragging.current = true; } 
          else { setActiveLayerId(null); }
      }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
      const { clientX, clientY } = 'touches' in e ? { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } : { clientX: (e as React.MouseEvent).clientX, clientY: (e as React.MouseEvent).clientY };
      
      if (isPanning.current) {
          const dx = clientX - lastPos.current.x;
          const dy = clientY - lastPos.current.y;
          setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
          lastPos.current = { x: clientX, y: clientY };
          return;
      }

      if (!isDragging.current || !activeLayerId || tool !== 'MOVE') return;
      if (e.cancelable) e.preventDefault();
      
      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.width / rect.width; 
      const dxCanvas = (clientX - lastPos.current.x) * scale;
      const dyCanvas = (clientY - lastPos.current.y) * scale;
      
      updateTargetLayers(layer => {
          const angleRad = (layer.rotation * Math.PI) / 180;
          let dxLocal = dxCanvas * Math.cos(angleRad) + dyCanvas * Math.sin(angleRad);
          let dyLocal = -dxCanvas * Math.sin(angleRad) + dyCanvas * Math.cos(angleRad);
          if (layer.flipX) dxLocal = -dxLocal; 
          if (layer.flipY) dyLocal = -dyLocal; 
          dxLocal /= layer.scale; dyLocal /= layer.scale;
          return { offsetX: layer.offsetX + dxLocal, offsetY: layer.offsetY + dyLocal };
      });
      lastPos.current = { x: clientX, y: clientY };
  };

  // --- TOUCH ---
  const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          e.preventDefault();
          const dist = Math.sqrt((e.touches[0].clientX - e.touches[1].clientX)**2 + (e.touches[0].clientY - e.touches[1].clientY)**2);
          lastDistRef.current = dist;
      } else {
          handlePointerDown(e);
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
          e.preventDefault();
          const dist = Math.sqrt((e.touches[0].clientX - e.touches[1].clientX)**2 + (e.touches[0].clientY - e.touches[1].clientY)**2);
          const scale = dist / lastDistRef.current;
          setView(v => ({ ...v, k: Math.min(Math.max(0.1, v.k * scale), 5) }));
          lastDistRef.current = dist;
      } else {
          handlePointerMove(e);
      }
  };

  const handleDownload = () => {
    if (!mainCanvasRef.current) return;
    const link = document.createElement('a'); link.download = 'vingi-mockup.png'; link.href = mainCanvasRef.current.toDataURL('image/png', 1.0); link.click();
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#f0f2f5] overflow-hidden">
      <ModuleHeader icon={Shirt} title="Aplicação em Corte" subtitle="Engenharia Técnica 2D" actionLabel={moldImage ? "Novo Projeto" : undefined} onAction={() => { setMoldImage(null); setLayers([]); setHistory([]); setHistoryIndex(-1); }} />

      {!moldImage ? (
          <div className="flex-1 overflow-y-auto">
              <input type="file" ref={moldInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = (ev) => setMoldImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
              <ModuleLandingPage icon={Shirt} title="Mockup Técnico" description="Ferramenta de engenharia para aplicação de estampas em moldes de corte." primaryActionLabel="Carregar Molde/Peça" onPrimaryAction={() => moldInputRef.current?.click()} features={["Preenchimento Inteligente", "Controle de Fio", "Escala Real", "Espelhamento"]} />
          </div>
      ) : (
          <div className="flex-1 flex flex-col relative h-full">
              {/* CANVAS */}
              <div 
                ref={containerRef} 
                className={`flex-1 bg-gray-100 relative flex items-center justify-center overflow-hidden touch-none ${tool==='HAND'?'cursor-grab active:cursor-grabbing':'cursor-crosshair'}`} 
                onWheel={(e) => { if(e.ctrlKey || tool==='HAND') { e.preventDefault(); const s=Math.exp(-e.deltaY*0.001); setView(v=>({...v, k:Math.min(Math.max(0.1,v.k*s),8)})); }}}
                onTouchStart={handleTouchStart} 
                onTouchMove={handleTouchMove}
              >
                  <div 
                      className="relative shadow-2xl transition-transform duration-75 ease-out origin-center" 
                      style={{ 
                          transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
                          width: moldImgObj ? moldImgObj.width : 'auto',
                          height: moldImgObj ? moldImgObj.height : 'auto'
                      }}
                  >
                      <canvas 
                        ref={mainCanvasRef} 
                        onMouseDown={handlePointerDown} 
                        onMouseMove={handlePointerMove} 
                        onMouseUp={() => { isDragging.current = false; isPanning.current = false; }} 
                        onMouseLeave={() => { isDragging.current = false; isPanning.current = false; }}
                        className="block bg-white" 
                      />
                  </div>

                  {!patternImage && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center backdrop-blur-sm z-50">
                          <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm">
                              <h3 className="text-xl font-bold mb-4">Selecione a Estampa</h3>
                              <button onClick={() => patternInputRef.current?.click()} className="w-full py-3 bg-vingi-900 text-white rounded-xl font-bold shadow-lg hover:bg-vingi-800 flex items-center justify-center gap-2"><UploadCloud size={20}/> Carregar Arquivo</button>
                              <input type="file" ref={patternInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = (ev) => setPatternImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                          </div>
                      </div>
                  )}
                  
                  {patternImage && (
                      <div className="absolute top-4 left-4 z-30 bg-white p-1 rounded-lg shadow-md border border-gray-200 cursor-pointer hover:scale-105 transition-transform group" onClick={() => patternInputRef.current?.click()}>
                          <img src={patternImage} className="w-12 h-12 object-cover rounded-md bg-gray-100 border border-gray-100" />
                          <div className="absolute -top-1 -right-1 bg-vingi-500 rounded-full p-0.5 border border-white text-white"><RefreshCw size={10} /></div>
                          <input type="file" ref={patternInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = (ev) => setPatternImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden" accept="image/*" />
                      </div>
                  )}
                  
                  {/* Instructions */}
                  {patternImage && layers.length === 0 && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-vingi-600 text-white px-6 py-2 rounded-full text-xs font-bold shadow-xl animate-bounce z-50 flex items-center gap-2 pointer-events-none">
                          <MousePointerClick size={16}/> Toque na peça para aplicar
                      </div>
                  )}

                  {/* Zoom Controls */}
                  <div className="absolute top-4 right-4 flex flex-col gap-2 bg-white rounded-lg shadow-md p-1 z-30">
                      <button onClick={()=>setView(v=>({...v, k: Math.min(v.k*1.2, 8)}))} className="p-2 hover:bg-gray-100 rounded text-gray-600"><ZoomIn size={18}/></button>
                      <button onClick={()=>setView(v=>({...v, k: Math.max(v.k*0.8, 0.1)}))} className="p-2 hover:bg-gray-100 rounded text-gray-600"><ZoomOut size={18}/></button>
                      <button onClick={()=>{ if(containerRef.current && moldImgObj) { const rect = containerRef.current.getBoundingClientRect(); setView({x:0, y:0, k: Math.min(rect.width/moldImgObj.width, rect.height/moldImgObj.height)*0.9}); } }} className="p-2 hover:bg-gray-100 rounded text-gray-600"><RotateCcw size={18}/></button>
                  </div>
              </div>

              {/* EDITOR TOOLBAR (2-ROW LAYOUT) */}
              <div className="shrink-0 bg-white border-t border-gray-200 shadow-[0_-5px_20px_rgba(0,0,0,0.1)] z-40 flex flex-col pb-safe max-h-[45vh] overflow-y-auto custom-scrollbar">
                  
                  {/* ROW 1: PRIMARY TOOLS & UNDO */}
                  <div className="flex items-center justify-between p-2 border-b border-gray-100 overflow-x-auto gap-4 px-4 shrink-0">
                      <div className="flex bg-gray-100 rounded-lg p-1 gap-1 shrink-0">
                          <button onClick={() => setTool('HAND')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all ${tool==='HAND' ? 'bg-white shadow text-vingi-600' : 'text-gray-500'}`}><Hand size={16}/> MOVER</button>
                          <button onClick={() => setTool('WAND')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all ${tool==='WAND' ? 'bg-white shadow text-vingi-600' : 'text-gray-500'}`}><Wand2 size={16}/> VARINHA</button>
                          <button onClick={() => setTool('MOVE')} className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold transition-all ${tool==='MOVE' ? 'bg-white shadow text-vingi-600' : 'text-gray-500'}`}><Move size={16}/> AJUSTAR</button>
                      </div>
                      
                      {/* UNDO / REDO GROUP */}
                      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
                          <button onClick={undo} disabled={historyIndex <= -1} className="p-2 rounded-md text-gray-600 hover:bg-white hover:text-vingi-600 hover:shadow disabled:opacity-30 transition-all"><Undo2 size={18}/></button>
                          <div className="w-px h-4 bg-gray-300"></div>
                          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 rounded-md text-gray-600 hover:bg-white hover:text-vingi-600 hover:shadow disabled:opacity-30 transition-all"><Redo2 size={18}/></button>
                      </div>

                      <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-vingi-900 text-white rounded-lg text-xs font-bold shadow-md hover:bg-vingi-800 shrink-0"><Download size={16}/> Exportar</button>
                  </div>

                  {/* ROW 2: ADJUSTMENTS (FLIP, ROTATE, SCALE, MODE) */}
                  <div className={`grid grid-cols-2 md:grid-cols-5 gap-3 p-3 items-center bg-gray-50/50`}>
                      {/* MODE TOGGLE */}
                      <button 
                        onClick={() => setEditAll(!editAll)} 
                        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all border w-full ${editAll ? 'bg-purple-100 text-purple-700 border-purple-300 shadow-sm' : 'bg-white text-gray-500 border-gray-200'}`}
                        title={editAll ? "Aplicar em todos os moldes" : "Aplicar somente no selecionado"}
                      >
                        {editAll ? <Layers size={14}/> : <CopyCheck size={14}/>}
                        {editAll ? 'EDITAR TODOS' : 'EDITAR ÚNICO'}
                      </button>

                      <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1"><Settings2 size={10}/> Rotação ({activeRotation}°)</label>
                          <input type="range" min="0" max="360" value={activeRotation} onChange={(e) => handleRotate(parseInt(e.target.value))} onMouseUp={(e) => handleRotate(parseInt((e.target as HTMLInputElement).value), true)} className={`w-full h-1.5 rounded-lg appearance-none ${editAll ? 'bg-purple-200 accent-purple-600' : 'bg-gray-200 accent-vingi-600'}`}/>
                      </div>
                      <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold text-gray-400 uppercase flex items-center gap-1"><Settings2 size={10}/> Escala ({Math.round(activeScale * 100)}%)</label>
                          <input type="range" min="0.1" max="3" step="0.1" value={activeScale} onChange={(e) => handleScale(parseFloat(e.target.value))} onMouseUp={(e) => handleScale(parseFloat((e.target as HTMLInputElement).value), true)} className={`w-full h-1.5 rounded-lg appearance-none ${editAll ? 'bg-purple-200 accent-purple-600' : 'bg-gray-200 accent-vingi-600'}`}/>
                      </div>
                      
                      <div className="flex gap-2">
                          <button onClick={handleFlipX} className={`flex-1 py-2 border rounded-lg flex items-center justify-center ${activeFlipX ? 'bg-vingi-200 border-vingi-300 text-vingi-800' : 'bg-white border-gray-300 text-gray-600'}`} title="Espelhar Horizontal"><FlipHorizontal size={16}/></button>
                          <button onClick={handleFlipY} className={`flex-1 py-2 border rounded-lg flex items-center justify-center ${activeFlipY ? 'bg-vingi-200 border-vingi-300 text-vingi-800' : 'bg-white border-gray-300 text-gray-600'}`} title="Espelhar Vertical"><FlipVertical size={16}/></button>
                      </div>
                      
                      <div className="flex gap-2">
                          <button onClick={() => { setActiveScale(0.5); setActiveRotation(0); setActiveFlipX(false); setActiveFlipY(false); updateTargetLayers(l => ({ scale: 0.5, rotation: 0, offsetX: 0, offsetY: 0, flipX: false, flipY: false }), true); }} className="flex-1 py-2 border border-gray-300 bg-white rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 flex items-center justify-center gap-1"><RefreshCcw size={14}/> Reset</button>
                          <button onClick={() => { const newL = layers.filter(x => x.id !== activeLayerId); saveToHistory(newL); setActiveLayerId(null); }} disabled={!activeLayerId} className="flex-1 py-2 bg-red-50 text-red-500 border border-red-100 rounded-lg text-xs font-bold hover:bg-red-100 flex items-center justify-center gap-1 disabled:opacity-50"><Eraser size={14}/> Del</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
