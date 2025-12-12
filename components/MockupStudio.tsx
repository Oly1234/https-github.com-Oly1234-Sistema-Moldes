
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { UploadCloud, Image as ImageIcon, Eraser, Download, Wand2, Layers, Zap, Lock, Unlock, ArrowRight, Sparkles, FlipHorizontal, FlipVertical, MonitorPlay, X, Target, Search, Wind, BoxSelect, Cylinder, Brush, Circle, Check, Move, MousePointer2, RotateCw, ZoomIn, Maximize, Loader2, Trash2, Shirt, Scissors, ScanFace, Sliders, Palette } from 'lucide-react';

// --- TYPES ---
interface AppliedLayer {
  id: string;
  maskCanvas: HTMLCanvasElement;
  maskCenter: { x: number, y: number }; 
  patternImg: HTMLImageElement;
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  skewX: number;
  skewY: number;
}

interface SimulationMapping {
    id: string;
    layerId: string | null; 
    directPattern?: HTMLImageElement | null; 
    maskCanvas: HTMLCanvasElement; // O Canvas que guarda a área branca pintada
    targetX: number;
    targetY: number;
    distortion: {
        curve: number;
        flow: number;
        pinch: number;
    }
}

// --- ALGORITMOS DE PROCESSAMENTO DE IMAGEM ---

// 1. Flood Fill (Varinha Mágica)
const floodFill = (ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number, tol: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const maskData = new Uint8ClampedArray(width * height * 4);
    
    const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    const r0 = data[startPos]; const g0 = data[startPos + 1]; const b0 = data[startPos + 2];
    
    if (data[startPos + 3] === 0) return null;

    const stack = [[Math.floor(startX), Math.floor(startY)]];
    const visited = new Uint8Array(width * height);
    
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let pixelCount = 0;

    while (stack.length) {
        const [x, y] = stack.pop()!;
        let py = y; 
        let pPos = (py * width + x) * 4;

        while (py >= 0 && visited[py*width+x]===0) {
            const dr = Math.abs(data[pPos] - r0); const dg = Math.abs(data[pPos+1] - g0); const db = Math.abs(data[pPos+2] - b0);
            if (dr > tol || dg > tol || db > tol) break;
            py--; pPos -= width*4;
        }
        pPos += width*4; py++;

        let reachL = false, reachR = false;
        
        while (py < height && visited[py*width+x]===0) {
            const dr = Math.abs(data[pPos] - r0); const dg = Math.abs(data[pPos+1] - g0); const db = Math.abs(data[pPos+2] - b0);
            if (dr > tol || dg > tol || db > tol) break;
            
            maskData[pPos] = 255; maskData[pPos+1] = 255; maskData[pPos+2] = 255; maskData[pPos+3] = 255;
            visited[py*width+x] = 1; 
            pixelCount++;

            if (x < minX) minX = x; if (x > maxX) maxX = x; if (py < minY) minY = py; if (py > maxY) maxY = py;

            if (x > 0) {
                const pLeft = pPos - 4; 
                const matchL = Math.abs(data[pLeft]-r0)<=tol && Math.abs(data[pLeft+1]-g0)<=tol && Math.abs(data[pLeft+2]-b0)<=tol;
                if (matchL && visited[py*width+(x-1)]===0) { if (!reachL) { stack.push([x-1, py]); reachL = true; } } else if (reachL) reachL = false;
            }
            if (x < width-1) {
                const pRight = pPos + 4; 
                const matchR = Math.abs(data[pRight]-r0)<=tol && Math.abs(data[pRight+1]-g0)<=tol && Math.abs(data[pRight+2]-b0)<=tol;
                if (matchR && visited[py*width+(x+1)]===0) { if (!reachR) { stack.push([x+1, py]); reachR = true; } } else if (reachR) reachR = false;
            }
            py++; pPos += width*4;
        }
    }
    
    if (pixelCount < 50) return null;

    // --- SMART FILL: FECHAMENTO DE BURACOS (PATTERN FIX) ---
    // Isso resolve o problema do "vestido floral" onde a varinha deixa buracos
    // Executa uma passagem simples de "Dilatação" para conectar áreas próximas
    const refinedMaskData = new Uint8ClampedArray(maskData);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = (y * width + x) * 4;
            // Se o pixel atual é transparente
            if (maskData[i + 3] === 0) {
                // Conta vizinhos preenchidos
                let neighbors = 0;
                if (maskData[((y-1)*width+x)*4+3] > 0) neighbors++;
                if (maskData[((y+1)*width+x)*4+3] > 0) neighbors++;
                if (maskData[(y*width+(x-1))*4+3] > 0) neighbors++;
                if (maskData[(y*width+(x+1))*4+3] > 0) neighbors++;
                
                // Se estiver cercado por 3 ou mais pixels selecionados, preenche (é um ruído/estampa)
                if (neighbors >= 3) {
                    refinedMaskData[i] = 255; refinedMaskData[i+1] = 255; refinedMaskData[i+2] = 255; refinedMaskData[i+3] = 255;
                }
            }
        }
    }

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width; maskCanvas.height = height;
    maskCanvas.getContext('2d')!.putImageData(new ImageData(refinedMaskData, width, height), 0, 0);
    
    return { 
        maskCanvas, 
        minX, maxX, minY, maxY, 
        centerX: minX + (maxX-minX)/2, 
        centerY: minY + (maxY-minY)/2,
        pixelCount
    };
};

