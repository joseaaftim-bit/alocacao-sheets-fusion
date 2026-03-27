const API_URL = '/api';
let months = [];
let allocations = [];
let chartTeamInstance = null;
let chartProjectsInstance = null;
let filters = { team: 'all', role: 'all', project: '', search: '' };
let currentEditCell = null;
let projectsData = [];
let token = localStorage.getItem('token');
let currentUser = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null;

// Initialize app
async function init() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

  updateMonthsList();
  setupEventListeners();
  if (token) {
    showApp();
    await fetchData();
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-view').classList.remove('hidden');
  document.getElementById('app-wrapper').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-view').classList.add('hidden');
  document.getElementById('app-wrapper').classList.remove('hidden');
}

async function login() {
  const userBtn = document.getElementById('login-username').value;
  const passBtn = document.getElementById('login-password').value;
  const errorP = document.getElementById('login-error');
  
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userBtn, password: passBtn })
    });
    
    if (!res.ok) throw new Error('Credenciais Inválidas');
    
    const data = await res.json();
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(currentUser));
    
    errorP.style.display = 'none';
    showApp();
    await fetchData();
  } catch(err) {
    errorP.textContent = err.message;
    errorP.style.display = 'block';
  }
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showLogin();
}

async function fetchData() {
  try {
    const res = await fetch(`${API_URL}/allocations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403) {
      logout();
      return;
    }
    allocations = await res.json();
    populateRoleFilter();
    renderTableHeaders();
    renderTableBody();
    updateDashboard();
    fetchProjects();
  } catch(e) {
    console.error(e);
  }
}

function populateRoleFilter() {
  const roleSelect = document.getElementById('filter-role');
  if (!roleSelect) return;
  const roles = [...new Set(allocations.map(a => a.role))].filter(Boolean).sort();
  
  const currentVal = roleSelect.value;
  roleSelect.innerHTML = '<option value="all">Todos os Perfis</option>';
  roles.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    roleSelect.appendChild(opt);
  });
  if (roles.includes(currentVal)) roleSelect.value = currentVal;
}

function getStringHue(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash % 360;
}

function updateMonthsList() {
  const startMonthVal = document.getElementById('filter-start-month').value; 
  const durationStr = document.getElementById('filter-duration').value;
  const duration = parseInt(durationStr, 10) || 10;
  
  if (!startMonthVal) return;
  
  const parts = startMonthVal.split('-');
  let year = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  
  months = [];
  for (let i = 0; i < duration; i++) {
    const formattedMonth = String(month).padStart(2, '0') + '/' + year;
    months.push(formattedMonth);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
}

function renderTableHeaders() {
  const headRow = document.getElementById('table-head-row');
  // keep only the first 3 columns, clear the rest
  while (headRow.children.length > 3) {
    headRow.removeChild(headRow.lastChild);
  }
  
  // Add month columns dynamically
  months.forEach(m => {
    const th = document.createElement('th');
    th.textContent = m;
    headRow.appendChild(th);
  });
}

function renderTableBody() {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  
  const filtered = allocations.filter(item => {
    const matchTeam = filters.team === 'all' || item.team === filters.team;
    const matchRole = filters.role === 'all' || item.role === filters.role;
    
    // Project filter logic
    const searchProjectContent = Object.values(item.allocations).join(' ').toLowerCase();
    const matchProject = filters.project === '' || searchProjectContent.includes(filters.project.toLowerCase());
    
    // Search by professional name or role
    const searchContent = `${item.name} ${item.role}`.toLowerCase();
    const matchSearch = filters.search === '' || searchContent.includes(filters.search.toLowerCase());
    
    return matchTeam && matchProject && matchSearch;
  });

  filtered.forEach(person => {
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
      <td class="sticky-col sticky-left-1">${person.team}</td>
      <td class="sticky-col sticky-left-2">${person.role}</td>
      <td class="sticky-col sticky-left-3"><strong>${person.name}</strong></td>
    `;
    
    months.forEach(m => {
      const val = person.allocations[m] || '';
      const td = document.createElement('td');
      td.className = `cell-month ${val ? 'filled-cell' : 'empty-cell'}`;
      
      let badgeStyle = '';
      if (val) {
        const h = Math.abs(getStringHue(val));
        badgeStyle = `background: hsla(${h}, 70%, 50%, 0.15); border-color: hsla(${h}, 70%, 50%, 0.3); color: hsla(${h}, 80%, 80%, 1);`;
      }
      
      td.innerHTML = `<span class="proj-badge" style="${badgeStyle}" title="${val}">${val}</span>`;
      td.dataset.personId = person.id;
      td.dataset.month = m;
      
      td.addEventListener('click', () => {
         if(currentUser?.role === 'admin') openModal(person, m);
         else alert('Apenas administradores podem editar alocações.');
      });
      tr.appendChild(td);
    });
    
    tbody.appendChild(tr);
  });
}

