/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  User, 
  Phone, 
  Mail, 
  CreditCard, 
  GraduationCap, 
  Briefcase, 
  MapPin, 
  Building2, 
  Send, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Users,
  Search,
  ChevronDown,
  ShieldCheck,
  Lock,
  X,
  Info,
  LayoutDashboard,
  LogOut,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Plus,
  Trash2
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  MUNICIPIOS_PIAUI, 
  FUNCOES, 
  GRES, 
  AREAS_FORMACAO, 
  NIVEIS_INSTRUCAO, 
  UNIDADES_TRABALHO 
} from './constants';
import { ProtectedRoute } from './components/ProtectedRoute';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const GRES_ESPECIAIS = [
  "1ª GRE", "2ª GRE", "3ª GRE", "4ª GRE", "5ª GRE", "6ª GRE", "7ª GRE", "8ª GRE", 
  "9ª GRE", "10ª GRE", "11ª GRE", "12ª GRE", "13ª GRE", "14ª GRE", "15ª GRE", 
  "16ª GRE", "17ª GRE", "18ª GRE", "19ª GRE", "20ª GRE", "21ª GRE", "SEDE", "SEDE (SEDUC)"
];

const schema = z.object({
  name: z.string().min(3, "Nome muito curto"),
  mobile: z.string().regex(/^\(\d{2}\)\s\d{5}-\d{4}$/, "Formato: (86) 99999-9999"),
  email: z.string().email("E-mail inválido"),
  cpf: z.string().refine((val) => {
    const cleanCPF = val.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

    // DV1
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let rest = sum % 11;
    let dv1 = rest < 2 ? 0 : 11 - rest;
    if (parseInt(cleanCPF.charAt(9)) !== dv1) return false;

    // DV2
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    rest = sum % 11;
    let dv2 = rest < 2 ? 0 : 11 - rest;
    if (parseInt(cleanCPF.charAt(10)) !== dv2) return false;

    return true;
  }, "CPF inválido"),
  areaFormacao: z.string().min(1, "Selecione uma área"),
  nivelInstrucao: z.string().min(1, "Selecione o nível"),
  funcao: z.string().min(1, "Selecione a função"),
  municipio: z.string().min(1, "Selecione o município"),
  gre: z.string().min(1, "Selecione a GRE"),
  unidadeTrabalho: z.string().min(1, "Selecione a unidade"),
  inep: z.string().optional(),
}).superRefine((data, ctx) => {
  const isGresEspecial = data.unidadeTrabalho && GRES_ESPECIAIS.includes(data.unidadeTrabalho.toUpperCase());
  if (data.unidadeTrabalho && !isGresEspecial) {
    if (!data.inep || data.inep.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "INEP obrigatório (8 dígitos)",
        path: ["inep"],
      });
    }
  }
});

type FormData = z.infer<typeof schema>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RegistrationPage />} />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
}

function RegistrationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [protocol, setProtocol] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingData, setPendingData] = useState<FormData | null>(null);
  
  // Admin & Dashboard State
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  
  // Searchable Select State
  const [unidadeSearch, setUnidadeSearch] = useState('');
  const [isUnidadeOpen, setIsUnidadeOpen] = useState(false);

  useEffect(() => {
    if ((location.state as any)?.showLogin) {
      setShowLoginModal(true);
    }
  }, [location.state]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset
  } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const selectedUnidade = watch('unidadeTrabalho');
  const showInep = selectedUnidade && !GRES_ESPECIAIS.includes(selectedUnidade.toUpperCase());

  const filteredUnidades = UNIDADES_TRABALHO.filter(u => 
    u.toLowerCase().includes(unidadeSearch.toLowerCase())
  ).slice(0, 10);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.unidade-container')) {
        setIsUnidadeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      
      const result = await response.json();
      
      if (result.status === 'success') {
        navigate('/dashboard');
        setShowLoginModal(false);
      } else {
        setLoginError(result.message || 'Erro ao realizar login.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Erro de conexão com o servidor.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePreSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');
    
    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: data.email, 
          cpf: data.cpf, 
          mobile: data.mobile 
        })
      });

      const result = await response.json();

      if (result.status === 'success') {
        setPendingData(data);
        setShowConfirmModal(true);
      } else {
        setSubmitStatus('error');
        setErrorMessage(result.message || 'Erro ao validar dados');
      }
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage('Falha na conexão com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeSubmit = async () => {
    if (!pendingData) return;
    
    setShowConfirmModal(false);
    setIsSubmitting(true);
    setSubmitStatus('idle');
    
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...pendingData,
          ipAddress: '0.0.0.0'
        })
      });

      const result = await response.json();

      if (result.status === 'success') {
        setProtocol(result.protocolo || '');
        setSubmitStatus('success');
        reset();
        setUnidadeSearch('');
        setPendingData(null);
      } else {
        setSubmitStatus('error');
        setErrorMessage(result.message || 'Erro ao realizar cadastro');
      }
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage('Falha na conexão com o servidor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCPF = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 11);
    if (v.length <= 3) return v;
    if (v.length <= 6) return `${v.slice(0, 3)}.${v.slice(3)}`;
    if (v.length <= 9) return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
    return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9, 11)}`;
  };

  const formatPhone = (value: string) => {
    const v = value.replace(/\D/g, '').slice(0, 11);
    if (v.length <= 2) return v;
    if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7, 11)}`;
  };

  return (
    <div className="min-h-screen py-6 md:py-12 px-4 sm:px-6 lg:px-8 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-100 via-white to-slate-50">
      
      {/* Header Section */}
      <div className="max-w-4xl mx-auto mb-6 md:mb-10 text-center relative">
        {/* Admin Access Button */}
        <button 
          onClick={() => setShowLoginModal(true)}
          className="absolute -top-4 -right-4 md:top-0 md:right-0 p-3 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-400 hover:text-piaui-blue hover:shadow-md transition-all group"
          title="Área Restrita"
        >
          <Lock size={18} className="group-hover:scale-110 transition-transform" />
        </button>

        {/* LGPD Seal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center mb-6 md:mb-8"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white shadow-sm border border-emerald-100 text-emerald-700 font-bold text-[10px] md:text-xs tracking-widest uppercase mb-3">
            <ShieldCheck size={16} className="text-emerald-500" />
            Ambiente Seguro LGPD
          </div>
          <p className="text-slate-500 text-[10px] md:text-[11px] max-w-lg mx-auto leading-relaxed px-4">
            <Lock size={10} className="inline mr-1 mb-0.5" />
            Seus dados estão protegidos. Tratamos suas informações com total privacidade, em conformidade com a <strong>LGPD</strong>.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-piaui-green/10 text-piaui-green text-xs md:text-sm font-bold mb-4 md:mb-6"
        >
          <Building2 size={14} className="md:w-4 md:h-4" />
          GOVERNO DO ESTADO DO PIAUÍ
        </motion.div>
        
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-5xl mb-3 md:mb-4 px-2">
          Cadastro de Dados <span className="text-piaui-green">GEFOR</span>
        </h1>
        <p className="text-sm md:text-lg text-slate-600 max-w-2xl mx-auto px-4">
          Gerência de Formação - SEDUC-PI. Banco de dados para profissionais da educação.
        </p>
      </div>

      {/* Main Form Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl mx-auto glass-card rounded-3xl overflow-hidden"
      >
        <div className="h-2 bg-gradient-to-r from-piaui-green via-piaui-blue to-piaui-yellow" />
        
        <form onSubmit={handleSubmit(handlePreSubmit)} className="p-6 md:p-12">
          
          {/* Section 1: Personal */}
          <div className="mb-12">
            <h2 className="section-title">
              <User size={20} className="text-piaui-green" />
              Informações Pessoais
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="label-text">Nome Completo <span className="text-red-500">*</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    {...register('name')}
                    style={{ paddingLeft: '44px' }}
                    className={cn("input-field", errors.name && "border-red-500")}
                    placeholder="Seu nome completo"
                  />
                </div>
                {errors.name && <p className="mt-1 text-xs text-red-500 font-medium">{errors.name.message}</p>}
              </div>

              <div>
                <label className="label-text">WhatsApp <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    {...register('mobile')}
                    style={{ paddingLeft: '44px' }}
                    onChange={(e) => setValue('mobile', formatPhone(e.target.value))}
                    className={cn("input-field", errors.mobile && "border-red-500")}
                    placeholder="(86) 99999-9999"
                  />
                </div>
                {errors.mobile && <p className="mt-1 text-xs text-red-500 font-medium">{errors.mobile.message}</p>}
              </div>

              <div>
                <label className="label-text">E-mail <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    {...register('email')}
                    style={{ paddingLeft: '44px' }}
                    className={cn("input-field", errors.email && "border-red-500")}
                    placeholder="seu@email.com"
                  />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-500 font-medium">{errors.email.message}</p>}
              </div>

              <div>
                <label className="label-text">CPF <span className="text-red-500">*</span></label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    {...register('cpf')}
                    style={{ paddingLeft: '44px' }}
                    onChange={(e) => setValue('cpf', formatCPF(e.target.value))}
                    className={cn("input-field", errors.cpf && "border-red-500")}
                    placeholder="000.000.000-00"
                  />
                </div>
                {errors.cpf && <p className="mt-1 text-xs text-red-500 font-medium">{errors.cpf.message}</p>}
              </div>
            </div>
          </div>

          {/* Section 2: Academic */}
          <div className="mb-12">
            <h2 className="section-title">
              <GraduationCap size={20} className="text-piaui-green" />
              Formação Acadêmica
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label-text">Área de Formação Inicial <span className="text-red-500">*</span></label>
                <select {...register('areaFormacao')} className="input-field">
                  <option value="">Selecione...</option>
                  {AREAS_FORMACAO.map(area => <option key={area} value={area}>{area}</option>)}
                </select>
                {errors.areaFormacao && <p className="mt-1 text-xs text-red-500 font-medium">{errors.areaFormacao.message}</p>}
              </div>

              <div>
                <label className="label-text">Nível de Instrução <span className="text-red-500">*</span></label>
                <select {...register('nivelInstrucao')} className="input-field">
                  <option value="">Selecione...</option>
                  {NIVEIS_INSTRUCAO.map(nivel => <option key={nivel} value={nivel}>{nivel}</option>)}
                </select>
                {errors.nivelInstrucao && <p className="mt-1 text-xs text-red-500 font-medium">{errors.nivelInstrucao.message}</p>}
              </div>
            </div>
          </div>

          {/* Section 3: Professional */}
          <div className="mb-12">
            <h2 className="section-title">
              <Briefcase size={20} className="text-piaui-green" />
              Dados Profissionais
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="label-text">Função <span className="text-red-500">*</span></label>
                <select {...register('funcao')} className="input-field">
                  <option value="">Selecione...</option>
                  {FUNCOES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                {errors.funcao && <p className="mt-1 text-xs text-red-500 font-medium">{errors.funcao.message}</p>}
              </div>

              <div>
                <label className="label-text">Município <span className="text-red-500">*</span></label>
                <select {...register('municipio')} className="input-field">
                  <option value="">Selecione...</option>
                  {MUNICIPIOS_PIAUI.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {errors.municipio && <p className="mt-1 text-xs text-red-500 font-medium">{errors.municipio.message}</p>}
              </div>

              <div>
                <label className="label-text">GRE <span className="text-red-500">*</span></label>
                <select {...register('gre')} className="input-field">
                  <option value="">Selecione...</option>
                  {GRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                {errors.gre && <p className="mt-1 text-xs text-red-500 font-medium">{errors.gre.message}</p>}
              </div>

              <div className="md:col-span-2 relative unidade-container">
                <label className="label-text">Unidade de Trabalho <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    style={{ paddingLeft: '44px' }}
                    className={cn("input-field", errors.unidadeTrabalho && "border-red-500")}
                    placeholder="Pesquise sua escola ou unidade..."
                    value={unidadeSearch || selectedUnidade || ''}
                    onChange={(e) => {
                      setUnidadeSearch(e.target.value);
                      setIsUnidadeOpen(true);
                      if (e.target.value === '') setValue('unidadeTrabalho', '');
                    }}
                    onFocus={() => setIsUnidadeOpen(true)}
                  />
                  <ChevronDown className={cn("absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform", isUnidadeOpen && "rotate-180")} size={18} />
                </div>
                
                <AnimatePresence>
                  {isUnidadeOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto"
                    >
                      {filteredUnidades.length > 0 ? (
                        filteredUnidades.map((u) => (
                          <button
                            key={u}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-medium text-slate-700 border-b border-slate-50 last:border-0 flex items-center gap-2"
                            onClick={() => {
                              setValue('unidadeTrabalho', u);
                              setUnidadeSearch(u);
                              setIsUnidadeOpen(false);
                            }}
                          >
                            <Building2 size={14} className="text-piaui-blue/50" />
                            {u}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-8 text-center text-slate-400">
                          <AlertCircle className="mx-auto mb-2 opacity-20" size={32} />
                          <p className="text-sm">Nenhuma unidade encontrada</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                <input type="hidden" {...register('unidadeTrabalho')} />
                {errors.unidadeTrabalho && <p className="mt-1 text-xs text-red-500 font-medium">{errors.unidadeTrabalho.message}</p>}
              </div>

              <AnimatePresence>
                {showInep && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <label className="label-text text-piaui-green">Código INEP <span className="text-red-500">*</span></label>
                    <input 
                      {...register('inep')}
                      className="input-field border-piaui-green/30"
                      placeholder="8 dígitos"
                      maxLength={8}
                    />
                    {errors.inep && <p className="mt-1 text-xs text-red-500 font-medium">{errors.inep.message}</p>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Feedback Messages */}
          <AnimatePresence>
            {submitStatus === 'success' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-6 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col items-center gap-4 text-emerald-700 text-center"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={24} />
                  <span className="font-bold text-lg">Inscrição realizada com sucesso!</span>
                </div>
                
                {protocol && (
                  <div className="w-full p-4 bg-white/50 border border-emerald-100 rounded-xl">
                    <span className="block text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest mb-1">Protocolo de Registro</span>
                    <span className="text-2xl font-mono font-bold text-emerald-800 tracking-wider">#{protocol}</span>
                  </div>
                )}
                
                <p className="text-sm text-emerald-600">Um e-mail de confirmação foi enviado para você.</p>
              </motion.div>
            )}
            {submitStatus === 'error' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700"
              >
                <AlertCircle size={20} />
                <span className="font-medium text-sm">{errorMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={isSubmitting}
            className={cn(
              "w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all transform active:scale-[0.98]",
              isSubmitting 
                ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                : "bg-piaui-green text-white hover:bg-piaui-green/90 hover:shadow-lg hover:shadow-piaui-green/20"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={24} />
                {showConfirmModal ? "PROCESSANDO..." : "VALIDANDO..."}
              </>
            ) : (
              <>
                <Send size={20} />
                ENVIAR CADASTRO
              </>
            )}
          </button>
        </form>
      </motion.div>

      {/* Footer */}
      <footer className="mt-16 text-center text-slate-400 text-sm">
        <p>© 2026 Governo do Estado do Piauí - SEDUC-PI</p>
        <p className="mt-1">Gerência de Formação (GEFOR)</p>
      </footer>

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2 text-slate-800 font-bold">
                  <Lock size={20} className="text-piaui-blue" />
                  Acesso Restrito GEFOR
                </div>
                <button 
                  onClick={() => setShowLoginModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8">
                <p className="text-slate-500 text-sm mb-8">
                  Área exclusiva para funcionários da Gerência de Formação. Identifique-se com seu e-mail e senha para acessar o dashboard.
                </p>
                
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="label-text">E-mail</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="email"
                        required
                        style={{ paddingLeft: '44px' }}
                        className="input-field"
                        placeholder="usuario@gefor.pi.gov.br"
                        value={loginForm.email}
                        onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label-text">Senha</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="password"
                        required
                        style={{ paddingLeft: '44px' }}
                        className="input-field"
                        placeholder="••••••••"
                        value={loginForm.password}
                        onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                      />
                    </div>
                  </div>

                  {loginError && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium flex items-center gap-2">
                      <AlertCircle size={14} />
                      {loginError}
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full py-4 bg-piaui-blue text-white rounded-2xl font-bold hover:bg-piaui-blue/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoggingIn ? <Loader2 className="animate-spin" size={20} /> : <LogOut size={20} className="rotate-180" />}
                    ENTRAR NO SISTEMA
                  </button>
                </form>

                <div className="mt-6 flex items-center gap-2 text-slate-400 text-[10px] justify-center">
                  <ShieldCheck size={12} />
                  Acesso monitorado e restrito a usuários autorizados.
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && pendingData && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden my-auto"
            >
              <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2 text-piaui-blue font-bold text-sm md:text-base">
                  <Info size={20} />
                  Confirmar Informações
                </div>
                <button 
                  onClick={() => setShowConfirmModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 md:p-8 max-h-[80vh] overflow-y-auto">
                {/* Top Warning */}
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                  <p className="text-amber-800 text-[11px] md:text-xs leading-relaxed">
                    <strong>Aviso Importante:</strong> O cadastro é vinculado exclusivamente ao seu CPF. Caso os dados sejam enviados com erros, a retificação só poderá ser feita via suporte: <span className="font-bold">marcuslimav123@gmail.com</span>
                  </p>
                </div>

                <p className="text-slate-600 mb-6 text-xs md:text-sm">
                  Por favor, revise atentamente seus dados abaixo. Esta é a sua última chance de conferir antes do registro definitivo.
                </p>
                
                <div className="space-y-4 bg-slate-50 rounded-2xl p-4 md:p-6 border border-slate-100">
                  <div>
                    <span className="block text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome Completo</span>
                    <span className="text-slate-700 font-semibold text-sm md:text-base">{pendingData.name}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">WhatsApp</span>
                      <span className="text-slate-700 font-semibold text-sm md:text-base">{pendingData.mobile}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CPF</span>
                      <span className="text-slate-700 font-semibold text-sm md:text-base">{pendingData.cpf}</span>
                    </div>
                  </div>
                  <div>
                    <span className="block text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">E-mail</span>
                    <span className="text-slate-700 font-semibold text-sm md:text-base">{pendingData.email}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Unidade de Trabalho</span>
                    <span className="text-slate-700 font-semibold text-sm md:text-base">{pendingData.unidadeTrabalho}</span>
                  </div>

                  {pendingData.inep && (
                    <div className="pt-3 border-t border-slate-200">
                      <span className="block text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Código INEP</span>
                      <span className="text-piaui-blue font-bold text-base md:text-lg tracking-widest">{pendingData.inep}</span>
                      <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-red-600 text-[10px] md:text-[11px] font-bold flex items-center gap-1.5">
                          <AlertCircle size={14} />
                          ATENÇÃO: É imprescindível que o código INEP esteja correto.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-6 md:mt-8">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors text-sm md:text-base order-2 sm:order-1"
                  >
                    VOLTAR E EDITAR
                  </button>
                  <button
                    onClick={executeSubmit}
                    className="py-3 rounded-xl bg-piaui-green text-white font-bold hover:bg-piaui-green/90 shadow-lg shadow-piaui-green/20 transition-all transform active:scale-95 text-sm md:text-base order-1 sm:order-2"
                  >
                    CONFIRMAR E ENVIAR
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const [adminUser, setAdminUser] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'staff'>('stats');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({ email: '', name: '', password: '', role: 'employee' });

  useEffect(() => {
    const fetchUser = async () => {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      setAdminUser(data.user);
    };
    fetchUser();
    fetchDashboardData();
    fetchStaff();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoadingStats(true);
    try {
      const response = await fetch('/api/stats');
      const result = await response.json();
      if (result.status === 'success') {
        setDashboardData(result.data);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await fetch('/api/staff');
      const result = await response.json();
      if (result.status === 'success') {
        setStaffList(result.data);
      }
    } catch (error) {
      console.error('Erro ao buscar equipe:', error);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingStaff(true);
    try {
      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStaff)
      });
      if (response.ok) {
        setNewStaff({ email: '', name: '', password: '', role: 'employee' });
        fetchStaff();
      } else {
        const error = await response.json();
        alert(error.message);
      }
    } catch (error) {
      alert('Erro ao adicionar funcionário.');
    } finally {
      setIsAddingStaff(false);
    }
  };

  const handleDeleteStaff = async (id: number) => {
    if (!confirm('Tem certeza que deseja remover este acesso?')) return;
    try {
      await fetch(`/api/staff/${id}`, { method: 'DELETE' });
      fetchStaff();
    } catch (error) {
      alert('Erro ao remover funcionário.');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    navigate('/');
  };

  const COLORS = ['#034ea2', '#007932', '#fdb913', '#ef4444', '#8b5cf6', '#ec4899', '#f97316'];

  const chartDataFuncao = dashboardData ? Object.entries(dashboardData.porFuncao).map(([name, value]) => ({ name, value: value as number })) : [];
  const chartDataNivel = dashboardData ? Object.entries(dashboardData.porNivel).map(([name, value]) => ({ name, value: value as number })) : [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin Nav */}
      <nav className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-piaui-blue flex items-center justify-center text-white shadow-lg shadow-piaui-blue/20">
              <LayoutDashboard size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Dashboard GEFOR</h1>
              <p className="text-xs text-slate-500">Olá, {adminUser?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('stats')}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                  activeTab === 'stats' ? "bg-white text-piaui-blue shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                ESTATÍSTICAS
              </button>
              <button 
                onClick={() => setActiveTab('staff')}
                className={cn(
                  "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                  activeTab === 'staff' ? "bg-white text-piaui-blue shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                GERENCIAR EQUIPE
              </button>
            </div>
            <div className="h-8 w-px bg-slate-200 hidden md:block" />
            <button 
              onClick={() => navigate('/')}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              VOLTAR AO FORMULÁRIO
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {activeTab === 'stats' ? (
          isLoadingStats ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="animate-spin text-piaui-blue mb-4" size={48} />
              <p className="text-slate-500 font-medium">Carregando dados estratégicos...</p>
            </div>
          ) : dashboardData ? (
            <div className="space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                      <Users size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total de Inscritos</p>
                      <h3 className="text-3xl font-black text-slate-900">{dashboardData.total}</h3>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Crescimento</p>
                      <h3 className="text-3xl font-black text-slate-900">+100%</h3>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                      <MapPin size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Municípios</p>
                      <h3 className="text-3xl font-black text-slate-900">{Object.keys(dashboardData.porMunicipio).length}</h3>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Por Função */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-8">
                    <BarChart3 size={20} className="text-piaui-blue" />
                    <h3 className="font-bold text-slate-800">Distribuição por Função</h3>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartDataFuncao} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={120} fontSize={10} stroke="#94a3b8" />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" fill="#034ea2" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>

                {/* Por Nível */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-8">
                    <PieChartIcon size={20} className="text-piaui-green" />
                    <h3 className="font-bold text-slate-800">Nível de Instrução</h3>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartDataNivel}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {chartDataNivel.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} fontSize={10} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-slate-400">Nenhum dado disponível para exibição.</p>
            </div>
          )
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Add Staff Form */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm w-full md:w-1/3 h-fit"
              >
                <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <ShieldCheck size={20} className="text-piaui-blue" />
                  Autorizar Novo Acesso
                </h3>
                <form onSubmit={handleAddStaff} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nome</label>
                    <input 
                      type="text" 
                      required
                      value={newStaff.name}
                      onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-piaui-blue/20 outline-none transition-all"
                      placeholder="Ex: Marcus Lima"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">E-mail</label>
                    <input 
                      type="email" 
                      required
                      value={newStaff.email}
                      onChange={e => setNewStaff({...newStaff, email: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-piaui-blue/20 outline-none transition-all"
                      placeholder="usuario@gefor.pi.gov.br"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Senha Provisória</label>
                    <input 
                      type="password" 
                      required
                      value={newStaff.password}
                      onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-piaui-blue/20 outline-none transition-all"
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nível de Acesso</label>
                    <select 
                      value={newStaff.role}
                      onChange={e => setNewStaff({...newStaff, role: e.target.value})}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-piaui-blue/20 outline-none transition-all"
                    >
                      <option value="employee">Funcionário (Visualização)</option>
                      <option value="admin">Administrador (Gestão Total)</option>
                    </select>
                  </div>
                  <button 
                    disabled={isAddingStaff}
                    className="w-full py-3 bg-piaui-blue text-white rounded-xl font-bold text-sm hover:bg-piaui-blue/90 transition-all flex items-center justify-center gap-2"
                  >
                    {isAddingStaff ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                    AUTORIZAR ACESSO
                  </button>
                </form>
              </motion.div>

              {/* Staff List */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-3xl border border-slate-200 shadow-sm w-full md:w-2/3 overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-800">Equipe Autorizada</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 text-left">
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Funcionário</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">E-mail</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Acesso</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staffList.map((staff) => (
                        <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-700 text-sm">{staff.name}</div>
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-sm">{staff.email}</td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                              staff.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                            )}>
                              {staff.role === 'admin' ? 'Admin' : 'Funcionário'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => handleDeleteStaff(staff.id)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                              title="Remover Acesso"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
