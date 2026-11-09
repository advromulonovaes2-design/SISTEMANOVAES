@echo off
REM ==================================================================
REM  PLANO B: rodar o robô no seu computador (Windows), caso o DJEN
REM  bloqueie o GitHub. Copie este arquivo e a robo.py para uma pasta
REM  do seu computador (ex.: Documentos\robo), preencha abaixo e salve.
REM  ATENÇÃO: depois de preenchido, NUNCA envie este arquivo ao GitHub.
REM ==================================================================
set SUPABASE_URL=COLE-AQUI-A-PROJECT-URL
set SUPABASE_SERVICE_KEY=COLE-AQUI-A-CHAVE-SECRETA
set TELEGRAM_TOKEN=
set GMAIL_USER=
set GMAIL_APP_PASSWORD=
set ALERTA_EMAIL=
set APP_URL=
rem Para o aviso no celular: cole a chave secreta gerada em Ajustes e rode uma vez "pip install cryptography"
set VAPID_PRIVATE=
set MODO=manha
cd /d "%~dp0"
python robo.py >> robo-log.txt 2>&1
