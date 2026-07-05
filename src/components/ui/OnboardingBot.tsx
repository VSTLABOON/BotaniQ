import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, X, Send, User, Bot, Sparkles } from 'lucide-react';
import systemPrompt from '../../../docs/agent-prompt.md?raw';
import { useTenant } from '../../context/TenantContext';
import { supabase } from '../../lib/supabaseClient';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: Date;
}

interface OnboardingBotProps {
  onClose: () => void;
}

export function OnboardingBot({ onClose }: OnboardingBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Bienvenida. Vi que acabas de entrar a tu panel de control — eso ya es el paso más difícil. ¿Hay algo en lo que quieras arrancar primero, o te cuento por dónde conviene empezar?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const systemInstructionRef = useRef<string>('');

  const { tenant } = useTenant();

  // Iniciar la sesión de chat con Gemini, inyectando contexto del tenant
  useEffect(() => {
    async function initChat() {
      if (!tenant?.id) return;

      try {
        // Fetch productos de la tienda para darle contexto
        const { data: productos } = await supabase
          .from('productos')
          .select('nombre, descripcion, precio, disponible')
          .eq('tienda_id', tenant.id);

        const contextInfo = `
---
CONTEXTO EN TIEMPO REAL DEL USUARIO (SISTEMA):
- Nombre de la Tienda: ${tenant.nombre || 'Sin configurar'}
- Color Identificativo: ${tenant.color_primario || 'default'}
- Catálogo de arreglos registrados (${productos?.length || 0}):
${productos?.length ? productos.map(p => `  * ${p.nombre} ($${p.precio}) - ${p.disponible ? 'Activo' : 'Oculto'}`).join('\n') : '  (No hay arreglos registrados aún)'}
---
REGLAS ESTRICTAS DE FORMATO:
1. NUNCA uses asteriscos (**) para negritas ni para listas. 
2. Tu respuesta debe ser 100% texto plano sin formato Markdown.
3. Si necesitas resaltar el nombre de un arreglo, sección o concepto, usa únicamente comillas simples (ejemplo: 'Ramo de Rosas').
---
        `;

        systemInstructionRef.current = systemPrompt + '\n' + contextInfo;
      } catch (err) {
        console.error("Error inicializando contexto del bot:", err);
      }
    }

    initChat();
  }, [tenant?.id]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userText = inputValue.trim();

    const newUserMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      // Construir el historial para Gemini
      // Gemini requiere que el historial empiece con 'user' y alterne con 'model'
      const historyPayload = [
        {
          role: 'user',
          parts: [{ text: 'Hola' }]
        },
        ...messages.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        })),
        {
          role: 'user',
          parts: [{ text: userText }]
        }
      ];

      // Invocar la Edge Function de Supabase
      const { data, error } = await supabase.functions.invoke('gemini-chat', {
        body: {
          history: historyPayload,
          systemInstruction: systemInstructionRef.current
        }
      });

      if (error || !data || !data.text) {
        throw new Error(error?.message || 'Error en la respuesta del bot');
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: data.text,
        timestamp: new Date()
      }]);

    } catch (error: any) {
      console.error('Error con Gemini detallado:', error);
      let errorMessage = 'Tuve un pequeño problema técnico procesando eso.';
      
      if (error?.message) {
        errorMessage = `Error de API: ${error.message}`;
      } else if (error?.status) {
        errorMessage = `Error de conexión (Status: ${error.status})`;
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: errorMessage,
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 50, scale: 0.95 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed bottom-24 right-6 w-[360px] sm:w-[400px] h-[550px] bg-[var(--color-background-primary)] rounded-3xl shadow-2xl border border-[var(--color-border-secondary)] overflow-hidden flex flex-col z-50"
    >
      {/* Header */}
      <div className="p-4 bg-emerald-600 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center relative">
            <Sparkles className="w-5 h-5 text-emerald-100" />
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-emerald-600"></span>
          </div>
          <div>
            <h3 className="font-display font-bold text-sm">BotaniQ AI</h3>
            <p className="text-xs text-emerald-100">Florista Asistente</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-crema/20">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-2 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.sender === 'user' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-secondary)]'
              }`}>
                {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-emerald-600 text-white rounded-tr-none'
                  : 'bg-[var(--color-background-primary)] text-[var(--color-text-primary)] border border-[var(--color-border-secondary)] rounded-tl-none shadow-sm'
              }`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="flex gap-2 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-[var(--color-background-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border-secondary)] flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3 bg-[var(--color-background-primary)] border border-[var(--color-border-secondary)] rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Área */}
      <div className="p-3 bg-[var(--color-background-primary)] border-t border-[var(--color-border-secondary)] shrink-0">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder="Escribe tu duda aquí..."
            className="w-full h-11 pl-4 pr-12 bg-[var(--color-background-secondary)] border border-[var(--color-border-secondary)] rounded-full text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className="absolute right-1.5 w-8 h-8 flex items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors"
          >
            <Send className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>
        <div className="text-center mt-2 flex items-center justify-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-500" />
          <span className="text-[0.6rem] text-[var(--color-text-tertiary)]">Impulsado por Google Gemini 1.5</span>
        </div>
      </div>
    </motion.div>
  );
}