function setupEventListeners() {
  // Login & Logout
  document.getElementById('btn-login').addEventListener('click', login);
  document.getElementById('login-password').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') login();
  });
  
  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) btnLogout.addEventListener('click', logout);

  // Switch Tabs
  document.getElementById('tab-table').addEventListener('click', () => switchTab('table'));
  document.getElementById('tab-dashboard').addEventListener('click', () => switchTab('dashboard'));
  document.getElementById('tab-gantt').addEventListener('click', () => switchTab('gantt'));
  document.getElementById('tab-projects').addEventListener('click', () => {
    switchTab('projects');
    fetchProjects();
  });

  // Export & Sync
  document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
    
    if (typeof Chart !== 'undefined') {
      Chart.defaults.color = next === 'dark' ? '#94a3b8' : '#475569';
      updateDashboard();
    }
  });

  document.getElementById('btn-sync-gsheets').addEventListener('click', syncGoogleSheets);
  document.getElementById('btn-export-csv').addEventListener('click', exportToCSV);
  document.getElementById('btn-export-pdf').addEventListener('click', exportToPDF);

  // Time Filters
  document.getElementById('filter-start-month').addEventListener('change', () => {
    updateMonthsList();
    renderTableHeaders();
    renderTableBody();
    renderGantt();
  });
  document.getElementById('filter-duration').addEventListener('change', () => {
    updateMonthsList();
    renderTableHeaders();
    renderTableBody();
    renderGantt();
  });

  // Filters
  document.getElementById('filter-team').addEventListener('change', (e) => {
    filters.team = e.target.value;
    renderTableBody();
    renderGantt();
  });
  
  document.getElementById('filter-role').addEventListener('change', (e) => {
    filters.role = e.target.value;
    renderTableBody();
    renderGantt();
  });
  
  document.getElementById('filter-project').addEventListener('input', (e) => {
    filters.project = e.target.value;
    renderTableBody();
    renderGantt();
  });
  
  document.getElementById('search-input').addEventListener('input', (e) => {
    filters.search = e.target.value;
    renderTableBody();
    renderGantt();
  });

  // Modal actions
  document.getElementById('close-modal').addEventListener('click', closeModal);
  document.getElementById('save-allocation').addEventListener('click', saveAllocation);
  document.getElementById('btn-batch-edit').addEventListener('click', batchEditAllocation);
  
  document.getElementById('edit-project-value').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') saveAllocation();
  });
  
  // Project Modal actions
  document.getElementById('btn-new-project')?.addEventListener('click', () => {
    document.getElementById('project-modal-title').textContent = 'Novo Projeto';
    document.getElementById('project-id-value').value = '';
    document.getElementById('project-name-value').value = '';
    document.getElementById('project-scope-value').value = '';
    document.getElementById('project-duration-value').value = '';
    document.getElementById('project-budget-value').value = '';
    document.getElementById('project-modal').classList.remove('hidden');
  });
  document.getElementById('close-project-modal')?.addEventListener('click', () => {
    document.getElementById('project-modal').classList.add('hidden');
  });
  document.getElementById('save-project')?.addEventListener('click', async () => {
    const id = document.getElementById('project-id-value').value;
    const data = {
      name: document.getElementById('project-name-value').value,
      scope: document.getElementById('project-scope-value').value,
      duration: document.getElementById('project-duration-value').value,
      budget: document.getElementById('project-budget-value').value
    };
    if(!data.name) {
      alert("Nome do projeto é obrigatório!");
      return;
    }
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/projects/${id}` : `/api/projects`;
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      if(res.ok) {
        document.getElementById('project-modal').classList.add('hidden');
        showToast("Projeto salvo!");
        fetchProjects();
      } else {
        const err = await res.json();
        alert("Erro ao salvar: " + err.error);
      }
    } catch(e) { 
      console.error(e); 
      alert("Erro de conexão com o servidor.");
    }
  });
  
  // Close on backdrop click for edit-modal
  document.getElementById('edit-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-modal') closeModal();
  });

  // Add Professional Modal actions
  document.getElementById('btn-new-professional').addEventListener('click', () => {
     if(currentUser?.role === 'admin') openAddModal();
     else alert('Apenas administradores podem adicionar profissionais.');
  });
  document.getElementById('close-add-modal').addEventListener('click', closeAddModal);
  document.getElementById('save-new-professional').addEventListener('click', saveNewProfessional);
  
  document.getElementById('new-team').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') saveNewProfessional();
  });

  // Close on backdrop click for add-modal
  document.getElementById('add-modal').addEventListener('click', (e) => {
    if (e.target.id === 'add-modal') closeAddModal();
  });
}

function openModal(person, month) {
  currentEditCell = { personId: person.id, month };
  
  const modalContext = document.getElementById('modal-context');
  modalContext.innerHTML = `Profissional: <strong>${person.name}</strong><br>Mês: <strong>${month}</strong>`;
  
  const input = document.getElementById('edit-project-value');
  input.value = person.allocations[month] || '';
  
  document.getElementById('edit-modal').classList.remove('hidden');
  input.focus();
}

function closeModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  document.getElementById('edit-project-value').value = '';
  currentEditCell = null;
}

async function saveAllocation() {
  if (!currentEditCell) return;
  const newValue = document.getElementById('edit-project-value').value.trim();
  
  try {
    const res = await fetch(`${API_URL}/allocations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        professional_id: currentEditCell.personId,
        month: currentEditCell.month,
        project: newValue
      })
    });
    
    if (res.ok) {
      const person = allocations.find(p => p.id === currentEditCell.personId);
      person.allocations[currentEditCell.month] = newValue;
      renderTableBody();
      updateDashboard();
      closeModal();
      showToast('Alocação salva com sucesso!');
    } else {
      const err = await res.json();
      alert("Erro ao salvar: " + err.error);
    }
  } catch(e) {
    alert("Erro de conexão");
  }
}

