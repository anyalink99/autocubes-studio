export type EmployeeExperience = {
  id: string;
  role: string;
  company: string;
  period: string;
  duration: string;
  description: string;
  achievements: string[];
  stack: string;
};

export type EmployeeProfileData = {
  name: string;
  role: string;
  joined: string;
  teamStatus: string;
  summary: string;
  phone: string;
  email: string;
  location: string;
  experienceTotal: string;
  focus: string;
  skills: string[];
  languages: Array<{name: string; level: string}>;
  education: string;
  photo: string;
  experiences: EmployeeExperience[];
};

export const defaultEmployeeProfile: EmployeeProfileData = {
  name: 'Антон Тараканов',
  role: 'Fullstack Developer',
  joined: 'С декабря 2025',
  teamStatus: 'Участник команды Autocubes',
  summary: 'В Autocubes Антон отвечает за продуктовую веб-разработку полного цикла — от уточнения требований и архитектуры до релиза, поддержки и улучшения пользовательского опыта.',
  phone: '+7 925 939-40-00',
  email: 'abstractwebdeveloper@gmail.com',
  location: 'Санкт-Петербург, Россия',
  experienceTotal: '4+ года',
  focus: 'От требований до поддержки',
  skills: ['Vue 3', 'TypeScript', 'Node.js', 'NestJS', 'PostgreSQL', 'Pinia', 'Angular', 'RxJS', 'Docker', 'CI/CD', 'Git'],
  languages: [{name: 'Русский', level: 'Родной'}, {name: 'Английский', level: 'B2 · Средне-продвинутый'}],
  education: 'Среднее образование',
  photo: '/assets/team/anton-tarakanov.png',
  experiences: [
    {
      id: 'agentapp', role: 'Fullstack Developer', company: 'agentapp', period: '08.2024 — 12.2025', duration: '1 год 5 месяцев',
      description: '',
      achievements: [
        'Разрабатывал функциональность полного цикла на Vue 3, TypeScript и Pinia.',
        'Проектировал и реализовывал REST API на Node.js/NestJS, работал с PostgreSQL и интеграциями.',
        'Вёл задачи end-to-end: требования, frontend/backend, релиз и дальнейшая поддержка.',
        'Участвовал в code review, CI/CD-процессах и контейнеризации через Docker.',
      ],
      stack: 'Vue 3 · TypeScript · Pinia · Node.js · NestJS · PostgreSQL · REST API · Docker',
    },
    {
      id: '4irelabs-frontend', role: 'Frontend Developer', company: '4irelabs', period: '01.2022 — 05.2024', duration: '2 года 5 месяцев',
      description: 'Разработка продукта commercetools и внутренней образовательной платформы.',
      achievements: [
        'Улучшил Web Vitals и скорость загрузки продуктовых страниц.',
        'Перевёл проект с Angular 12 на Angular 15.',
        'После запуска новой продуктовой функции MAU вырос на 20%, DAU — на 5%.',
      ],
      stack: 'Angular 12–15 · RxJS · NgRx · TypeScript · .NET',
    },
    {
      id: '4irelabs-solidity', role: 'Solidity Developer', company: '4irelabs', period: '10.2021 — 01.2022', duration: '4 месяца',
      description: '',
      achievements: [
        'Разрабатывал смарт-контракты для EVM-сетей и внутреннюю систему выплат на ERC-20.',
        'Оптимизировал интерфейс, стоимость транзакций и конструкцию контрактов.',
      ],
      stack: 'Solidity · TypeScript · Web3.js',
    },
  ],
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const assetUrl = (value: string, base = '') => /^https?:|^data:/i.test(value) ? value : `${base}${value.startsWith('/') ? value : `/${value}`}`;
const logo = '<svg viewBox="0 0 1040 1040" aria-label="Autocubes"><path fill-rule="evenodd" d="M633 1040H257a30 30 0 0 1-30-30V257a30 30 0 0 1 30-30h409a30 30 0 0 0 30-30v-44a30 30 0 0 0-30-30H153a30 30 0 0 0-30 30v630a30 30 0 0 1-30 30H30a30 30 0 0 1-30-30V30A30 30 0 0 1 30 0h753a30 30 0 0 1 30 30v753a30 30 0 0 1-30 30H374a30 30 0 0 0-30 30v44a30 30 0 0 0 30 30h513a30 30 0 0 0 30-30V257a30 30 0 0 1 30-30h63a30 30 0 0 1 30 30v753a30 30 0 0 1-30 30ZM519 349h141a30 30 0 0 1 30 30v282a30 30 0 0 1-30 30H379a30 30 0 0 1-30-30V379a30 30 0 0 1 30-30Z" fill="currentColor"/></svg>';

export const renderEmployeeProfileHtml = (profile: EmployeeProfileData, base = '') => {
  const [firstName, ...lastName] = profile.name.trim().split(/\s+/);
  const experience = profile.experiences.map((job) => `<article class="job"><div class="date">${escapeHtml(job.period)}<span>${escapeHtml(job.duration)}</span></div><div><div class="job-head"><h3>${escapeHtml(job.role)}</h3><b>${escapeHtml(job.company)}</b></div>${job.description ? `<p>${escapeHtml(job.description)}</p>` : ''}<ul>${job.achievements.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><small>${escapeHtml(job.stack)}</small></div></article>`).join('');
  const skills = profile.skills.map((skill, index) => `<i class="${index === 0 ? 'accent' : ''}">${escapeHtml(skill)}</i>`).join('');
  const languages = profile.languages.map((language) => `<p><strong>${escapeHtml(language.name)}</strong>${escapeHtml(language.level)}</p>`).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(profile.name)} — Autocubes</title><style>
  *{box-sizing:border-box}html,body{margin:0;background:#fff;color:#0a0a09;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:0}.page{position:relative;width:210mm;height:297mm;padding:12mm 13mm 10mm;overflow:hidden;background:#f2f2ed}.top{display:flex;align-items:center;justify-content:space-between;font-size:6.2pt;font-weight:700;letter-spacing:.13em;text-transform:uppercase}.brand{display:flex;align-items:center;gap:2.4mm}.brand svg{width:4mm;height:4mm;color:#ff4e2f}.hero{display:grid;grid-template-columns:1fr 43mm;gap:10mm;align-items:end;margin-top:8mm;min-height:49mm}.hero h1{margin:0 0 4mm;font-size:43pt;font-weight:800;line-height:.89;letter-spacing:-.055em}.role{display:flex;align-items:center;gap:4mm;margin:0;font-size:12pt;font-weight:700}.role:before{width:13mm;height:.8mm;background:#ff4e2f;content:""}.photo{width:43mm;height:49mm;object-fit:cover;object-position:50% 18%;border:.35mm solid #0a0a09;background:#d8d9d5}.rule{height:.35mm;margin:8mm 0 0;background:#0a0a09}.layout{position:absolute;top:88mm;right:13mm;left:13mm;display:grid;grid-template-columns:1fr 48mm;gap:10mm}.eyebrow,.side h2{margin:0 0 2.5mm;color:#6d6d66;font-size:6.2pt;font-weight:700;letter-spacing:.13em;text-transform:uppercase}.summary{margin:0 0 7mm;font-size:11pt;font-weight:700;line-height:1.3;letter-spacing:-.015em}.section-title{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 4mm;padding-bottom:2.2mm;border-bottom:.3mm solid #0a0a09;font-size:13pt;font-weight:800}.section-title span{color:#ff4e2f;font-size:6.2pt;letter-spacing:.1em;text-transform:uppercase}.job{display:grid;grid-template-columns:27mm 1fr;gap:5mm;margin:0 0 5mm;padding:0 0 5mm;border-bottom:.25mm solid #b9b9b2}.job:last-child{margin:0;padding:0;border:0}.date{color:#6d6d66;font-size:6.8pt;font-weight:700;line-height:1.35;text-transform:uppercase}.date span{display:block;margin-top:1.5mm;color:#0a0a09;font-weight:400;text-transform:none}.job-head{display:flex;justify-content:space-between;align-items:baseline;gap:3mm;margin-bottom:2mm}.job h3{margin:0;font-size:11.2pt}.job-head b{color:#ff4e2f;font-size:7pt;letter-spacing:.05em;text-transform:uppercase}.job p,.job li{font-size:7.8pt;line-height:1.38}.job p{margin:0 0 1.5mm}.job ul{margin:0;padding:0;list-style:none}.job li{position:relative;padding-left:4mm}.job li:before{position:absolute;left:0;color:#ff4e2f;font-weight:800;content:"→"}.job small{display:block;margin-top:2mm;color:#6d6d66;font-size:6.6pt;font-weight:700}.side{padding-left:5mm;border-left:.35mm solid #0a0a09}.side section{margin-bottom:5.5mm;padding-bottom:4.5mm;border-bottom:.25mm solid #b9b9b2}.side section:last-child{border:0}.side p{margin:0 0 2mm;font-size:7.4pt;line-height:1.35;overflow-wrap:anywhere}.side p strong{display:block;font-size:8pt}.metric strong{color:#ff4e2f!important;font-size:24pt!important;line-height:.95}.metric span{font-size:6.8pt;font-weight:700;text-transform:uppercase}.tags{display:flex;flex-wrap:wrap;gap:1.5mm}.tags i{padding:1.25mm 1.6mm 1.1mm;background:#0a0a09;color:#f2f2ed;font-size:6.3pt;font-style:normal;font-weight:700;line-height:1}.tags .accent{background:#ff4e2f}.foot{position:absolute;right:13mm;bottom:7mm;left:13mm;display:flex;justify-content:space-between;padding-top:2.2mm;border-top:.3mm solid #0a0a09;font-size:6.2pt;font-weight:700;letter-spacing:.13em;text-transform:uppercase}.foot b{color:#ff4e2f}@media print{html,body{background:transparent}}
  </style></head><body><main class="page"><header><div class="top"><div class="brand">${logo}<span>Autocubes / Команда</span></div><span>Employee profile</span></div><div class="hero"><div><h1>${escapeHtml(firstName)}<br>${escapeHtml(lastName.join(' '))}</h1><p class="role">${escapeHtml(profile.role)} · Autocubes</p></div><img class="photo" src="${escapeHtml(assetUrl(profile.photo, base))}" alt="${escapeHtml(profile.name)}"></div><div class="rule"></div></header><div class="layout"><section><p class="eyebrow">Роль в команде</p><p class="summary">${escapeHtml(profile.summary)}</p><h2 class="section-title">Профессиональный бэкграунд <span>${escapeHtml(profile.experienceTotal)}</span></h2>${experience}</section><aside class="side"><section><h2>Связь</h2><p>${escapeHtml(profile.phone)}</p><p>${escapeHtml(profile.email)}</p><p>${escapeHtml(profile.location)}</p></section><section><h2>В Autocubes</h2><p><strong>${escapeHtml(profile.joined)}</strong>${escapeHtml(profile.teamStatus)}</p><p><strong>${escapeHtml(profile.role)}</strong>Frontend + Backend</p></section><section><h2>Фокус</h2><p class="metric"><strong>${escapeHtml(profile.experienceTotal.replace(/\s*года?$/i, ''))}</strong><span>коммерческой разработки</span></p><p class="metric"><strong>E2E</strong><span>${escapeHtml(profile.focus)}</span></p></section><section><h2>Основной стек</h2><div class="tags">${skills}</div></section><section><h2>Языки и база</h2>${languages}<p><strong>Образование</strong>${escapeHtml(profile.education)}</p></section></aside></div><footer class="foot"><span>${escapeHtml(profile.name)} · Команда Autocubes</span><b>autocubes.site</b></footer></main></body></html>`;
};
