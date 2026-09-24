# Producte · Escena

## Objectiu

Una banda gestiona tota la informació d'un concert, des de l'acord fins al cobrament, i veu d'un cop d'ull **nom, data, ubicació i coses pendents**. Els concerts poden ser molt diferents: cap apartat opcional no ha de forçar un procés fix.

## Decisions acordades

- Prova inicial amb una banda i un compte compartit, sense permisos per rols. El model separa dades per banda perquè altres bandes puguin tenir el seu espai més endavant.
- La logística admet tant un punt de trobada com desplaçaments individuals; no imposa una manera de viatjar.
- Web responsive accessible des de mòbil per URL pública. Offline selectiu previst, especialment consulta de dades pràctiques i càrrega de material.
- Tresoreria: registre intern de cobraments/despeses per concert i generals; sense emissió de factures.

## Primer lliurable implementat

Accés amb Supabase quan està configurat; demo local si no. Llista i calendari; crear, editar i eliminar concerts; fitxa amb acord, contactes, horaris, logística, hospitalitat, documents com a enllaços/estat, setlist, material marcable, acreditacions i imports-resum; pendents derivats. RLS de banda a la migració SQL.

## Següents lliurables

1. Documents reutilitzables de la banda i pujada segura de fitxers.
2. Registre de moviments econòmics (per concert i generals) i inventari/vendes de marxandatge; substituir imports-resum per càlculs, sense duplicar ingressos.
3. PWA amb dades de concerts disponibles offline, cua de canvis del material i indicació de sincronització; resoldre canvis simultanis al mateix element.
4. Comptes individuals, invitacions i permisos si l'ús real ho justifica.

No representar les funcions dels següents lliurables com si ja estiguessin acabades.
