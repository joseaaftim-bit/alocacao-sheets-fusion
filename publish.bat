@echo off
echo ==============================================================
echo        PUBLICANDO APLICATIVO NA INTERNET (CLOUDFLARE)
echo ==============================================================
echo.

echo [1/3] Preparando a versao otimizada do sistema (Build)...
call npm run build

echo.
echo [2/3] Iniciando o Servidor de Backend...
start "Servidor Principal" cmd /c "node server\server.cjs"

timeout /t 3 /nobreak >nul

echo.
echo [3/3] Criando o link temporario da Internet (Tunel)...
echo.
echo Procure na tela abaixo um link que termina com ".trycloudflare.com"
echo Esse eh o link que voce vai acessar no celular ou mandar para sua equipe!
echo.
echo Aperte CTRL+C para derrubar o site quando terminar de usar.
echo.
cloudflared.exe tunnel --url http://localhost:3000
pause
