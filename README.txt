================================================================================
  PORTAL CZYTELNIKA BIBLIOTEKI ŁSW  —  samodzielny pakiet
  Działa z aplikacją desktop „Biblioteka LSW” (Biblioteka-LSW.exe)
================================================================================

CO TO JEST
----------
Serwer WWW + strona katalogu i logowania czytelników.
Aplikacja na komputerze biblioteki WYSYŁA do tego serwera:
  • wszystkie książki
  • wypożyczenia
  • loginy i hasła z kart czytelników

Po synchronizacji portal pokazuje aktualny stan bez Twojego udziału.


WYMAGANIA
---------
1. Node.js 18+  —  https://nodejs.org  (wersja LTS)
2. Aplikacja Biblioteka LSW zainstalowana na komputerze biblioteki
3. Ten sam komputer ALBO serwer w sieci / w internecie, do którego aplikacja
   ma dostęp (HTTP)


URUCHOMIENIE (Windows)
----------------------
1. Rozpakuj ten folder gdzie chcesz, np. C:\portal-lsw

2. Otwórz CMD w tym folderze i ustaw tajny klucz (wymysl mocny ciąg znaków):

     set SYNC_KEY=moj-tajny-klucz-2026
     node server.js

   Albo kliknij dwukrotnie:  start-windows.bat
   (najpierw edytuj plik start-windows.bat i wpisz swój klucz)

3. W konsoli zobaczysz adresy, np.:
     Lokalnie:   http://127.0.0.1:8787/
     W sieci:    http://192.168.1.20:8787/

4. Otwórz przeglądarkę i sprawdź katalog.


PODŁĄCZENIE APLIKACJI DESKTOP
-----------------------------
1. Uruchom Biblioteka LSW
2. Wejdź w zakładkę:  Ważne  →  Portal internetowy
3. Adres strony portalu:
     http://IP-KOMPUTERA:8787
   (ten sam adres co w konsoli serwera; bez ukośnika na końcu)
4. Klucz synchronizacji:
     DOKŁADNIE ten sam tekst co SYNC_KEY
5. Kliknij „Zapisz i połącz”, potem „Synchronizuj teraz”

Od tej pory:
  • zmiana książki w aplikacji → po chwili widać na portalu
  • nowa karta / reset hasła → login działa na stronie
  • wypożyczenia aktualizują dostępność egzemplarzy


LOGOWANIE CZYTELNIKA
--------------------
Login i hasło są generowane / ustawiane w aplikacji (karta czytelnika).
Czytelnik wchodzi na portal → „Zaloguj się” → te dane.


PORT / HOST
-----------
Domyślny port: 8787
Zmiana:

  set PORT=9000
  set SYNC_KEY=...
  node server.js


UDOSTĘPNIENIE W INTERNECIE
--------------------------
Jeśli portal ma działać poza siecią lokalną:
  • wystaw ten serwer na VPS / hosting Node, ALBO
  • użyj tunelu (np. Cloudflare Tunnel, ngrok) na port 8787
  • w aplikacji wklej publiczny adres HTTPS zamiast IP lokalnego
  • SYNC_KEY musi pozostać tajny


PLIKI DANYCH
------------
data/portal.json  —  kopia katalogu, wypożyczeń i kont po synchronizacji
Możesz robić kopię zapasową tego pliku.


SPRAWDZENIE
-----------
http://127.0.0.1:8787/api/health
powinno zwrócić JSON z liczbą książek i "syncKeySet": true


PROBLEMY
--------
• „Nieprawidłowy klucz synchronizacji” — SYNC_KEY ≠ klucz w aplikacji
• Pusty katalog — jeszcze nie było udanej synchronizacji z aplikacji
• Aplikacja nie łączy się — firewall Windows blokuje port 8787;
  dodaj regułę przychodzącą dla node.exe / portu 8787
• Logowanie nie działa — upewnij się, że karty mają portalLogin/hasło
  w aplikacji i że sync przeszedł (sprawdź /api/health → cards > 0)

================================================================================
  Nie wymaga bazy danych, npm install ani konta w chmurze.
  Wystarczy:  Node.js + ten folder + klucz + aplikacja desktop.
================================================================================