async function batchEditAllocation() {
  if (!currentEditCell) return;
  const newValue = document.getElementById('edit-project-value').value.trim();
  
  const startIndex = months.indexOf(currentEditCell.month);
  if (startIndex === -1) return;
  
  const targetMonths = months.slice(startIndex);
  
  try {
    const res = await fetch(`${API_URL}/allocations/batch`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        professional_id: currentEditCell.personId,
        targetMonths: targetMonths,
        project: newValue
      })
    });
    
    if (res.ok) {
      await fetchData();
      closeModal();
      showToast('Alocação replicada!');
    } else {
      const err = await res.json();
      alert("Erro ao replicar: " + err.error);
    }
  } catch(e) {
    alert("Erro de conexão");
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  if(msg) toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function openAddModal() {
  document.getElementById('new-name').value = '';
  document.getElementById('new-role').value = '';
  document.getElementById('new-team').value = 'ATENA';
  document.getElementById('add-modal').classList.remove('hidden');
  document.getElementById('new-name').focus();
}

function closeAddModal() {
  document.getElementById('add-modal').classList.add('hidden');
}

async function saveNewProfessional() {
  const name = document.getElementById('new-name').value.trim();
  const role = document.getElementById('new-role').value.trim();
  const team = document.getElementById('new-team').value;

  if (!name || !role) {
    alert("Por favor, preencha o Nome e o Perfil.");
    return;
  }

  try {
    const res = await fetch(`${API_URL}/professionals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ name, role, team, activeMonths: months })
    });
    
    if (res.ok) {
      await fetchData();
      closeAddModal();
      showToast("Profissional adicionado.");
    } else {
      const err = await res.json();
      alert("Erro: " + err.error);
    }
  } catch(e) {
     alert("Erro de conexão");
  }
}

function switchTab(tab) {
  document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  
  document.getElementById('data-view').classList.add('hidden');
  document.getElementById('dashboard-view').classList.add('hidden');
  document.getElementById('gantt-view').classList.add('hidden');
  const projView = document.getElementById('projects-view');
  if(projView) projView.classList.add('hidden');
  
  if (tab === 'table') {
    document.getElementById('data-view').classList.remove('hidden');
    document.querySelector('.header-filters').classList.remove('hidden');
  } else if (tab === 'dashboard') {
    document.getElementById('dashboard-view').classList.remove('hidden');
    document.querySelector('.header-filters').classList.add('hidden');
    updateDashboard();
  } else if (tab === 'gantt') {
    document.getElementById('gantt-view').classList.remove('hidden');
    document.querySelector('.header-filters').classList.remove('hidden');
    renderGantt();
  } else if (tab === 'projects') {
    if(projView) projView.classList.remove('hidden');
    document.querySelector('.header-filters').classList.add('hidden');
  }
}

function updateDashboard() {
  if (!allocations.length) return;

  const totalPros = allocations.length;
  const projectCounts = {};
  const teamCounts = {};
  let totalSlots = 0;
  let filledSlots = 0;

  allocations.forEach(p => {
    teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
    
    months.forEach(m => {
      totalSlots++;
      const proj = p.allocations[m];
      if (proj && proj.trim() !== "") {
        filledSlots++;
        const pName = proj.trim().toUpperCase();
        projectCounts[pName] = (projectCounts[pName] || 0) + 1;
      }
    });
  });

  const uniqueProjects = Object.keys(projectCounts).length;
  const occupationRate = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

  document.getElementById('metric-total-pros').textContent = totalPros;
  document.getElementById('metric-total-projects').textContent = uniqueProjects;
  document.getElementById('metric-occupation').textContent = occupationRate + "%";

  renderCharts(teamCounts, projectCounts);
}

function renderCharts(teamCounts, projectCounts) {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = 'Inter';

  // Teams Chart
  const ctxTeam = document.getElementById('chartTeam');
  if (chartTeamInstance) chartTeamInstance.destroy();
  
  chartTeamInstance = new Chart(ctxTeam, {
    type: 'doughnut',
    data: {
      labels: Object.keys(teamCounts),
      datasets: [{
        data: Object.values(teamCounts),
        backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });

  // Projects Chart
  const sortedProjects = Object.entries(projectCounts).sort((a,b) => b[1] - a[1]).slice(0, 5);
  const ctxProjects = document.getElementById('chartProjects');
  if (chartProjectsInstance) chartProjectsInstance.destroy();

  chartProjectsInstance = new Chart(ctxProjects, {
    type: 'bar',
    data: {
      labels: sortedProjects.map(p => p[0].substring(0, 15)),
      datasets: [{
        label: 'Meses Alocados',
        data: sortedProjects.map(p => p[1]),
        backgroundColor: '#3b82f6',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

async function syncGoogleSheets() {
  const btn = document.getElementById('btn-sync-gsheets');
  const originalText = btn.textContent;
  btn.textContent = "Sincronizando...";
  try {
    const res = await fetch(`${API_URL}/sync`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.ok) {
      const data = await res.json();
      showToast(data.message);
      await fetchData();
    } else {
      const err = await res.json();
      alert("Erro ao sincronizar: " + err.error);
    }
  } catch (e) {
    alert("Erro de conexão ao sincronizar.");
  } finally {
    btn.textContent = originalText;
  }
}

function exportToCSV() {
  let csvContent = "Time,Perfil,Profissional," + months.join(",") + "\n";
  allocations.forEach(p => {
    let row = `"${p.team}","${p.role}","${p.name}"`;
    months.forEach(m => {
      row += `,"${p.allocations[m] || ''}"`;
    });
    csvContent += row + "\n";
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", "alocacao_recursos.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function exportToPDF() {
  const dashboard = document.getElementById('dashboard-view');
  if (dashboard.classList.contains('hidden')) {
    alert("Mude para a aba Dashboard antes de exportar o PDF!");
    return;
  }
  
  const btn = document.getElementById('btn-export-pdf');
  const originalText = btn.textContent;
  btn.textContent = "Gerando PDF...";
  
  try {
    const canvas = await html2canvas(dashboard, {
      scale: 2,
      backgroundColor: '#0f172a'
    });
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    
    // A4 Landscape: 297 x 210 mm
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('dashboard_alocacao.pdf');
  } catch(e) {
    alert("Erro ao exportar PDF.");
  } finally {
    btn.textContent = originalText;
  }
}

// Gantt Rendering Logic
function renderGantt() {
  const container = document.getElementById('gantt-container');
  container.innerHTML = '';
  
  if (!months.length || !allocations.length) return;
  
  const projectsMap = {}; // { 'SUSTENTAÇÃO': { profs: [...] } }
  
  const filtered = allocations.filter(item => {
    const matchTeam = filters.team === 'all' || item.team === filters.team;
    const matchRole = filters.role === 'all' || item.role === filters.role;
    const searchProjectContent = Object.values(item.allocations).join(' ').toLowerCase();
    const matchProject = filters.project === '' || searchProjectContent.includes(filters.project.toLowerCase());
    const searchContent = `${item.name} ${item.role}`.toLowerCase();
    const matchSearch = filters.search === '' || searchContent.includes(filters.search.toLowerCase());
    return matchTeam && matchRole && matchProject && matchSearch;
  });

  filtered.forEach(person => {
    months.forEach((m, idx) => {
      const proj = person.allocations[m];
      if (proj && proj.trim() !== '') {
        const pName = proj.trim().toUpperCase();
        if (!projectsMap[pName]) projectsMap[pName] = {};
        if (!projectsMap[pName][person.id]) projectsMap[pName][person.id] = { name: person.name, role: person.role, indexes: [] };
        
        projectsMap[pName][person.id].indexes.push(idx); // save month index
      }
    });
  });

  Object.keys(projectsMap).sort().forEach(projName => {
    const projectGroup = document.createElement('div');
    projectGroup.className = 'gantt-project-group';
    
    const h = Math.abs(getStringHue(projName));
    projectGroup.style.borderLeft = `4px solid hsl(${h}, 70%, 50%)`;
    
    const profIds = Object.keys(projectsMap[projName]);
    
    let rowsHtml = '';
    let timelineHtml = '';
    
    profIds.forEach(pId => {
      const profData = projectsMap[projName][pId];
      const activeIndexes = profData.indexes.sort((a,b)=>a-b);
      const blocks = [];
      let currentBlock = null;
      
      activeIndexes.forEach(idx => {
        if (!currentBlock) {
          currentBlock = { start: idx, length: 1 };
        } else if (idx === currentBlock.start + currentBlock.length) {
          currentBlock.length++;
        } else {
          blocks.push(currentBlock);
          currentBlock = { start: idx, length: 1 };
        }
      });
      if (currentBlock) blocks.push(currentBlock);
      
      const tooltip = `${profData.role} - ${profData.name}`;
      rowsHtml += `<div class="gantt-name-row" title="${tooltip}">
        <span style="opacity: 0.6; font-size: 0.75rem; margin-right: 8px;">👤 [${profData.role}]</span> 
        ${profData.name}
      </div>`;
      
      let barsHtml = '';
      blocks.forEach((b, blockIdx) => {
        const leftPercent = (b.start / months.length) * 100;
        const widthPercent = (b.length / months.length) * 100;
        const startMonthStr = months[b.start];
        const endMonthStr = months[b.start + b.length - 1];
        const barTooltip = `${projName}\n${startMonthStr} até ${endMonthStr} (${b.length} mês/meses)`;
        const barText = `${b.length}m`;
        
        // Add staggering effect based on string conversion + block index
        const hash = typeof pId === 'string' ? pId.charCodeAt(0) + pId.charCodeAt(pId.length-1) : 0;
        const delay = (hash % 5) * 0.1 + blockIdx * 0.05;
        
        barsHtml += `<div class="gantt-bar" title="${barTooltip}" style="left: ${leftPercent}%; width: ${widthPercent}%; background: linear-gradient(90deg, hsl(${h}, 70%, 45%), hsl(${h}, 60%, 55%)); animation-delay: ${delay}s;">${barText}</div>`;
      });
      
      timelineHtml += `<div class="gantt-bar-row">${barsHtml}</div>`;
    });
    
    let monthHeaders = '';
    months.forEach(m => monthHeaders += `<div class="gantt-month-col">${m}</div>`);
    
    projectGroup.innerHTML = `
      <div class="gantt-project-header">
        <span>${projName}</span>
        <span style="font-size: 0.8rem; opacity: 0.7">${profIds.length} Recurso(s)</span>
      </div>
      <div class="gantt-project-body" style="--month-count: ${months.length}">
        <div class="gantt-names">
          <div class="gantt-timeline-header" style="justify-content: center; align-items: center; font-weight: 600; color: #fff;">Profissionais</div>
          ${rowsHtml}
        </div>
        <div class="gantt-timeline-area">
          <div class="gantt-timeline-header">${monthHeaders}</div>
          <div class="gantt-bars-container">${timelineHtml}</div>
        </div>
      </div>
    `;
    
    container.appendChild(projectGroup);
  });
  
  if (Object.keys(projectsMap).length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Nenhuma alocação encontrada para exibir no Gráfico de Gantt.</p>';
  }
}

// ==========================================
// PROJECT REGISTRATION LOGIC
// ==========================================
async function fetchProjects() {
  try {
    const res = await fetch('/api/projects', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Erro ao buscar projetos");
    projectsData = await res.json();
    renderProjectsTable();
    populateProjectSelects();
    
    const totalHours = projectsData.reduce((sum, p) => sum + (Number(p.budget) || 0), 0);
    const hoursEl = document.getElementById('metric-total-budget');
    if (hoursEl) hoursEl.textContent = `${totalHours.toLocaleString('pt-BR')} h`;
  } catch(e) {
    console.error(e);
  }
}

function renderProjectsTable() {
  const tbody = document.getElementById('projects-table-body');
  if(!tbody) return;
  tbody.innerHTML = '';
  projectsData.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.name}</strong></td>
      <td>${p.scope}</td>
      <td>${p.duration ? p.duration + ' meses' : '-'}</td>
      <td>${Number(p.budget || 0).toLocaleString('pt-BR')} h</td>
      <td>
        <button class="btn-secondary" onclick="editProjectModal(${p.id})" style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-right: 0.5rem;">Editar</button>
        <button class="btn-danger" onclick="deleteProject(${p.id})" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function populateProjectSelects() {
  const select = document.getElementById('edit-project-value');
  if(!select) return;
  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Selecione o Projeto Oficial --</option>';
  projectsData.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
  if(projectsData.some(p => p.name === currentVal)) {
    select.value = currentVal;
  }
}

window.editProjectModal = (id) => {
  const p = projectsData.find(x => x.id === id);
  if(!p) return;
  document.getElementById('project-modal-title').textContent = 'Editar Projeto';
  document.getElementById('project-id-value').value = p.id;
  document.getElementById('project-name-value').value = p.name;
  document.getElementById('project-scope-value').value = p.scope;
  document.getElementById('project-duration-value').value = p.duration;
  document.getElementById('project-budget-value').value = p.budget;
  document.getElementById('project-modal').classList.remove('hidden');
};

window.deleteProject = async (id) => {
  if(!confirm("Tem certeza que deseja excluir este projeto?")) return;
  try {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if(res.ok) {
      showToast("Projeto excluído!");
      fetchProjects();
    }
  } catch(e) { console.error(e); }
};

// Start app
document.addEventListener('DOMContentLoaded', init);