// --- COMIC BUBBLE COMPONENT ---
const ComicBubble: React.FC<{ text: string, type: 'INFO' | 'ACTION' | 'SUCCESS', style?: React.CSSProperties, position?: 'top' | 'bottom' | 'left' | 'right' }> = ({ text, type, style, position = 'top' }) => {
    const colors = {
        INFO: 'bg-white text-gray-900 border-gray-900',
        ACTION: 'bg-vingi-600 text-white border-white',
        SUCCESS: 'bg-green-500 text-white border-white'
    };
    const arrowClasses = {
        top: 'bottom-[-12px] left-1/2 -translate-x-1/2 border-t-[12px] border-l-[10px] border-r-[10px] border-l-transparent border-r-transparent',
        bottom: 'top-[-12px] left-1/2 -translate-x-1/2 border-b-[12px] border-l-[10px] border-r-[10px] border-l-transparent border-r-transparent',
        left: 'right-[-12px] top-1/2 -translate-y-1/2 border-l-[12px] border-t-[10px] border-b-[10px] border-t-transparent border-b-transparent',
        right: 'left-[-12px] top-1/2 -translate-y-1/2 border-r-[12px] border-t-[10px] border-b-[10px] border-t-transparent border-b-transparent'
    };
    const arrowStyle = position === 'top' ? { borderTopColor: type === 'INFO' ? '#111827' : '#ffffff' } :
                       position === 'bottom' ? { borderBottomColor: type === 'INFO' ? '#111827' : '#ffffff' } :
                       position === 'left' ? { borderLeftColor: type === 'INFO' ? '#111827' : '#ffffff' } :
                       { borderRightColor: type === 'INFO' ? '#111827' : '#ffffff' };

    return (
        <div className={`absolute z-[999] px-5 py-3 rounded-2xl border-4 shadow-[4px_4px_0px_rgba(0,0,0,0.3)] animate-bounce-subtle pointer-events-none font-bold text-xs md:text-sm uppercase tracking-wide leading-tight text-center max-w-[200px] ${colors[type]}`} style={style}>
            {text}
            <div className={`absolute w-0 h-0 ${arrowClasses[position]}`} style={arrowStyle} />
        </div>
    );
};

