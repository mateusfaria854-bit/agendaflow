import { useEffect, useState } from 'react';
import { APP_NAME, type HealthResponse } from '@agendaflow/shared';
import Portal from './features/portal/Portal.js';

type ApiStatus = 'checking' | 'online' | 'offline';

const features = [
  { number: '01', title: 'Contas e acesso', text: 'Cadastro, login e permissões por perfil.' },
  { number: '02', title: 'Serviços e profissionais', text: 'Catálogo de atendimentos, duração e especialidades.' },
  { number: '03', title: 'Disponibilidade', text: 'Expedientes, pausas, bloqueios e horários livres.' },
  { number: '04', title: 'Reservas', text: 'Agendar, acompanhar e cancelar com proteção contra conflitos.' },
  { number: '05', title: 'Gestão e indicadores', text: 'Visão do negócio, operação diária e relatórios.' },
];

const roadmap = [
  { phase: '00', name: 'Fundação técnica', summary: 'Monorepo, API, React, PostgreSQL, testes e SDD.', current: false },
  { phase: '01', name: 'Identidade e catálogo', summary: 'Cadastro, login, serviços e profissionais conectados à API.', current: false },
  { phase: '02', name: 'Agenda disponível', summary: 'Expedientes, bloqueios e horários válidos calculados pela API.', current: true },
  { phase: '03', name: 'Reserva ponta a ponta', summary: 'Agendar, listar e cancelar sem dupla reserva.', current: false },
  { phase: '04', name: 'Operação administrativa', summary: 'Painel, calendário e gestão da equipe.', current: false },
  { phase: '05', name: 'Qualidade e publicação', summary: 'Acessibilidade, testes E2E e deploy.', current: false },
];

function App() {
  const [api, setApi] = useState<ApiStatus>('checking');
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/v1/health', { signal: abort.signal })
      .then(async response => {
        if (!response.ok) throw new Error('API indisponível');
        const data = (await response.json()) as HealthResponse;
        setApi(data.service === 'agendaflow-api' && data.status === 'ok' ? 'online' : 'offline');
      })
      .catch(() => { if (!abort.signal.aborted) setApi('offline'); });
    return () => abort.abort();
  }, []);

  return (
    <div className="app">
      <div className="top-glow" aria-hidden="true" />
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="AgendaFlow, início">
          <span className="brand-mark">A<span className="brand-dot">.</span></span>
          <span>{APP_NAME}</span>
        </a>
        <nav aria-label="Navegação principal" className="nav-links">
          <a href="#visao">Visão geral</a>
          <a href="#modulos">Módulos</a>
          <a href="#portal">Entrar / cadastrar</a>
          <a href="#horarios">Horários</a>
          <a href="#etapas">Roadmap</a>
        </nav>
        <a className="github-link" href="https://github.com/mateusfaria854-bit/agendaflow"
          target="_blank" rel="noopener noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      </header>

      <main id="inicio">
        <section className="hero section-wrap" id="visao">
          <div className="hero-copy">
            <div className="eyebrow"><span className="pulse" /> EM DESENVOLVIMENTO <span className="eyebrow-separator">/</span> FASE 02</div>
            <h1>O próximo horário.<br/><em>Uma experiência melhor.</em></h1>
            <p>Uma plataforma de agendamentos planejada para simplificar a rotina de clientes e equipes. Construída por etapas, com arquitetura clara e validações no servidor.</p>
            <div className="hero-actions">
              <a className="button-primary" href="#portal">Explorar catálogo <span aria-hidden="true">↗</span></a>
              <a className="button-ghost" href="#modulos">Conhecer o escopo <span aria-hidden="true">→</span></a>
            </div>
            <div className="hero-meta">
              <span><strong>React</strong> + TypeScript</span>
              <span className="meta-dot">•</span>
              <span><strong>Node.js</strong> + PostgreSQL</span>
              <span className="meta-dot">•</span>
              <span>Spec-Driven Development</span>
            </div>
          </div>
          <div className="preview" aria-label="Prévia conceitual da interface, ainda não funcional">
            <div className="preview-topbar">
              <div className="window-dots"><i/><i/><i/></div>
              <span>agenda / prévia de interface</span>
              <span className="preview-icon">◈</span>
            </div>
            <div className="preview-content">
              <div className="preview-label">SEU ESPAÇO DE TEMPO</div>
              <div className="preview-title">Uma semana organizada.</div>
              <div className="preview-summary">A estrutura visual é ilustrativa. Os horários disponíveis são calculados na Fase 2, mas as reservas entram na Fase 3.</div>
              <div className="preview-week">
                {[
                  { day: 'SEG', date: '23', busy: false },
                  { day: 'TER', date: '24', busy: false },
                  { day: 'QUA', date: '25', busy: true },
                  { day: 'QUI', date: '26', busy: false },
                  { day: 'SEX', date: '27', busy: false },
                ].map((date) => (
                  <div className={date.busy ? 'preview-day selected' : 'preview-day'} key={date.date}>
                    <span>{date.day}</span><strong>{date.date}</strong>
                  </div>
                ))}
              </div>
              <div className="preview-times">
                <span>09:00</span><span className="active-slot">10:30</span><span>11:00</span><span>14:00</span>
              </div>
              <div className="preview-status">
                <span className="status-icon">✳</span>
                <div><strong>Agenda sem conflitos.</strong><small>Integridade de horários garantida pelo banco na futura API.</small></div>
              </div>
            </div>
            <div className="preview-footer"><span>PRÉVIA CONCEITUAL</span><span>01 / 05</span></div>
          </div>
        </section>

        <section className="section-wrap modules-section" id="modulos">
          <div className="section-heading">
            <div><span className="section-tag">/ O PRODUTO</span><h2>O essencial, bem construído.</h2></div>
            <p>Do cadastro à confirmação, cada módulo terá responsabilidades e regras verificáveis antes de entrar em produção.</p>
          </div>
          <div className="feature-grid">{features.map(feature => (
            <article className="feature-card" key={feature.number}>
              <span className="feature-number">{feature.number}</span>
              <h3>{feature.title}</h3><p>{feature.text}</p>
            </article>
          ))}</div>
        </section>

        <Portal />

        <section className="roadmap-section" id="etapas">
          <div className="section-wrap">
            <div className="section-heading"><div><span className="section-tag">/ CONSTRUÇÃO</span><h2>Um produto. Etapa por etapa.</h2></div>
              <p>O desenvolvimento segue especificações, planejamento técnico, tarefas pequenas e testes automatizados.</p></div>
            <div className="timeline">{roadmap.map(step => (
              <div className={step.current ? 'timeline-item active' : 'timeline-item'} key={step.phase}>
                <span className="timeline-index">{step.phase}</span>
                <div className="timeline-body"><h3>{step.name}</h3><p>{step.summary}</p></div>
                <span className="timeline-state">{step.current ? 'EM CONSTRUÇÃO' : 'PLANEJADO'}</span>
              </div>
            ))}</div>
          </div>
        </section>
      </main>

      <footer className="site-footer section-wrap">
        <div><span className="footer-brand">AgendaFlow</span><p>Planejamento e desenvolvimento por Mateus Faria Andrade · Engenharia de Software, UniRV.</p></div>
        <div className="api-status" role="status">
          <span className={api === 'online' ? 'status-light on' : 'status-light'} />
          {api === 'checking' ? 'Verificando API...' : api === 'online' ? 'API local conectada' : 'API local não iniciada'}
        </div>
      </footer>
    </div>
  );
}

export default App;
