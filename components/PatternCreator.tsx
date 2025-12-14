
import React, { useState, useRef } from 'react';
import { UploadCloud, Wand2, Download, Palette, Image as ImageIcon, Loader2, Sparkles, Layers, Grid3X3, Target, Globe, Box, Maximize2, Feather, AlertCircle, Search, ChevronRight, Move, ZoomIn, Minimize2, Plus, TrendingUp, Brush, Leaf, Droplets } from 'lucide-react';
import { PantoneColor, ExternalPatternMatch } from '../types';
import { PatternVisualCard } from './PatternVisualCard';

// Modal Flutuante para Comparação
const FloatingComparisonModal: React.FC<{ image: string }> = ({ image }) => {
    const [position, setPosition] = useState({ x: window.innerWidth - 220, y: 100 }); 
    const [size, setSize] = useState(180);
    const [isMinimized, setIsMinimized] = useState(false);
    
    const dragOffset = useRef({ x: 0, y: 0 });
    const isDragging = useRef(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        isDragging.current = true;
        dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        setPosition({
            x: Math.max(0, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - size)),
            y: Math.max(0, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 50))
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    if (isMinimized) {
        return (
            <div className="fixed top-24 right-4 bg-vingi-900 text-white p-3 rounded-full shadow-2xl z-[100] cursor-pointer hover:scale-110 transition-transform" onClick={() => setIsMinimized(false)}>
                <ImageIcon size={24} />
            </div>
        );
    }

    return (
        <div 
            className="fixed z-[90] bg-white rounded-xl shadow-2xl border-2 border-vingi-500 overflow-hidden flex flex-col transition-shadow shadow-md"
            style={{ left: position.x, top: position.y, width: size, touchAction: 'none' }}
        >
            <div 
                className="bg-vingi-900 h-9 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing select-none"
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
            >
                <span className="text-[10px] font-bold text-white flex items-center gap-1 uppercase tracking-wider"><Move size={10}/> Ref</span>
                <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                    <button onClick={() => setSize(s => Math.min(400, s + 30))} className="text-white/70 hover:text-white"><ZoomIn size={12}/></button>
                    <button onClick={() => setIsMinimized(true)} className="text-white/70 hover:text-white"><Minimize2 size={12}/></button>
                </div>
            </div>
            <div className="relative bg-gray-100 group">
                <img src={image} className="w-full object-contain bg-white pointer-events-none select-none" style={{ maxHeight: size * 1.5 }} />
            </div>
        </div>
    );
};

const compressImage = (base64Str: string | null, maxWidth = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!base64Str) { reject(new Error("Imagem vazia")); return; }
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) { ctx.drawImage(img, 0, 0, width, height); resolve(canvas.toDataURL('image/jpeg', 0.8)); }
            else reject(new Error("Canvas error"));
        };
        img.onerror = () => reject(new Error("Load error"));
    });
};

