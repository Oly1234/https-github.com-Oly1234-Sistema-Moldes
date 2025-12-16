
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Sparkles, Zap, BrainCircuit, Activity } from 'lucide-react';
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
                setStatus('SPEAKING'); // Short delay for visual feedback
                setTimeout(() => {
                    onNavigate(data.targetView, data.message);
                    setStatus('IDLE');
                    setTranscript('');
                }, 800);
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

    // --- VISUAL STYLES ---
    const getOrbStyle = () => {
        switch (status) {
            case 'IDLE': return "bg-gradient-to-br from-vingi-600 to-vingi-900 scale-100 shadow-lg border-vingi-500/30";
            case 'LISTENING': return "bg-gradient-to-br from-red-500 to-pink-600 scale-110 shadow-[0_0_40px_rgba(239,68,68,0.6)] animate-pulse border-red-400";
            case 'PROCESSING': return "bg-gradient-to-br from-purple-500 to-indigo-600 scale-105 shadow-[0_0_30px_rgba(139,92,246,0.6)] animate-pulse-slow border-purple-400";
            case 'SPEAKING': return "bg-gradient-to-br from-emerald-400 to-teal-500 scale-110 shadow-[0_0_40px_rgba(52,211,153,0.6)] border-white";
        }
    };

    return (
        <div className="flex flex-col items-center justify-center relative mt-8 z-50">
            {/* Status Label (Futuristic HUD) */}
            <div className={`absolute -top-12 transition-all duration-500 ${status === 'IDLE' ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
                <div className="bg-black/80 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-mono border border-white/10 flex items-center gap-2 shadow-xl whitespace-nowrap">
                    {status === 'LISTENING' && <><Mic size={12} className="animate-pulse text-red-400"/> Ouvindo...</>}
                    {status === 'PROCESSING' && <><BrainCircuit size={12} className="animate-spin text-purple-400"/> Analisando Intenção...</>}
                    {status === 'SPEAKING' && <><Sparkles size={12} className="text-emerald-400"/> Confirmado</>}
                </div>
            </div>

            {/* Transcription Float */}
            {transcript && status !== 'IDLE' && (
                <div className="absolute top-20 transition-all duration-300 w-64 text-center">
                    <p className="text-gray-500 text-xs italic bg-white/90 px-3 py-1 rounded-full shadow-sm border border-gray-100 inline-block">"{transcript}"</p>
                </div>
            )}

            {/* The Orb Button */}
            <button 
                onClick={toggleListening}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 border-4 relative group ${getOrbStyle()}`}
            >
                {/* Inner Glow Layers */}
                <div className={`absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 blur-md`}></div>
                
                {/* Icon Switcher */}
                <div className="relative z-10 text-white transition-all duration-300">
                    {status === 'IDLE' && <Mic size={28} className="drop-shadow-md group-hover:scale-110 transition-transform" />}
                    {status === 'LISTENING' && (
                        <div className="flex gap-1 items-end h-6">
                             <div className="w-1 bg-white animate-[bounce_1s_infinite] h-3"></div>
                             <div className="w-1 bg-white animate-[bounce_1.2s_infinite] h-5"></div>
                             <div className="w-1 bg-white animate-[bounce_0.8s_infinite] h-3"></div>
                        </div>
                    )}
                    {status === 'PROCESSING' && <Activity size={28} className="animate-spin-slow" />}
                    {status === 'SPEAKING' && <Zap size={28} className="fill-white animate-bounce" />}
                </div>

                {/* Ring Animation for Idle */}
                {status === 'IDLE' && (
                    <div className="absolute inset-0 border border-white/20 rounded-full animate-ping opacity-20" style={{ animationDuration: '3s' }}></div>
                )}
            </button>
            
            <p className="mt-4 text-[10px] uppercase font-bold tracking-[0.2em] text-gray-400">
                {status === 'IDLE' ? "Toque para Falar" : "Vingi AI Agent"}
            </p>
        </div>
    );
};
