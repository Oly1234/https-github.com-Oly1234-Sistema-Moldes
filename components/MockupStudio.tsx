
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, Wand2, Download, Eraser, CheckCircle2, Shirt, Zap, Move, Lock, Unlock, FlipHorizontal, FlipVertical, Sparkles, Maximize, Ruler, PenTool, RotateCcw, RefreshCcw } from 'lucide-react';
import { ModuleHeader, ModuleLandingPage } from './Shared';

// --- TYPES OTIMIZADOS ---
interface AppliedLayer {
  id: string;
  maskCanvas: HTMLCanvasElement; // Canvas recortado (apenas o tamanho da peça)
  maskX: number; // Posição X da máscara no canvas principal
  maskY: number; // Posição Y da máscara no canvas principal
  maskW: number; // Largura da máscara
  maskH: number; // Altura da máscara
  maskCenter: { x: number, y: number }; // Pivô de rotação (Centro da Bounding Box)
  pattern: CanvasPattern | null; // Padrão cacheado (Performance Extrema)
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  flipX: boolean; 
  flipY: boolean; 
  timestamp?: number;
}

export const MockupStudio: React.FC = () => {
  // State
  const [moldImage, setMoldImage] = useState<string | null>(null);
  const [moldImgObj, setMoldImgObj] = useState<HTMLImageElement | null>(null);
  const [patternImage, setPatternImage] = useState<string | null>(null);
  const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);

  const [layers, setLayers] = useState<AppliedLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [tool, setTool] = useState<'WAND' | 'MOVE'>('WAND');
  const [tolerance, setTolerance] = useState(40); 
  
  // Controls
  const [activeScale, setActiveScale] = useState(0.5);
  const [activeRotation, setActiveRotation] = useState(0);
  const [activeFlipX, setActiveFlipX] = useState(false);
  const [activeFlipY, setActiveFlipY] = useState(false);

  // Viewport
  const [viewTransform, setViewTransform] = useState({ k: 1, x: 0, y: 0 });

  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const moldInputRef = useRef<HTMLInputElement>(null);
  const patternInputRef = useRef<HTMLInputElement>(null);
  
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // --- TRANSFER LISTENER ---
  useEffect(() => {
    const checkStorage = () => {
        const stored = localStorage.getItem('vingi_mockup_pattern');
        if (stored) {
            setPatternImage(stored);
            localStorage.removeItem('vingi_mockup_pattern');
        }
    };
    checkStorage();
    const handleTransfer = (e: any) => {
        if (e.detail?.module === 'MOCKUP') checkStorage();
    };
    window.addEventListener('vingi_transfer', handleTransfer);
    return () => window.removeEventListener('vingi_transfer', handleTransfer);
  }, []);

  // --- INIT MOLD ---
  useEffect(() => {
    if (moldImage) {
      const img = new Image();
      img.src = moldImage;
      img.onload = () => {
        if (mainCanvasRef.current) {
            const canvas = mainCanvasRef.current;
            const MAX_DIM = 2500; 
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > MAX_DIM || h > MAX_DIM) {
                const ratio = w / h;
                if (w > h) { w = MAX_DIM; h = MAX_DIM / ratio; } 
                else { h = MAX_DIM; w = MAX_DIM * ratio; }
            }
            canvas.width = w; canvas.height = h;
            
            if (!tempCanvasRef.current) {
                tempCanvasRef.current = document.createElement('canvas');
            }
            tempCanvasRef.current.width = w;
            tempCanvasRef.current.height = h;

            setViewTransform({ k: 1, x: 0, y: 0 });
        }
        setMoldImgObj(img);
        setLayers([]);
        setActiveLayerId(null);
      };
    }
  }, [moldImage]);

  useEffect(() => {
    if (patternImage) { const img = new Image(); img.src = patternImage; img.onload = () => setPatternImgObj(img); }
  }, [patternImage]);

  // --- SYNC UI WITH ACTIVE LAYER ---
  useEffect(() => {
      if (activeLayerId) {
          const layer = layers.find(l => l.id === activeLayerId);
          if (layer) {
              setActiveScale(layer.scale);
              setActiveRotation(layer.rotation);
              setActiveFlipX(layer.flipX);
              setActiveFlipY(layer.flipY);
          }
      }
  }, [activeLayerId, layers]);

  // --- HELPERS DE INTERAÇÃO SEGURA ---
  const updateActiveLayer = (updater: (l: AppliedLayer) => Partial<AppliedLayer>) => {
      if (!activeLayerId) return;
      setLayers(prev => prev.map(l => {
          if (l.id === activeLayerId) return { ...l, ...updater(l) };
          return l;
      }));
  };

  const handleFlipX = () => updateActiveLayer(l => ({ flipX: !l.flipX, offsetX: -l.offsetX })); // Inverte offset para manter posição visual
  const handleFlipY = () => updateActiveLayer(l => ({ flipY: !l.flipY, offsetY: -l.offsetY }));
  const handleRotate = (val: number) => updateActiveLayer(l => ({ rotation: val }));
  const handleScale = (val: number) => updateActiveLayer(l => ({ scale: val }));
  const resetActiveLayer = () => updateActiveLayer(l => ({ scale: 0.5, rotation: 0, offsetX: 0, offsetY: 0, flipX: false, flipY: false }));

  // --- RENDER ENGINE (OPTIMIZED 2.0) ---
  const render = useCallback(() => {
    const canvas = mainCanvasRef.current;
    const tempCanvas = tempCanvasRef.current;
    if (!canvas || !moldImgObj || !tempCanvas) return;

    const ctx = canvas.getContext('2d', { alpha: false })!;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!;

    // 1. Draw Base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);

    // 2. Draw Layers
    layers.forEach(layer => {
        // Limpa apenas a área necessária no tempCanvas (Otimização)
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Desenha a máscara recortada na posição correta
        tempCtx.drawImage(layer.maskCanvas, layer.maskX, layer.maskY);
        
        // Composição: Source-In
        tempCtx.globalCompositeOperation = 'source-in';
        
        tempCtx.save();
        // Move para o centro da máscara (Pivô)
        tempCtx.translate(layer.maskCenter.x, layer.maskCenter.y);
        
        // Aplica Transformações
        tempCtx.rotate((layer.rotation * Math.PI) / 180);
        tempCtx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
        tempCtx.scale(layer.scale, layer.scale);
        
        // Aplica Offset da estampa
        tempCtx.translate(layer.offsetX, layer.offsetY);
        
        // Pattern Fill Cacheado
        if (layer.pattern) { 
            tempCtx.fillStyle = layer.pattern; 
            // Otimização: Desenha apenas o necessário para cobrir a máscara rotacionada
            // Calcula diagonal da bounding box da máscara
            const diag = Math.sqrt(layer.maskW**2 + layer.maskH**2);
            // Multiplicador de segurança para rotação
            const safeSize = (diag * 1.5) / layer.scale; 
            tempCtx.fillRect(-safeSize, -safeSize, safeSize*2, safeSize*2); 
        }
        tempCtx.restore();
        
        // Compõe no Principal
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();

        // 3. Selection Indicator
        if (layer.id === activeLayerId) {
            ctx.save();
            ctx.globalAlpha = 1; 
            ctx.globalCompositeOperation = 'source-over';
            ctx.beginPath();
            ctx.arc(layer.maskCenter.x, layer.maskCenter.y, 8 / viewTransform.k, 0, Math.PI * 2);
            ctx.fillStyle = '#3b82f6'; 
            ctx.strokeStyle = 'white'; 
            ctx.lineWidth = 2 / viewTransform.k;
            ctx.shadowBlur = 4;
            ctx.fill(); ctx.stroke();
            // Bounding box hint (opcional, ajuda a ver o que está selecionado)
            ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(layer.maskX, layer.maskY, layer.maskW, layer.maskH);
            ctx.restore();
        }
    });

    // 4. Multiply Base Shadows (Realism)
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);
    ctx.restore();

  }, [moldImgObj, layers, activeLayerId, viewTransform.k]);

  useEffect(() => {
      requestAnimationFrame(render);
  }, [render]);

  // --- INTERACTION LOGIC (SMART MASKING) ---
  const createMaskFromClick = (startX: number, startY: number) => {
      if (!mainCanvasRef.current || !moldImgObj) return null;
      const canvas = mainCanvasRef.current;
      const width = canvas.width; const height = canvas.height;
      
      const tempCanvas = document.createElement('canvas'); 
      tempCanvas.width = width; tempCanvas.height = height;
      const tCtx = tempCanvas.getContext('2d')!; tCtx.drawImage(moldImgObj, 0, 0, width, height);
      
      const data = tCtx.getImageData(0, 0, width, height).data;
      const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
      
      if (data[startPos] < 30 && data[startPos+1] < 30 && data[startPos+2] < 30) return null;

      const visited = new Uint8Array(width * height);
      const stack = [[Math.floor(startX), Math.floor(startY)]];
      const tol = tolerance;
      
      // Bounding Box Tracking
      let minX = width, maxX = 0, minY = height, maxY = 0;
      let pixelCount = 0;
      const r0 = data[startPos], g0 = data[startPos+1], b0 = data[startPos+2];
      
      // Armazena pixels válidos para desenhar depois no canvas recortado
      const validPixels: number[] = []; // Indices

      while (stack.length) {
          const [x, y] = stack.pop()!;
          const idx = y * width + x;
          if (visited[idx]) continue;
          
          visited[idx] = 1;
          const pPos = idx * 4;
          
          const diff = Math.abs(data[pPos] - r0) + Math.abs(data[pPos+1] - g0) + Math.abs(data[pPos+2] - b0);
          
          if (diff <= tol * 3) {
              validPixels.push(idx);
              pixelCount++;
              
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;

              if (x > 0) stack.push([x-1, y]);
              if (x < width - 1) stack.push([x+1, y]);
              if (y > 0) stack.push([x, y-1]);
              if (y < height - 1) stack.push([x, y+1]);
          }
      }
      
      if (pixelCount < 50) return null;

      // CRIAR MÁSCARA RECORTADA (CROPPED)
      const maskW = maxX - minX + 1;
      const maskH = maxY - minY + 1;
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = maskW;
      maskCanvas.height = maskH;
      const mCtx = maskCanvas.getContext('2d')!;
      const mImgData = mCtx.createImageData(maskW, maskH);
      const mData = mImgData.data;

      // Preenche apenas os pixels relativos ao crop
      for (const globalIdx of validPixels) {
          const gx = globalIdx % width;
          const gy = Math.floor(globalIdx / width);
          const lx = gx - minX;
          const ly = gy - minY;
          const localIdx = (ly * maskW + lx) * 4;
          mData[localIdx] = 255; mData[localIdx+1] = 255; mData[localIdx+2] = 255; mData[localIdx+3] = 255;
      }
      mCtx.putImageData(mImgData, 0, 0);
      
      return { 
          maskCanvas, 
          minX, minY, maskW, maskH,
          centerX: minX + maskW / 2, 
          centerY: minY + maskH / 2 
      };
  };

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
      if ('touches' in e) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
      return { x: (e as React.MouseEvent).clientX, y: (e as React.MouseEvent).clientY };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
      if (!moldImgObj || !patternImgObj) return;
      const { x: clientX, y: clientY } = getCoords(e);
      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const displayWidth = rect.width;
      const displayHeight = rect.height;
      const x = (clientX - rect.left) * (canvas.width / displayWidth);
      const y = (clientY - rect.top) * (canvas.height / displayHeight);

      if (tool === 'WAND') {
          const res = createMaskFromClick(x, y);
          if (res) {
              // Cache pattern once
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
                  scale: 0.5, rotation: 0, flipX: false, flipY: false, 
                  timestamp: Date.now()
              };
              setLayers(prev => [...prev, newLayer]);
              setActiveLayerId(newLayer.id);
              setTool('MOVE');
          }
      } else if (tool === 'MOVE') {
          let clickedId = null;
          // Check collision with bounding boxes first (fast)
          for (let i = layers.length - 1; i >= 0; i--) {
              const l = layers[i];
              if (x >= l.maskX && x <= l.maskX + l.maskW && y >= l.maskY && y <= l.maskY + l.maskH) {
                  // Precise check: check mask pixel alpha
                  const localX = Math.floor(x - l.maskX);
                  const localY = Math.floor(y - l.maskY);
                  const ctx = l.maskCanvas.getContext('2d')!;
                  if (ctx.getImageData(localX, localY, 1, 1).data[3] > 0) {
                      clickedId = l.id;
                      break;
                  }
              }
          }
          if (clickedId) {
              setActiveLayerId(clickedId);
              isDragging.current = true;
              lastPos.current = { x: clientX, y: clientY };
          } else {
              setActiveLayerId(null);
          }
      }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDragging.current || !activeLayerId || tool !== 'MOVE') return;
      if (e.cancelable && e.nativeEvent) e.preventDefault();
      
      const { x: clientX, y: clientY } = getCoords(e);
      const canvas = mainCanvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const scaleFactorX = canvas.width / rect.width;
      const scaleFactorY = canvas.height / rect.height;
      
      const dxCanvas = (clientX - lastPos.current.x) * scaleFactorX;
      const dyCanvas = (clientY - lastPos.current.y) * scaleFactorY;
      
      updateActiveLayer(layer => {
          const angleRad = (layer.rotation * Math.PI) / 180;
          let dxLocal = dxCanvas * Math.cos(angleRad) + dyCanvas * Math.sin(angleRad);
          let dyLocal = -dxCanvas * Math.sin(angleRad) + dyCanvas * Math.cos(angleRad);
          
          if (layer.flipX) dxLocal = -dxLocal;
          if (layer.flipY) dyLocal = -dyLocal; 
          
          dxLocal /= layer.scale;
          dyLocal /= layer.scale;

          return { offsetX: layer.offsetX + dxLocal, offsetY: layer.offsetY + dyLocal };
      });
      
      lastPos.current = { x: clientX, y: clientY };
  };

  const handleDownload = () => {
    if (!mainCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'vingi-mockup.png';
    link.href = mainCanvasRef.current.toDataURL('image/png', 1.0);
    link.click();
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#f0f2f5] overflow-hidden">
      <ModuleHeader 
          icon={Shirt} 
          title="Aplicação em Corte" 
          subtitle="Engenharia Técnica 2D"
          actionLabel={moldImage ? "Novo Projeto" : undefined}
          onAction={() => { setMoldImage(null); setLayers([]); }}
      />

      {!moldImage ? (
          <div className="flex-1 overflow-y-auto">
              <input type="file" ref={moldInputRef} onChange={(e) => {
                  const file = e.target.files?.[0];
                  if(file) { const r = new FileReader(); r.onload = (ev) => setMoldImage(ev.target?.result as string); r.readAsDataURL(file); }
              }} className="hidden" accept="image/*" />
              <ModuleLandingPage 
                  icon={Shirt}
                  title="Mockup Técnico"
                  description="Ferramenta de engenharia para aplicação de estampas em moldes de corte. Simule o encaixe, rotacione o fio e visualize o consumo real."
                  primaryActionLabel="Carregar Molde/Peça"
                  onPrimaryAction={() => moldInputRef.current?.click()}
                  features={["Preenchimento Inteligente", "Controle de Fio", "Escala Real", "Espelhamento"]}
              />
          </div>
      ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              <div className="flex-1 bg-gray-100 relative flex items-center justify-center overflow-hidden touch-none cursor-crosshair">
                  <div className="absolute inset-0 opacity-10 bg-[linear-gradient(#94a3b8_1px,transparent_1px),linear-gradient(90deg,#94a3b8_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                  <canvas 
                      ref={mainCanvasRef}
                      onMouseDown={handlePointerDown}
                      onMouseMove={handlePointerMove}
                      onMouseUp={() => { isDragging.current = false; }}
                      onTouchStart={handlePointerDown}
                      onTouchMove={handlePointerMove}
                      onTouchEnd={() => { isDragging.current = false; }}
                      className="max-w-full max-h-[85vh] object-contain shadow-2xl bg-white"
                  />
                  {!patternImage && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center backdrop-blur-sm">
                          <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm">
                              <h3 className="text-xl font-bold mb-4">Selecione a Estampa</h3>
                              <button onClick={() => patternInputRef.current?.click()} className="w-full py-3 bg-vingi-900 text-white rounded-xl font-bold shadow-lg hover:bg-vingi-800 flex items-center justify-center gap-2">
                                  <UploadCloud size={20}/> Carregar Arquivo
                              </button>
                              <input type="file" ref={patternInputRef} onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if(file) { const r = new FileReader(); r.onload = (ev) => setPatternImage(ev.target?.result as string); r.readAsDataURL(file); }
                              }} className="hidden" accept="image/*" />
                          </div>
                      </div>
                  )}
              </div>

              {/* CONTROLS SIDEBAR */}
              <div className="w-full md:w-80 bg-white border-l border-gray-200 shadow-xl flex flex-col z-20 h-64 md:h-full overflow-y-auto">
                  <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center sticky top-0 z-10">
                      <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Ferramentas</h3>
                      <div className="flex bg-white rounded-lg p-1 border shadow-sm">
                          <button onClick={() => setTool('WAND')} className={`p-2 rounded ${tool === 'WAND' ? 'bg-vingi-100 text-vingi-600' : 'text-gray-400'}`}><Wand2 size={18}/></button>
                          <button onClick={() => setTool('MOVE')} className={`p-2 rounded ${tool === 'MOVE' ? 'bg-vingi-100 text-vingi-600' : 'text-gray-400'}`}><Move size={18}/></button>
                      </div>
                  </div>

                  <div className="p-6 space-y-6">
                      {activeLayerId ? (
                          <div className="space-y-6 animate-fade-in">
                              <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-vingi-600 bg-vingi-50 px-2 py-1 rounded">Camada Ativa</span>
                                  <button onClick={resetActiveLayer} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"><RefreshCcw size={12}/> Resetar</button>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                  <button onClick={handleFlipX} className={`py-3 border rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${activeFlipX ? 'bg-vingi-900 text-white border-vingi-900' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                      <FlipHorizontal size={20}/> <span className="text-[10px] font-bold">ESPELHAR H</span>
                                  </button>
                                  <button onClick={handleFlipY} className={`py-3 border rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${activeFlipY ? 'bg-vingi-900 text-white border-vingi-900' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                      <FlipVertical size={20}/> <span className="text-[10px] font-bold">ESPELHAR V</span>
                                  </button>
                              </div>

                              <div>
                                  <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase mb-1">
                                      <span>Rotação (Fio)</span>
                                      <span>{activeRotation}°</span>
                                  </div>
                                  <input type="range" min="0" max="360" value={activeRotation} onChange={(e) => handleRotate(parseInt(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none accent-vingi-600"/>
                              </div>

                              <div>
                                  <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase mb-1">
                                      <span>Escala (Rapport)</span>
                                      <span>{Math.round(activeScale * 100)}%</span>
                                  </div>
                                  <input type="range" min="0.1" max="2" step="0.05" value={activeScale} onChange={(e) => handleScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none accent-vingi-600"/>
                              </div>
                              
                              <button onClick={() => {
                                  setLayers(l => l.filter(x => x.id !== activeLayerId));
                                  setActiveLayerId(null);
                              }} className="w-full py-3 border border-red-200 text-red-500 rounded-xl font-bold text-xs hover:bg-red-50 flex items-center justify-center gap-2 mt-4">
                                  <Eraser size={14}/> REMOVER SELEÇÃO
                              </button>
                          </div>
                      ) : (
                          <div className="text-center py-10 text-gray-400">
                              <Move size={32} className="mx-auto mb-2 opacity-20"/>
                              <p className="text-xs">Selecione uma área da peça para editar.</p>
                          </div>
                      )}

                      <div className="pt-6 border-t border-gray-100">
                          <button onClick={handleDownload} className="w-full py-4 bg-gray-800 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-gray-900 flex items-center justify-center gap-2">
                              <Download size={16}/> EXPORTAR IMAGEM
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
