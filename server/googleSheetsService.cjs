const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const TOKEN_PATH = path.join(__dirname, 'token.json');

async function getAuthClient() {
  try {
    // 1. Try environment variable first (for Railway/Production)
    if (process.env.GOOGLE_TOKEN_JSON) {
      const credentials = JSON.parse(process.env.GOOGLE_TOKEN_JSON);
      return google.auth.fromJSON(credentials);
    }

    // 2. Try local token.json file
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    console.error("ERRO: Token de autenticação não encontrado.");
    console.error("Certifique-on de que GOOGLE_TOKEN_JSON está definido no Railway ou que 'token.json' existe localmente.");
    throw err;
  }
}

async function getSheetsInstance() {
  const authClient = await getAuthClient();
  return google.sheets({ version: 'v4', auth: authClient });
}

async function getProjects() {
  const sheets = await getSheetsInstance();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A:Z', 
  });
  
  const rows = response.data.values;
  if (!rows || rows.length === 0) return [];

  const headers = rows[0];
  const projects = rows.slice(1).map((row, index) => {
    let rowData = { _rowIndex: index + 2 }; 
    headers.forEach((header, i) => {
      rowData[header.trim()] = row[i] || ''; 
    });
    return rowData;
  });

  return projects;
}

async function addProject(projectData) {
  const sheets = await getSheetsInstance();
  
  const getRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '1:1', 
  });
  
  const headers = getRes.data.values ? getRes.data.values[0] : [];
  const rowValues = headers.map(header => projectData[header.trim()] || '');

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'A:A',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowValues] },
  });
  
  return { success: true, response: response.data };
}

async function updateProject(rowIndex, projectData) {
  const sheets = await getSheetsInstance();
  
  // 1. Get headers
  const getHeadersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '1:1',
  });
  const headers = getHeadersRes.data.values ? getHeadersRes.data.values[0] : [];
  
  // 2. Get the specific row
  const getRowRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `A${rowIndex}:Z${rowIndex}`,
  });
  const currentRowValues = getRowRes.data.values ? getRowRes.data.values[0] : [];

  // 3. Merge old values with new ones
  const rowValues = headers.map((header, index) => {
    const trimmedHeader = header.trim();
    if (projectData[trimmedHeader] !== undefined) {
      return projectData[trimmedHeader];
    }
    return currentRowValues[index] || '';
  });

  // 4. Update row
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `A${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowValues] },
  });

  return { success: true, response: response.data };
}

async function getProjectDetails() {
  const sheets = await getSheetsInstance();
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Projetos!A:Z', 
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) return [];
    const headers = rows[0];
    return rows.slice(1).map((row, index) => {
      let rowData = { _rowIndex: index + 2 }; 
      headers.forEach((header, i) => {
        // Normalizing to uppercase for internal mapping
        rowData[header.trim().toUpperCase()] = row[i] || ''; 
      });
      return {
        _rowIndex: rowData._rowIndex,
        'NOME DO PROJETO': rowData['NOME DO PROJETO'] || rowData['NOME'] || rowData['PROJETO'] || '',
        'ESCOPO': rowData['ESCOPO'] || '',
        'DURAÇÃO MÁXIMA': rowData['DURAÇÃO MÁXIMA'] || rowData['DURACAO MAXIMA'] || '',
        'TOTAL DE HORAS': rowData['TOTAL DE HORAS'] || rowData['ORÇAMENTO'] || rowData['ORCAMENTO'] || rowData['HORAS'] || ''
      };
    }).filter(p => p['NOME DO PROJETO'] !== ''); 
  } catch (err) {
    if (err.message.includes('Unable to parse range')) {
      console.warn("AVISO: Aba 'Projetos' não encontrada na planilha. Retornando lista vazia.");
      return [];
    }
    throw err;
  }
}

async function addProjectDetails(projectData) {
  const sheets = await getSheetsInstance();
  const getRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Projetos!1:1', 
  });
  
  let headers = getRes.data.values ? getRes.data.values[0] : [];
  
  if (headers.length === 0) {
    // If table is empty, create headers first
    headers = ['NOME DO PROJETO', 'ESCOPO', 'DURAÇÃO MÁXIMA', 'TOTAL DE HORAS'];
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Projetos!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] },
    });
  }

  const rowValues = headers.map(header => {
    const key = header.trim().toUpperCase();
    return projectData[key] || '';
  });
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Projetos!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowValues] },
  });
  return { success: true, response: response.data };
}

async function updateProjectDetails(rowIndex, projectData) {
  const sheets = await getSheetsInstance();
  const getHeadersRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Projetos!1:1',
  });
  const headers = getHeadersRes.data.values ? getHeadersRes.data.values[0] : [];
  const getRowRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `Projetos!A${rowIndex}:Z${rowIndex}`,
  });
  const currentRowValues = getRowRes.data.values ? getRowRes.data.values[0] : [];
  const rowValues = headers.map((header, index) => {
    const key = header.trim().toUpperCase();
    if (projectData[key] !== undefined) {
      return projectData[key];
    }
    return currentRowValues[index] || '';
  });
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Projetos!A${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowValues] },
  });
  return { success: true, response: response.data };
}

async function deleteProjectDetails(rowIndex) {
  const sheets = await getSheetsInstance();
  const response = await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `Projetos!A${rowIndex}:Z${rowIndex}`,
  });
  return { success: true, response: response.data };
}

module.exports = {
  getProjects,
  addProject,
  updateProject,
  getProjectDetails,
  addProjectDetails,
  updateProjectDetails,
  deleteProjectDetails
};
