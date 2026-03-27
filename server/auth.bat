@echo off
echo ==============================================================
echo        AUTORIZACAO DO GOOGLE SHEETS
echo ==============================================================
echo.
echo Isso vai abrir o navegador para você confirmar sua conta do Google.
echo.
node setupAuth.cjs
echo.
echo Se apareceu SUCESSO na tela, o token.json foi criado! Pode fechar essa janela preta.
pause