// CARTÃO PANTONE INTERATIVO & TRENDY (ATUALIZADO PARA EXIBIR DADOS DO DEPARTAMENTO DE COR)
const PantoneCard: React.FC<{ color: PantoneColor | any }> = ({ color }) => {
    const handleSearch = () => {
        const query = `Pantone ${color.code} ${color.name} cotton swatch`;
        window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`, '_blank');
    };

    return (
        <div onClick={handleSearch} className="flex flex-col bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200 hover:shadow-lg transition-all cursor-pointer group h-full hover:scale-[1.02]">
            <div className="h-20 w-full relative" style={{ backgroundColor: color.hex }}>
                 <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <div className="bg-white/90 rounded text-[8px] font-mono px-1 py-0.5">{color.hex}</div>
                 </div>
                 <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                     <Search className="text-white drop-shadow-md" size={16}/>
                 </div>
            </div>
            <div className="p-3 flex flex-col justify-between flex-1">
                <div className="mb-2">
                    <span className="block text-[10px] font-extrabold text-gray-900 leading-tight uppercase tracking-tight">{color.name}</span>
                    <span className="block text-[11px] text-gray-600 font-mono mt-0.5 font-bold">{color.code || 'TCX PENDING'}</span>
                </div>
                <div className="flex flex-col gap-1">
                    {color.role && (
                        <span className="self-start text-[8px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 uppercase tracking-wider">
                            {color.role}
                        </span>
                    )}
                    {color.trendStatus && (
                        <span className="self-start text-[8px] font-bold text-vingi-600 bg-vingi-50 px-1.5 py-0.5 rounded border border-vingi-100 flex items-center gap-1 leading-tight animate-pulse">
                            <TrendingUp size={8} className="shrink-0"/> {color.trendStatus}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const SpecBadge: React.FC<{ icon: any, label: string, value: string }> = ({ icon: Icon, label, value }) => (
    <div className="bg-white border border-gray-100 rounded-lg p-2.5 flex items-center gap-3 shadow-sm">
        <div className="p-2 bg-gray-50 rounded-full text-vingi-500">
            <Icon size={14} />
        </div>
        <div>
            <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest">{label}</span>
            <span className="block text-xs font-bold text-gray-800 capitalize">{value}</span>
        </div>
    </div>
);

export const PatternCreator: React.FC = () => {
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [generatedPattern, setGeneratedPattern] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [detectedColors, setDetectedColors] = useState<PantoneColor[]>([]);
    
    // Resultados de Busca & Paginação
    const [fabricMatches, setFabricMatches] = useState<ExternalPatternMatch[]>([]);
    const [visibleMatchesCount, setVisibleMatchesCount] = useState(10); 
    
    const [technicalSpecs, setTechnicalSpecs] = useState<any>(null);
    const [genError, setGenError] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const res = ev.target?.result as string;
                if (res) {
                    setReferenceImage(res);
                    setGeneratedPattern(null);
                    setDetectedColors([]);
                    setFabricMatches([]);
                    setVisibleMatchesCount(10);
                    setTechnicalSpecs(null);
                    setPrompt('');
                    setGenError(null);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const analyzeReference = async () => {
        if (!referenceImage) return;
        setIsAnalyzing(true);
        setGenError(null);
        try {
            const compressedBase64 = await compressImage(referenceImage);
            const parts = compressedBase64.split(',');
            const data = parts[1];
            const mimeType = 'image/jpeg'; 
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'DESCRIBE_PATTERN',
                    mainImageBase64: data,
                    mainMimeType: mimeType
                })
            });
            if (!response.ok) throw new Error("API Error");
            const resData = await response.json();
            if (resData.success) {
                setPrompt(resData.prompt || '');
                setDetectedColors(Array.isArray(resData.colors) ? resData.colors : []);
                setFabricMatches(Array.isArray(resData.stockMatches) ? resData.stockMatches : []);
                setTechnicalSpecs(resData.technicalSpecs || null);
            }
        } catch (error) {
            setPrompt("Could not analyze texture.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const generatePatternFromData = async () => {
        if (!prompt) return;
        setIsGenerating(true);
        setGenError(null);
        try {
             const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'GENERATE_PATTERN', 
                    prompt: prompt,
                    colors: detectedColors
                })
            });
            const data = await response.json();
            if (data.success && data.image) { 
                setGeneratedPattern(data.image); 
            } else {
                setGenError(data.error || "Erro na geração. A IA pode estar sobrecarregada.");
            }
        } catch (error: any) {
            setGenError(error.message || "Erro na geração.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (!generatedPattern) return;
        const link = document.createElement('a');
        link.download = `vingi-texture-${Date.now()}.jpg`;
        link.href = generatedPattern;
        link.click();
    };

    // DEDUPLICAÇÃO DE RESULTADOS
    const uniqueMatches = fabricMatches.filter((match, index, self) =>
        index === self.findIndex((m) => (
            m.url === match.url
        ))
    );

    const visibleData = uniqueMatches.slice(0, visibleMatchesCount);

    return (
        <div className="flex flex-col h-full bg-[#f0f2f5] overflow-hidden relative">
            {referenceImage && <FloatingComparisonModal image={referenceImage} />}

            <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 shrink-0 z-20 shadow-sm">
                <Palette className="text-vingi-600 mr-2" size={20} />
                <h2 className="text-lg font-bold text-gray-800">Pattern Studio <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500 ml-2">DEPTS. ATIVOS</span></h2>
            </header>

            {/* Layout Flex para Mobile (Column) e Desktop (Row) */}
            {/* FIX MOBILE SCROLL: overflow-y-auto no wrapper principal para mobile, md:overflow-hidden para desktop */}
            <div className="flex-1 flex flex-col md:flex-row md:overflow-hidden overflow-y-auto">
                
                {/* SIDEBAR: INPUTS & ANÁLISE */}
                {/* Mobile: h-auto (flow), Desktop: h-full (scroll independent) */}
                <div className="w-full md:w-[400px] bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col h-auto md:h-full md:overflow-y-auto shrink-0 z-10 custom-scrollbar shadow-sm">
                    <div className="p-6 space-y-8">
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <ImageIcon size={14}/> 1. Amostra de Referência
                            </h3>
                            <div onClick={() => fileInputRef.current?.click()} className={`relative h-48 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all group ${referenceImage ? 'border-vingi-500 bg-white' : 'border-gray-300 hover:border-vingi-400 hover:bg-gray-50'}`}>
                                <input type="file" ref={fileInputRef} onChange={handleReferenceUpload} accept="image/*" className="hidden" />
                                {referenceImage ? (
                                    <>
                                        <img src={referenceImage} className="w-full h-full object-cover rounded-lg p-1 opacity-80 group-hover:opacity-100 transition-opacity" />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 rounded-lg transition-opacity">
                                            <span className="bg-white px-3 py-1 rounded-full text-xs font-bold shadow-md">Trocar Imagem</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center p-6">
                                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                                            <UploadCloud className="text-gray-400" size={24}/>
                                        </div>
                                        <span className="text-sm font-bold text-gray-600">Carregar Textura</span>
                                        <p className="text-[10px] text-gray-400 mt-1">JPG, PNG (Max 5MB)</p>
                                    </div>
                                )}
                            </div>
                            {referenceImage && !technicalSpecs && (
                                <button onClick={analyzeReference} disabled={isAnalyzing} className="mt-4 w-full py-3 bg-vingi-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-vingi-800 transition-colors shadow-lg animate-fade-in">
                                    {isAnalyzing ? <Loader2 className="animate-spin" size={16}/> : <Search size={16}/>} 
                                    {isAnalyzing ? 'Consultar Departamentos' : 'Iniciar Análise Técnica'}
                                </button>
                            )}
                        </div>
                        {technicalSpecs && (
                            <div className="animate-fade-in space-y-6">
                                {technicalSpecs.motifs && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <SpecBadge icon={Leaf} label="Motivos" value={technicalSpecs.motifs[0] || 'Floral'} />
                                        <SpecBadge icon={Brush} label="Técnica" value={technicalSpecs.technique || 'Digital'} />
                                        <SpecBadge icon={Layers} label="Textura" value={technicalSpecs.texture || 'Liso'} />
                                        <SpecBadge icon={Droplets} label="Vibe" value={technicalSpecs.vibe || 'Modern'} />
                                    </div>
                                )}

                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Palette size={14}/> Dept. Colorimetria
                                    </h3>
                                    {detectedColors.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3">
                                            {detectedColors.map((c, i) => <PantoneCard key={i} color={c} />)}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-400 italic">Nenhuma cor dominante detectada.</p>
                                    )}
                                </div>
                                <div className="pt-4 border-t border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Sparkles size={14}/> Atelier Digital (Gemini 2.5)
                                    </h3>
                                    <button onClick={generatePatternFromData} disabled={isGenerating} className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 hover:brightness-110 transition-all">
                                        {isGenerating ? <Loader2 className="animate-spin"/> : <Wand2 size={18}/>}
                                        {generatedPattern ? 'Gerar Novamente' : 'Criar Estampa'}
                                    </button>
                                    {genError && (
                                        <div className="mt-3 p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2 border border-red-100">
                                            <AlertCircle size={14} className="shrink-0"/> {genError}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ÁREA PRINCIPAL: RESULTADOS */}
                {/* Mobile: h-auto (flow), Desktop: h-full (scroll independent) */}
                <div className="flex-1 flex flex-col h-auto md:h-full md:overflow-y-auto bg-[#f1f5f9]">
                    <div className="p-6 md:p-10 flex flex-col items-center justify-center bg-white border-b border-gray-200 min-h-[400px] relative">
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                        {!generatedPattern && !isGenerating ? (
                            <div className="text-center opacity-40 max-w-md">
                                <Layers size={64} className="mx-auto mb-4 text-gray-300"/>
                                <h3 className="text-xl font-bold text-gray-800">Estúdio de Criação</h3>
                                <p className="text-gray-500 mt-2">Use o botão "Criar Estampa" para acionar o Atelier Digital (IA).</p>
                            </div>
                        ) : isGenerating ? (
                             <div className="flex flex-col items-center justify-center">
                                <div className="relative">
                                    <div className="w-24 h-24 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin"></div>
                                    <Sparkles size={24} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-600 animate-pulse"/>
                                </div>
                                <h3 className="text-lg font-bold text-gray-700 mt-6">Atelier Trabalhando...</h3>
                                <p className="text-sm text-gray-400">Desenhando padrão seamless (Model: Nano Banana).</p>
                             </div>
                        ) : (
                            <div className="w-full max-w-4xl animate-fade-in flex flex-col md:flex-row gap-8 items-center">
                                <div className="relative aspect-square w-full md:w-96 bg-white rounded-xl shadow-2xl overflow-hidden border-8 border-white group">
                                    <img src={generatedPattern!} className="w-full h-full object-cover"/>
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button onClick={handleDownload} className="bg-white text-gray-900 px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 hover:scale-105 transition-transform"><Download size={18}/> Baixar Arquivo</button>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-4">
                                    <h3 className="text-2xl font-bold text-gray-800">Resultado Gerado</h3>
                                    <p className="text-gray-500 text-sm">Esta estampa é única, seamless (repetição infinita) e livre de royalties. Pronta para sublimação ou impressão digital.</p>
                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                         <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Prompt Utilizado</h4>
                                         <p className="text-xs text-gray-600 font-mono italic">"{prompt}"</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-6 md:p-8 pb-32">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                <Globe className="text-vingi-600"/> Dept. Mercado Global
                            </h3>
                            {uniqueMatches.length > 0 && <span className="text-xs bg-white border border-gray-200 px-3 py-1 rounded-full text-gray-500 font-bold">{uniqueMatches.length} Encontrados</span>}
                        </div>
                        {uniqueMatches.length === 0 ? (
                             technicalSpecs ? (
                                <div className="flex items-center justify-center h-32 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                    <p className="text-gray-400 text-sm">Nenhuma correspondência exata encontrada nos marketplaces.</p>
                                </div>
                             ) : (
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 opacity-30 pointer-events-none">
                                    {[1,2,3,4,5].map(i => <div key={i} className="h-64 bg-gray-200 rounded-xl animate-pulse"></div>)}
                                </div>
                             )
                        ) : (
                            <>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {visibleData.map((match, i) => (
                                        <PatternVisualCard key={i} match={match} userReferenceImage={referenceImage} />
                                    ))}
                                </div>
                                
                                {visibleMatchesCount < uniqueMatches.length && (
                                    <div className="mt-8 flex justify-center">
                                        <button 
                                            onClick={() => setVisibleMatchesCount(p => p + 10)} 
                                            className="px-8 py-3 bg-white border border-gray-300 rounded-xl font-bold shadow-sm hover:bg-gray-50 hover:border-gray-400 text-gray-600 transition-all flex items-center gap-2"
                                        >
                                            <Plus size={16}/> Carregar Mais ({uniqueMatches.length - visibleMatchesCount})
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
