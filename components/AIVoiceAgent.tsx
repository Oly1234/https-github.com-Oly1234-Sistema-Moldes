
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, Zap, BrainCircuit, Activity, CheckCircle2 } from 'lucide-react';
import { ViewState } from '../types';

interface AIVoiceAgentProps {
    onNavigate: (view: ViewState, contextMessage: string) => void;
}

export const AIVoiceAgent: React.FC<AIVoiceAgentProps> = ({ onNavigate }) => {
    const [status, setStatus] = useState<'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING'>('IDLE');
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // Initialize Web Speech API
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'pt-BR';

            recognition.onstart = () => {
                setStatus('LISTENING');
                if (navigator.vibrate) navigator.vibrate(50); // Haptic start
            };

            recognition.onresult = (event: any) => {
                const text = event.results[0][0].transcript;
                setTranscript(text);
                processCommand(text);
            };

            recognition.onerror = (event: any) => {
                console.error("Voice Error:", event.error);
                setStatus('IDLE');
            };

            recognition.onend = () => {
                if (status === 'LISTENING') setStatus('PROCESSING');
            };

            recognitionRef.current = recognition;
        }
    }, []);

    const processCommand = async (text: string) => {
        setStatus('PROCESSING');
        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'VOICE_COMMAND', commandText: text })
            });
            const data = await response.json();
            
            if (data.success && data.targetView) {
                if (navigator.vibrate) navigator.vibrate([30, 50, 30]); // Haptic Success
                setStatus('SPEAKING'); // Success State
                
                // Delay navigation slightly to show success animation
                setTimeout(() => {
                    onNavigate(data.targetView, data.message);
                    setStatus('IDLE');
                    setTranscript('');
                }, 1200); 
            } else {
                setStatus('IDLE');
            }
        } catch (e) {
            console.error("Voice Agent Brain Freeze", e);
            setStatus('IDLE');
        }
    };

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert("Seu navegador não suporta comandos de voz.");
            return;
        }
        if (status === 'IDLE') {
            recognitionRef.current.start();
        } else {
            recognitionRef.current.stop();
        }
    };

    // --- VISUAL STYLES & LABELS ---
    const getStatusConfig = () => {
        switch (status) {
            case 'IDLE': return {
                label: "Toque para Falar",
                subLabel: "Vingi AI",
                className: "bg-gradient-to-br from-vingi-700 to-vingi-900 border-vingi-500/30 shadow-lg scale-100",
                icon: <Mic size={28} className="drop-shadow-md text-white/90 group-hover:scale-110 transition-transform" />
            };
            case 'LISTENING': return {
                label: "Ouvindo...",
                subLabel: "Fale Agora",
                className: "bg-gradient-to-br from-red-500 to-pink-600 border-red-400 shadow-[0_0_40px_rgba(239,68,68,0.5)] scale-110 animate-pulse",
                icon: (
                    <div className="flex gap-1 items-end h-6 text-white">
                         <div className="w-1 bg-white animate-[bounce_1s_infinite] h-3"></div>
                         <div className="w-1 bg-white animate-[bounce_1.2s_infinite] h-5"></div>
                         <div className="w-1 bg-white animate-[bounce_0.8s_infinite] h-3"></div>
                    </div>
                )
            };
            case 'PROCESSING': return {
                label: "Processando...",
                subLabel: "Analisando Intenção",
                className: "bg-gradient-to-br from-purple-600 to-indigo-700 border-purple-400 shadow-[0_0_30px_rgba(139,92,246,0.6)] scale-105",
                icon: <Activity size={28} className="animate-spin-slow text-white" />
            };
            case 'SPEAKING': return {
                label: "Entendido!",
                subLabel: "Navegando...",
                className: "bg-gradient-to-br from-emerald-400 to-teal-600 border-white shadow-[0_0_50px_rgba(16,185,129,0.6)] scale-110",
                icon: <CheckCircle2 size={32} className="text-white animate-bounce" />
            };
        }
    };

    const config = getStatusConfig();

    return (
        <div className="flex flex-col items-center justify-center relative mt-10 z-50">
            {/* Status Label (Floating above) */}
            <div className={`absolute -top-14 transition-all duration-500 flex flex-col items-center ${status === 'IDLE' ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
                {transcript && status === 'PROCESSING' && (
                    <div className="mb-2 bg-white/90 text-gray-600 px-3 py-1 rounded-full text-[10px] font-medium shadow-sm italic border border-gray-100 max-w-[200px] truncate">
                        "{transcript}"
                    </div>
                )}
                <div className="bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-mono border border-white/10 flex items-center gap-2 shadow-xl whitespace-nowrap">
                    {status === 'LISTENING' && <Mic size={12} className="text-red-400 animate-pulse"/>}
                    {status === 'PROCESSING' && <BrainCircuit size={12} className="text-purple-400 animate-spin"/>}
                    {status === 'SPEAKING' && <Sparkles size={12} className="text-emerald-400"/>}
                    <span className="font-bold tracking-wide">{config.label}</span>
                </div>
            </div>

            {/* The Orb Button */}
            <button 
                onClick={toggleListening}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 border-4 relative group ${config.className}`}
            >
                {/* Inner Glow Layers */}
                <div className={`absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 blur-md`}></div>
                
                {/* Icon Switcher */}
                <div className="relative z-10 transition-all duration-300">
                    {config.icon}
                </div>

                {/* Ring Animation for Idle */}
                {status === 'IDLE' && (
                    <div className="absolute inset-0 border border-white/20 rounded-full animate-ping opacity-20" style={{ animationDuration: '3s' }}></div>
                )}
            </button>
            
            <p className="mt-4 text-[10px] uppercase font-bold tracking-[0.2em] text-gray-400 transition-colors duration-300">
                {status !== 'IDLE' ? config.subLabel : "Vingi AI Agent"}
            </p>
        </div>
    );
};
