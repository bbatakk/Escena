# Producte · Escena

## Objectiu

Una banda gestiona tota la informació d'un concert, des de l'acord fins al cobrament, i veu d'un cop d'ull **nom, data, ubicació i coses pendents**. Els concerts poden ser molt diferents: cap apartat opcional no ha de forçar un procés fix.

## Decisions acordades

- Prova inicial amb una banda i un compte compartit, sense permisos per rols. El model separa dades per banda perquè altres bandes puguin tenir el seu espai més endavant.
- La logística admet tant un punt de trobada com desplaçaments individuals; no imposa una manera de viatjar.
- Web responsive accessible des de mòbil per URL pública. Offline selectiu previst, especialment consulta de dades pràctiques i càrrega de material.
- Tresoreria: registre intern de cobraments/despeses per concert i generals; sense emissió de factures.

## Primer lliurable implementat

Accés amb Supabase quan està configurat; demo local si no. Llista i calendari; crear, editar i eliminar concerts; fitxa amb acord, contactes, horaris, logística, hospitalitat, documents com a enllaços/estat i fitxers privats adjunts, apartats separats de persones, material i setlists reutilitzables, biblioteca de documents, tresoreria bàsica, catàleg de marxandatge amb talles i estoc per variant, venda ràpida per concert, material marcable, acreditacions i imports-resum; pendents derivats. També inclou un taller de cançons en procés amb lletra, notes, fases i versions d’àudio privades, separat dels setlists i sense convertir-se en una discografia. La banda pot crear enllaços privats d’escolta només de lectura, triar si comparteix la lletra i les notes de treball, i revocar-los; cada enllaç mostra les versions actuals de les cançons seleccionades. RLS de banda a les migracions SQL.

## Següents lliurables

1. Retirar gradualment els camps de tancament antics quan totes les bandes facin servir els moviments reals. La fitxa ja calcula un balanç sense duplicar catxet, vendes detallades ni moviments manuals.
2. Ampliar la PWA offline als documents i fitxers d’àudio, i reforçar la resolució de conflictes concurrents. Ja es mostren els canvis pendents/error, i la cua inclou concerts, tresoreria, marxandatge, recursos de banda i metadades de cançons.
3. Comptes individuals, invitacions i permisos si l'ús real ho justifica.
La migració 007 deixa preparats `role` a `band_members` i `band_invitations`, però la UI continua deliberadament amb compte compartit. No s'han d'activar permisos parcials sense dissenyar abans el flux d'invitació, acceptació i recuperació de compte.

No representar les funcions dels següents lliurables com si ja estiguessin acabades.