export const MockupStudio: React.FC = () => {
  // --- STUDIO MODE ---
  const [studioMode, setStudioMode] = useState<'TECHNICAL' | 'MOCKUP'>('TECHNICAL');

  // --- ASSETS ---
  const [moldImage, setMoldImage] = useState<string | null>(null);
  const [moldImgObj, setMoldImgObj] = useState<HTMLImageElement | null>(null);
  const [patternImage, setPatternImage] = useState<string | null>(null);
  const [patternImgObj, setPatternImgObj] = useState<HTMLImageElement | null>(null);

  // --- ENGINE ---
  const [layers, setLayers] = useState<AppliedLayer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);

  // --- TOOLS ---
  const [tool, setTool] = useState<'WAND' | 'MOVE'>('WAND');
  const [tolerance, setTolerance] = useState(40); 
  const [globalScale, setGlobalScale] = useState(0.5); 
  const [globalRotation, setGlobalRotation] = useState(0);
  const [syncSettings, setSyncSettings] = useState(true); 
  const [realismOpacity, setRealismOpacity] = useState(0.95); 

  const [isProcessing, setIsProcessing] = useState(false);

  // --- LIVE RUNWAY STATE ---
  const [showSimModal, setShowSimModal] = useState(false);
  const [simImage, setSimImage] = useState<string | null>(null);
  const [simImgObj, setSimImgObj] = useState<HTMLImageElement | null>(null);
  const [simMappings, setSimMappings] = useState<SimulationMapping[]>([]);
  const [simSensitivity, setSimSensitivity] = useState(50); // Sensibilidade ajustada
  
  // LIVE RUNWAY PROCESSING STATE
  const [isSimProcessing, setIsSimProcessing] = useState(false);
  const [simProcessStep, setSimProcessStep] = useState(0);
  
  // Workflow
  const [simWorkflow, setSimWorkflow] = useState<'IDLE' | 'PAINTING_MASK' | 'PICKING_MOLD_PIECE' | 'DETECTING_GARMENT'>('IDLE');
  const [currentSimMappingId, setCurrentSimMappingId] = useState<string | null>(null);
  const [simModalPos, setSimModalPos] = useState({ x: 50, y: 80 });
  
  // Simulation Tools
  const [simTool, setSimTool] = useState<'WAND' | 'BRUSH' | 'MOVE'>('WAND'); 
  const [simBrushSize, setSimBrushSize] = useState(30);
  const [isSimInteracting, setIsSimInteracting] = useState(false);

  // --- REFS ---
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const simCanvasRef = useRef<HTMLCanvasElement>(null);
  const moldInputRef = useRef<HTMLInputElement>(null);
  const patternInputRef = useRef<HTMLInputElement>(null);
  const simInputRef = useRef<HTMLInputElement>(null);
  
  const isDragging = useRef(false);
  const isDraggingModal = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // --- INITIALIZATION ---
  useEffect(() => {
    if (moldImage) {
      const img = new Image(); img.src = moldImage;
      img.onload = () => {
        if (mainCanvasRef.current) { mainCanvasRef.current.width = img.naturalWidth; mainCanvasRef.current.height = img.naturalHeight; }
        setMoldImgObj(img); setLayers([]);
      };
    }
  }, [moldImage]);

  useEffect(() => {
    if (patternImage) { const img = new Image(); img.src = patternImage; img.onload = () => setPatternImgObj(img); }
  }, [patternImage]);

  // Handle Sim Image Upload
  useEffect(() => {
      if (simImage) {
          setIsSimProcessing(true);
          setSimProcessStep(0);
          setShowSimModal(true);

          const img = new Image(); 
          img.src = simImage;
          img.onload = () => { 
              setSimImgObj(img); 
              setSimMappings([]); 
              
              // Fake processing steps for UX
              setTimeout(() => setSimProcessStep(1), 500);
              setTimeout(() => {
                  setIsSimProcessing(false);
                  if (!moldImage) setStudioMode('MOCKUP');
              }, 1200);
          }
      }
  }, [simImage]);

  // Sync Global Settings
  useEffect(() => {
    if (syncSettings && layers.length > 0) {
        setLayers(prev => prev.map(layer => ({ ...layer, scale: globalScale, rotation: globalRotation })));
    }
  }, [globalScale, globalRotation, syncSettings, studioMode]);

  useEffect(() => {
      const l = layers.find(l => l.id === activeLayerId);
      if (!syncSettings && l) { setGlobalScale(l.scale); setGlobalRotation(l.rotation); }
  }, [activeLayerId, syncSettings]);

  const updateActiveLayer = (updates: Partial<AppliedLayer>) => {
      if (!activeLayerId) return;
      setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, ...updates } : l));
  };
  
  const deleteActiveLayer = () => {
      if (!activeLayerId) return;
      setLayers(prev => prev.filter(l => l.id !== activeLayerId));
      setActiveLayerId(null);
  };

  // --- RENDER 1: MAIN CANVAS (2D MOLD) ---
  const render = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas || !moldImgObj) return;
    const ctx = canvas.getContext('2d')!;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);

    layers.forEach(layer => {
        const layerCanvas = document.createElement('canvas');
        layerCanvas.width = canvas.width; layerCanvas.height = canvas.height;
        const lCtx = layerCanvas.getContext('2d')!;

        lCtx.drawImage(layer.maskCanvas, 0, 0);
        lCtx.globalCompositeOperation = 'source-in';
        lCtx.save();
        lCtx.translate(layer.maskCenter.x, layer.maskCenter.y);
        lCtx.rotate((layer.rotation * Math.PI) / 180);
        lCtx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
        lCtx.transform(1, layer.skewY, layer.skewX, 1, 0, 0);
        lCtx.translate(-layer.maskCenter.x, -layer.maskCenter.y);
        lCtx.translate(layer.offsetX, layer.offsetY);
        lCtx.scale(layer.scale, layer.scale);
        
        const pat = lCtx.createPattern(layer.patternImg, 'repeat');
        if (pat) { lCtx.fillStyle = pat; lCtx.fillRect(-20000, -20000, 40000, 40000); }
        lCtx.restore();

        ctx.save(); ctx.globalAlpha = realismOpacity; ctx.drawImage(layerCanvas, 0, 0); ctx.restore();

        if (layer.id === activeLayerId) {
            ctx.save();
            ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3;
            ctx.strokeRect(layer.maskCenter.x - 20, layer.maskCenter.y - 20, 40, 40); 
            
            const mapping = simMappings.find(m => m.layerId === layer.id);
            if (mapping) {
                ctx.fillStyle = '#3b82f6';
                ctx.font = 'bold 12px sans-serif';
                ctx.fillText("SYNC", layer.maskCenter.x - 15, layer.maskCenter.y - 25);
            }
            ctx.restore();
        }
    });
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height); ctx.restore();
  }, [moldImgObj, layers, activeLayerId, realismOpacity, simMappings]);


  // --- RENDER 2: LIVE RUNWAY (2D LUMINANCE) ---
  const renderSimulation = useCallback(() => {
      const canvas = simCanvasRef.current;
      if (!canvas || !simImgObj) return;

      const ctx = canvas.getContext('2d')!;
      const modalWidth = 350;
      const ratio = simImgObj.naturalWidth / simImgObj.naturalHeight;
      const calculatedHeight = modalWidth / ratio;
      
      // Resize only if needed to avoid flicker
      if (canvas.width !== modalWidth || canvas.height !== calculatedHeight) { 
          canvas.width = modalWidth; canvas.height = calculatedHeight; 
      }

      // 1. Draw Original Photo (Base)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(simImgObj, 0, 0, canvas.width, canvas.height);

      // 2. Process Mappings (Luminance Extraction Loop)
      simMappings.forEach(mapping => {
          let patternToUse = mapping.directPattern;
          let scaleToUse = globalScale;
          let rotationToUse = globalRotation;

          if (mapping.layerId) {
             const layer = layers.find(l => l.id === mapping.layerId);
             if (layer) {
                 patternToUse = layer.patternImg;
                 scaleToUse = layer.scale;
                 rotationToUse = layer.rotation;
             }
          } else if (studioMode === 'MOCKUP' && patternImgObj) {
              patternToUse = patternImgObj;
          }

          // --- STEP A: LUMINANCE MAP (Shadow Extraction) ---
          const shadowCanvas = document.createElement('canvas');
          shadowCanvas.width = canvas.width; shadowCanvas.height = canvas.height;
          const sCtx = shadowCanvas.getContext('2d')!;
          
          // Use the stored MaskCanvas which contains Wand + Brush strokes
          sCtx.drawImage(mapping.maskCanvas, 0, 0, canvas.width, canvas.height);
          sCtx.globalCompositeOperation = 'source-in';
          sCtx.drawImage(simImgObj, 0, 0, canvas.width, canvas.height);
          
          const sData = sCtx.getImageData(0, 0, canvas.width, canvas.height).data;
          for(let i=0; i<sData.length; i+=4) {
             if (sData[i+3] === 0) continue;
             const luma = 0.299*sData[i] + 0.587*sData[i+1] + 0.114*sData[i+2];
             
             // High contrast curve for "White Dress" effect
             let val = luma;
             if (luma > 150) val = 255; 
             else val = luma + 40; 
             
             sData[i] = val; sData[i+1] = val; sData[i+2] = val;
          }
          sCtx.putImageData(new ImageData(sData, canvas.width, canvas.height), 0, 0);

          // --- STEP B: WHITE BASE ---
          const baseCanvas = document.createElement('canvas');
          baseCanvas.width = canvas.width; baseCanvas.height = canvas.height;
          const bCtx = baseCanvas.getContext('2d')!;
          
          bCtx.drawImage(mapping.maskCanvas, 0, 0, canvas.width, canvas.height);
          bCtx.globalCompositeOperation = 'source-in';
          bCtx.fillStyle = '#ffffff';
          bCtx.fillRect(0, 0, canvas.width, canvas.height);
          bCtx.globalCompositeOperation = 'multiply';
          bCtx.drawImage(shadowCanvas, 0, 0);

          // --- STEP C: PATTERN ---
          if (patternToUse) {
            const patCanvas = document.createElement('canvas');
            patCanvas.width = canvas.width; patCanvas.height = canvas.height;
            const pCtx = patCanvas.getContext('2d')!;
            
            pCtx.save();
            pCtx.translate(canvas.width/2, canvas.height/2);
            pCtx.rotate((rotationToUse * Math.PI) / 180);
            pCtx.scale(scaleToUse * 0.5, scaleToUse * 0.5); 
            const pat = pCtx.createPattern(patternToUse, 'repeat');
            if (pat) { pCtx.fillStyle = pat; pCtx.fillRect(-4000, -4000, 8000, 8000); }
            pCtx.restore();

            bCtx.globalCompositeOperation = 'multiply';
            bCtx.drawImage(patCanvas, 0, 0);
          }

          ctx.drawImage(baseCanvas, 0, 0);

          // Selection Outline
          if (studioMode === 'MOCKUP' || mapping.layerId === activeLayerId) {
             ctx.save();
             ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
             ctx.strokeRect(mapping.targetX - 10, mapping.targetY - 10, 20, 20);
             ctx.restore();
          }
      });
      
  }, [simImgObj, layers, simMappings, studioMode, patternImgObj, globalScale, globalRotation, activeLayerId, isSimProcessing]);

  useEffect(() => { requestAnimationFrame(render); }, [render]);
  useEffect(() => { if(showSimModal && !isSimProcessing) requestAnimationFrame(renderSimulation); }, [renderSimulation, showSimModal, isSimProcessing]);


  // --- HANDLERS ---
  
  // ... (handleCanvasClick e handleMove do modo Técnico mantidos iguais, omitidos para brevidade mas estão no contexto) ...
  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    // If waiting for user to pick a mold piece to link
    if (simWorkflow === 'PICKING_MOLD_PIECE') {
        const canvas = mainCanvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } 
        else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
        const x = (clientX - rect.left) * (canvas.width / rect.width);
        const y = (clientY - rect.top) * (canvas.height / rect.height);
        
        for (let i = layers.length - 1; i >= 0; i--) {
            const ctx = layers[i].maskCanvas.getContext('2d')!;
            if (ctx.getImageData(x, y, 1, 1).data[3] > 0) { 
                setSimMappings(prev => prev.map(m => m.id === currentSimMappingId ? { ...m, layerId: layers[i].id } : m));
                setActiveLayerId(layers[i].id);
                setSimWorkflow('IDLE'); 
                setCurrentSimMappingId(null);
                return;
            }
        }
        return;
    }

    if (!moldImgObj || !patternImgObj) return;
    const canvas = mainCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } 
    else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    if (tool === 'WAND') {
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0,0,canvas.width,canvas.height); 
        ctx.drawImage(moldImgObj, 0, 0, canvas.width, canvas.height);
        const res = floodFill(ctx, canvas.width, canvas.height, x, y, tolerance);
        render(); 

        if (res) {
            const centeredOffsetX = res.centerX - (patternImgObj.width * globalScale) / 2;
            const centeredOffsetY = res.centerY - (patternImgObj.height * globalScale) / 2;
            const newLayer: AppliedLayer = {
                id: Date.now().toString(),
                maskCanvas: res.maskCanvas,
                maskCenter: { x: res.centerX, y: res.centerY },
                patternImg: patternImgObj,
                offsetX: centeredOffsetX, offsetY: centeredOffsetY,
                scale: globalScale, rotation: globalRotation, 
                flipX: false, flipY: false, skewX: 0, skewY: 0
            };
            setLayers(prev => [...prev, newLayer]);
            setActiveLayerId(newLayer.id);
        }
    } else if (tool === 'MOVE') {
        let clickedId = null;
        for (let i = layers.length - 1; i >= 0; i--) {
            const ctx = layers[i].maskCanvas.getContext('2d')!;
            if (ctx.getImageData(x, y, 1, 1).data[3] > 0) { clickedId = layers[i].id; break; }
        }
        if (clickedId) {
            setActiveLayerId(clickedId);
            isDragging.current = true;
            lastPos.current = { x: clientX, y: clientY };
            const l = layers.find(lay => lay.id === clickedId);
            if (l && !syncSettings) {
                setGlobalScale(l.scale);
                setGlobalRotation(l.rotation);
            }
        } else { setActiveLayerId(null); }
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !activeLayerId || tool !== 'MOVE') return;
    e.preventDefault();
    let clientX, clientY;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; } 
    else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
    const canvas = mainCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const dxScreen = (clientX - lastPos.current.x) * (canvas.width / rect.width);
    const dyScreen = (clientY - lastPos.current.y) * (canvas.height / rect.height);
    const layer = layers.find(l => l.id === activeLayerId);
    if (layer) {
        const angleRad = (layer.rotation * Math.PI) / 180;
        let dxLocal = dxScreen * Math.cos(angleRad) + dyScreen * Math.sin(angleRad);
        let dyLocal = -dxScreen * Math.sin(angleRad) + dyScreen * Math.cos(angleRad);
        if (layer.flipX) dxLocal = -dxLocal;
        if (layer.flipY) dyLocal = -dyLocal;
        setLayers(prev => prev.map(l => l.id === activeLayerId ? { ...l, offsetX: l.offsetX + dxLocal, offsetY: l.offsetY + dyLocal } : l));
    }
    lastPos.current = { x: clientX, y: clientY };
  };

  // 2. LIVE RUNWAY HANDLERS (Paint/Wand)
  const handleSimInteractionStart = (e: React.MouseEvent | React.TouchEvent) => {
      setIsSimInteracting(true);
      handleSimInteractionMove(e); // Click is also a move
  };

  const handleSimInteractionMove = (e: React.MouseEvent | React.TouchEvent) => {
      if (!isSimInteracting && e.type !== 'click' && e.type !== 'mousedown' && e.type !== 'touchstart') return;
      if (!simImgObj || !simCanvasRef.current) return;

      const canvas = simCanvasRef.current;
      const rect = canvas.getBoundingClientRect();
      let clientX, clientY;
      if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
      else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }
      const x = (clientX - rect.left) * (canvas.width / rect.width);
      const y = (clientY - rect.top) * (canvas.height / rect.height);

      // --- WAND (CLICK ONLY) ---
      if (simTool === 'WAND' && (e.type === 'click' || e.type === 'touchstart')) {
         const ctx = canvas.getContext('2d')!;
         ctx.drawImage(simImgObj, 0, 0, canvas.width, canvas.height);
         const res = floodFill(ctx, canvas.width, canvas.height, x, y, simSensitivity);
         
         if (res) {
             const mappingId = Date.now().toString();
             const newMapping: SimulationMapping = {
                 id: mappingId,
                 layerId: null, 
                 directPattern: patternImgObj,
                 maskCanvas: res.maskCanvas,
                 targetX: res.centerX, targetY: res.centerY,
                 distortion: { curve: 0, flow: 0, pinch: 0 }
             };
             
             if (studioMode === 'TECHNICAL') {
                 setSimMappings(prev => [...prev, newMapping]);
                 setCurrentSimMappingId(mappingId);
                 setSimWorkflow('PICKING_MOLD_PIECE');
             } else {
                 setSimMappings(prev => [...prev, newMapping]);
             }
         }
      }

      // --- BRUSH (PAINT MASK MANUALLY) ---
      if (simTool === 'BRUSH' && isSimInteracting) {
          // If no mapping exists, create one empty container first
          if (simMappings.length === 0) {
              const mappingId = Date.now().toString();
              const tempC = document.createElement('canvas');
              tempC.width = canvas.width; tempC.height = canvas.height;
              const newMapping: SimulationMapping = {
                 id: mappingId, layerId: null, directPattern: patternImgObj, maskCanvas: tempC, targetX: x, targetY: y, distortion: { curve: 0, flow: 0, pinch: 0 }
              };
              setSimMappings([newMapping]);
              return; // Wait for next frame to paint
          }

          // Paint on the last active mapping's maskCanvas
          const activeMap = simMappings[simMappings.length - 1];
          const mCtx = activeMap.maskCanvas.getContext('2d')!;
          
          mCtx.beginPath();
          mCtx.arc(x, y, simBrushSize / 2, 0, Math.PI * 2);
          mCtx.fillStyle = 'rgba(255, 255, 255, 1)'; // Alpha doesn't matter for mask logic, just needs value > 0
          mCtx.fill();
          
          // Force re-render
          requestAnimationFrame(renderSimulation);
      }
  };

  const handleModalMouseDown = (e: React.MouseEvent) => { isDraggingModal.current = true; lastPos.current = { x: e.clientX, y: e.clientY }; };
  const handleModalMove = (e: React.MouseEvent) => { if(isDraggingModal.current) { const dx = e.clientX - lastPos.current.x; const dy = e.clientY - lastPos.current.y; setSimModalPos(p => ({ x: p.x + dx, y: p.y + dy })); lastPos.current = { x: e.clientX, y: e.clientY }; } };

  // --- AUTO DETECT (CENTER START) ---
  const handleAutoDetectGarment = () => {
      if (!simImgObj || !simCanvasRef.current) return;
      const canvas = simCanvasRef.current;
      const ctx = canvas.getContext('2d')!;
      const x = canvas.width / 2; const y = canvas.height / 2;
      ctx.drawImage(simImgObj, 0, 0, canvas.width, canvas.height);
      const res = floodFill(ctx, canvas.width, canvas.height, x, y, simSensitivity); // Use sensitivity
      if (res && res.pixelCount > (canvas.width * canvas.height * 0.1)) {
           const mappingId = Date.now().toString();
           const newMapping: SimulationMapping = {
               id: mappingId, layerId: null, directPattern: patternImgObj, maskCanvas: res.maskCanvas, targetX: res.centerX, targetY: res.centerY,
               distortion: { curve: 0, flow: 0, pinch: 0 }
           };
           setSimMappings([newMapping]); 
      }
  };

  const activeLayer = layers.find(l => l.id === activeLayerId);

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] md:flex-row overflow-hidden font-sans relative" onMouseMove={handleModalMove} onMouseUp={() => isDraggingModal.current = false}>
      
      {/* 1. SIDEBAR CONTROLS */}
      <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col shadow-2xl z-20 shrink-0 h-auto md:h-full overflow-y-auto">
          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-lg font-bold text-vingi-900 flex items-center gap-2">
                  <Wand2 className="text-vingi-600" size={20} /> Mockup Studio 
                  <span className="text-[10px] bg-vingi-900 text-white px-2 py-0.5 rounded-full font-mono">PRO</span>
              </h2>
          </div>

          <div className="p-4 bg-gray-100 border-b border-gray-200 flex p-1 gap-1">
              <button onClick={() => setStudioMode('TECHNICAL')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${studioMode === 'TECHNICAL' ? 'bg-white shadow text-vingi-900' : 'text-gray-500'}`}>
                  <Scissors size={14}/> TÉCNICO
              </button>
              <button onClick={() => setStudioMode('MOCKUP')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${studioMode === 'MOCKUP' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}>
                  <Shirt size={14}/> MOCKUP RÁPIDO
              </button>
          </div>
          
          <div className="p-5 space-y-6">
               {studioMode === 'TECHNICAL' && (
               <div onClick={() => moldInputRef.current?.click()} className="p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 text-center animate-fade-in">
                  <input type="file" ref={moldInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setMoldImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden"/>
                  {moldImage ? <img src={moldImage} className="h-20 mx-auto object-contain"/> : <span className="text-xs font-bold text-gray-400">CARREGAR MOLDE (2D)</span>}
               </div>
               )}

               <div onClick={() => patternInputRef.current?.click()} className="p-4 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 text-center">
                  <input type="file" ref={patternInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setPatternImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden"/>
                  {patternImage ? <img src={patternImage} className="h-20 mx-auto object-cover rounded"/> : <span className="text-xs font-bold text-gray-400">CARREGAR ESTAMPA</span>}
               </div>

               {/* GLOBAL ADJUSTMENTS */}
               <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 animate-fade-in">
                   <h3 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2"><Target size={12}/> Ajuste Global (Estampa)</h3>
                   <div className="space-y-2">
                       <div className="flex justify-between text-[10px] text-gray-500"><span>Escala da Estampa</span><span>{Math.round(globalScale * 100)}%</span></div>
                       <input type="range" min="0.1" max="2" step="0.05" value={globalScale} onChange={(e) => setGlobalScale(parseFloat(e.target.value))} className="w-full h-1 bg-blue-200 rounded-lg accent-blue-600"/>
                       <div className="flex justify-between text-[10px] text-gray-500"><span>Rotação</span><span>{globalRotation}°</span></div>
                       <input type="range" min="0" max="360" value={globalRotation} onChange={(e) => setGlobalRotation(parseInt(e.target.value))} className="w-full h-1 bg-blue-200 rounded-lg accent-blue-600"/>
                   </div>
               </div>

               {/* AJUSTE FINO DE CAMADA (FERRAMENTAS RESTAURADAS) */}
               {activeLayer && studioMode === 'TECHNICAL' && (
                   <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 animate-fade-in shadow-sm ring-2 ring-vingi-100">
                       <div className="flex justify-between items-center mb-3">
                           <h3 className="text-[10px] font-bold text-gray-700 uppercase tracking-widest flex items-center gap-2"><Move size={12}/> Ajuste da Peça</h3>
                           <button onClick={deleteActiveLayer} className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                       </div>
                       
                       <div className="grid grid-cols-4 gap-2 mb-4">
                           <button onClick={() => updateActiveLayer({ flipX: !activeLayer.flipX })} className="bg-white p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-vingi-600 transition-colors shadow-sm" title="Espelhar Horizontal"><FlipHorizontal size={18} className="mx-auto"/></button>
                           <button onClick={() => updateActiveLayer({ flipY: !activeLayer.flipY })} className="bg-white p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-vingi-600 transition-colors shadow-sm" title="Espelhar Vertical"><FlipVertical size={18} className="mx-auto"/></button>
                           <button onClick={() => updateActiveLayer({ rotation: activeLayer.rotation - 90 })} className="bg-white p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-vingi-600 transition-colors shadow-sm" title="Girar -90"><RotateCw size={18} className="mx-auto transform -scale-x-100"/></button>
                           <button onClick={() => updateActiveLayer({ rotation: activeLayer.rotation + 90 })} className="bg-white p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-vingi-600 transition-colors shadow-sm" title="Girar +90"><RotateCw size={18} className="mx-auto"/></button>
                       </div>
                       
                       <div className="space-y-3 border-t border-gray-200 pt-3">
                            <div>
                                <div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>Ajuste Fino Escala</span><span className="font-mono">{Math.round(activeLayer.scale * 100)}%</span></div>
                                <input type="range" min="0.1" max="2" step="0.01" value={activeLayer.scale} onChange={(e) => updateActiveLayer({ scale: parseFloat(e.target.value) })} className="w-full h-1 bg-gray-300 rounded-lg accent-gray-600"/>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] text-gray-500 mb-1"><span>Ajuste Fino Rotação</span><span className="font-mono">{activeLayer.rotation}°</span></div>
                                <input type="range" min="0" max="360" value={activeLayer.rotation} onChange={(e) => updateActiveLayer({ rotation: parseInt(e.target.value) })} className="w-full h-1 bg-gray-300 rounded-lg accent-gray-600"/>
                            </div>
                       </div>
                   </div>
               )}

               {studioMode === 'TECHNICAL' && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                   <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Zap size={12}/> Ferramentas 2D</h3>
                   <div className="flex gap-2 mb-3">
                       <button onClick={() => setTool('WAND')} className={`flex-1 py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-2 ${tool === 'WAND' ? 'bg-vingi-900 text-white' : 'bg-white text-gray-500'}`}>
                           <Wand2 size={14}/> PINTAR
                       </button>
                       <button onClick={() => setTool('MOVE')} className={`flex-1 py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-2 ${tool === 'MOVE' ? 'bg-vingi-900 text-white' : 'bg-white text-gray-500'}`}>
                           <Move size={14}/> MOVER
                       </button>
                   </div>
               </div>
               )}

               <div className="pt-4 border-t border-gray-100">
                   <button onClick={() => setShowSimModal(true)} className="w-full py-4 bg-vingi-900 text-white font-black text-sm rounded-xl shadow-xl hover:scale-[1.02] transition-transform flex items-center justify-center gap-2 animate-pulse-slow">
                       <MonitorPlay size={18}/> LIVE RUNWAY PRO
                   </button>
               </div>
          </div>
      </div>

      {/* 2. WORKSPACE */}
      <div className="flex-1 bg-[#e2e8f0] relative flex items-center justify-center overflow-hidden touch-none">
           <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#64748b 1px, transparent 1px), linear-gradient(90deg, #64748b 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

           {/* --- COMIC BUBBLES IN WORKSPACE --- */}
           {simWorkflow === 'PICKING_MOLD_PIECE' && (
               <ComicBubble 
                    text={`CLIQUE NA PEÇA CORRESPONDENTE NO MOLDE\n(EX: FRENTE DO VESTIDO)`}
                    type="ACTION" 
                    position="left"
                    style={{ left: '5%', top: '50%' }}
               />
           )}
           
           {!activeLayerId && moldImage && tool === 'WAND' && simWorkflow === 'IDLE' && studioMode === 'TECHNICAL' && (
               <ComicBubble 
                    text="CLIQUE NUMA ÁREA DO MOLDE PARA APLICAR A ESTAMPA"
                    type="INFO" 
                    position="top"
                    style={{ top: '10%', left: '50%', transform: 'translateX(-50%)' }}
               />
           )}

           {studioMode === 'MOCKUP' && !moldImage ? (
                <div className="flex flex-col items-center justify-center opacity-40 p-10 text-center">
                    <Shirt size={64} className="mb-4 text-vingi-900"/>
                    <h2 className="text-2xl font-bold text-gray-700">Modo Mockup Rápido</h2>
                    <p className="max-w-md">Neste modo, o foco é a Live Runway. Carregue uma foto da modelo e aplique a estampa diretamente.</p>
                    <button onClick={() => setShowSimModal(true)} className="mt-6 px-6 py-3 bg-vingi-900 text-white rounded-lg font-bold">ABRIR LIVE RUNWAY</button>
                </div>
           ) : (
                <div className="relative shadow-2xl bg-white border-4 border-white rounded-lg overflow-hidden max-w-[95%] max-h-[90%] flex flex-col"
                     style={{ cursor: simWorkflow === 'PICKING_MOLD_PIECE' ? 'crosshair' : (tool === 'WAND' ? 'crosshair' : 'default') }}>
                    
                    <canvas 
                        ref={mainCanvasRef}
                        onMouseDown={handleCanvasClick}
                        onMouseMove={handleMove}
                        onMouseUp={() => isDragging.current = false}
                        onTouchStart={handleCanvasClick}
                        onTouchMove={handleMove}
                        onTouchEnd={() => isDragging.current = false}
                        className="block max-w-full max-h-[85vh] w-auto h-auto"
                        style={{ width: 'auto', height: 'auto', maxHeight: '85vh', maxWidth: '100%' }}
                    />
                </div>
           )}

           {/* 3. FLOATING SIMULATION MODAL (LIVE RUNWAY) - FIXED POSITION */}
           {showSimModal && (
               <div 
                 className="fixed w-[380px] bg-white rounded-xl shadow-2xl border-2 border-gray-900 flex flex-col overflow-hidden z-[9999]"
                 style={{ top: simModalPos.y, left: simModalPos.x }}
               >
                   <div onMouseDown={handleModalMouseDown} className="bg-vingi-900 text-white p-3 flex justify-between items-center cursor-move select-none">
                       <span className="text-xs font-bold flex items-center gap-2">
                           <MonitorPlay size={14}/> LIVE RUNWAY PRO
                           <span className="bg-white/20 px-2 py-0.5 rounded text-[10px]">{studioMode === 'MOCKUP' ? 'MOCKUP' : 'SYNC'}</span>
                       </span>
                       <div className="flex gap-2">
                           <button onClick={() => setShowSimModal(false)}><X size={14}/></button>
                       </div>
                   </div>
                   
                   <div className="bg-gray-100 min-h-[400px] max-h-[600px] overflow-auto flex justify-center relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxwYXRoIGQ9Ik0wIDBoOHY4SDB6IiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTAgMGg0djRINHptNCA0aDR2NEg0eiIgZmlsbD0iI2U1ZTVlNSIvPjwvc3ZnPg==')]">
                       {!simImage ? (
                           <div onClick={() => simInputRef.current?.click()} className="self-center text-center cursor-pointer opacity-60 hover:opacity-100 p-8 bg-white rounded-lg shadow-sm border border-dashed border-gray-300">
                               <input type="file" ref={simInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f) { const r = new FileReader(); r.onload=ev=>setSimImage(ev.target?.result as string); r.readAsDataURL(f); } }} className="hidden"/>
                               <UploadCloud size={32} className="mx-auto mb-2 text-vingi-500"/>
                               <p className="text-xs font-bold">CARREGAR FOTO DA MODELO</p>
                           </div>
                       ) : isSimProcessing ? (
                           /* TELA DE PROCESSAMENTO NEURAL SIMULADO */
                           <div className="absolute inset-0 bg-white z-50 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                               <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 relative">
                                   <ScanFace size={32} className="text-vingi-600 animate-pulse"/>
                                   <div className="absolute inset-0 border-4 border-blue-100 rounded-full border-t-blue-600 animate-spin"/>
                               </div>
                               <h3 className="text-lg font-bold text-gray-800">Processando Imagem</h3>
                               <p className="text-sm text-gray-500 mt-2 min-h-[20px] transition-all">
                                   {simProcessStep === 0 && "Removendo estampas originais..."}
                                   {simProcessStep === 1 && "Calculando iluminação e sombras..."}
                               </p>
                           </div>
                       ) : (
                           <>
                             {/* Canvas de Simulação */}
                             <canvas 
                                ref={simCanvasRef} 
                                onClick={handleSimInteractionStart}
                                onMouseMove={handleSimInteractionMove}
                                onMouseDown={handleSimInteractionStart}
                                onTouchStart={handleSimInteractionStart}
                                onTouchMove={handleSimInteractionMove}
                                className={`block shadow-lg ${simTool === 'BRUSH' ? 'cursor-none' : 'cursor-crosshair'}`}
                             />
                             
                             {/* Brush Cursor Indicator */}
                             {simTool === 'BRUSH' && isSimInteracting && (
                                 <div className="fixed pointer-events-none rounded-full border-2 border-white bg-white/20 z-[10000]" 
                                      style={{ width: simBrushSize, height: simBrushSize, transform: 'translate(-50%, -50%)', left: lastPos.current.x, top: lastPos.current.y }} />
                             )}

                             {/* TOOLS OVERLAY */}
                             <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                                <div className="bg-white p-1 rounded-xl shadow-lg flex flex-col gap-1 mb-2">
                                     <button onClick={() => setSimTool('WAND')} className={`p-2 rounded-lg ${simTool === 'WAND' ? 'bg-vingi-900 text-white' : 'bg-transparent text-gray-500'}`} title="Varinha Mágica (Auto)"><Wand2 size={16}/></button>
                                     <button onClick={() => setSimTool('BRUSH')} className={`p-2 rounded-lg ${simTool === 'BRUSH' ? 'bg-vingi-900 text-white' : 'bg-transparent text-gray-500'}`} title="Pincel (Manual)"><Brush size={16}/></button>
                                     <div className="h-[1px] bg-gray-200 my-1"></div>
                                     <button onClick={handleAutoDetectGarment} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="Auto Detectar (Centro)"><Sparkles size={16}/></button>
                                </div>
                             </div>

                             {/* CONTROL PANEL (BOTTOM) */}
                             <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur rounded-xl p-3 shadow-xl border border-white z-10">
                                <div className="flex items-center gap-3">
                                    {simTool === 'WAND' ? <Sliders size={16} className="text-gray-500"/> : <Circle size={16} className="text-gray-500"/>}
                                    <div className="flex-1">
                                        <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase mb-1">
                                            <span>{simTool === 'WAND' ? 'Sensibilidade IA' : 'Tamanho Pincel'}</span>
                                            <span>{simTool === 'WAND' ? `${simSensitivity}%` : `${simBrushSize}px`}</span>
                                        </div>
                                        {simTool === 'WAND' ? (
                                            <input type="range" min="5" max="100" value={simSensitivity} onChange={(e) => setSimSensitivity(parseInt(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg accent-vingi-600 cursor-pointer"/>
                                        ) : (
                                            <input type="range" min="5" max="100" value={simBrushSize} onChange={(e) => setSimBrushSize(parseInt(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg accent-vingi-600 cursor-pointer"/>
                                        )}
                                    </div>
                                </div>
                                {simMappings.length === 0 && (
                                    <p className="text-[10px] text-center text-red-500 font-bold mt-2 animate-pulse">
                                        {simTool === 'WAND' ? 'CLIQUE PARA SELECIONAR' : 'PINTE A ÁREA DO VESTIDO'}
                                    </p>
                                )}
                             </div>
                           </>
                       )}
                   </div>
               </div>
           )}
      </div>
    </div>
  );
};
