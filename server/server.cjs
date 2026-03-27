const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

const { getProjects, addProject, updateProject, getProjectDetails, addProjectDetails, updateProjectDetails, deleteProjectDetails } = require('./googleSheetsService.cjs');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = "alocacao_pro_secret_key";

app.use(cors());
app.use(express.json());

// Request Logging Middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Users are hardcoded to simplify the setup as requested
const USERS = [
  { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
  { id: 2, username: 'viewer', password: 'viewer123', role: 'viewer' }
];

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '12h' });
  res.json({ token, user: { username: user.username, role: user.role } });
});

app.get('/api/allocations', authenticateToken, async (req, res) => {
  try {
    const rawData = await getProjects();
    
    // Map raw sheet data to the expected frontend format
    const allocations = rawData.map(row => {
      const nameKey = Object.keys(row).find(k => k.toUpperCase().includes('NOME') || k.toUpperCase().includes('PROFISSIONAL'));
      const roleKey = Object.keys(row).find(k => k.toUpperCase() === 'PERFIL' || k.toUpperCase() === 'CARGO');
      const teamKey = Object.keys(row).find(k => k.toUpperCase() === 'TIME');
      
      const allocs = {};
      Object.keys(row).forEach(k => {
        // Regex to match MM/YYYY
        if (/^\d{2}\/\d{4}$/.test(k)) {
          allocs[k] = row[k];
        }
      });
      
      return {
        id: row._rowIndex, 
        name: nameKey ? row[nameKey] : 'Desconhecido',
        role: roleKey ? row[roleKey] : '',
        team: teamKey ? row[teamKey] : '',
        allocations: allocs
      };
    }).filter(p => p.name !== 'Desconhecido' && p.name !== '');
    
    res.json(allocations);
  } catch (err) {
    console.error("ERRO em /api/allocations:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/professionals', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  
  const { name, role, team, activeMonths } = req.body;
  try {
    const rowData = {
      'PROFISSIONAL ': name,
      'PERFIL': role,
      'TIME': team
    };
    if (activeMonths) activeMonths.forEach(m => rowData[m] = '');
    
    await addProject(rowData);
    res.json({ success: true, message: "Profissional criado." });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/allocations', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  
  const { professional_id, month, project } = req.body;
  try {
    const updateData = {};
    updateData[month] = project;
    
    await updateProject(professional_id, updateData);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/allocations/batch', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  
  const { professional_id, targetMonths, project } = req.body;
  try {
    const updateData = {};
    targetMonths.forEach(m => updateData[m] = project);
    await updateProject(professional_id, updateData);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// -- PROJECTS API --
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const projects = await getProjectDetails();
    const mapped = projects.map(p => ({
      id: p._rowIndex,
      name: p['NOME DO PROJETO'] || '',
      scope: p['ESCOPO'] || '',
      duration: p['DURAÇÃO MÁXIMA'] || '',
      budget: p['TOTAL DE HORAS'] || ''
    }));
    res.json(mapped);
  } catch (err) {
    console.error("ERRO em /api/projects:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { name, scope, duration, budget } = req.body;
  try {
    await addProjectDetails({
      'NOME DO PROJETO': name,
      'ESCOPO': scope,
      'DURAÇÃO MÁXIMA': duration,
      'TOTAL DE HORAS': budget
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/projects/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  const { name, scope, duration, budget } = req.body;
  try {
    await updateProjectDetails(req.params.id, {
      'NOME DO PROJETO': name,
      'ESCOPO': scope,
      'DURAÇÃO MÁXIMA': duration,
      'TOTAL DE HORAS': budget
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    await deleteProjectDetails(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync from Google Sheets (Dummy route to satisfy frontend for now)
app.post('/api/sync', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  try {
    // In Sheets Fusion, synchronization is live, so we just return success
    // Or we could trigger a fetch here if there were a cache.
    res.json({ success: true, message: "Sincronizado via Sheets com Sucesso (Live Mode)!" });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve static files in production
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback logic for SPA
app.use((req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("ERRO ao servir index.html:", err.message);
      res.status(404).send("Frontend não encontrado no diretório 'dist'.");
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server rodando na porta ${PORT} (Google Sheets Integration)`);
});
