@echo off
echo ==============================================================
echo        INICIANDO O SISTEMA: ALOCACAO DE RECURSOS PRO
echo ==============================================================
echo.

echo [1/2] Iniciando o Servidor de Banco de Dados (Backend API)...
start "Backend - Alocacao PRO" cmd /c "node server\server.cjs"

timeout /t 2 /nobreak >nul

echo [2/2] Iniciando a Interface do Usuario (Vite)...
start "Frontend - Alocacao PRO" cmd /k "npm run dev"

echo.
echo Tudo iniciado! 
echo Procure na janela "Frontend" qual foi o link gerado (ex: http://localhost:5173).
echo Mantenha as janelas pretas abertas enquanto estiver usando o sistema.
echo.
pause
