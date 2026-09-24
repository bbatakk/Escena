# Domini i regles del concert

## Fitxa

`Concert` té id, títol, data, estat, ubicació i catxet acordat/cobrat. `ConcertDetails` conté les dades opcionals: acord, contacte, equip, horaris, logística, hospitalitat, documents, setlist, material, passis, imports de tancament i notes. Definicions TypeScript: `src/model.ts`.

Estats del concert: **en converses → reservat → confirmat → realitzat**, amb **cancel·lat** com a sortida possible. L'usuari tria l'estat; «realitzat» no implica «cobrat».

Sopar/allotjament: **pendent de saber / sí / no**. Un «sí» sense detalls és informació incompleta; un «no» no és un pendent. Documents: direcció **enviar/rebre** i estat **pendent/fet/no cal**. L'enllaç, quan existeix, és a un fitxer allotjat en un servei extern; «fet» és una confirmació de la banda, no una comprovació automàtica de lliurament.

Un document també pot tenir `storagePath` i `fileName`: el fitxer és al bucket privat `concert-documents` sota `band_id/concert_id/document_id/`. Una URL temporal signada permet obrir-lo només després d'autenticar-se. Pujar un fitxer no equival a enviar-lo o rebre'l; els pendents segueixen derivant-se de l'estat del document. La pujada només es fa després de desar la fitxa.

`BandDocument` és un recurs reutilitzable de la banda (nom, enllaç i/o fitxer privat); els seus fitxers viuen a `band_id/shared/document_id/`. Incorporar-lo a un concert en copia les referències i en crea una entrada amb estat propi, inicialment «pendent d'enviar». Els fitxers compartits no s'eliminen quan es treu l'entrada d'un concert; arxivar el recurs tampoc no invalida concerts previs. Si el recurs se substitueix, les fitxes anteriors conserven la versió anterior.

Horaris: entrades lliures amb hora, nom i lloc; no hi ha una seqüència fixa. Material: entrades del concert amb `loaded` per fer la comprovació física de càrrega.

## Pendents derivats

`getPending(concert)` és l'única font de veritat d'aquesta primera versió. Mostra: reserva sense confirmar; concert confirmat sense sala ni adreça; sopar/allotjament indicats com a «sí» sense detalls; documents amb nom i estat pendent; concert realitzat amb catxet cobrat inferior al pactat. Un concert cancel·lat no mostra pendents. Cap altre camp buit genera un avís per defecte. Els pendents desapareixen en actualitzar les dades, sense caselles manuals.

## Persistència actual

En Supabase, columnes per dades identificatives i econòmiques bàsiques; `details` JSONB per dades opcionals de la fitxa. Aquesta decisió afavoreix iterar la fitxa durant la prova inicial; abans d'afegir informes/inventari compartit es normalitzaran les dades transaccionals. `band_members` vincula cada compte a una banda i RLS impedeix llegir o editar concerts d'altres bandes.

`updated_at` protegeix l'edició simultània: si una fitxa ha canviat en un altre dispositiu, es rebutja desar una còpia antiga en comptes de sobreescriure-la silenciosament.
